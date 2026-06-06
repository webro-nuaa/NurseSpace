import re
from docx import Document
from models import Case, Station, StandardAnswer, CaseCategory, db
import os

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
        """解析文档内容结构 - 支持新的【】标记格式"""
        content = {
            'case_guide': '',
            'stations': [],
            'extended_knowledge': []
        }
        
        current_section = None
        current_station = None
        current_knowledge = None
        current_question = None
        text_buffer = []
        in_answer_section = False
        in_knowledge_section = False
        
        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                continue
            
            # 识别【案例指引】
            if text == '【案例指引】':
                current_section = 'case_guide'
                text_buffer = []
                continue
            elif text == '【案例指引结尾】':
                content['case_guide'] = '\n'.join(text_buffer)
                current_section = None
                continue
            
            # 识别【站点】
            elif text == '【站点】':
                if current_station:
                    content['stations'].append(current_station)
                current_station = None
                current_section = 'station_name'
                continue
            elif text == '【站点结尾】':
                if current_station:
                    content['stations'].append(current_station)
                current_station = None
                current_section = None
                continue
            
            # 识别【考核任务】
            elif text == '【考核任务】':
                current_section = 'assessment_task'
                text_buffer = []
                continue
            elif text == '【考核任务结尾】':
                if current_station:
                    current_station['assessment_task'] = '\n'.join(text_buffer)
                current_section = None
                continue

            # 识别【病情汇报】
            elif text == '【病情汇报】':
                current_section = 'condition_report'
                text_buffer = []
                continue
            elif text == '【病情汇报结尾】':
                if current_station:
                    current_station['condition_report'] = '\n'.join(text_buffer)
                current_section = None
                continue
            
            # 识别【问题】
            elif text == '【问题】':
                # 如果在知识拓展区，遇到新的问题，先把上一个知识点（若已成型）入库
                if in_knowledge_section:
                    if current_knowledge and (current_knowledge.get('question') or current_knowledge.get('answer')):
                        content['extended_knowledge'].append(current_knowledge)
                    current_knowledge = {'question': '', 'answer': ''}
                current_section = 'question'
                text_buffer = []
                continue
            elif text == '【问题结尾】':
                if current_station and current_question is None:
                    # 第一个问题作为站点问题
                    current_station['question'] = '\n'.join(text_buffer)
                elif current_knowledge:
                    # 知识扩展问题
                    current_knowledge['question'] = '\n'.join(text_buffer)
                current_section = None
                continue
            
            # 识别【回答】
            elif text == '【回答】':
                current_section = 'answer'
                in_answer_section = True
                text_buffer = []
                continue
            elif text == '【回答结尾】':
                if current_knowledge is not None:
                    current_knowledge['answer'] = '\n'.join(text_buffer)
                current_section = None
                in_answer_section = False
                continue
            
            # 识别【项】
            elif text == '【项】':
                current_section = 'answer_item'
                text_buffer = []
                continue
            elif text == '【项结尾】':
                if in_knowledge_section and current_knowledge is not None:
                    answer_text = '\n'.join(text_buffer).strip()
                    if answer_text:
                        current_knowledge.setdefault('items', []).append(answer_text)
                elif current_station and in_answer_section:
                    answer_text = '\n'.join(text_buffer).strip()
                    if answer_text:
                        current_station['answers'].append(answer_text)
                current_section = 'answer'  # 返回到回答区域
                continue
            
            # 识别【知识拓展】
            elif text == '【知识拓展】':
                current_section = 'extended_knowledge'
                in_knowledge_section = True
                # 开启知识拓展块时清空当前knowledge缓存
                if current_knowledge and current_knowledge.get('question'):
                    content['extended_knowledge'].append(current_knowledge)
                current_knowledge = None
                continue
            elif text == '【知识拓展结尾】':
                if current_knowledge and current_knowledge.get('question'):
                    content['extended_knowledge'].append(current_knowledge)
                current_section = None
                in_knowledge_section = False
                continue
            
            # 处理具体内容
            if current_section == 'case_guide':
                text_buffer.append(text)
            
            elif current_section == 'station_name':
                if not current_station:
                    current_station = {
                        'name': text,
                        'assessment_task': '',
                        'condition_report': '',
                        'question': '',
                        'answers': []
                    }
                current_section = None

            elif current_section == 'assessment_task':
                text_buffer.append(text)

            elif current_section == 'condition_report':
                text_buffer.append(text)

            elif current_section == 'question':
                # 如果在知识拓展区，首次遇到问题时初始化当前知识对象
                if in_knowledge_section and current_knowledge is None:
                    current_knowledge = {'question': '', 'answer': ''}
                text_buffer.append(text)
            
            elif current_section == 'answer':
                text_buffer.append(text)

            elif current_section == 'answer_item':
                text_buffer.append(text)

            elif current_section == 'extended_knowledge':
                # 遇到问题时，保存之前的知识点
                if current_knowledge and current_knowledge.get('question'):
                    content['extended_knowledge'].append(current_knowledge)
                current_knowledge = {'question': '', 'answer': ''}
        
        # 保存最后的站点和扩展知识
        if current_station:
            content['stations'].append(current_station)
        
        if current_knowledge and current_knowledge.get('question'):
            content['extended_knowledge'].append(current_knowledge)
        
        return content
    
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
