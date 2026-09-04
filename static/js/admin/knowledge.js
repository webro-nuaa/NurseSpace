// 管理员端 — 知识库管理（文档上传/刷新/删除）与知识问答

function loadKnowledgeBase() {
    setActiveNav('知识库');
    var html = `
        <div class="page-title">
            <h2><i class="fas fa-database me-2"></i>知识库管理</h2>
            <p>上传护理文档构建专属知识库，护士端配置个人 API Key 后即可使用智能问答</p>
        </div>
        <div class="card mb-3">
            <div class="card-header"><h6 class="mb-0"><i class="fas fa-upload me-2"></i>上传知识文档</h6></div>
            <div class="card-body">
                <input type="file" id="kb-file-input" accept=".pdf,.docx,.doc,.txt" class="form-control mb-2">
                <button class="btn btn-primary" id="btn-kb-upload"><i class="fas fa-upload me-1"></i>上传</button>
                <div class="form-text">支持 PDF、Word、TXT 格式，上传后自动索引</div>
            </div>
        </div>
        <div class="card mb-3" id="kb-docs-card">
            <div class="card-header"><h6 class="mb-0"><i class="fas fa-list me-2"></i>已上传文档</h6></div>
            <div class="card-body">
                <div id="kb-doc-list"><div class="text-muted text-center py-3">加载中...</div></div>
            </div>
        </div>`;
    $('#main-content').html(html);
    $('#btn-kb-upload').on('click', uploadKnowledgeDoc);
    refreshKnowledgeDocs();
}
function refreshKnowledgeDocs() {
    $.ajax({
        url: '/admin/knowledge/docs',
        method: 'GET',
        timeout: 30000,
        success: function(res) {
            if (res.success) {
                var count = res.data.doc_count || 0;
                var docs = res.data.docs || [];
                $('#kb-doc-count').text(count);
                if (count > 0) {
                    var listHtml = '<table class="table table-sm"><thead><tr><th>文件名</th><th>上传时间</th><th style="width:80px">操作</th></tr></thead><tbody>';
                    for (var i = 0; i < docs.length; i++) {
                        var d = docs[i];
                        listHtml += '<tr><td>' + (d.filename||'未知文件').replace(/</g,'&lt;') + '</td><td class="text-muted small">' + (d.uploaded_at||'').substring(0,19) + '</td>';
                        listHtml += '<td><button class="btn btn-sm btn-outline-danger" onclick="deleteKnowledgeDoc(\'' + d.id + '\', this)"><i class="fas fa-trash"></i></button></td></tr>';
                    }
                    listHtml += '</tbody></table>';
                    $('#kb-doc-list').html(listHtml);
                } else {
                    $('#kb-doc-list').html('<p class="text-muted">暂无文档，请上传护理相关文档以构建知识库。</p>');
                }
            }
        },
        error: function() {
            $('#kb-doc-list').html('<p class="text-danger">知识库引擎初始化失败，请稍后刷新重试。</p>');
        }
    });
}

function deleteKnowledgeDoc(docId, btn) {
    if (!confirm('确认删除此文档？删除后将从知识库中移除。')) return;
    $(btn).prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i>');
    $.ajax({
        url: '/admin/knowledge/docs/' + encodeURIComponent(docId),
        method: 'DELETE',
        success: function(res) {
            if (res.success) { showAlert('已删除', 'success', 1500); refreshKnowledgeDocs(); }
            else showAlert(res.message, 'error');
        },
        error: function() { showAlert('删除失败', 'error'); }
    });
}

function uploadKnowledgeDoc() {
    var fileInput = document.getElementById('kb-file-input');
    if (!fileInput || !fileInput.files || !fileInput.files.length) {
        alert('请先选择文件');
        return;
    }
    var file = fileInput.files[0];
    var btn = $('#btn-kb-upload');
    btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-1"></i>上传中...');
    var formData = new FormData();
    formData.append('file', file);
    $.ajax({
        url: '/admin/knowledge/docs',
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(res) {
            btn.prop('disabled', false).html('<i class="fas fa-upload me-1"></i>上传');
            if (res.success) { showAlert(res.message, 'success', 2000); refreshKnowledgeDocs(); }
            else showAlert(res.message, 'error');
        },
        error: function(xhr) {
            btn.prop('disabled', false).html('<i class="fas fa-upload me-1"></i>上传');
            var msg = '上传失败';
            try { var r = JSON.parse(xhr.responseText); if (r.message) msg = r.message; } catch(e) {}
            showAlert(msg + ' (' + xhr.status + ')', 'error');
        }
    });
}

// 管理员知识问答
function loadAdminKnowledgeQA() {
    setActiveNav('知识问答');
    $.get('/admin/personal-ai-settings', function(res) {
        var hasKey = res.success && res.data && res.data.has_knowledge_key;
        if (!hasKey) {
            $('#main-content').html(`
                <div style="max-width:800px;margin:60px auto;text-align:center">
                    <h2 style="font-size:2rem;margin-bottom:10px">NurseSpace 知识问答</h2>
                    <p style="color:#888;margin-bottom:40px">配置个人 API Key 后即可使用</p>
                    <button class="btn btn-primary btn-lg" onclick="navigateTo('personal-ai')" style="padding:12px 40px;border-radius:12px">
                        <i class="fas fa-key me-2"></i>配置 AI Key
                    </button>
                </div>`);
            return;
        }
        $('#main-content').html(`
            <div class="qa-wrapper" style="display:flex;flex-direction:column;height:calc(100vh - 120px);max-width:800px;margin:0 auto">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0">
                    <h4 style="margin:0;font-weight:600">NurseSpace 知识问答</h4>
                    <button class="btn btn-sm btn-outline-secondary" onclick="navigateTo('personal-ai')" style="border-radius:8px">
                        <i class="fas fa-cog me-1"></i>设置
                    </button>
                </div>
                <div id="qa-chat" style="flex:1;overflow-y:auto;padding:10px 0">
                    <div style="text-align:center;color:#bbb;padding-top:80px">
                        <div style="font-size:3rem;margin-bottom:16px">💬</div>
                        <div style="font-size:1.1rem;margin-bottom:8px">有什么护理问题可以问我</div>
                        <div style="font-size:0.85rem">基于知识库为您提供参考答案</div>
                    </div>
                </div>
                <div style="padding:12px 0;border-top:1px solid #eee">
                    <div style="display:flex;gap:8px;background:#f5f5f5;border-radius:16px;padding:6px 16px;align-items:center">
                        <input type="text" id="qa-input" placeholder="输入问题，例如：新生儿黄疸的护理要点？"
                            style="flex:1;border:none;background:transparent;outline:none;font-size:.95rem;padding:8px 0"
                            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();adminAskKnowledge()}">
                        <button onclick="adminAskKnowledge()" style="border:none;background:#2b6ef0;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center">
                            <i class="fas fa-arrow-up" style="font-size:14px"></i>
                        </button>
                    </div>
                </div>
            </div>`);
    });
}

function adminAskKnowledge() {
    var q = $('#qa-input').val().trim();
    if (!q) return;
    var chat = $('#qa-chat');
    chat.find('div[style*="padding-top"]').remove();
    chat.append('<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><div style="max-width:75%;background:#2b6ef0;color:#fff;border-radius:16px 16px 4px 16px;padding:10px 16px;font-size:.9rem;line-height:1.5">' + sanitizeHTML(q).replace(/\n/g,'<br>') + '</div></div>');
    chat.append('<div style="display:flex;margin-bottom:16px"><div style="max-width:85%;background:#f0f0f0;border-radius:16px 16px 16px 4px;padding:10px 16px;color:#999;font-size:.9rem"><i class="fas fa-spinner fa-pulse me-1"></i>思考中...</div></div>');
    chat.scrollTop(chat[0].scrollHeight);
    $('#qa-input').val('').focus();
    $.ajax({
        url: '/admin/knowledge/ask', method: 'POST', contentType: 'application/json',
        data: JSON.stringify({question: q}),
        success: function(res) {
            chat.find('div:contains("思考中...")').remove();
            if (res.success) {
                var d = res.data;
                var srcHtml = d.sources && d.sources.length ? '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #ddd;font-size:.75rem;color:#999">来源：' + d.sources.map(sanitizeHTML).join('、') + '</div>' : '';
                chat.append('<div style="display:flex;margin-bottom:16px"><div style="max-width:85%;background:#f0f0f0;border-radius:16px 16px 16px 4px;padding:10px 16px;font-size:.9rem;line-height:1.7;white-space:pre-wrap">' + sanitizeHTML(d.answer || '') + srcHtml + '</div></div>');
            } else {
                chat.append('<div style="display:flex;margin-bottom:16px"><div style="max-width:85%;background:#fff0f0;color:#d32f2f;border-radius:16px 16px 16px 4px;padding:10px 16px;font-size:.9rem">' + sanitizeHTML(res.message || '出错了') + '</div></div>');
            }
            chat.scrollTop(chat[0].scrollHeight);
        },
        error: function() { chat.find('div:contains("思考中...")').remove(); chat.append('<div style="display:flex;margin-bottom:16px"><div style="max-width:85%;background:#fff0f0;color:#d32f2f;border-radius:16px 16px 16px 4px;padding:10px 16px;font-size:.9rem">网络错误</div></div>'); }
    });
}
