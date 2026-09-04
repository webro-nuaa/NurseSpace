"""案例解析快照与回归对比工具。

解析器改动前后的回归验证：dump 用当前解析器对案例目录全部 docx 生成
JSON 基线；compare 重新解析并与基线逐文件逐字段对比，输出差异清单。
基线与对比之间唯一的变量应当是解析器本身。

用法（容器内执行，案例目录默认 /app/案例）：
    python3 scripts/case_parse_snapshot.py dump   <基线文件路径>
    python3 scripts/case_parse_snapshot.py compare <基线文件路径>
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from docx import Document

from utils.docx_parser import DocxParser

# 仅取这三类核心产物作为对比对象，与 parse_file 的消费范围一致
_CONTENT_KEYS = ('case_guide', 'stations', 'extended_knowledge')


def snapshot(directory):
    """用当前解析器解析目录下全部 docx，返回可 JSON 化的精简结构。"""
    parser = DocxParser()
    data = {}
    for name in sorted(os.listdir(directory)):
        if not name.lower().endswith('.docx') or name.startswith('~'):
            continue
        parsed = parser._parse_document_content(
            Document(os.path.join(directory, name)))
        data[name] = {
            'guide': parsed.get('case_guide', ''),
            'stations': [{
                'name': s.get('name', ''),
                'task': s.get('assessment_task', ''),
                'report': s.get('condition_report', '') or '',
                'question': s.get('question', ''),
                'answers': s.get('answers', []),
            } for s in parsed.get('stations', [])],
            'knowledge': [{
                'question': k.get('question', ''),
                'answer': k.get('answer', ''),
                'items': k.get('items', []),
            } for k in parsed.get('extended_knowledge', [])],
        }
    return data


def _preview(value, limit=46):
    text = str(value)
    if len(text) <= limit:
        return repr(text)
    return f'{len(text)}字:{text[:limit]!r}…'


def compare(baseline_path, directory):
    with open(baseline_path, encoding='utf-8') as f:
        baseline = json.load(f)
    current = snapshot(directory)

    changed = 0
    for name in sorted(set(baseline) | set(current)):
        base = baseline.get(name)
        cur = current.get(name)
        if base is None:
            print(f'+ {name}: 基线中不存在（新增文件）')
            changed += 1
            continue
        if cur is None:
            print(f'- {name}: 当前目录中不存在（已删除）')
            changed += 1
            continue
        if base == cur:
            continue
        changed += 1
        print(f'~ {name}')
        if base['guide'] != cur['guide']:
            print(f"    指引: {_preview(base['guide'])} -> {_preview(cur['guide'])}")
        for key, label in (('stations', '站点'), ('knowledge', '知识问答')):
            base_list, cur_list = base[key], cur[key]
            if len(base_list) != len(cur_list):
                print(f'    {label}数: {len(base_list)} -> {len(cur_list)}')
            for i in range(max(len(base_list), len(cur_list))):
                b = base_list[i] if i < len(base_list) else None
                c = cur_list[i] if i < len(cur_list) else None
                if b == c:
                    continue
                if b is None or c is None:
                    item = c or b
                    head = item.get('question') or item.get('name') or ''
                    print(f'    {label}{i + 1} {"新增" if c else "消失"}: {_preview(head)}')
                    continue
                for field in b:
                    if b[field] != c[field]:
                        print(f'    {label}{i + 1}.{field}: '
                              f'{_preview(b[field])} -> {_preview(c[field])}')

    print('=' * 60)
    print(f'对比完成：当前 {len(current)} 个文件，其中 {changed} 个与基线不同')


if __name__ == '__main__':
    mode, path = sys.argv[1], sys.argv[2]
    directory = sys.argv[3] if len(sys.argv) > 3 else '/app/案例'
    if mode == 'dump':
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(snapshot(directory), f, ensure_ascii=False, indent=1)
        print(f'基线已写入 {path}')
    elif mode == 'compare':
        compare(path, directory)
    else:
        print(f'未知模式：{mode}（可用：dump / compare）')
        sys.exit(1)
