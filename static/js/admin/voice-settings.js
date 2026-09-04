// 管理员端 — 语音设置（百度 ASR Key 增删/启停）

function loadVoiceSettings() {
    setActiveNav('语音设置');

    var html = `
        <div class="page-header">
            <div>
                <h4><i class="fas fa-microphone me-2"></i>语音设置</h4>
                <p class="text-muted mb-0">百度语音识别 Key 管理</p>
            </div>
        </div>
        <div class="row"><div class="col-lg-7">
            <div class="card"><div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="mb-0">百度 ASR Key 列表</h6>
                    <button class="btn btn-sm btn-primary" onclick="showAddBaiduKeyForm()"><i class="fas fa-plus me-1"></i>添加 Key</button>
                </div>
                <p class="text-muted small mb-3">多个 Key 自动轮转：当一个 Key 额度用完时自动切换下一个。每个 Key 免费额度 5 万次/天。<br>
                注册地址：<a href="https://console.bce.baidu.com/ai/#/ai/speech/overview" target="_blank">百度 AI 开放平台 → 语音识别</a></p>
                <div id="baidu-asr-key-list">${renderBaiduKeysLoading()}</div>
                <div id="baidu-asr-key-form" style="display:none"></div>
            </div></div>
        </div></div>
    `;
    $('#main-content').html(html);
    loadBaiduAsrKeys();
}

// ---- Baidu ASR Key Management ----

function renderBaiduKeysLoading() {
    return '<div class="spinner-border spinner-border-sm text-muted me-2"></div>加载中...';
}

function loadBaiduAsrKeys() {
    $.get('/admin/baidu-asr-keys', function(res) {
        if (!res.success) { $('#baidu-asr-key-list').html('<p class="text-danger small">加载失败</p>'); return; }
        var keys = res.data || [];
        if (keys.length === 0) {
            $('#baidu-asr-key-list').html('<p class="text-muted small mb-0">暂无 Key，点击「添加 Key」开始配置。</p>');
            return;
        }
        var html = '<div class="list-group list-group-flush">';
        keys.forEach(function(k) {
            var statusBadge = k.is_active
                ? '<span class="badge bg-success">启用</span>'
                : '<span class="badge bg-secondary">禁用</span>';
            html += '<div class="list-group-item px-0 d-flex justify-content-between align-items-center">' +
                '<div><small class="text-muted">App ID: ' + (k.app_id || '-') +
                ' &nbsp;|&nbsp; Key: ' + k.api_key_masked + '</small><br>' + statusBadge +
                ' <small class="text-muted">' + formatDateTime(k.created_at) + '</small></div>' +
                '<div class="d-flex gap-1">' +
                '<button class="btn btn-sm ' + (k.is_active ? 'btn-outline-warning' : 'btn-outline-success') +
                '" onclick="toggleBaiduKey(' + k.id + ')">' +
                (k.is_active ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>') + '</button>' +
                '<button class="btn btn-sm btn-outline-danger" onclick="deleteBaiduKey(' + k.id +
                ')" title="删除"><i class="fas fa-trash"></i></button>' +
                '</div></div>';
        });
        html += '</div>';
        $('#baidu-asr-key-list').html(html);
    });
}

function showAddBaiduKeyForm() {
    var html = '<hr>' +
        '<div class="mb-2"><label class="form-label small">App ID <span class="text-muted">(可选)</span></label>' +
        '<input type="text" class="form-control form-control-sm" id="new-baidu-app-id" placeholder="百度应用 App ID"></div>' +
        '<div class="mb-2"><label class="form-label small">API Key</label>' +
        '<input type="text" class="form-control form-control-sm" id="new-baidu-api-key" placeholder="百度 API Key"></div>' +
        '<div class="mb-2"><label class="form-label small">Secret Key</label>' +
        '<input type="text" class="form-control form-control-sm" id="new-baidu-secret-key" placeholder="百度 Secret Key"></div>' +
        '<div class="d-flex gap-2">' +
        '<button class="btn btn-sm btn-primary" onclick="addBaiduKey()"><i class="fas fa-check me-1"></i>保存</button>' +
        '<button class="btn btn-sm btn-outline-secondary" onclick="$(\'#baidu-asr-key-form\').hide()">取消</button>' +
        '</div>';
    $('#baidu-asr-key-form').html(html).show();
}

function addBaiduKey() {
    var appId = $('#new-baidu-app-id').val().trim();
    var apiKey = $('#new-baidu-api-key').val().trim();
    var secretKey = $('#new-baidu-secret-key').val().trim();
    if (!apiKey || !secretKey) { showAlert('API Key 和 Secret Key 不能为空', 'error'); return; }
    $.ajax({
        url: '/admin/baidu-asr-keys',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ app_id: appId, api_key: apiKey, secret_key: secretKey }),
        success: function(res) {
            if (res.success) {
                showAlert('Key 已添加', 'success');
                $('#baidu-asr-key-form').hide();
                loadBaiduAsrKeys();
            } else { showAlert(res.message, 'error'); }
        }
    });
}

function toggleBaiduKey(id) {
    $.ajax({
        url: '/admin/baidu-asr-keys/' + id + '/toggle',
        method: 'POST',
        success: function(res) {
            if (res.success) { showAlert(res.message, 'info'); loadBaiduAsrKeys(); }
            else { showAlert(res.message, 'error'); }
        }
    });
}

function deleteBaiduKey(id) {
    if (!confirm('确定要删除这个 Key 吗？')) return;
    $.ajax({
        url: '/admin/baidu-asr-keys/' + id,
        method: 'DELETE',
        success: function(res) {
            if (res.success) { showAlert('Key 已删除', 'info'); loadBaiduAsrKeys(); }
            else { showAlert(res.message, 'error'); }
        }
    });
}
