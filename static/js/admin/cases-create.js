// 管理员端 — 案例管理 · 手动创建案例页（站点/视频/链接/知识拓展动态表单）
// =========== 案例创建页面 ===========
function renderCaseCreatePage() {
    _stationIdx = 0; _videoIdx = 0; _linkIdx = 0; _knowledgeIdx = 0;
    $.get('/api/categories', function(res) {
        const cats = res.success ? res.data : [];
        const catOptions = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

        const html = `
            <nav aria-label="breadcrumb"><ol class="breadcrumb">
                <li class="breadcrumb-item"><a href="#" onclick="navToCases(); return false;">案例管理</a></li>
                <li class="breadcrumb-item active">创建案例</li>
            </ol></nav>
            <div class="page-header">
                <div>
                    <h4><i class="fas fa-plus me-2"></i>创建完整案例</h4>
                    <p class="text-muted mb-0">一次填写案例基本信息、站点考核、扩展资源，点击创建即可使用</p>
                </div>
            </div>

            <!-- 1. 案例基本信息 -->
            <div class="card mb-3"><div class="card-header"><i class="fas fa-info-circle me-2"></i>案例基本信息</div><div class="card-body">
                <div class="row g-3">
                    <div class="col-md-6">
                        <label class="form-label">案例标题 <span class="text-danger">*</span></label>
                        <input type="text" class="form-control" id="create-title" placeholder="如：新生儿黄疸护理案例">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">类别 <span class="text-danger">*</span></label>
                        <div class="input-group">
                            <select class="form-select" id="create-category">
                                <option value="">选择已有类别</option>
                                ${catOptions}
                            </select>
                            <input type="text" class="form-control" id="create-category-new" placeholder="或输入新类别名称" style="max-width:180px;">
                        </div>
                        <small class="text-muted">可从已有类别中选择，或直接输入新类别名称自动创建</small>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">难度</label>
                        <select class="form-select" id="create-difficulty">
                            <option value="intermediate">中级</option>
                            <option value="basic">基础</option>
                            <option value="advanced">高级</option>
                        </select>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">类型 <span class="text-danger">*</span></label>
                        <select class="form-select" id="create-type">
                            <option value="learning">学习案例</option>
                            <option value="exam">考试案例</option>
                        </select>
                        <small class="text-muted">学习案例用于日常练习，考试案例用于组织考试</small>
                    </div>
                    <div class="col-md-4"></div>
                    <div class="col-12">
                        <label class="form-label">案例指引</label>
                        <textarea class="form-control" id="create-guide" rows="3" placeholder="输入案例背景介绍和教学指引..."></textarea>
                        <small class="text-muted">可选。简要说明本案例的教学目标、适用对象和注意事项</small>
                    </div>
                </div>
            </div></div>

            <!-- 2. 站点/考核点 -->
            <div class="card mb-3 border-primary"><div class="card-header bg-primary bg-opacity-10 d-flex justify-content-between align-items-center">
                <div>
                    <i class="fas fa-map-pin me-2 text-primary"></i><strong>站点（考核点）</strong>
                    <small class="text-muted ms-2">每个站点代表案例中的一个考核环节，可以有多个站点</small>
                </div>
                <button class="btn btn-primary btn-sm" onclick="addStationForm()"><i class="fas fa-plus me-1"></i>添加站点</button>
            </div><div class="card-body" id="stations-container">
                <p class="text-muted small mb-0 text-center py-2" id="stations-empty">点击上方「添加站点」按钮创建第一个考核站点</p>
            </div></div>

            <!-- 3. 扩展视频 -->
            <div class="card mb-3"><div class="card-header d-flex justify-content-between align-items-center">
                <span><i class="fas fa-video me-2"></i>扩展视频 <small class="text-muted">（可选）</small></span>
                <button class="btn btn-outline-primary btn-sm" onclick="addVideoForm()"><i class="fas fa-plus me-1"></i>添加视频</button>
            </div><div class="card-body" id="videos-container">
                <p class="text-muted small mb-0 text-center py-2" id="videos-empty">暂无视频，可不填</p>
            </div></div>

            <!-- 4. 扩展链接 -->
            <div class="card mb-3"><div class="card-header d-flex justify-content-between align-items-center">
                <span><i class="fas fa-link me-2"></i>扩展链接 <small class="text-muted">（可选）</small></span>
                <button class="btn btn-outline-primary btn-sm" onclick="addLinkForm()"><i class="fas fa-plus me-1"></i>添加链接</button>
            </div><div class="card-body" id="links-container">
                <p class="text-muted small mb-0 text-center py-2" id="links-empty">暂无链接，可不填</p>
            </div></div>

            <!-- 5. 扩展知识 -->
            <div class="card mb-3"><div class="card-header d-flex justify-content-between align-items-center">
                <span><i class="fas fa-lightbulb me-2"></i>扩展知识问答 <small class="text-muted">（可选）</small></span>
                <button class="btn btn-outline-primary btn-sm" onclick="addKnowledgeForm()"><i class="fas fa-plus me-1"></i>添加知识</button>
            </div><div class="card-body" id="knowledge-container">
                <p class="text-muted small mb-0 text-center py-2" id="knowledge-empty">暂无知识条目，可不填</p>
            </div></div>

            <!-- 提交 -->
            <div class="d-flex gap-2 mb-4">
                <button class="btn btn-primary btn-lg" onclick="submitCreateCase()"><i class="fas fa-save me-1"></i>创建完整案例</button>
                <button class="btn btn-outline-secondary btn-lg" onclick="navToCases()">取消</button>
            </div>
        `;
        $('#main-content').html(html);
        // 预添加一个空站点让用户看到站点表单结构
        addStationForm();
    });
}

let _stationIdx = 0;
let _videoIdx = 0;
let _linkIdx = 0;
let _knowledgeIdx = 0;

function addStationForm() {
    _stationIdx++;
    const si = _stationIdx;
    $('#stations-empty').hide();
    $('#stations-container').append(`
        <div class="station-card border rounded p-3 mb-3" id="station-${si}" style="background:#f8faff;">
            <div class="d-flex justify-content-between align-items-start mb-3">
                <div>
                    <span class="badge bg-primary me-2">站点 ${si}</span>
                    <small class="text-muted">填写该考核点的名称、任务、题目和标准答案</small>
                </div>
                <button class="btn btn-sm btn-outline-danger" onclick="$('#station-${si}').remove(); if(!$('.station-card').length) $('#stations-empty').show();">
                    <i class="fas fa-trash me-1"></i>删除此站点
                </button>
            </div>
            <div class="row g-2 mb-2">
                <div class="col-md-4">
                    <label class="form-label small fw-bold">站点名称 <span class="text-danger">*</span></label>
                    <input type="text" class="form-control form-control-sm station-name" placeholder="如：东22区新生儿科 或 护理评估">
                    <small class="text-muted" style="font-size:0.7rem;">科室名或考核环节名称</small>
                </div>
                <div class="col-md-4">
                    <label class="form-label small fw-bold">考核任务</label>
                    <input type="text" class="form-control form-control-sm station-task" placeholder="如：有条理地采集病史、选择性进行体格评估">
                    <small class="text-muted" style="font-size:0.7rem;">该站点的考核目标描述</small>
                </div>
                <div class="col-md-4">
                    <label class="form-label small fw-bold">题目 <span class="text-danger">*</span></label>
                    <input type="text" class="form-control form-control-sm station-question" placeholder="如：请写出新生儿黄疸的护理评估要点">
                    <small class="text-muted" style="font-size:0.7rem;">护士需要回答的问题</small>
                </div>
            </div>
            <div class="mt-2 p-2 bg-white rounded border">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <label class="form-label small fw-bold mb-0">标准答案（分项评分）</label>
                    <button class="btn btn-outline-primary btn-sm py-0" onclick="addCreateAnswerRow(${si})" style="font-size:0.75rem;">
                        <i class="fas fa-plus me-1"></i>添加评分项
                    </button>
                </div>
                <small class="text-muted" style="font-size:0.7rem;">每个评分项是一个独立采分点，权重表示该项在总分中的占比</small>
                <div class="answers-list-${si} mt-2">
                    <div class="answer-row-${si}-1 input-group input-group-sm mb-1">
                        <input type="text" class="form-control answer-item" placeholder="答案评分项内容（如：评估胎龄、日龄与喂养方式）">
                        <span class="input-group-text" style="font-size:0.7rem;">权重</span>
                        <input type="number" class="form-control answer-weight" value="1.0" step="0.1" min="0" style="max-width:70px;" placeholder="1.0">
                        <button class="btn btn-outline-secondary" type="button" onclick="addCreateAnswerRow(${si})"><i class="fas fa-plus"></i></button>
                    </div>
                </div>
            </div>
        </div>
    `);
}

function addCreateAnswerRow(si) {
    const $container = $(`.answers-list-${si}`);
    $container.append(`
        <div class="answer-row input-group input-group-sm mb-1">
            <input type="text" class="form-control answer-item" placeholder="答案评分项内容">
            <span class="input-group-text" style="font-size:0.7rem;">权重</span>
            <input type="number" class="form-control answer-weight" value="1.0" step="0.1" min="0" style="max-width:70px;" placeholder="1.0">
            <button class="btn btn-outline-danger" type="button" onclick="$(this).closest('.answer-row').remove()"><i class="fas fa-times"></i></button>
        </div>
    `);
}

function addVideoForm() {
    _videoIdx++;
    $('#videos-empty').hide();
    $('#videos-container').append(`
        <div class="video-card border rounded p-3 mb-2" id="video-${_videoIdx}">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <strong class="text-info">视频 #${_videoIdx}</strong>
                <button class="btn btn-sm btn-outline-danger" onclick="$('#video-${_videoIdx}').remove(); if(!$('.video-card').length) $('#videos-empty').show();">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="row g-2">
                <div class="col-md-4">
                    <label class="form-label small">标题 *</label>
                    <input type="text" class="form-control form-control-sm video-title" placeholder="视频标题">
                </div>
                <div class="col-md-4">
                    <label class="form-label small">上传视频文件</label>
                    <input type="file" class="form-control form-control-sm video-file" accept="video/*">
                </div>
                <div class="col-md-4">
                    <label class="form-label small">或视频链接</label>
                    <input type="text" class="form-control form-control-sm video-url" placeholder="https://... 如不上传文件则使用链接">
                </div>
            </div>
            <div class="row g-2 mt-1">
                <div class="col-12">
                    <label class="form-label small">描述</label>
                    <input type="text" class="form-control form-control-sm video-desc" placeholder="简要描述视频内容">
                </div>
            </div>
        </div>
    `);
}

function addLinkForm() {
    _linkIdx++;
    $('#links-empty').hide();
    $('#links-container').append(`
        <div class="link-card border rounded p-3 mb-2" id="link-${_linkIdx}">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <strong class="text-success">链接 #${_linkIdx}</strong>
                <button class="btn btn-sm btn-outline-danger" onclick="$('#link-${_linkIdx}').remove(); if(!$('.link-card').length) $('#links-empty').show();">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="row g-2">
                <div class="col-md-4">
                    <label class="form-label small">标题 *</label>
                    <input type="text" class="form-control form-control-sm link-title" placeholder="链接标题">
                </div>
                <div class="col-md-4">
                    <label class="form-label small">URL *</label>
                    <input type="text" class="form-control form-control-sm link-url" placeholder="https://...">
                </div>
                <div class="col-md-4">
                    <label class="form-label small">描述</label>
                    <input type="text" class="form-control form-control-sm link-desc" placeholder="简要描述">
                </div>
            </div>
        </div>
    `);
}

function addKnowledgeForm() {
    _knowledgeIdx++;
    $('#knowledge-empty').hide();
    $('#knowledge-container').append(`
        <div class="knowledge-card border rounded p-3 mb-2" id="knowledge-${_knowledgeIdx}">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <strong class="text-warning">知识问答 #${_knowledgeIdx}</strong>
                <button class="btn btn-sm btn-outline-danger" onclick="$('#knowledge-${_knowledgeIdx}').remove(); if(!$('.knowledge-card').length) $('#knowledge-empty').show();">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="mb-2">
                <input type="text" class="form-control form-control-sm knowledge-q" placeholder="问题（如：病理性黄疸的特点是什么？）">
            </div>
            <div class="mb-1">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <label class="form-label mb-0 small">答案项（按项评分）</label>
                    <button class="btn btn-outline-primary btn-sm" onclick="addKnAnswerItem(${_knowledgeIdx})">
                        <i class="fas fa-plus me-1"></i>添加项
                    </button>
                </div>
                <div class="kn-answers-container" id="kn-answers-${_knowledgeIdx}">
                    <div class="input-group input-group-sm mb-1 kn-answer-row">
                        <input type="text" class="form-control kn-answer-item" placeholder="答案内容 *">
                        <input type="number" class="form-control kn-answer-weight" placeholder="权重" value="1" step="0.5" min="0" style="max-width:80px;">
                        <button class="btn btn-outline-danger" onclick="$(this).parent().remove()"><i class="fas fa-times"></i></button>
                    </div>
                </div>
            </div>
        </div>
    `);
}

function addKnAnswerItem(knIdx) {
    $(`#kn-answers-${knIdx}`).append(`
        <div class="input-group input-group-sm mb-1 kn-answer-row">
            <input type="text" class="form-control kn-answer-item" placeholder="答案内容 *">
            <input type="number" class="form-control kn-answer-weight" placeholder="权重" value="1" step="0.5" min="0" style="max-width:80px;">
            <button class="btn btn-outline-danger" onclick="$(this).parent().remove()"><i class="fas fa-times"></i></button>
        </div>
    `);
}

function submitCreateCase() {
    const payload = {
        title: ($('#create-title').val() || '').trim(),
        category_id: parseInt($('#create-category').val()) || null,
        category_name: ($('#create-category-new').val() || '').trim(),
        difficulty: $('#create-difficulty').val(),
        case_type: $('#create-type').val(),
        case_guide: ($('#create-guide').val() || '').trim(),
        stations: [],
        videos: [],
        links: [],
        extended_knowledge: []
    };

    if (!payload.title) {
        showAlert('请输入案例标题', 'error');
        return;
    }
    if (!payload.category_id && !payload.category_name) {
        showAlert('请选择已有类别或输入新类别名称', 'error');
        return;
    }

    // 收集所有站点数据
    $('.station-card').each(function(i) {
        const name = ($(this).find('.station-name').val() || '').trim();
        const question = ($(this).find('.station-question').val() || '').trim();
        if (!name || !question) return;
        const answers = [];
        $(this).find('.answer-row').each(function() {
            const item = ($(this).find('.answer-item').val() || '').trim();
            if (item) {
                answers.push({
                    answer_item: item,
                    score_weight: parseFloat($(this).find('.answer-weight').val()) || 1.0
                });
            }
        });
        payload.stations.push({
            name: name,
            assessment_task: ($(this).find('.station-task').val() || '').trim(),
            question: question,
            order_index: i,
            standard_answers: answers
        });
    });

    if (payload.stations.length === 0) {
        showAlert('请至少添加一个站点（含站点名称和题目）', 'error');
        return;
    }

    // 收集链接
    $('.link-card').each(function(i) {
        const title = $(this).find('.link-title').val().trim();
        const url = $(this).find('.link-url').val().trim();
        if (title && url) {
            payload.links.push({
                title: title, url: url,
                description: $(this).find('.link-desc').val().trim(),
                order_index: i
            });
        }
    });

    // 收集知识（含多答案项）
    $('.knowledge-card').each(function() {
        const q = $(this).find('.knowledge-q').val().trim();
        const answers = [];
        $(this).find('.kn-answer-row').each(function() {
            const item = $(this).find('.kn-answer-item').val().trim();
            const weight = parseFloat($(this).find('.kn-answer-weight').val()) || 1;
            if (item) answers.push({ answer_item: item, score_weight: weight });
        });
        if (q && answers.length) {
            payload.extended_knowledge.push({ question: q, answers: answers });
        }
    });

    // 先上传视频文件，再创建案例
    uploadVideoFiles(function(videoUrls) {
        // 合并上传的视频文件URL
        $('.video-card').each(function(i) {
            const title = $(this).find('.video-title').val().trim();
            const url = $(this).find('.video-url').val().trim();
            const uploadedUrl = videoUrls['video-' + (i+1)];
            const finalUrl = uploadedUrl || url;
            if (title && finalUrl) {
                payload.videos.push({
                    title: title, url: finalUrl,
                    description: $(this).find('.video-desc').val().trim(),
                    order_index: i
                });
            }
        });

        $.ajax({
            url: '/admin/cases',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(payload),
            success: function(res) {
                if (res.success) {
                    showAlert(res.message || '创建成功', 'success');
                    setTimeout(function() { if (typeof adminReplaceView === 'function') adminReplaceView({tab: 'cases'}); loadCases(); }, 800);
                } else {
                    showAlert(res.message || '创建失败', 'error');
                }
            }
        });
    });
}

function uploadVideoFiles(callback) {
    const videoCards = $('.video-card');
    const videoUrls = {};
    let pending = 0;

    videoCards.each(function() {
        const fileInput = $(this).find('.video-file')[0];
        const cardId = $(this).attr('id');
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            pending++;
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            $.ajax({
                url: '/admin/videos/upload',
                method: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: function(res) {
                    if (res.success) videoUrls[cardId] = res.url;
                },
                complete: function() {
                    pending--;
                    if (pending === 0) callback(videoUrls);
                }
            });
        }
    });

    if (pending === 0) callback(videoUrls);
}

