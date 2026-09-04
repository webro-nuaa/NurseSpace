// 管理员端 — 案例管理 · 案例详情页（元信息编辑、站点/视频/链接/知识拓展增删）
// =========== 案例详情页面（含编辑、站点/视频/链接管理）===========
function renderCaseDetailPage(caseId) {
    $.get(`/admin/cases/${caseId}`, function(response) {
        if (!response.success) { showAlert(response.message || '加载失败', 'error'); return; }
        const d = response.data;
        const c = d.case;
        const html = `
            <div class="row"><div class="col-12">
                <nav aria-label="breadcrumb"><ol class="breadcrumb">
                    <li class="breadcrumb-item"><a href="#" onclick="navToCases(); return false;">案例管理</a></li>
                    <li class="breadcrumb-item active">${c.title}</li>
                </ol></nav>
            </div></div>

            <!-- 案例元数据卡片 -->
            <div class="row mb-3"><div class="col-12"><div class="card"><div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h4>${c.title}</h4>
                    <button class="btn btn-outline-warning btn-sm" onclick="toggleCaseMetaEdit(${c.id})">
                        <i class="fas fa-edit me-1"></i>编辑
                    </button>
                </div>
                <div id="case-meta-view">
                    <span class="badge bg-secondary me-2">${c.category_name}</span>
                    ${getDifficultyBadge(c.difficulty)}
                    ${getCaseTypeBadge(c.case_type)}
                    <p class="mt-2 mb-0"><strong>案例指引：</strong>${c.case_guide || '暂无'}</p>
                </div>
                <div id="case-meta-edit" style="display:none;"></div>
            </div></div></div></div>

            <div class="row">
                <!-- 左侧：题目（站点 + 扩展知识） -->
                <div class="col-lg-8">
                    <div class="card mb-3"><div class="card-header d-flex justify-content-between align-items-center">
                        <h5 class="mb-0"><i class="fas fa-tasks me-2"></i>学习站点</h5>
                        <button class="btn btn-primary btn-sm" onclick="showAddStationForm(${c.id})">
                            <i class="fas fa-plus me-1"></i>添加站点
                        </button>
                    </div><div class="card-body" id="stations-area">
                        ${d.stations.length ? d.stations.map(s => renderStationCard(c.id, s)).join('') : '<p class="text-muted">暂无站点</p>'}
                    </div></div>

                    <div class="card mb-3"><div class="card-header d-flex justify-content-between align-items-center">
                        <h5 class="mb-0"><i class="fas fa-lightbulb me-2"></i>扩展知识</h5>
                        <button class="btn btn-primary btn-sm" onclick="showAddKnowledgeInline(${c.id})">
                            <i class="fas fa-plus me-1"></i>添加知识
                        </button>
                    </div><div class="card-body" id="knowledge-area">
                        ${(() => { const kItems = (d.stations || []).filter(s => s.station_type === 'knowledge'); return kItems.length ? kItems.map(ek => {
                            const answers = ek.answers || [];
                            const totalWeight = answers.reduce((s, a) => s + (a.score_weight || 0), 0);
                            return `
                            <div class="card mb-2" id="ek-${ek.id}">
                                <div class="card-body py-2">
                                    <div class="d-flex justify-content-between align-items-start">
                                        <div class="flex-grow-1">
                                            <strong class="text-primary">${ek.question}</strong>
                                            <span class="badge bg-info ms-2">${totalWeight}分</span>
                                            <ol class="mb-0 mt-1 small">
                                                ${answers.map(a => `<li>${a.answer_item} <span class="text-muted">(权重${a.score_weight})</span></li>`).join('')}
                                            </ol>
                                        </div>
                                        <button class="btn btn-sm btn-outline-danger ms-2" onclick="deleteKnowledgeInline(${c.id}, ${ek.id})">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `}).join('') : '<p class="text-muted">暂无扩展知识</p>'; })()}
                    </div></div>
                </div>

                <!-- 右侧：学习资料（视频 + 链接） -->
                <div class="col-lg-4">
                    <div class="card mb-3"><div class="card-header d-flex justify-content-between align-items-center">
                        <h6 class="mb-0"><i class="fas fa-video me-2"></i>扩展视频</h6>
                        <button class="btn btn-outline-primary btn-sm" onclick="showAddVideoInline(${c.id})"><i class="fas fa-plus"></i></button>
                    </div><div class="card-body" id="videos-area">
                        ${d.videos.length ? d.videos.map(v => `
                            <div class="d-flex justify-content-between align-items-start mb-2" id="video-${v.id}">
                                <div>
                                    <strong>${v.title}</strong>
                                    ${v.description ? `<br><small class="text-muted">${v.description}</small>` : ''}
                                    <br><a href="${v.url}" target="_blank"><small><i class="fas fa-play me-1"></i>观看视频</small></a>
                                </div>
                                <button class="btn btn-sm btn-outline-danger ms-2" onclick="deleteVideo(${c.id}, ${v.id})"><i class="fas fa-trash"></i></button>
                            </div>
                        `).join('') : '<p class="text-muted small">暂无视频</p>'}
                    </div></div>

                    <div class="card mb-3"><div class="card-header d-flex justify-content-between align-items-center">
                        <h6 class="mb-0"><i class="fas fa-link me-2"></i>扩展链接</h6>
                        <button class="btn btn-outline-primary btn-sm" onclick="showAddLinkForm(${c.id})"><i class="fas fa-plus"></i></button>
                    </div><div class="card-body" id="links-area">
                        ${d.links.length ? d.links.map(l => `
                            <div class="d-flex justify-content-between align-items-start mb-2" id="link-${l.id}">
                                <div>
                                    <a href="${l.url}" target="_blank">${l.title}</a>
                                    ${l.description ? `<br><small class="text-muted">${l.description}</small>` : ''}
                                </div>
                                <button class="btn btn-sm btn-outline-danger ms-2" onclick="deleteLink(${c.id}, ${l.id})"><i class="fas fa-trash"></i></button>
                            </div>
                        `).join('') : '<p class="text-muted small">暂无链接</p>'}
                    </div></div>
                </div>
            </div>
        `;
        $('#main-content').html(html);
    });
}

function renderStationCard(caseId, s) {
    return `
        <div class="card mb-2" id="station-${s.id}">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6>${s.name}</h6>
                        ${s.assessment_task ? `<p class="small text-muted"><strong>考核任务：</strong>${s.assessment_task}</p>` : ''}
                        <p class="small"><strong>题目：</strong>${s.question}</p>
                        <div class="small"><strong>答案：</strong>
                            <ol class="mb-0">${s.answers.map(a => `<li>${a.answer_item} <span class="text-muted">(权重${a.score_weight})</span></li>`).join('')}</ol>
                        </div>
                        <div class="mt-1">
                            <span class="badge bg-info">${s.learning_count}次学习</span>
                            <span class="badge bg-success ms-1">均分${s.avg_score ? s.avg_score.toFixed(1) : 0}</span>
                        </div>
                    </div>
                    <div class="ms-2">
                        <button class="btn btn-sm btn-outline-primary d-block mb-1" onclick="navToStationEdit(${caseId}, ${s.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger d-block" onclick="deleteStation(${caseId}, ${s.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
}

// =========== 案例元数据编辑 ===========
function toggleCaseMetaEdit(caseId) {
    $.get(`/admin/cases/${caseId}`, function(res) {
        if (!res.success) return;
        const c = res.data.case;
        $.get('/api/categories', function(catRes) {
            const cats = catRes.success ? catRes.data : [];
            const html = `
                <div class="mb-3">
                    <label class="form-label">标题</label>
                    <input type="text" class="form-control" id="edit-case-title" value="${c.title}">
                </div>
                <div class="mb-3">
                    <label class="form-label">类别</label>
                    <select class="form-select" id="edit-case-category">
                        ${cats.map(cat => `<option value="${cat.id}" ${c.category_name===cat.name?'selected':''}>${cat.name}</option>`).join('')}
                    </select>
                </div>
                <div class="row g-2 mb-3">
                    <div class="col-md-6">
                        <label class="form-label">难度</label>
                        <select class="form-select" id="edit-case-difficulty">
                            <option value="basic" ${c.difficulty==='basic'?'selected':''}>基础</option>
                            <option value="intermediate" ${c.difficulty==='intermediate'?'selected':''}>中级</option>
                            <option value="advanced" ${c.difficulty==='advanced'?'selected':''}>高级</option>
                        </select>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">类型</label>
                        <select class="form-select" id="edit-case-type">
                            <option value="learning" ${c.case_type==='learning'?'selected':''}>学习案例</option>
                            <option value="exam" ${c.case_type==='exam'?'selected':''}>考试案例</option>
                        </select>
                    </div>
                </div>
                <div class="mb-3">
                    <label class="form-label">案例指引</label>
                    <textarea class="form-control" id="edit-case-guide" rows="3">${c.case_guide || ''}</textarea>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-primary btn-sm" onclick="submitCaseMetaEdit(${caseId})">保存</button>
                    <button class="btn btn-outline-secondary btn-sm" onclick="navToCaseDetail(${caseId})">取消</button>
                </div>
            `;
            $('#case-meta-view').hide();
            $('#case-meta-edit').html(html).show();
        });
    });
}

function submitCaseMetaEdit(caseId) {
    const payload = {
        title: ($('#edit-case-title').val() || '').trim(),
        category_id: parseInt($('#edit-case-category').val()),
        difficulty: $('#edit-case-difficulty').val(),
        case_type: $('#edit-case-type').val(),
        case_guide: ($('#edit-case-guide').val() || '').trim()
    };
    $.ajax({
        url: `/admin/cases/${caseId}`,
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(payload),
        success: function(res) {
            if (res.success) {
                showAlert('已更新', 'success');
                renderCaseDetailPage(caseId);
            } else {
                showAlert(res.message || '更新失败', 'error');
            }
        }
    });
}

// =========== 站点/视频/链接 增删操作 ===========
function showAddStationForm(caseId) {
    const html = `
        <div class="card mb-2 border-success">
            <div class="card-body">
                <div class="mb-2"><input type="text" class="form-control form-control-sm" id="new-station-name" placeholder="站点名称 *"></div>
                <div class="mb-2"><input type="text" class="form-control form-control-sm" id="new-station-task" placeholder="考核任务"></div>
                <div class="mb-2"><textarea class="form-control form-control-sm" id="new-station-question" placeholder="题目 *" rows="2"></textarea></div>
                <div class="d-flex gap-2">
                    <button class="btn btn-success btn-sm" onclick="submitAddStation(${caseId})">添加</button>
                    <button class="btn btn-outline-secondary btn-sm" onclick="navToCaseDetail(${caseId})">取消</button>
                </div>
            </div>
        </div>`;
    $('#stations-area').prepend(html);
}

function submitAddStation(caseId) {
    const payload = {
        name: ($('#new-station-name').val() || '').trim(),
        assessment_task: ($('#new-station-task').val() || '').trim(),
        question: ($('#new-station-question').val() || '').trim()
    };
    if (!payload.name || !payload.question) { showAlert('站点名称和题目不能为空', 'error'); return; }
    $.ajax({
        url: `/admin/cases/${caseId}/stations`,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(payload),
        success: function(res) {
            if (res.success) {
                showAlert('站点已添加', 'success');
                renderCaseDetailPage(caseId);
            } else { showAlert(res.message || '添加失败', 'error'); }
        }
    });
}

function deleteStation(caseId, stationId) {
    if (!confirm('确定删除该站点？相关的学习记录、考试记录也将一并删除。')) return;
    $.ajax({
        url: `/admin/cases/${caseId}/stations/${stationId}`,
        method: 'DELETE',
        success: function(res) {
            if (res.success) { showAlert('已删除', 'success'); renderCaseDetailPage(caseId); }
            else { showAlert(res.message || '删除失败', 'error'); }
        },
        error: function(xhr) {
            var msg = '删除失败';
            try { var r = JSON.parse(xhr.responseText); if (r.message) msg = r.message; } catch(e) {}
            showAlert(msg, 'error');
        }
    });
}

function showAddVideoInline(caseId) {
    const html = `
        <div class="border border-info rounded p-2 mb-2" id="add-video-form">
            <input type="text" class="form-control form-control-sm mb-1" id="new-video-title" placeholder="视频标题 *">
            <div class="mb-1">
                <input type="file" class="form-control form-control-sm" id="new-video-file" accept="video/*">
                <small class="text-muted">上传本地视频文件</small>
            </div>
            <div class="input-group input-group-sm mb-1">
                <span class="input-group-text">或URL</span>
                <input type="text" class="form-control" id="new-video-url" placeholder="https://...">
            </div>
            <input type="text" class="form-control form-control-sm mb-2" id="new-video-desc" placeholder="描述（可选）">
            <div class="d-flex gap-2">
                <button class="btn btn-success btn-sm" onclick="submitAddVideoInline(${caseId})">添加</button>
                <button class="btn btn-outline-secondary btn-sm" onclick="navToCaseDetail(${caseId})">取消</button>
            </div>
        </div>`;
    $('#videos-area').prepend(html);
}

function submitAddVideoInline(caseId) {
    const title = ($('#new-video-title').val() || '').trim();
    const desc = ($('#new-video-desc').val() || '').trim();
    if (!title) { showAlert('视频标题不能为空', 'error'); return; }
    const fileInput = document.getElementById('new-video-file');
    const file = fileInput && fileInput.files && fileInput.files[0];
    const urlInput = ($('#new-video-url').val() || '').trim();

    function saveVideo(url) {
        $.ajax({
            url: `/admin/cases/${caseId}/videos`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ title: title, url: url, description: desc }),
            success: function(res) {
                if (res.success) { showAlert('视频已添加', 'success'); renderCaseDetailPage(caseId); }
                else { showAlert(res.message || '添加失败', 'error'); }
            }
        });
    }

    if (file) {
        const fd = new FormData();
        fd.append('file', file);
        $.ajax({
            url: '/admin/videos/upload',
            method: 'POST',
            processData: false,
            contentType: false,
            data: fd,
            success: function(res) {
                if (res.success) { saveVideo(res.url); }
                else { showAlert(res.message || '上传失败', 'error'); }
            },
            error: function() { showAlert('视频上传失败', 'error'); }
        });
    } else if (urlInput) {
        saveVideo(urlInput);
    } else {
        showAlert('请选择视频文件或填写视频URL', 'error');
    }
}

function deleteVideo(caseId, videoId) {
    if (!confirm('确定删除该视频？')) return;
    $.ajax({
        url: `/admin/cases/${caseId}/videos/${videoId}`,
        method: 'DELETE',
        success: function(res) {
            if (res.success) { showAlert('已删除', 'success'); renderCaseDetailPage(caseId); }
            else { showAlert(res.message || '删除失败', 'error'); }
        },
        error: function() { showAlert('删除失败', 'error'); }
    });
}

function showAddLinkForm(caseId) {
    const html = `
        <div class="border border-info rounded p-2 mb-2" id="add-link-form">
            <input type="text" class="form-control form-control-sm mb-1" id="new-link-title" placeholder="链接标题 *">
            <input type="text" class="form-control form-control-sm mb-1" id="new-link-url" placeholder="链接URL *">
            <input type="text" class="form-control form-control-sm mb-2" id="new-link-desc" placeholder="描述（可选）">
            <div class="d-flex gap-2">
                <button class="btn btn-success btn-sm" onclick="submitAddLink(${caseId})">添加</button>
                <button class="btn btn-outline-secondary btn-sm" onclick="navToCaseDetail(${caseId})">取消</button>
            </div>
        </div>`;
    $('#links-area').prepend(html);
}

function submitAddLink(caseId) {
    const payload = {
        title: ($('#new-link-title').val() || '').trim(),
        url: ($('#new-link-url').val() || '').trim(),
        description: ($('#new-link-desc').val() || '').trim()
    };
    if (!payload.title || !payload.url) { showAlert('标题和URL不能为空', 'error'); return; }
    $.ajax({
        url: `/admin/cases/${caseId}/links`,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(payload),
        success: function(res) {
            if (res.success) { showAlert('链接已添加', 'success'); renderCaseDetailPage(caseId); }
            else { showAlert(res.message || '添加失败', 'error'); }
        }
    });
}

function deleteLink(caseId, linkId) {
    if (!confirm('确定删除该链接？')) return;
    $.ajax({
        url: `/admin/cases/${caseId}/links/${linkId}`,
        method: 'DELETE',
        success: function(res) {
            if (res.success) { showAlert('已删除', 'success'); renderCaseDetailPage(caseId); }
            else { showAlert(res.message || '删除失败', 'error'); }
        },
        error: function() { showAlert('删除失败', 'error'); }
    });
}

// =========== 扩展知识（详情页内联操作） ===========
let _knowledgeAnswerIdx = 0;
function showAddKnowledgeInline(caseId) {
    _knowledgeAnswerIdx = 0;
    const html = `
        <div class="border border-warning rounded p-3 mb-2" id="add-knowledge-form">
            <input type="text" class="form-control form-control-sm mb-2" id="new-kn-question" placeholder="问题 *">
            <div class="mb-2">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <label class="form-label mb-0 small">答案项（按项评分）</label>
                    <button class="btn btn-outline-primary btn-sm" onclick="addKnowledgeAnswerItem()">
                        <i class="fas fa-plus me-1"></i>添加答案项
                    </button>
                </div>
                <div id="knowledge-answer-items">
                    <div class="input-group input-group-sm mb-1">
                        <input type="text" class="form-control" name="kn-answer-item" placeholder="答案内容 *">
                        <input type="number" class="form-control" name="kn-answer-weight" placeholder="权重" value="1" step="0.5" min="0" style="max-width:80px;">
                        <button class="btn btn-outline-danger" onclick="$(this).parent().remove()"><i class="fas fa-times"></i></button>
                    </div>
                </div>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-success btn-sm" onclick="submitAddKnowledgeInline(${caseId})">添加</button>
                <button class="btn btn-outline-secondary btn-sm" onclick="navToCaseDetail(${caseId})">取消</button>
            </div>
        </div>`;
    $('#knowledge-area').prepend(html);
}

function addKnowledgeAnswerItem() {
    _knowledgeAnswerIdx++;
    $('#knowledge-answer-items').append(`
        <div class="input-group input-group-sm mb-1">
            <input type="text" class="form-control" name="kn-answer-item" placeholder="答案内容 *">
            <input type="number" class="form-control" name="kn-answer-weight" placeholder="权重" value="1" step="0.5" min="0" style="max-width:80px;">
            <button class="btn btn-outline-danger" onclick="$(this).parent().remove()"><i class="fas fa-times"></i></button>
        </div>
    `);
}

function submitAddKnowledgeInline(caseId) {
    const question = ($('#new-kn-question').val() || '').trim();
    if (!question) { showAlert('问题不能为空', 'error'); return; }
    const answers = [];
    $('#knowledge-answer-items .input-group').each(function() {
        const item = $(this).find('input[name="kn-answer-item"]').val().trim();
        const weight = parseFloat($(this).find('input[name="kn-answer-weight"]').val()) || 1;
        if (item) answers.push({ answer_item: item, score_weight: weight });
    });
    if (!answers.length) { showAlert('至少需要一个答案项', 'error'); return; }
    $.ajax({
        url: `/admin/cases/${caseId}/knowledge`,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ question: question, answers: answers }),
        success: function(res) {
            if (res.success) { showAlert('已添加', 'success'); renderCaseDetailPage(caseId); }
            else { showAlert(res.message || '添加失败', 'error'); }
        }
    });
}

function deleteKnowledgeInline(caseId, knowledgeId) {
    if (!confirm('确定删除该扩展知识？')) return;
    $.ajax({
        url: `/admin/cases/${caseId}/knowledge/${knowledgeId}`,
        method: 'DELETE',
        success: function(res) {
            if (res.success) { showAlert('已删除', 'success'); renderCaseDetailPage(caseId); }
            else { showAlert(res.message || '删除失败', 'error'); }
        },
        error: function() { showAlert('删除失败', 'error'); }
    });
}

