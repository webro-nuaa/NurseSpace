import logging

logger = logging.getLogger(__name__)


class KnowledgeService:
    """知识库管理服务 — 统一管理 KnowledgeStore 实例"""

    def __init__(self, persist_dir=None):
        self.persist_dir = persist_dir
        self._store = None

    def _get_persist_dir(self):
        if self.persist_dir:
            return self.persist_dir
        from flask import current_app
        return current_app.config.get('CHROMA_DIR', './chroma_data')

    def get_store(self):
        """获取 KnowledgeStore 实例（惰性初始化）"""
        if self._store is None:
            from utils.rag import KnowledgeStore
            persist_dir = self._get_persist_dir()
            self._store = KnowledgeStore(persist_dir=persist_dir)
        return self._store

    def reset_store(self):
        """重置 store 实例（配置变更后使用）"""
        self._store = None
