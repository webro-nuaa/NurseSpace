// 管理员端 — AI 设置（平台级提供商配置 + 管理员个人 AI 偏好 + 连接测试）
// =============== AI 设置 ===============
function saveAiSettings() {
    var provider = $('#ai-provider').val();
    var payload = { provider: provider };
    if (provider === 'openai') {
        payload.openai_key = valOrNull('#ai-key');
        payload.openai_model = valOrNull('#ai-model');
        payload.openai_base_url = valOrNull('#ai-base-url');
    } else if (provider === 'glm') {
        payload.zhipu_key = valOrNull('#ai-key');
        payload.zhipu_model = valOrNull('#ai-model');
        payload.zhipu_base_url = valOrNull('#ai-base-url');
    }
    $.ajax({
        url: '/admin/ai-settings',
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(payload),
        success: function(res) {
            if (res.success) { showAlert('AI设置已更新', 'success'); }
            else { showAlert(res.message || '保存失败', 'error'); }
        },
        error: function() { showAlert('保存失败', 'error'); }
    });
}

function valOrNull(sel){
    const v = $(sel).val();
    if (!v || v === '******') return null;
    return v;
}

function loadAiSettings() {
    setActiveNav('AI设置');

    $.get('/admin/ai-settings', function(response) {
        if (!response.success) {
            showAlert(response.message || '加载失败', 'error');
            return;
        }
        var d = response.data;
        var prov = d.provider || 'local';
        window._aiSettingsData = d;

        var html = `
            <div class="page-header">
                <div>
                    <h4><i class="fas fa-robot me-2"></i>AI设置</h4>
                    <p class="text-muted mb-0">配置系统 AI 模型，用于智能评分、反馈生成和知识积累</p>
                </div>
            </div>
            <div class="row"><div class="col-lg-7">
                <div class="card"><div class="card-header"><h6 class="mb-0"><i class="fas fa-cog me-2"></i>系统 AI 模型（评分、反馈、知识积累共用）</h6></div>
                <div class="card-body">
                    <div class="mb-3">
                        <label class="form-label">模型提供方</label>
                        <select class="form-select" id="ai-provider" onchange="switchAiProvider()">
                            <option value="openai" ${prov==='openai'?'selected':''}>OpenAI</option>
                            <option value="glm" ${prov==='glm'?'selected':''}>智谱 GLM</option>
                            <option value="local" ${prov==='local'?'selected':''}>本地匹配</option>
                        </select>
                    </div>
                    <div id="ai-provider-fields">${renderAiProviderFields(prov, d)}</div>
                    <div class="d-flex gap-2 mt-3">
                        <button class="btn btn-primary" onclick="saveAiSettings()"><i class="fas fa-save me-1"></i>保存</button>
                        <button class="btn btn-outline-info" id="btn-test-ai" onclick="testAiConnection()" ${prov==='local'?'disabled':''}><i class="fas fa-plug me-1"></i>测试连接</button>
                    </div>
                    <div id="ai-test-result" class="mt-3"></div>
                </div></div>
            </div></div>
        `;
        $('#main-content').html(html);
    });
}

function renderAiProviderFields(prov, d) {
    if (prov === 'local') {
        return '<p class="text-muted small mb-0"><i class="fas fa-info-circle me-1"></i>本地匹配模式基于关键词匹配评分，无需配置 API。</p>';
    }
    var cfg = AI_PROVIDERS[prov] || AI_PROVIDERS.openai;
    var keyField = prov === 'openai' ? 'openai_key' : 'zhipu_key';
    var modelField = prov === 'openai' ? 'openai_model' : 'zhipu_model';
    var baseUrlField = prov === 'openai' ? 'openai_base_url' : 'zhipu_base_url';
    var savedKey = d[keyField] || '';
    var savedModel = d[modelField] || cfg.default_model;
    var savedBaseUrl = d[baseUrlField] || cfg.default_base_url;

    return `
        <div class="mb-2">
            <label class="form-label">API Key</label>
            <div class="input-group">
                <input type="password" class="form-control" id="ai-key" placeholder="${savedKey ? '已保存 ('+savedKey+')' : '输入 API Key'}" ${savedKey ? 'value="'+savedKey+'"' : ''}>
                <button class="btn btn-outline-secondary" type="button" onclick="toggleAiKeyVisibility()" title="显示/隐藏"><i class="fas fa-eye"></i></button>
            </div>
        </div>
        <div class="mb-2">
            <label class="form-label">模型名</label>
            <input type="text" class="form-control" id="ai-model" placeholder="${cfg.default_model}" value="${savedModel}">
            <div class="form-text">${prov === 'openai' ? '如 gpt-4o-mini, gpt-4o, gpt-3.5-turbo' : '如 glm-4-air, glm-4-flash'}</div>
        </div>
        <div class="mb-2">
            <label class="form-label">Base URL</label>
            <input type="text" class="form-control" id="ai-base-url" placeholder="${cfg.default_base_url}" value="${savedBaseUrl}">
            <div class="form-text">默认为 ${cfg.default_base_url}</div>
        </div>
    `;
}

function switchAiProvider() {
    var prov = $('#ai-provider').val();
    var d = window._aiSettingsData || {};
    $('#ai-provider-fields').html(renderAiProviderFields(prov, d));
    if (prov === 'local') {
        $('#btn-test-ai').prop('disabled', true);
    } else {
        $('#btn-test-ai').prop('disabled', false);
    }
    $('#ai-test-result').html('');
}

function toggleAiKeyVisibility() {
    var inp = $('#ai-key');
    inp.attr('type', inp.attr('type') === 'password' ? 'text' : 'password');
}


function loadAdminPersonalAISettings() {
    $.get('/admin/personal-ai-settings', function(res) {
        var d = res.success ? res.data : {};
        var html = `
            <div class="page-title"><h2><i class="fas fa-cog me-2"></i>个人AI设置</h2><p>配置知识问答 AI Key（个人使用）</p></div>
            <div class="row"><div class="col-lg-6"><div class="card"><div class="card-body">
                <div class="mb-3">
                    <label class="form-label">Provider</label>
                    <select class="form-select" id="qa-provider">
                        <option value="glm" ${d.knowledge_provider==='glm'?'selected':''}>智谱 GLM</option>
                        <option value="openai" ${d.knowledge_provider==='openai'?'selected':''}>OpenAI</option>
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label">API Key</label>
                    <input type="password" class="form-control" id="qa-key" placeholder="${d.has_knowledge_key?'已设置，留空不修改':'输入 API Key'}">
                </div>
                <div class="mb-3">
                    <label class="form-label">Model</label>
                    <input type="text" class="form-control" id="qa-model" value="${d.knowledge_model||'glm-4-air'}">
                </div>
                <button class="btn btn-primary" onclick="saveAdminPersonalAI()">保存</button>
                <button class="btn btn-outline-secondary ms-2" onclick="navigateTo('knowledge-qa')">返回问答</button>
            </div></div></div></div>`;
        $('#main-content').html(html);
    });
}

function saveAdminPersonalAI() {
    $.ajax({
        url: '/admin/personal-ai-settings', method: 'PUT', contentType: 'application/json',
        data: JSON.stringify({ knowledge_provider: $('#qa-provider').val(), knowledge_key: $('#qa-key').val()||undefined, knowledge_model: $('#qa-model').val() }),
        success: function(res) { if (res.success) { showAlert('保存成功','success'); navigateTo('knowledge-qa'); } else showAlert(res.message,'error'); }
    });
}

function testAiConnection() {
    var provider = $('#ai-provider').val();
    if (provider === 'local') { showAlert('本地匹配模式无需测试', 'info'); return; }
    var apiKey = $('#ai-key').val();
    var model = $('#ai-model').val();
    var baseUrl = $('#ai-base-url').val();
    if (!apiKey || apiKey.indexOf('***') === 0) { showAlert('请先输入 API Key', 'error'); return; }
    $('#ai-test-result').html('<div class="spinner-border spinner-border-sm text-primary me-2"></div>测试中...');
    $.ajax({
        url: '/admin/ai-settings/test',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ provider: provider, api_key: apiKey, model: model, base_url: baseUrl }),
        success: function(res) {
            if (res.success) {
                $('#ai-test-result').html('<div class="alert alert-success py-2"><i class="fas fa-check-circle me-1"></i>连接成功，延迟 ' + res.latency_ms + 'ms</div>');
            } else {
                $('#ai-test-result').html('<div class="alert alert-danger py-2"><i class="fas fa-times-circle me-1"></i>' + (res.message || '失败') + '</div>');
            }
        },
        error: function() {
            $('#ai-test-result').html('<div class="alert alert-danger py-2">请求失败，请检查网络</div>');
        }
    });
}

// ---- Voice Settings Page ----
