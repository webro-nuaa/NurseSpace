import json
import logging
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
import threading

from utils.ai_evaluator import AIEvaluator

logger = logging.getLogger(__name__)

# 评分与积分阈值
WRONG_THRESHOLD = 60
GOOD_THRESHOLD = 80
EXCELLENT_THRESHOLD = 90
GOOD_POINTS = 10
EXCELLENT_POINTS = 20

# 有界线程池：max_workers=2，最多排队 8 个任务，超出则拒绝
_MAX_QUEUE_SIZE = 8


class _BoundedExecutor:
    """包装 ThreadPoolExecutor，用 Semaphore 限制排队任务数，防止 OOM。"""

    def __init__(self, max_workers: int, max_queue: int, thread_name_prefix: str = ''):
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix=thread_name_prefix)
        self._semaphore = threading.BoundedSemaphore(max_workers + max_queue)

    def submit(self, fn, *args, **kwargs):
        acquired = self._semaphore.acquire(blocking=False)
        if not acquired:
            raise RuntimeError('AI 评分队列已满，请稍后重试')
        try:
            future = self._executor.submit(fn, *args, **kwargs)
        except Exception:
            self._semaphore.release()
            raise
        future.add_done_callback(lambda _: self._semaphore.release())
        return future

    def shutdown(self, wait=True):
        self._executor.shutdown(wait=wait)


_eval_executor = _BoundedExecutor(max_workers=2, max_queue=_MAX_QUEUE_SIZE, thread_name_prefix='ai-eval-')


class EvaluationService:
    """AI 评分 + 提交处理服务"""

    def __init__(self, evaluator: AIEvaluator = None):
        self._evaluator = evaluator

    @property
    def evaluator(self):
        if self._evaluator is None:
            from flask import current_app
            self._evaluator = current_app.extensions.get('ai_evaluator', AIEvaluator())
        return self._evaluator

    def evaluate_answer(self, question, user_answer, standard_answers):
        """评估单条答案，返回评分结果 dict"""
        return self.evaluator.evaluate_answer(question, user_answer, standard_answers)

    def evaluate_answer_async(self, question, user_answer, standard_answers, callback=None):
        """异步评估（不阻塞请求），完成后调用 callback(result)

        队列满时抛出 RuntimeError，调用方应捕获并返回 503 给客户端。
        """
        try:
            future = _eval_executor.submit(
                self.evaluator.evaluate_answer, question, user_answer, standard_answers
            )
        except RuntimeError:
            logger.warning('AI 评分队列已满，拒绝新任务')
            raise
        if callback:
            future.add_done_callback(lambda f: callback(f.result() if not f.exception() else None))
        return future

    def process_submission(self, user, station, user_answer, standard_answers, db):
        """
        处理答案提交：评分 + 错题管理 + 积分奖励 + 学习记录

        Returns: dict 含 success/score/feedback 等信息，可直接序列化为 JSON response
        """
        from models import LearningRecord, WrongQuestion

        evaluation = self.evaluate_answer(
            question=station.question,
            user_answer=user_answer,
            standard_answers=standard_answers
        )

        feedback_json = json.dumps({
            'feedback': evaluation.get('feedback', ''),
            'reason': evaluation.get('reason', '')
        }, ensure_ascii=False)

        existing_record = LearningRecord.query.filter_by(
            user_id=user.id, station_id=station.id
        ).first()

        if existing_record:
            existing_record.user_answer = user_answer
            existing_record.score = evaluation['score']
            existing_record.ai_feedback = feedback_json
            existing_record.completed_at = datetime.now(timezone.utc)
            learning_record = existing_record
        else:
            learning_record = LearningRecord(
                user_id=user.id,
                user_answer=user_answer,
                score=evaluation['score'],
                max_score=evaluation['max_score'],
                ai_feedback=feedback_json,
                station_id=station.id
            )
            db.session.add(learning_record)

        # 错题处理
        if evaluation['score'] < WRONG_THRESHOLD:
            existing_wrong = WrongQuestion.query.filter_by(
                user_id=user.id, station_id=station.id
            ).first()
            if existing_wrong:
                existing_wrong.score = evaluation['score']
            else:
                db.session.add(WrongQuestion(
                    user_id=user.id, score=evaluation['score'], station_id=station.id
                ))
        else:
            WrongQuestion.query.filter_by(
                user_id=user.id, station_id=station.id
            ).delete()

        # 积分奖励（仅首次提交时发放）
        point_record = None
        if not existing_record and evaluation['score'] >= GOOD_THRESHOLD:
            from services.points import PointService
            point_record = PointService.award_points(
                db, user.id,
                points=self._calc_points(evaluation['score']),
                reason_prefix='案例学习高分奖励' if station.station_type != 'knowledge' else '扩展知识高分奖励',
                score=evaluation['score'],
                related_id=learning_record.id,
                related_type='learning'
            )

        db.session.commit()

        return {
            'success': True,
            'message': '答案提交成功',
            'evaluation': {
                'score': evaluation['score'],
                'max_score': evaluation['max_score'],
                'feedback': evaluation['feedback'],
                'covered_points': evaluation.get('covered_points', []),
                'missed_points': evaluation.get('missed_points', []),
                'suggestions': evaluation.get('suggestions', ''),
                'reason': evaluation.get('reason', '')
            }
        }

    def _calc_points(self, score):
        if score >= EXCELLENT_THRESHOLD:
            return EXCELLENT_POINTS
        return GOOD_POINTS

    def analyze_weakness(self, user_id, wrong_data):
        """委托 AI 分析薄弱点"""
        return self.evaluator.analyze_weakness(user_id, wrong_data)

    def evaluate_exam_answer(self, station, user_answer):
        """考试场景的单题评估（不涉及学习记录）"""
        standard_answers = [
            {'answer_item': sa.answer_item, 'score_weight': float(sa.score_weight)}
            for sa in (station.standard_answers.all() if station else [])
        ]
        if standard_answers and user_answer.strip():
            result = self.evaluate_answer(
                question=station.question if station else '',
                user_answer=user_answer,
                standard_answers=standard_answers
            )
            return result.get('score', 0), result.get('feedback', '')
        return 0, ''


def build_my_record(record):
    """从学习记录构建详细信息字典（供路由层使用）"""
    if not record:
        return {
            'user_answer': '',
            'score': None,
            'ai_feedback': '',
            'reason': '',
            'completed_at': None
        }

    feedback_text = record.ai_feedback or ''
    parsed = {}
    if feedback_text and feedback_text.strip().startswith('{'):
        try:
            parsed = json.loads(feedback_text)
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        'user_answer': record.user_answer or '',
        'score': float(record.score) if record.score is not None else None,
        'ai_feedback': (parsed.get('feedback') if isinstance(parsed, dict) else feedback_text) or '',
        'reason': (parsed.get('reason') if isinstance(parsed, dict) else ''),
        'completed_at': record.completed_at.isoformat() if record.completed_at else None
    }
