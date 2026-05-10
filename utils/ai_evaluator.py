import json
import re
from config import Config
from models import AiSetting
from utils.crypto import decrypt_value
try:
    import openai
except ImportError:
    openai = None
try:
    from zhipuai import ZhipuAI
except ImportError:
    ZhipuAI = None

class AIEvaluator:
    """AI评分器，用于评估护士答案"""
    
    def __init__(self):
        import logging
        self._logger = logging.getLogger(__name__)
        if Config.OPENAI_API_KEY:
            openai.api_key = Config.OPENAI_API_KEY
        else:
            self._logger.warning("未设置OPENAI_API_KEY，AI评分功能将无法使用")
    
    def evaluate_answer(self, question, user_answer, standard_answers):
        """
        评估用户答案
        
        Args:
            question: 问题文本
            user_answer: 用户答案
            standard_answers: 标准答案列表 [{answer_item: str, score_weight: float}, ...]
        
        Returns:
            dict: {
                'score': float,  # 得分 (0-100)
                'max_score': float,  # 满分
                'feedback': str,  # 详细反馈
                'covered_points': list,  # 覆盖的得分点
                'missed_points': list   # 遗漏的得分点
            }
        """
        # 读取数据库配置，支持运行期切换
        provider = None
        zhipu_key = None
        zhipu_model = None
        zhipu_base_url = None
        openai_key = None
        openai_base_url = None

        try:
            setting = AiSetting.get_singleton()

            provider = (setting.provider or '').lower()
            zhipu_key = decrypt_value(setting.zhipu_key) or getattr(Config, 'ZHIPU_API_KEY', None)
            zhipu_model = setting.zhipu_model or getattr(Config, 'ZHIPU_MODEL', 'glm-4-air')
            zhipu_base_url = setting.zhipu_base_url or None
            openai_key = decrypt_value(setting.openai_key) or getattr(Config, 'OPENAI_API_KEY', None)
            openai_model = setting.openai_model or getattr(Config, 'OPENAI_MODEL', 'gpt-4o-mini')
            openai_base_url = setting.openai_base_url or None

        except Exception:
            provider = None
            zhipu_key = getattr(Config, 'ZHIPU_API_KEY', None)
            zhipu_model = getattr(Config, 'ZHIPU_MODEL', 'glm-4-air')
            openai_key = getattr(Config, 'OPENAI_API_KEY', None)
            openai_model = getattr(Config, 'OPENAI_MODEL', 'gpt-4o-mini')

        # 优先根据 provider 选择
        if (provider == 'glm' or (provider is None and zhipu_key)) and ZhipuAI is not None and zhipu_key:
            try:
                return self._evaluate_with_glm(question, user_answer, standard_answers, zhipu_key, zhipu_model, zhipu_base_url)
            except Exception as e:
                self._logger.warning("GLM评分出错：%s，降级使用其他方式", str(e))

        if not openai_key or openai is None:
            # 如果没有配置模型，使用简单的文本匹配评分
            return self._simple_text_matching(question, user_answer, standard_answers)
        
        try:
            # 构建标准答案文本
            standard_text = "\n".join([
                f"{i+1}. {ans['answer_item']} (权重: {ans['score_weight']})"
                for i, ans in enumerate(standard_answers)
            ])
            
            # 构建评分提示
            prompt = f"""
作为一名医疗教育专家，请评估以下护士的答案。

问题：
{question}

标准答案要点：
{standard_text}

护士的答案：
{user_answer}

请按照以下JSON格式返回评估结果：
{{
    "score": 分数(0-100),
    "feedback": "详细的评价反馈，包括做得好的地方和需要改进的地方",
    "covered_points": ["覆盖的要点1", "覆盖的要点2"],
    "missed_points": ["遗漏的要点1", "遗漏的要点2"],
    "suggestions": "改进建议",
    "reason": "评分理由或依据（说明为何给出该分数）"
}}

评分标准：
1. 完全覆盖所有要点：90-100分
2. 覆盖大部分要点，表述准确：80-89分
3. 覆盖部分要点，表述基本正确：70-79分
4. 覆盖少数要点，或表述不够准确：60-69分
5. 答案不正确或严重遗漏：0-59分

请严格只返回JSON，不要包含任何额外文字或代码块标记。
"""
            
            openai.api_key = openai_key
            if openai_base_url:
                openai.api_base = openai_base_url
            model_name = openai_model
            response = openai.ChatCompletion.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "你是一名专业的医疗教育评估专家，专门负责评估护理实践教学答案。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1000,
                temperature=0.3
            )
            
            result_text = response.choices[0].message.content.strip()
            # 更健壮的解析
            result = self._try_parse_json(result_text)
            if result is None:
                score_match = re.search(r'\b(\d{1,3})\b', result_text)
                score = int(score_match.group(1)) if score_match else 60
                result = {
                    'score': score,
                    'feedback': '模型返回非标准JSON，已采用默认分数',
                    'covered_points': [],
                    'missed_points': [],
                    'suggestions': '',
                    'reason': ''
                }
            
            # 满分统一为 100（AI 按 0-100 评分，权重仅用于相对重要性）
            max_score = 100.0

            return {
                'score': min(100, max(0, float(result.get('score', 60)))),
                'max_score': max_score,
                'feedback': result.get('feedback', ''),
                'covered_points': result.get('covered_points', []),
                'missed_points': result.get('missed_points', []),
                'suggestions': result.get('suggestions', ''),
                'reason': result.get('reason', '')
            }
            
        except Exception as e:
            self._logger.warning("AI评分出错：%s", str(e))
            # 降级到简单文本匹配
            return self._simple_text_matching(question, user_answer, standard_answers)
    
    def _simple_text_matching(self, question, user_answer, standard_answers):
        """简单的文本匹配评分算法"""
        if not user_answer or not user_answer.strip():
            return {
                'score': 0,
                'max_score': 100,
                'feedback': '未提供答案',
                'covered_points': [],
                'missed_points': [ans['answer_item'] for ans in standard_answers],
                'suggestions': '请根据标准答案要点进行回答。'
            }
        
        user_answer = user_answer.lower().strip()
        covered_points = []
        missed_points = []
        total_weight = 0
        covered_weight = 0
        
        for answer in standard_answers:
            answer_text = answer['answer_item'].lower()
            weight = float(answer['score_weight'])
            total_weight += weight
            
            # 简单的关键词匹配
            keywords = re.findall(r'\b\w+\b', answer_text)
            matching_keywords = [kw for kw in keywords if kw in user_answer and len(kw) > 2]
            
            if len(matching_keywords) >= max(1, len(keywords) * 0.3):  # 匹配30%以上关键词
                covered_points.append(answer['answer_item'])
                covered_weight += weight
            else:
                missed_points.append(answer['answer_item'])
        
        # 计算分数
        if total_weight > 0:
            score = (covered_weight / total_weight) * 100
        else:
            score = 50  # 默认分数
        
        # 生成反馈
        if score >= 80:
            feedback = "答案较为完整，涵盖了大部分关键要点。"
        elif score >= 60:
            feedback = "答案涵盖了部分要点，但还有改进空间。"
        else:
            feedback = "答案需要进一步完善，遗漏了重要要点。"
        
        return {
            'score': min(100, max(0, score)),
            'max_score': 100,
            'feedback': feedback,
            'covered_points': covered_points,
            'missed_points': missed_points,
            'suggestions': '请对照标准答案，补充遗漏的要点。'
        }

    # ============== GLM 接入 ==============
    def _evaluate_with_glm(self, question, user_answer, standard_answers, api_key, model_name, base_url=None):
        """使用智谱 GLM 进行评分"""

        client_kwargs = {'api_key': api_key}
        if base_url:
            client_kwargs['base_url'] = base_url
        client = ZhipuAI(**client_kwargs)
        standard_text = "\n".join([
            f"{i+1}. {ans['answer_item']} (权重: {ans['score_weight']})"
            for i, ans in enumerate(standard_answers)
        ])

        prompt = f"""
你是一名医疗教育评估专家。请对护士的答案进行评分。

问题：\n{question}
标准答案要点：\n{standard_text}
护士的答案：\n{user_answer}

请输出严格JSON：
{{
  "score": 分数(0-100),
  "feedback": "文字反馈",
  "covered_points": ["覆盖要点1", "覆盖要点2"],
  "missed_points": ["遗漏要点1"],
  "suggestions": "改进建议",
  "reason": "评分理由或依据（说明为何给出该分数）"
}}
"""

        resp = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "你是严谨的医疗教育评估专家"},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
        )
        
        # 兼容SDK返回的多种结构（CompletionMessage对象或dict，content为str或list）
        content = ''
        try:
            msg = getattr(resp.choices[0], 'message', None) or resp.choices[0].get('message')
            raw_content = getattr(msg, 'content', None) if msg is not None else resp.choices[0].get('content')
            if isinstance(raw_content, str):
                content = raw_content
            elif isinstance(raw_content, list):
                # 智谱可能返回[{"type":"text","text":"..."}] 格式
                parts = []
                for seg in raw_content:
                    if isinstance(seg, dict):
                        parts.append(seg.get('text', '') or seg.get('content', '') or '')
                    else:
                        parts.append(str(seg))
                content = ''.join(parts)
            else:
                content = str(raw_content)
        except Exception:
            content = ''
        data = self._try_parse_json(content)
        if data is None:
            data = { 'score': 60, 'feedback': '模型返回非标准JSON，已采用默认分数', 'covered_points': [], 'missed_points': [], 'suggestions': '', 'reason': '' }

        max_score = 100.0
        return {
            'score': min(100, max(0, float(data.get('score', 60)))),
            'max_score': max_score,
            'feedback': data.get('feedback', ''),
            'covered_points': data.get('covered_points', []),
            'missed_points': data.get('missed_points', []),
            'suggestions': data.get('suggestions', ''),
            'reason': data.get('reason', '')
        }

    # -------- JSON 解析容错工具 --------
    def _try_parse_json(self, text: str):
        if not text:
            return None
        candidates = [text, self._strip_fences(text), self._extract_json_object(text)]
        for cand in candidates:
            try:
                if cand:
                    return json.loads(cand)
            except Exception:
                continue
        return None

    @staticmethod
    def _strip_fences(text: str) -> str:
        t = text.strip()
        if t.startswith('```') and t.endswith('```'):
            inner = t[3:-3]
            inner = re.sub(r'^json\n', '', inner, flags=re.IGNORECASE)
            return inner.strip()
        return t

    @staticmethod
    def _extract_json_object(text: str) -> str:
        start = text.find('{')
        if start == -1:
            return ''
        stack = 0
        in_str = False
        escape = False
        for i in range(start, len(text)):
            ch = text[i]
            if ch == '"' and not escape:
                in_str = not in_str
            if not in_str:
                if ch == '{':
                    stack += 1
                elif ch == '}':
                    stack -= 1
                    if stack == 0:
                        return text[start:i+1]
            escape = (ch == '\\' and not escape)
        return ''
    
    def analyze_weakness(self, user_id, wrong_questions_data):
        """
        分析用户薄弱点
        
        Args:
            user_id: 用户ID
            wrong_questions_data: 错题数据 [{'category': str, 'question': str, 'score': float}, ...]
        
        Returns:
            dict: 薄弱点分析报告
        """
        # 读取数据库配置，支持运行期切换
        provider = None
        zhipu_key = None
        zhipu_model = None
        openai_key = None

        try:
            setting = AiSetting.get_singleton()
            provider = (setting.provider or '').lower()
            zhipu_key = decrypt_value(setting.zhipu_key) or getattr(Config, 'ZHIPU_API_KEY', None)
            zhipu_model = setting.zhipu_model or getattr(Config, 'ZHIPU_MODEL', 'glm-4-air')
            openai_key = decrypt_value(setting.openai_key) or getattr(Config, 'OPENAI_API_KEY', None)
        except Exception:
            provider = None
            zhipu_key = getattr(Config, 'ZHIPU_API_KEY', None)
            zhipu_model = getattr(Config, 'ZHIPU_MODEL', 'glm-4-air')
            openai_key = getattr(Config, 'OPENAI_API_KEY', None)

        # 若完全缺少可用大模型，fallback
        if not ((ZhipuAI is not None and zhipu_key) or (openai is not None and openai_key)):
            return self._simple_weakness_analysis(wrong_questions_data)
        
        try:
            # 统计错题分布
            category_stats = {}
            for item in wrong_questions_data:
                category = item['category']
                if category not in category_stats:
                    category_stats[category] = {'count': 0, 'total_score': 0}
                category_stats[category]['count'] += 1
                category_stats[category]['total_score'] += item['score']
            
            # 构建分析提示：总体统计
            stats_text = "\n".join([
                f"{cat}: {data['count']}道错题，平均分{data['total_score']/data['count']:.1f}"
                for cat, data in category_stats.items()
            ])
            
            # 构建样例明细：包含题干、我的作答、标准答案与历史反馈，帮助模型做内容驱动的诊断
            detailed_items = []
            for item in wrong_questions_data[:10]:  # 控制长度，避免超长上下文
                category = item.get('category', '')
                case_title = item.get('case_title', '')
                station_name = item.get('station_name', '')
                score = item.get('score', '')
                question = (item.get('question') or '')[:800]
                user_answer = (item.get('user_answer') or '')[:800]
                std_answers = item.get('standard_answers') or []
                ai_feedback = (item.get('ai_feedback') or '')[:600]
                answers_text = "\n    - ".join(std_answers) if std_answers else ''
                detailed_items.append(
                    f"[类别]{category} | [案例]{case_title} | [站点]{station_name} | [得分]{score}\n"
                    f"[题干]\n{question}\n"
                    f"[我的作答]\n{user_answer or '（无历史作答记录）'}\n"
                    f"[标准答案要点]\n    - {answers_text if answers_text else '（无标准答案记录）'}\n"
                    f"[以往AI反馈]\n{ai_feedback or '（无AI反馈）'}"
                )
            detailed_items_text = "\n\n".join(detailed_items)
            
            prompt = f"""
你是一名严谨的医疗教育分析师。请基于“题目内容与该护士的真实作答”进行内容驱动的诊断，归纳其系统性问题与知识薄弱环节，并输出可执行的改进建议。

【总体错题统计】
{stats_text}

【错题明细（节选）】
{detailed_items_text}

要求：
- 仅根据上述题干与作答内容进行分析，不要编造题目。
- 识别该护士反复出现的遗漏步骤、概念性误解、要点遗漏与答题结构问题。
- 给出针对性的训练建议与优先加强领域。

请严格输出JSON（不要包含多余文字或代码块标记）：
{{
  "weak_categories": ["薄弱领域1", "薄弱领域2"],
  "main_issues": ["基于内容的主要问题1", "主要问题2"],
  "improvement_suggestions": [
    {{ "category": "对应领域", "suggestion": "具体且可执行的改进建议" }}
  ],
  "study_plan": "1-2段话，给出分阶段的学习与练习路径",
  "priority_areas": ["优先加强领域1", "优先加强领域2"]
}}
"""
            
            # 优先根据 provider 选择 GLM
            if (provider == 'glm' or (provider is None and zhipu_key)) and ZhipuAI is not None and zhipu_key:
                client = ZhipuAI(api_key=zhipu_key)
                resp = client.chat.completions.create(
                    model=zhipu_model,
                    messages=[
                        {"role": "system", "content": "你是一名专业的医疗教育分析师。"},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.3,
                )
                # 解析GLM返回
                content = ''
                try:
                    msg = getattr(resp.choices[0], 'message', None) or resp.choices[0].get('message')
                    raw_content = getattr(msg, 'content', None) if msg is not None else resp.choices[0].get('content')
                    if isinstance(raw_content, str):
                        content = raw_content
                    elif isinstance(raw_content, list):
                        parts = []
                        for seg in raw_content:
                            if isinstance(seg, dict):
                                parts.append(seg.get('text', '') or seg.get('content', '') or '')
                            else:
                                parts.append(str(seg))
                        content = ''.join(parts)
                    else:
                        content = str(raw_content)
                except Exception:
                    content = ''
                try:
                    return json.loads(content)
                except Exception:
                    return self._simple_weakness_analysis(wrong_questions_data)

            # 否则使用 OpenAI
            openai.api_key = openai_key
            if openai_base_url:
                openai.api_base = openai_base_url
            model_name = openai_model
            response = openai.ChatCompletion.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "你是一名专业的医疗教育分析师。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1000,
                temperature=0.3
            )
            result_text = response.choices[0].message.content.strip()
            try:
                return json.loads(result_text)
            except json.JSONDecodeError:
                return self._simple_weakness_analysis(wrong_questions_data)
                
        except Exception as e:
            self._logger.warning("AI薄弱点分析出错：%s", str(e))
            return self._simple_weakness_analysis(wrong_questions_data)
    
    def _simple_weakness_analysis(self, wrong_questions_data):
        """简单的薄弱点分析"""
        if not wrong_questions_data:
            return {
                'weak_categories': [],
                'main_issues': ['暂无错题数据'],
                'improvement_suggestions': [],
                'study_plan': '继续学习新的案例内容',
                'priority_areas': []
            }
        
        # 统计错题最多的类别
        category_count = {}
        for item in wrong_questions_data:
            category = item['category']
            category_count[category] = category_count.get(category, 0) + 1
        
        # 找出错题最多的类别
        weak_categories = sorted(category_count.keys(), key=lambda x: category_count[x], reverse=True)[:3]
        
        return {
            'weak_categories': weak_categories,
            'main_issues': [
                f'{cat}领域答题准确率较低' for cat in weak_categories
            ],
            'improvement_suggestions': [
                {
                    'category': cat,
                    'suggestion': f'建议加强{cat}相关知识的学习和练习'
                } for cat in weak_categories
            ],
            'study_plan': f'重点关注{", ".join(weak_categories)}等领域的知识点，多做相关练习题。',
            'priority_areas': weak_categories[:2]
        }
