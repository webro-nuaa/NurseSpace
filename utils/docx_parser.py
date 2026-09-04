"""Word 文档解析器：解析智慧化护理实践教学案例。

解析按【】结构标记驱动，语义同 HTML 标签：标记可出现在段落内任意
位置（独占一段、粘在内容首尾、多对挤在一段均可识别），段落不是结构
边界 —— 每个段落先切分为 标记/文本 令牌流，再交给状态机处理。

标记全集见 STRUCTURE_MARKERS（与 utils/docx_exporter.py 生成的格式
对应），导出 → 导入可无损往返。
"""
import os
import re

from docx import Document

from models import Case, Station, StandardAnswer, CaseCategory, db

# 结构标记全集（单一事实来源，检查脚本同样引用）
STRUCTURE_MARKERS = (
    '案例指引', '案例指引结尾',
    '站点', '站点结尾',
    '考核任务', '考核任务结尾',
    '病情汇报', '病情汇报结尾',
    '问题', '问题结尾',
    '回答', '回答结尾',
    '项', '项结尾',
    '知识拓展', '知识拓展结尾',
)
_MARKER_PATTERN = re.compile(r'(【(?:%s)】)' % '|'.join(STRUCTURE_MARKERS))
_MARKER_SET = frozenset('【%s】' % name for name in STRUCTURE_MARKERS)

# 解析产物中最多保留多少条游离文本样例（超出只计数）
_DROPPED_SAMPLE_LIMIT = 20


class _StructureStateMachine:
    """【】结构标记状态机：接收 标记/文本 令牌流，产出结构化内容。

    与旧的逐段全等匹配解析相比，语义保持一致，另有两处明确改进：

    1. 容错归属：站点经【站点结尾】闭合后仍保持可归属，直到遇到
       【站点】/【知识拓展】/【案例指引】才清除 —— 紧跟在站点块外的
       问答、考核任务归属到最近的站点（肿瘤模块等文件的常见写法）。
       归属遵循"先到先得"：不覆盖块内已设置的问题/任务。
    2. 知识问答在【知识拓展结尾】处即定稿并清空缓存，修复旧实现中
       文档以知识拓展结尾时同一问答被重复收录的缺陷。

    标记结构之外的文本（如页眉残片）会被忽略，计入 dropped 供检查
    脚本向作者提示。
    """

    def __init__(self):
        self.content = {
            'case_guide': '',
            'stations': [],
            'extended_knowledge': [],
            'dropped': {'count': 0, 'samples': []},
        }
        self.section = None           # 当前接收文本的区块
        self.buffer = []              # 当前区块的文本缓冲
        self.station = None           # 当前归属站点（闭合后仍保持）
        self.station_pending = False  # 该站点是否尚未收入结果列表
        self.knowledge = None         # 当前知识问答对象
        self.in_answer = False        # 是否处于【回答】区块内
        self.in_knowledge = False     # 是否处于【知识拓展】区块内
        self.seen_structure = False   # 是否已出现首个结构标记

    # ---- 令牌入口 ----

    def feed_marker(self, marker):
        if marker == '【案例指引】':
            self._close_station()
            self.station = None
            self.section = 'case_guide'
            self.buffer = []
        elif marker == '【案例指引结尾】':
            self.content['case_guide'] = '\n'.join(self.buffer)
            self.section = None
        elif marker == '【站点】':
            self._close_station()
            self.station = None
            self.section = 'station_name'
        elif marker == '【站点结尾】':
            self._close_station()
            self.section = None
            # self.station 保持引用：站点块外紧跟的问答仍归属该站点，
            # 直到下一个结构性标记（【站点】/【知识拓展】/【案例指引】）清除
        elif marker == '【考核任务】':
            self.section = 'assessment_task'
            self.buffer = []
        elif marker == '【考核任务结尾】':
            if self.station is not None and (
                    self.station_pending or not self.station['assessment_task']):
                self.station['assessment_task'] = '\n'.join(self.buffer)
            self.section = None
        elif marker == '【病情汇报】':
            self.section = 'condition_report'
            self.buffer = []
        elif marker == '【病情汇报结尾】':
            if self.station is not None and (
                    self.station_pending or not self.station['condition_report']):
                self.station['condition_report'] = '\n'.join(self.buffer)
            self.section = None
        elif marker == '【问题】':
            if self.in_knowledge:
                self._flush_knowledge(keep_answer_only=True)
                self.knowledge = {'question': '', 'answer': ''}
            self.section = 'question'
            self.buffer = []
        elif marker == '【问题结尾】':
            if self.station is not None and (
                    self.station_pending or not self.station['question']):
                # 站点内多个【问题】块时后者覆盖（旧语义）；块外归属时先到先得
                self.station['question'] = '\n'.join(self.buffer)
            elif self.knowledge is not None:
                self.knowledge['question'] = '\n'.join(self.buffer)
            self.section = None
        elif marker == '【回答】':
            self.section = 'answer'
            self.in_answer = True
            self.buffer = []
        elif marker == '【回答结尾】':
            if self.knowledge is not None:
                self.knowledge['answer'] = '\n'.join(self.buffer)
            self.section = None
            self.in_answer = False
        elif marker == '【项】':
            self.section = 'answer_item'
            self.buffer = []
        elif marker == '【项结尾】':
            if self.in_knowledge and self.knowledge is not None:
                answer_text = '\n'.join(self.buffer).strip()
                if answer_text:
                    self.knowledge.setdefault('items', []).append(answer_text)
            elif self.station is not None and self.in_answer:
                answer_text = '\n'.join(self.buffer).strip()
                if answer_text:
                    self.station['answers'].append(answer_text)
            self.section = 'answer'  # 返回回答区域
        elif marker == '【知识拓展】':
            self.section = 'extended_knowledge'
            self.in_knowledge = True
            self.station = None  # 站点归属到此为止，之后的问答归知识拓展
            self._flush_knowledge()
            self.knowledge = None
        elif marker == '【知识拓展结尾】':
            self._flush_knowledge()
            self.knowledge = None  # 定稿即清空，避免 EOF 重复收录
            self.section = None
            self.in_knowledge = False
        self.seen_structure = True

    def feed_text(self, text):
        if self.section == 'case_guide':
            self.buffer.append(text)
        elif self.section == 'station_name':
            if self.station is None:
                self.station = {
                    'name': text,
                    'assessment_task': '',
                    'condition_report': '',
                    'question': '',
                    'answers': [],
                }
                self.station_pending = True
            self.section = None
        elif self.section in ('assessment_task', 'condition_report',
                              'question', 'answer', 'answer_item'):
            self.buffer.append(text)
        elif self.section == 'extended_knowledge':
            # 知识拓展区裸文本：收上一个成型问答并开启新对象
            self._flush_knowledge()
            self.knowledge = {'question': '', 'answer': ''}
        elif self.seen_structure:
            # 标记结构之外的文本被忽略（标题区文本不计，见 seen_structure）
            dropped = self.content['dropped']
            dropped['count'] += 1
            if len(dropped['samples']) < _DROPPED_SAMPLE_LIMIT:
                dropped['samples'].append(text[:40])

    def finish(self):
        """文档结束：收入未闭合的站点与知识问答，返回解析产物。"""
        self._close_station()
        self._flush_knowledge()
        return self.content

    # ---- 内部 ----

    def _close_station(self):
        """把未入库的站点收入列表；已入库的不重复收。"""
        if self.station is not None and self.station_pending:
            self.content['stations'].append(self.station)
            self.station_pending = False

    def _flush_knowledge(self, keep_answer_only=False):
        """把成型的知识问答收入列表。

        默认要求已有问题；keep_answer_only 表示仅凭回答也收
        （【问题】分支的旧语义：上一问仅作答未提问时保留）。
        """
        k = self.knowledge
        if k is None:
            return
        if k.get('question') or (keep_answer_only and k.get('answer')):
            self.content['extended_knowledge'].append(k)


class DocxParser:
    """Word文档解析器，用于解析智慧化护理实践教学案例"""

    def __init__(self):
        self.current_case = None
        self.current_station = None

    def parse_file(self, file_path):
        """解析Word文档并保存到数据库"""
        try:
            # 从文件名提取类别和案例名称
            filename = os.path.basename(file_path)
            category_match = re.search(r'【(.+?)】', filename)
            if not category_match:
                raise ValueError(f"无法从文件名提取类别：{filename}")

            category_name = category_match.group(1)
            case_title = filename.replace(f'【{category_name}】', '').replace('.docx', '')

            # 获取或创建类别
            category = CaseCategory.query.filter_by(name=category_name).first()
            if not category:
                category = CaseCategory(name=category_name, description=f"{category_name}相关医疗案例")
                db.session.add(category)
                db.session.flush()

            # 检查案例是否已存在
            existing_case = Case.query.filter_by(title=case_title, category_id=category.id).first()
            if existing_case:
                return existing_case

            # 读取Word文档
            doc = Document(file_path)

            # 解析文档内容
            case_data = self._parse_document_content(doc)

            # 创建案例
            case = Case(
                category_id=category.id,
                title=case_title,
                case_guide=case_data.get('case_guide', ''),
            )
            db.session.add(case)
            db.session.flush()

            # 创建站点和答案
            for i, station_data in enumerate(case_data.get('stations', [])):
                station = Station(
                    case_id=case.id,
                    name=station_data.get('name', ''),
                    assessment_task=station_data.get('assessment_task', ''),
                    condition_report=station_data.get('condition_report', '') or None,
                    question=station_data.get('question', ''),
                    order_index=i
                )
                db.session.add(station)
                db.session.flush()

                # 创建标准答案
                for i, answer_item in enumerate(station_data.get('answers', [])):
                    answer = StandardAnswer(
                        station_id=station.id,
                        answer_item=answer_item,
                        order_index=i
                    )
                    db.session.add(answer)

            # 创建扩展知识（作为 knowledge 类型的 Station）
            for knowledge_data in case_data.get('extended_knowledge', []):
                sk = Station(
                    case_id=case.id,
                    question=knowledge_data.get('question', ''),
                    station_type='knowledge',
                    order_index=0
                )
                db.session.add(sk)
                db.session.flush()
                items = knowledge_data.get('items', [])
                if not items:
                    items = [knowledge_data.get('answer', '')]
                for i, item_text in enumerate(items):
                    if item_text.strip():
                        sa = StandardAnswer(
                            station_id=sk.id,
                            answer_item=item_text,
                            order_index=i
                        )
                        db.session.add(sa)

            db.session.commit()
            return case

        except Exception as e:
            db.session.rollback()
            raise Exception(f"解析文档失败：{str(e)}")

    def _parse_document_content(self, doc):
        """解析文档内容结构 —— 标记分词引擎。

        每个段落先切分为 标记/文本 令牌流（标记可出现在段落内任意
        位置），再交由 _StructureStateMachine 按结构语义处理。
        """
        machine = _StructureStateMachine()
        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                continue
            for part in _MARKER_PATTERN.split(text):
                if not part:
                    continue
                if part in _MARKER_SET:
                    machine.feed_marker(part)
                else:
                    stripped = part.strip()
                    if stripped:
                        machine.feed_text(stripped)
        return machine.finish()

    def batch_parse_directory(self, directory_path):
        """批量解析目录下的所有Word文档"""
        results = []
        errors = []

        for filename in os.listdir(directory_path):
            if filename.endswith('.docx') and not filename.startswith('~'):
                file_path = os.path.join(directory_path, filename)
                try:
                    case = self.parse_file(file_path)
                    results.append({
                        'filename': filename,
                        'case_id': case.id,
                        'case_title': case.title,
                        'status': 'success'
                    })
                except Exception as e:
                    errors.append({
                        'filename': filename,
                        'error': str(e),
                        'status': 'error'
                    })

        return {
            'success_count': len(results),
            'error_count': len(errors),
            'results': results,
            'errors': errors
        }
