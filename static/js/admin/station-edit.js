// 管理员端 — 案例管理 · 站点编辑页（元信息与标准答案）
// =========== 站点编辑页面 ===========
function renderStationEditPage(caseId, stationId) {
    $.when(
        $.get(`/api/stations/${stationId}`),
        $.get(`/admin/cases/${caseId}`)
    ).done(function(stationRes, caseRes) {
        if (!stationRes[0].success) { showAlert('站点不存在', 'error'); return; }
        const s = stationRes[0].data;
        const c = caseRes[0].data.case;
        const html = `
            <nav aria-label="breadcrumb"><ol class="breadcrumb">
                <li class="breadcrumb-item"><a href="#" onclick="navToCases(); return false;">案例管理</a></li>
                <li class="breadcrumb-item"><a href="#" onclick="navToCaseDetail(${caseId}); return false;">${c.title}</a></li>
                <li class="breadcrumb-item active">${s.name}</li>
            </ol></nav>
            <div class="page-header">
                <div>
                    <h4>${s.name}</h4>
                </div>
            </div>
            <div class="row"><div class="col-lg-8">
                <div class="card mb-3"><div class="card-header"><h5 class="mb-0">站点信息</h5></div>
                <div class="card-body">
                    <div class="mb-2">
                        <label class="form-label">站点名称</label>
                        <input type="text" class="form-control" id="station-name" value="${s.name}">
                    </div>
                    <div class="mb-2">
                        <label class="form-label">考核任务</label>
                        <textarea class="form-control" id="station-task" rows="2">${s.assessment_task || ''}</textarea>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">题目</label>
                        <textarea class="form-control" id="station-question" rows="3">${s.question || ''}</textarea>
                    </div>
                    <button class="btn btn-primary" onclick="saveStationMeta(${caseId}, ${stationId})"><i class="fas fa-save me-1"></i>保存站点信息</button>
                </div></div>

                <div class="card"><div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">标准答案</h5>
                    <button class="btn btn-outline-primary btn-sm" onclick="addAnswerRow()"><i class="fas fa-plus"></i></button>
                </div><div class="card-body">
                    <div id="answers-edit-area">
                        ${(s.standard_answers || []).map((a, i) => `
                            <div class="row g-2 mb-2 answer-row">
                                <div class="col-lg-8"><input type="text" class="form-control form-control-sm" value="${a.answer_item}" data-field="answer_item"></div>
                                <div class="col-lg-2"><input type="number" class="form-control form-control-sm" value="${a.score_weight}" step="0.1" data-field="score_weight"></div>
                                <div class="col-lg-2"><button class="btn btn-sm btn-outline-danger" onclick="$(this).closest('.answer-row').remove()"><i class="fas fa-trash"></i></button></div>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-success mt-2" onclick="saveStationAnswers(${caseId}, ${stationId})"><i class="fas fa-save me-1"></i>保存答案</button>
                </div></div>
            </div></div>
        `;
        $('#main-content').html(html);
    });
}

function saveStationMeta(caseId, stationId) {
    const payload = {
        name: ($('#station-name').val() || '').trim(),
        assessment_task: ($('#station-task').val() || '').trim(),
        question: ($('#station-question').val() || '').trim()
    };
    $.ajax({
        url: `/admin/cases/${caseId}/stations/${stationId}`,
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(payload),
        success: function(res) {
            if (res.success) { showAlert('已保存', 'success'); }
            else { showAlert(res.message || '保存失败', 'error'); }
        }
    });
}

function addAnswerRow() {
    $('#answers-edit-area').append(`
        <div class="row g-2 mb-2 answer-row">
            <div class="col-lg-8"><input type="text" class="form-control form-control-sm" placeholder="答案内容" data-field="answer_item"></div>
            <div class="col-lg-2"><input type="number" class="form-control form-control-sm" value="1.0" step="0.1" data-field="score_weight"></div>
            <div class="col-lg-2"><button class="btn btn-sm btn-outline-danger" onclick="$(this).closest('.answer-row').remove()"><i class="fas fa-trash"></i></button></div>
        </div>
    `);
}

function saveStationAnswers(caseId, stationId) {
    const answers = [];
    $('.answer-row').each(function() {
        const item = $(this).find('[data-field="answer_item"]').val();
        if (item && item.trim()) {
            answers.push({
                answer_item: item.trim(),
                score_weight: parseFloat($(this).find('[data-field="score_weight"]').val()) || 1.0
            });
        }
    });
    $.ajax({
        url: `/admin/cases/${caseId}/stations/${stationId}/answers`,
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({ answers: answers }),
        success: function(res) {
            if (res.success) { showAlert('答案已保存', 'success'); }
            else { showAlert(res.message || '保存失败', 'error'); }
        }
    });
}

