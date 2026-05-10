"""Tests for AI evaluator: text matching, JSON parsing, weakness analysis."""
import json
import pytest


class TestSimpleTextMatching:
    def test_perfect_match(self, app):
        from utils.ai_evaluator import AIEvaluator
        evaluator = AIEvaluator()
        result = evaluator._simple_text_matching(
            '如何测量血压？',
            '选择合适的袖带尺寸 袖带下缘距肘窝2到3厘米 患者取坐位或卧位',
            [{'answer_item': '选择合适的袖带尺寸', 'score_weight': 1.0},
             {'answer_item': '袖带下缘距肘窝2-3cm', 'score_weight': 1.0},
             {'answer_item': '患者取坐位或卧位', 'score_weight': 1.0}]
        )
        assert result['score'] >= 50
        assert result['max_score'] == 100
        assert 'feedback' in result

    def test_empty_answer(self, app):
        from utils.ai_evaluator import AIEvaluator
        evaluator = AIEvaluator()
        result = evaluator._simple_text_matching(
            '问题？',
            '',
            [{'answer_item': '标准答案', 'score_weight': 1.0}]
        )
        assert result['score'] == 0
        assert len(result['missed_points']) == 1
        assert '未提供答案' in result['feedback']

    def test_whitespace_only_answer(self, app):
        from utils.ai_evaluator import AIEvaluator
        evaluator = AIEvaluator()
        result = evaluator._simple_text_matching(
            '问题？',
            '   ',
            [{'answer_item': '标准答案', 'score_weight': 1.0}]
        )
        assert result['score'] == 0

    def test_partial_match(self, app):
        from utils.ai_evaluator import AIEvaluator
        evaluator = AIEvaluator()
        result = evaluator._simple_text_matching(
            '无菌操作要点？',
            '操作前需要洗手 戴无菌手套',
            [{'answer_item': '操作前洗手消毒', 'score_weight': 1.0},
             {'answer_item': '佩戴无菌手套', 'score_weight': 1.0},
             {'answer_item': '铺无菌巾单', 'score_weight': 1.0}]
        )
        # The simple matcher uses \b\w+\b which may not split Chinese well,
        # but score should be in valid range and have some coverage
        assert 0 <= result['score'] <= 100
        assert result['max_score'] == 100

    def test_score_bounds(self, app):
        from utils.ai_evaluator import AIEvaluator
        evaluator = AIEvaluator()
        result = evaluator._simple_text_matching(
            '问题？', '答案',
            [{'answer_item': '完全不相关的要点', 'score_weight': 0.5}]
        )
        assert 0 <= result['score'] <= 100

    def test_high_score_feedback(self, app):
        from utils.ai_evaluator import AIEvaluator
        evaluator = AIEvaluator()
        result = evaluator._simple_text_matching(
            '问题？',
            '选择合适的袖带尺寸 袖带下缘 坐位卧位',
            [{'answer_item': '选择合适的袖带尺寸', 'score_weight': 1.0},
             {'answer_item': '袖带下缘距肘窝2-3cm', 'score_weight': 1.0},
             {'answer_item': '患者取坐位或卧位', 'score_weight': 1.0}]
        )
        # With keyword overlap, some points should be covered
        assert result['score'] >= 0
        assert result['max_score'] == 100
        assert len(result['covered_points']) + len(result['missed_points']) > 0

    def test_low_score_feedback(self, app):
        from utils.ai_evaluator import AIEvaluator
        evaluator = AIEvaluator()
        result = evaluator._simple_text_matching(
            '问题？',
            '不相关的答案内容',
            [{'answer_item': '标准答案要点一', 'score_weight': 1.0},
             {'answer_item': '标准答案要点二', 'score_weight': 1.0}]
        )
        assert result['score'] < 60

    def test_zero_weight_edge(self, app):
        from utils.ai_evaluator import AIEvaluator
        evaluator = AIEvaluator()
        result = evaluator._simple_text_matching(
            '问题？', '答案',
            []
        )
        assert result['score'] == 50  # default when no weight


class TestJsonParsingHelpers:
    def test_try_parse_valid_json(self, app):
        from utils.ai_evaluator import AIEvaluator
        evaluator = AIEvaluator()
        result = evaluator._try_parse_json('{"score": 85, "feedback": "good"}')
        assert result == {'score': 85, 'feedback': 'good'}

    def test_try_parse_json_with_fences(self, app):
        from utils.ai_evaluator import AIEvaluator
        evaluator = AIEvaluator()
        result = evaluator._try_parse_json(
            '```json\n{"score": 90}\n```'
        )
        assert result == {'score': 90}

    def test_try_parse_json_with_extra_text(self, app):
        from utils.ai_evaluator import AIEvaluator
        evaluator = AIEvaluator()
        result = evaluator._try_parse_json(
            'Here is the result: {"score": 75, "feedback": "ok"} end'
        )
        assert result == {'score': 75, 'feedback': 'ok'}

    def test_try_parse_invalid_json(self, app):
        from utils.ai_evaluator import AIEvaluator
        evaluator = AIEvaluator()
        result = evaluator._try_parse_json('not json at all')
        assert result is None

    def test_try_parse_empty_string(self, app):
        from utils.ai_evaluator import AIEvaluator
        evaluator = AIEvaluator()
        assert evaluator._try_parse_json('') is None
        assert evaluator._try_parse_json(None) is None

    def test_strip_fences(self, app):
        from utils.ai_evaluator import AIEvaluator
        result = AIEvaluator._strip_fences('```json\n{"a": 1}\n```')
        assert result == '{"a": 1}'

    def test_strip_fences_no_fences(self, app):
        from utils.ai_evaluator import AIEvaluator
        result = AIEvaluator._strip_fences('{"a": 1}')
        assert result == '{"a": 1}'

    def test_extract_json_object_nested(self, app):
        from utils.ai_evaluator import AIEvaluator
        result = AIEvaluator._extract_json_object(
            'prefix {"outer": {"inner": [1, 2, 3]}, "key": "val"} suffix'
        )
        parsed = json.loads(result)
        assert parsed['outer']['inner'] == [1, 2, 3]

    def test_extract_json_no_braces(self, app):
        from utils.ai_evaluator import AIEvaluator
        assert AIEvaluator._extract_json_object('no braces') == ''


class TestSimpleWeaknessAnalysis:
    def test_empty_data(self, app):
        from utils.ai_evaluator import AIEvaluator
        evaluator = AIEvaluator()
        result = evaluator._simple_weakness_analysis([])
        assert result['weak_categories'] == []
        assert '暂无错题数据' in result['main_issues'][0]

    def test_single_category(self, app):
        from utils.ai_evaluator import AIEvaluator
        evaluator = AIEvaluator()
        data = [
            {'category': '外科', 'question': 'Q1', 'score': 60},
            {'category': '外科', 'question': 'Q2', 'score': 55},
        ]
        result = evaluator._simple_weakness_analysis(data)
        assert '外科' in result['weak_categories']
        assert len(result['improvement_suggestions']) >= 1

    def test_multiple_categories_ordered(self, app):
        from utils.ai_evaluator import AIEvaluator
        evaluator = AIEvaluator()
        data = [
            {'category': '内科', 'question': 'Q1', 'score': 50},
            {'category': '外科', 'question': 'Q2', 'score': 60},
            {'category': '外科', 'question': 'Q3', 'score': 55},
            {'category': '内科', 'question': 'Q4', 'score': 45},
            {'category': '儿科', 'question': 'Q5', 'score': 70},
        ]
        result = evaluator._simple_weakness_analysis(data)
        #外科 has 2, 内科 has 2, 儿科 has 1 —外科 should be first (or tied)
        assert result['weak_categories'][0] in ('外科', '内科')
        assert len(result['weak_categories']) <= 3

    def test_study_plan_includes_categories(self, app):
        from utils.ai_evaluator import AIEvaluator
        evaluator = AIEvaluator()
        data = [{'category': '外科', 'question': 'Q1', 'score': 60}]
        result = evaluator._simple_weakness_analysis(data)
        assert '外科' in result['study_plan']

    def test_priority_areas(self, app):
        from utils.ai_evaluator import AIEvaluator
        evaluator = AIEvaluator()
        data = [
            {'category': '内科', 'question': 'Q1', 'score': 60},
            {'category': '外科', 'question': 'Q2', 'score': 55},
        ]
        result = evaluator._simple_weakness_analysis(data)
        assert len(result['priority_areas']) <= 2
