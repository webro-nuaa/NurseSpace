// 管理员端 — 考试管理 · 批阅（考生列表、答卷详情、人工调分）

function reviewExam(examId) {
    setActiveNav('考试管理');
    $.get(`/admin/exams/${examId}/review`, function(res) {
        if (!res.success) { showAlert(res.message||'加载失败','error'); return; }
        const d = res.data;
        const exam = d.exam;
        const participants = d.participants;

        let rows = '';
        if (participants.length === 0) {
            rows = '<tr><td colspan="5" class="text-center text-muted py-4">暂无考生提交</td></tr>';
        } else {
            participants.forEach(function(p) {
                rows += `
                    <tr>
                        <td>${p.real_name}</td>
                        <td>${p.department || '-'}</td>
                        <td><span class="fw-bold">${p.total_score.toFixed(0)}</span> / ${p.max_score.toFixed(0)}</td>
                        <td>${p.submit_time ? formatDateTime(p.submit_time) : '-'}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" onclick="navToParticipantDetail(${examId}, ${p.record_id})" title="查看答题详情">
                                <i class="fas fa-eye"></i>
                            </button>
                        </td>
                    </tr>`;
            });
        }

        const html = `
            <nav aria-label="breadcrumb"><ol class="breadcrumb">
                <li class="breadcrumb-item"><a href="#" onclick="navToExams(); return false;">考试管理</a></li>
                <li class="breadcrumb-item active">批阅：${exam.title}</li>
            </ol></nav>

            <div class="page-header">
                <div>
                    <h4><i class="fas fa-check-double me-2"></i>批阅 — ${exam.title}</h4>
                    <p class="text-muted mb-0">查看考生作答、AI评分，并手动调整分数</p>
                </div>
                <div class="d-flex gap-2">
                    <a href="/admin/exams/${examId}/export" class="btn btn-sm btn-outline-primary" target="_blank">
                        <i class="fas fa-download me-1"></i>导出成绩 (CSV)
                    </a>
                    <a href="#" class="btn btn-sm btn-outline-secondary" onclick="navToExams(); return false;">
                        <i class="fas fa-arrow-left me-1"></i>返回考试列表
                    </a>
                </div>
            </div>

            <div class="card">
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th>考生姓名</th>
                                    <th>科室</th>
                                    <th>得分</th>
                                    <th>提交时间</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
            </div>`;

        $('#main-content').html(html);
    });
}

function viewParticipantDetail(examId, recordId) {
    setActiveNav('考试管理');
    $.get(`/admin/exams/${examId}/review/${recordId}`, function(res) {
        if (!res.success) { showAlert(res.message||'加载失败','error'); return; }
        const p = res.data.participant;
        const exam = res.data.exam;

        let cards = '';
        if (p.answers.length === 0) {
            cards = '<p class="text-muted text-center py-4">暂无答题记录</p>';
        } else {
            cards = p.answers.map(function(a, i) {
                return `
                    <div class="card mb-3">
                        <div class="card-header py-2">
                            <div class="d-flex flex-column flex-md-row justify-content-between gap-2">
                                <div>
                                    <strong>#${i + 1}</strong> ${a.station_name}
                                    <small class="text-muted d-block d-md-inline-block ms-md-1">${a.case_title}</small>
                                </div>
                                <div class="d-flex align-items-center gap-2">
                                    <span class="fw-bold text-nowrap" id="score-display-${a.id}">${a.score.toFixed(0)} 分</span>
                                    <button class="btn btn-sm btn-outline-info" id="re-score-btn-${a.id}" onclick="reScoreAnswer(${examId}, ${a.id}, ${p.record_id})" title="AI 重新评分">
                                        <i class="fas fa-robot"></i><span class="d-none d-md-inline ms-1">重新评分</span>
                                    </button>
                                    <button class="btn btn-sm btn-outline-warning" onclick="showScoreEdit(${examId}, ${a.id}, ${a.score}, ${p.record_id})" title="调整分数">
                                        <i class="fas fa-pen"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="card-body py-2">
                            <div class="mb-2 content-wrap"><small class="text-muted">题目：</small>${a.question}</div>
                            <div class="mb-2"><small class="text-muted">考生作答：</small><div class="border rounded p-2 bg-white content-wrap">${a.user_answer || '<span class="text-muted">(未作答)</span>'}</div></div>
                            ${a.ai_feedback ? '<div class="mb-2"><small class="text-muted">AI 反馈：</small><div class="border rounded p-2 bg-white content-wrap">' + a.ai_feedback + '</div></div>' : ''}
                            ${a.standard_answers && a.standard_answers.length ? `
                                <div class="mb-2"><small class="text-muted">标准答案：</small>
                                    <div class="border rounded p-3 bg-white">
                                        <ol class="mb-0 ps-3">${a.standard_answers.map(function(sa) {
                                            return '<li class="mb-1 content-wrap">' + sa.answer_item + (sa.score_weight !== 1 ? ' <span class="badge bg-info ms-1" style="font-size:0.65rem;">权重 ' + sa.score_weight + '</span>' : '') + '</li>';
                                        }).join('')}</ol>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>`;
            }).join('');
        }

        const html = `
            <nav aria-label="breadcrumb"><ol class="breadcrumb">
                <li class="breadcrumb-item"><a href="#" onclick="navToExams(); return false;">考试管理</a></li>
                <li class="breadcrumb-item"><a href="#" onclick="navToExamReview(${examId}); return false;">批阅：${exam.title}</a></li>
                <li class="breadcrumb-item active">${p.real_name}</li>
            </ol></nav>

            <div class="page-header">
                <div>
                    <h4><i class="fas fa-user-check me-2"></i>${p.real_name} 的答题详情</h4>
                    <p class="text-muted mb-0">
                        ${p.department ? '<span class="me-3"><i class="fas fa-building me-1"></i>' + p.department + '</span>' : ''}
                        <span class="me-3"><i class="fas fa-star me-1"></i>总分：${p.total_score.toFixed(0)} / ${p.max_score.toFixed(0)}</span>
                        ${p.submit_time ? '<span><i class="fas fa-clock me-1"></i>提交：' + formatDateTime(p.submit_time) + '</span>' : ''}
                    </p>
                </div>
                <div class="d-flex gap-2">
                    <a href="#" class="btn btn-sm btn-outline-secondary" onclick="navToExamReview(${examId}); return false;">
                        <i class="fas fa-arrow-left me-1"></i>返回考生列表
                    </a>
                </div>
            </div>

            ${cards}`;

        $('#main-content').html(html);
    });
}

function toggleParticipantAnswers(recordId) {
    // No longer used — replaced by viewParticipantDetail page navigation
}

function showScoreEdit(examId, answerId, currentScore, recordId) {
    const newScore = prompt('调整分数（当前：' + currentScore.toFixed(0) + '）：', currentScore.toFixed(0));
    if (newScore === null) return;

    const scoreNum = parseFloat(newScore);
    if (isNaN(scoreNum) || scoreNum < 0) {
        showAlert('请输入有效的分数', 'error');
        return;
    }

    $.ajax({
        url: `/admin/exams/${examId}/review/${answerId}/score`,
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({ score: scoreNum }),
        success: function(res) {
            if (res.success) {
                showAlert('分数已更新', 'success');
                if (recordId) {
                    setTimeout(function() { viewParticipantDetail(examId, recordId); }, 500);
                } else {
                    setTimeout(function() { reviewExam(examId); }, 500);
                }
            } else { showAlert(res.message||'更新失败','error'); }
        }
    });
}

function reScoreAnswer(examId, answerId, recordId) {
    if (!confirm('确定用 AI 重新评分吗？这将覆盖当前分数和反馈。')) return;
    var $btn = $('#re-score-btn-' + answerId);
    $btn.prop('disabled', true).find('i').addClass('fa-spin');
    $.ajax({
        url: '/admin/exams/' + examId + '/review/' + answerId + '/re-score',
        method: 'POST',
        contentType: 'application/json',
        success: function(res) {
            if (res.success) {
                showAlert('AI 重新评分完成', 'success');
                if (recordId) {
                    setTimeout(function() { viewParticipantDetail(examId, recordId); }, 500);
                } else {
                    setTimeout(function() { reviewExam(examId); }, 500);
                }
            } else { showAlert(res.message || 'AI评分失败', 'error'); }
        },
        complete: function() {
            $btn.prop('disabled', false).find('i').removeClass('fa-spin');
        }
    });
}

// =========== 增强 AI 设置（含测试连接）===========
var AI_PROVIDERS = {
    openai:  { name: 'OpenAI',     default_model: 'gpt-4o-mini',   default_base_url: 'https://api.openai.com/v1' },
    glm:     { name: '智谱 GLM',   default_model: 'glm-4-air',     default_base_url: 'https://open.bigmodel.cn/api/paas/v4' },
    local:   { name: '本地匹配',   default_model: '',               default_base_url: '' }
};
