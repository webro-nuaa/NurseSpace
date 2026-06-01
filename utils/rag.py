"""
RAG 知识库模块

基于 ChromaDB 的向量存储与检索。
模型文件通过 Dockerfile COPY 预置，运行时零下载。
"""

import os
import json
import logging
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class KnowledgeStore:
    """护理知识向量存储 — ChromaDB"""

    def __init__(self, persist_dir='./chroma_data'):
        self.persist_dir = persist_dir
        self._client = None
        self._admin_docs = None

    def _get_client(self):
        if self._client is None:
            import chromadb
            os.makedirs(self.persist_dir, exist_ok=True)
            self._client = chromadb.PersistentClient(path=self.persist_dir)
        return self._client

    def _get_collection(self):
        if self._admin_docs is None:
            client = self._get_client()
            self._admin_docs = client.get_or_create_collection(
                name="nurse_knowledge",
                metadata={"description": "护理知识库"}
            )
        return self._admin_docs

    def add_doc(self, doc_id, text, metadata=None):
        col = self._get_collection()
        col.add(documents=[text], metadatas=[metadata or {}], ids=[doc_id])

    def search(self, query, top_k=5):
        col = self._get_collection()
        if col.count() == 0:
            return []
        results = col.query(query_texts=[query], n_results=min(top_k, col.count()))
        docs = results.get('documents', [[]])[0]
        metas = results.get('metadatas', [[]])[0]
        ids = results.get('ids', [[]])[0]
        formatted = []
        for i in range(len(docs)):
            formatted.append({
                'id': ids[i], 'text': docs[i],
                'metadata': metas[i] if i < len(metas) else {},
            })
        return formatted

    def get_doc_count(self):
        try:
            return self._get_collection().count()
        except Exception:
            return 0

    def get_all_docs(self):
        """获取所有文档列表（含元数据）"""
        try:
            col = self._get_collection()
            if col.count() == 0:
                return []
            results = col.get(include=['metadatas'])
            docs = []
            for i in range(len(results['ids'])):
                docs.append({
                    'id': results['ids'][i],
                    'filename': results['metadatas'][i].get('filename', '未知文件') if results['metadatas'] else '未知文件',
                    'uploaded_at': results['metadatas'][i].get('uploaded_at', '') if results['metadatas'] else '',
                })
            return docs
        except Exception:
            return []

    def delete_doc(self, doc_id):
        """删除指定文档"""
        try:
            self._get_collection().delete(ids=[doc_id])
            return True
        except Exception:
            return False


class DocumentParser:
    """解析 PDF/Word/TXT"""

    @staticmethod
    def parse_file(filepath):
        ext = os.path.splitext(filepath)[1].lower()
        if ext == '.pdf':
            from pypdf import PdfReader
            return '\n'.join(p.extract_text() or '' for p in PdfReader(filepath).pages)
        elif ext in ('.docx', '.doc'):
            from docx import Document
            return '\n'.join(p.text for p in Document(filepath).paragraphs if p.text.strip())
        elif ext == '.txt':
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        raise ValueError(f"不支持的文件格式: {ext}")


class KnowledgeQAAgent:
    """知识问答 Agent"""

    def __init__(self, provider, api_key, model, store: KnowledgeStore):
        self.provider = provider
        self.model = model
        self.store = store
        if provider == 'glm':
            from zhipuai import ZhipuAI
            self.client = ZhipuAI(api_key=api_key)
        else:
            import openai
            self.client = openai.OpenAI(api_key=api_key)

    def ask(self, question, top_k=5):
        results = self.store.search(question, top_k)
        context = "\n".join(r['text'][:800] for r in results)
        sources = list(set(
            r['metadata'].get('filename', '') or r['metadata'].get('type', '')
            for r in results if r.get('metadata')
        ))

        prompt = f"参考资料：\n{context if context else '（无）'}\n\n问题：{question}\n\n基于参考资料回答。返回JSON：{{\"answer\":\"...\",\"sources\":[\"...\"]}}"

        resp = self._call(prompt)
        try:
            result = json.loads(resp)
        except Exception:
            import re
            m = re.search(r'\{.*\}', resp, re.DOTALL)
            result = json.loads(m.group()) if m else {'answer': resp, 'sources': sources}
        result.setdefault('sources', sources)
        return result

    def _call(self, prompt, max_tokens=2000):
        if self.provider == 'glm':
            r = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "system", "content": "你是护理知识助手"}, {"role": "user", "content": prompt}],
                max_tokens=max_tokens)
        else:
            r = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "system", "content": "你是护理知识助手"}, {"role": "user", "content": prompt}],
                max_tokens=max_tokens)
        return r.choices[0].message.content.strip()
