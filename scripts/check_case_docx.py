"""案例 docx 合规检查（dry-run，不写数据库）。

使用与系统导入完全相同的标记分词解析器（utils.docx_parser）对案例
目录中所有 docx 逐个体检。系统支持两类合法内容：

- 考核型：【站点】块 → assessment 站点（需有问题与标准答案才能评分）
- 知识型：【知识拓展】问答 → knowledge 站点（合法案例形态）

检查项：
- 文件名缺【类别】标记（导入无法归类）
- 文件名疑似重复副本（_1 / (1) 变体，导入会生成重复案例）
- 文档损坏 / 无法打开
- 缺【案例指引】或内容为空
- 考核站点缺【问题】或标准答案（导入后无法评分）
- 知识问答缺问题或缺回答
- 解析产物中残留未消化的标记字符（分词引擎失效信号）
- 既无站点也无知识问答（导入后无任何考核内容）
- 标记结构之外的游离文本（会被解析器忽略，列出样例供作者修正）

用法（容器内）：
    python3 scripts/check_case_docx.py [目录，默认 /app/案例]
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from docx import Document

from utils.docx_parser import DocxParser

# 文件名重复副本：xxx_1.docx、xxx_1(1).docx、xxx(1).docx
_DUP_PATTERN = re.compile(r'(?:_\d+|\(\d+\))+\.docx$')


def check_file(path):
    """检查单个 docx，返回问题列表与统计信息。"""
    filename = os.path.basename(path)
    if not re.search(r'【.+?】', filename):
        return {'filename': filename,
                'issues': ['文件名缺【类别】标记，导入无法归类'], 'stats': None}

    issues = []
    if _DUP_PATTERN.search(filename):
        issues.append('文件名疑似重复副本（_1/(1) 变体），导入会生成重复案例')

    try:
        doc = Document(path)
    except Exception as e:  # noqa: BLE001 - 报告全部损坏原因
        return {'filename': filename, 'issues': issues + [f'文档无法打开：{e}'],
                'stats': None}

    data = DocxParser()._parse_document_content(doc)

    if not data.get('case_guide'):
        issues.append('缺【案例指引】或内容为空')

    stations = data.get('stations', [])
    for i, station in enumerate(stations, 1):
        name = station.get('name') or f'站点{i}'
        if not station.get('question'):
            issues.append(f'考核站点[{name}] 缺【问题】，导入后无法评分')
        if not station.get('answers'):
            issues.append(f'考核站点[{name}] 无标准答案（缺【项】）')

    knowledge = data.get('extended_knowledge', [])
    for j, kb in enumerate(knowledge, 1):
        if not kb.get('question'):
            issues.append(f'知识问答{j} 缺【问题】')
        elif not (kb.get('items') or kb.get('answer')):
            issues.append(f'知识问答{j}（{kb["question"][:20]}）缺【回答】')

    # 分词引擎失效信号：正常解析产物中不应残留任何标记字符
    junk = [a for s in stations for a in s.get('answers', []) if '【' in a]
    junk += [k['answer'] for k in knowledge if '【' in k.get('answer', '')]
    junk += [item for k in knowledge for item in k.get('items', []) if '【' in item]
    if junk:
        issues.append(f'{len(junk)} 条答案内容残留标记字符'
                      f'（样例: {junk[0][:40]}）')

    if not stations and not knowledge:
        issues.append('既无【站点】块也无【知识拓展】问答，导入后无任何考核内容')

    dropped = data.get('dropped') or {}
    if dropped.get('count'):
        samples = dropped.get('samples') or []
        sample = f'，样例: {samples[0]}…' if samples else ''
        issues.append(f"{dropped['count']} 行标记结构外的游离文本会被忽略{sample}")

    stats = {'stations': len(stations), 'knowledge': len(knowledge),
             'guide_len': len(data.get('case_guide', ''))}
    return {'filename': filename, 'issues': issues, 'stats': stats}


def main():
    target_dir = sys.argv[1] if len(sys.argv) > 1 else '/app/案例'
    if not os.path.isdir(target_dir):
        print(f'目录不存在：{target_dir}')
        sys.exit(1)

    files = sorted(
        f for f in os.listdir(target_dir)
        if f.lower().endswith('.docx') and not f.startswith('~')
    )
    print(f'检查目录：{target_dir}，共 {len(files)} 个 docx\n' + '=' * 60)

    ok_count = 0
    for fname in files:
        result = check_file(os.path.join(target_dir, fname))
        if result['issues']:
            print(f'\n✗ {fname}')
            for issue in result['issues']:
                print(f'    - {issue}')
        else:
            ok_count += 1

    print('\n' + '=' * 60)
    print(f'总计 {len(files)} 个文件：合规 {ok_count} 个，存在问题 {len(files) - ok_count} 个')


if __name__ == '__main__':
    main()
