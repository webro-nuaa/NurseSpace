// 管理员端 — 考试管理 · 考题管理（按案例选题、案例预览、题目增删）

function manageExamQuestions(examId) {
    window._currentExamId = examId;
    $.get(`/admin/exams/${examId}/questions`, function(res) {
        if (!res.success) { showAlert(res.message||'加载失败','error'); return; }
        const d = res.data;
        window._examExistingIds = d.questions.map(q => q.case_id);
        window._examExistingCaseIds = [];
        // 按案例分组已选站点
        const caseMap = {};
        d.questions.forEach(function(q) {
            if (!caseMap[q.case_id]) { caseMap[q.case_id] = { title: q.case_title, stations: [] }; }
            caseMap[q.case_id].stations.push(q);
        });
        window._examExistingCaseIds = Object.keys(caseMap).map(Number);
        buildExamQuestionPage(examId, d.exam, caseMap);
    });
}

function buildExamQuestionPage(examId, exam, existingCaseMap) {
    const existingCaseCount = Object.keys(existingCaseMap).length;
    const existingTotalStations = Object.values(existingCaseMap).reduce(function(sum, c) { return sum + c.stations.length; }, 0);

    let existingCardsHtml = '';
    Object.keys(existingCaseMap).forEach(function(caseId) {
        const c = existingCaseMap[caseId];
        const q = c.stations[0];
        const stationCount = q ? (q.station_count || c.stations.length) : c.stations.length;
        existingCardsHtml += `
            <div class="d-flex align-items-center justify-content-between border rounded p-2 me-2 mb-2 bg-white" style="min-width:200px;max-width:260px;">
                <div style="min-width:0;">
                    <div class="text-truncate small fw-bold">${c.title}</div>
                    <span class="badge bg-info" style="font-size:0.7rem;">${stationCount} 题</span>
                </div>
                <button class="btn btn-sm text-danger flex-shrink-0 ms-2" title="移除" onclick="removeCaseFromExam(${examId}, ${caseId})" style="padding:0 4px;line-height:1;">
                    <i class="fas fa-times" style="font-size:0.75rem;"></i>
                </button>
            </div>`;
    });

    const html = `
        <nav aria-label="breadcrumb"><ol class="breadcrumb">
            <li class="breadcrumb-item"><a href="#" onclick="navToExams(); return false;">考试管理</a></li>
            <li class="breadcrumb-item active">${exam.title} - 添加题目</li>
        </ol></nav>

        <div class="page-header">
            <div>
                <h4><i class="fas fa-list-check me-2"></i>${exam.title} — 添加题目</h4>
                <p class="text-muted mb-0">从考试案例库中选择案例加入本场考试，每个案例包含其全部站点题目</p>
            </div>
            <a href="#" class="btn btn-sm btn-outline-secondary" onclick="navToExams(); return false;">
                <i class="fas fa-arrow-left me-1"></i>返回考试列表
            </a>
        </div>

        <!-- 已选案例条 -->
        <div class="card mb-3 border-success"><div class="card-header bg-success bg-opacity-10 d-flex justify-content-between align-items-center">
            <span><i class="fas fa-check-circle me-2 text-success"></i><strong>已选案例</strong>
                <span class="badge bg-success ms-2" id="existing-count">${existingCaseCount}</span>
                <small class="text-muted ms-1">个案例，共 <span id="existing-total-stations">${existingTotalStations}</span> 道题目</small>
            </span>
            ${existingCaseCount ? '<button class="btn btn-sm btn-outline-danger" onclick="clearExamCases(' + examId + ')"><i class="fas fa-trash-alt me-1"></i>清空全部</button>' : ''}
        </div><div class="card-body" id="existing-questions-bar">
            <div class="d-flex flex-wrap align-items-start">
                ${existingCaseCount ? existingCardsHtml : '<p class="text-muted small mb-0 text-center w-100 py-2">暂未选择案例，从下方表格中选择案例添加</p>'}
            </div>
        </div></div>

        <!-- 案例选择表格 -->
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                <span><i class="fas fa-folder-open me-2"></i><strong>考试案例库</strong>
                    <small class="text-muted ms-2">仅显示类型为「考试案例」的案例</small>
                </span>
                <div class="d-flex gap-2 flex-wrap">
                    <select class="form-select form-select-sm" id="exam-case-category-filter" style="width:auto;" onchange="loadExamCaseTable(${examId})">
                        <option value="">全部类别</option>
                    </select>
                    <div class="input-group input-group-sm" style="width:260px;">
                        <span class="input-group-text"><i class="fas fa-search"></i></span>
                        <input type="text" class="form-control" id="exam-case-search" placeholder="搜索案例标题、站点名称..." onkeyup="debounceExamCaseSearch(${examId})">
                    </div>
                </div>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover mb-0">
                        <thead class="table-light">
                            <tr>
                                <th>案例标题</th>
                                <th style="width:80px;" class="d-none d-sm-table-cell">类别</th>
                                <th style="width:70px;" class="d-none d-sm-table-cell">难度</th>
                                <th style="width:60px;">题数</th>
                                <th style="width:60px;">状态</th>
                                <th style="width:110px;">操作</th>
                            </tr>
                        </thead>
                        <tbody id="exam-case-tbody">
                            <tr><td colspan="6" class="text-center text-muted py-3">
                                <div class="spinner-border spinner-border-sm me-2"></div>加载中...
                            </td></tr>
                        </tbody>
                    </table>
                </div>
                <div id="exam-case-pagination" class="p-3 border-top"></div>
            </div>
        </div>
    `;
    $('#main-content').html(html);

    // 加载类别筛选下拉
    $.get('/api/categories', function(res) {
        if (res.success) {
            const opts = res.data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            $('#exam-case-category-filter').append(opts);
        }
    });

    loadExamCaseTable(examId);
}

let _examCaseSearchTimer = null;
function debounceExamCaseSearch(examId) {
    clearTimeout(_examCaseSearchTimer);
    _examCaseSearchTimer = setTimeout(function() { loadExamCaseTable(examId); }, 350);
}

function loadExamCaseTable(examId, page) {
    page = page || 1;
    const kw = ($('#exam-case-search').val() || '').trim();
    const catId = $('#exam-case-category-filter').val();
    const existingIds = window._examExistingIds || [];

    let url = `/admin/cases?case_type=exam&include_stations=true&page=${page}&per_page=10`;
    if (kw) url += `&search=${encodeURIComponent(kw)}`;
    if (catId) url += `&category_id=${catId}`;

    $.get(url, function(res) {
        if (!res.success) return;
        const cases = res.data.cases;
        const pg = res.data.pagination;

        let rows = '';
        if (cases.length === 0) {
            rows = '<tr><td colspan="6" class="text-center text-muted py-4">无匹配的考试案例<p class="small mt-1 mb-0">请确认已创建类型为「考试案例」的案例，或调整搜索条件</p></td></tr>';
        } else {
            cases.forEach(function(c) {
                const diffBadge = c.difficulty === 'advanced' ? 'danger' : (c.difficulty === 'basic' ? 'success' : 'warning');
                const diffLabel = c.difficulty === 'advanced' ? '高级' : (c.difficulty === 'basic' ? '基础' : '中级');
                const stations = c.stations || [];
                const allAdded = existingIds.indexOf(c.id) !== -1;

                // 构建站点预览列表（用于展开）
                let stationsPreview = '';
                if (stations.length > 0) {
                    stationsPreview = `
                        <tr class="station-detail-row" id="station-detail-${c.id}" style="display:none;background:#f8f9fb;">
                            <td colspan="6" class="p-0">
                                <div class="p-3 border-top">
                                    <small class="text-muted fw-bold d-block mb-2">包含的站点题目：</small>
                                    ${stations.map(function(s, si) {
                                        const sAdded = existingIds.indexOf(s.id) !== -1;
                                        const answers = s.standard_answers || [];
                                        return `<div class="d-flex border rounded p-2 mb-2 bg-white ${sAdded ? 'border-success' : ''}">
                                            <div style="min-width:0;flex:1;">
                                                <div class="small fw-bold">${s.name || '站点 ' + (si+1)} ${sAdded ? '<span class="text-success"><i class="fas fa-check-circle"></i> 已选</span>' : ''}</div>
                                                <div class="small text-muted">${s.question || '(无题目)'}</div>
                                                ${answers.length ? '<div class="mt-1">' + answers.map(function(a) {
                                                    return '<span class="badge bg-light text-dark me-1 mb-1" style="font-size:0.7rem;">' + a.answer_item + (a.score_weight !== 1 ? ' (x' + a.score_weight + ')' : '') + '</span>';
                                                }).join('') + '</div>' : ''}
                                            </div>
                                        </div>`;
                                    }).join('')}
                                </div>
                            </td>
                        </tr>`;
                }

                rows += `
                    <tr class="case-main-row">
                        <td>
                            <strong>${c.title}</strong>
                            ${stations.length > 0 ? `<a href="#" class="text-decoration-none ms-2 small" onclick="toggleStationDetail(${c.id}); return false;" title="展开查看站点">
                                <i class="fas fa-chevron-down" id="toggle-icon-${c.id}" style="font-size:0.7rem;"></i> <span class="d-none d-sm-inline">站点</span>
                            </a>` : ''}
                        </td>
                        <td class="d-none d-sm-table-cell"><span class="badge bg-secondary">${c.category_name}</span></td>
                        <td class="d-none d-sm-table-cell"><span class="badge bg-${diffBadge}">${diffLabel}</span></td>
                        <td>${c.station_count}</td>
                        <td>${allAdded ? '<span class="text-success fw-bold">已添加</span>' : '<span class="text-muted">未添加</span>'}</td>
                        <td>
                            <div class="btn-action-group">
                            <button class="btn btn-sm ${allAdded ? 'btn-outline-danger' : 'btn-primary'}" onclick="${allAdded ? 'removeCaseFromExam(' + examId + ',' + c.id + ')' : 'addCaseToExam(' + examId + ',' + c.id + ')'}" title="${allAdded ? '移除此案例' : '添加此案例'}">
                                <i class="fas ${allAdded ? 'fa-minus' : 'fa-plus'}"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-info" onclick="showCasePreviewModal(${c.id})" title="预览案例详情">
                                <i class="fas fa-eye"></i>
                            </button>
                            </div>
                        </td>
                    </tr>
                    ${stationsPreview}
                `;
            });
        }

        $('#exam-case-tbody').html(rows);

        // 分页
        let pagHtml = '';
        if (pg.pages > 1) {
            pagHtml = '<nav><ul class="pagination pagination-sm mb-0 justify-content-center">';
            pagHtml += `<li class="page-item ${pg.has_prev ? '' : 'disabled'}"><a class="page-link" href="#" onclick="loadExamCaseTable(${examId}, ${pg.page - 1}); return false;">上一页</a></li>`;
            for (let p = 1; p <= pg.pages; p++) {
                pagHtml += `<li class="page-item ${p === pg.page ? 'active' : ''}"><a class="page-link" href="#" onclick="loadExamCaseTable(${examId}, ${p}); return false;">${p}</a></li>`;
                if (p >= pg.page + 4 && p < pg.pages - 1) { pagHtml += '<li class="page-item disabled"><span class="page-link">...</span></li>'; p = pg.pages - 2; }
            }
            pagHtml += `<li class="page-item ${pg.has_next ? '' : 'disabled'}"><a class="page-link" href="#" onclick="loadExamCaseTable(${examId}, ${pg.page + 1}); return false;">下一页</a></li>`;
            pagHtml += `<li class="page-item disabled"><span class="page-link text-muted">共 ${pg.total} 条</span></li>`;
            pagHtml += '</ul></nav>';
        }
        $('#exam-case-pagination').html(pagHtml || '<div class="text-center"><small class="text-muted">共 ' + pg.total + ' 个案例</small></div>');
    });
}

function toggleStationDetail(caseId) {
    $('#station-detail-' + caseId).toggle();
    $('#toggle-icon-' + caseId).toggleClass('fa-chevron-down fa-chevron-up');
}

function showCasePreviewModal(caseId) {
    // 使用模态框显示案例详情，不影响当前题目选择上下文
    $.get('/admin/cases/' + caseId, function(res) {
        if (!res.success) { showAlert(res.message || '加载失败', 'error'); return; }
        const c = res.data.case;
        const stations = res.data.stations || [];
        const assessmentStations = stations.filter(s => (s.station_type || 'assessment') === 'assessment');
        const extendedKnowledge = stations.filter(s => s.station_type === 'knowledge');
        let stationsHtml = '';
        assessmentStations.forEach(function(s, i) {
            const answers = s.answers || [];
            stationsHtml += `
                <div class="border rounded p-2 mb-2">
                    <div class="fw-bold small">站点 ${i+1}：${s.name}</div>
                    ${s.assessment_task ? '<div class="small text-muted">考核任务：' + s.assessment_task + '</div>' : ''}
                    <div class="small">题目：${s.question}</div>
                    ${answers.length ? '<div class="mt-1">' + answers.map(function(a) {
                        return '<span class="badge bg-light text-dark me-1">' + a.answer_item + ' (权重:' + a.score_weight + ')</span>';
                    }).join('') + '</div>' : ''}
                </div>`;
        });

        let knowledgeHtml = '';
        if (extendedKnowledge.length) {
            knowledgeHtml = '<h6 class="border-bottom pb-2 mb-3 mt-3">扩展知识</h6>' + extendedKnowledge.map(function(k) {
                return '<div class="small mb-2"><strong>Q: ' + k.question + '</strong><br>A: ' + (k.answers || []).map(function(a) { return a.answer_item; }).join('；') + '</div>';
            }).join('');
        }

        const modal = `
            <div class="modal fade" id="casePreviewModal" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h6 class="modal-title"><i class="fas fa-book-medical me-2"></i>${c.title}</h6>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <span class="badge bg-secondary me-1">${c.category_name}</span>
                                ${getDifficultyBadge(c.difficulty)}
                                ${getCaseTypeBadge(c.case_type)}
                            </div>
                            ${c.case_guide ? '<div class="mb-3"><strong>案例指引：</strong><p class="small text-muted mt-1">' + c.case_guide + '</p></div>' : ''}
                            <h6 class="border-bottom pb-2 mb-3">站点题目（共 ${assessmentStations.length} 题）</h6>
                            ${stationsHtml || '<p class="text-muted small">暂无站点题目</p>'}
                            ${knowledgeHtml}
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">关闭</button>
                        </div>
                    </div>
                </div>
            </div>`;
        $('#modal-container').html(modal);
        $('#casePreviewModal').modal('show');
    });
}

function addCaseToExam(examId, caseId) {
    $.ajax({
        url: `/admin/exams/${examId}/questions`,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ case_ids: [caseId] }),
        success: function(res) {
            if (res.success) {
                showAlert('案例已添加到考试', 'success');
                if (!window._examExistingIds) window._examExistingIds = [];
                window._examExistingIds.push(caseId);
                const activePage = $('.pagination .active .page-link').text() || 1;
                loadExamCaseTable(examId, parseInt(activePage));
                // 刷新已选列表
                $.get(`/admin/exams/${examId}/questions`, function(r2) {
                    if (r2.success) {
                        refreshExistingCasesPanel(r2.data.questions);
                    }
                });
            } else { showAlert(res.message||'添加失败','error'); }
        }
    });
}

function refreshExistingCasesPanel(questions) {
    const caseMap = {};
    questions.forEach(function(q) {
        if (!caseMap[q.case_id]) caseMap[q.case_id] = { title: q.case_title, count: 0, station_count: q.station_count || 0 };
        caseMap[q.case_id].count++;
    });
    const caseIds = Object.keys(caseMap);
    const examId = window._currentExamId || 0;
    const totalStations = Object.values(caseMap).reduce(function(sum, c) { return sum + c.station_count; }, 0);

    $('#existing-count').text(caseIds.length);
    $('#existing-total-stations').text(totalStations);

    if (caseIds.length) {
        const cardsHtml = caseIds.map(function(cid) {
            const c = caseMap[cid];
            return '<div class="d-flex align-items-center justify-content-between border rounded p-2 me-2 mb-2 bg-white" style="min-width:200px;max-width:260px;">' +
                '<div style="min-width:0;">' +
                    '<div class="text-truncate small fw-bold">' + c.title + '</div>' +
                    '<span class="badge bg-info" style="font-size:0.7rem;">' + c.station_count + ' 题</span>' +
                '</div>' +
                '<button class="btn btn-sm text-danger flex-shrink-0 ms-2" title="移除" onclick="removeCaseFromExam(' + examId + ',' + cid + ')" style="padding:0 4px;line-height:1;">' +
                    '<i class="fas fa-times" style="font-size:0.75rem;"></i>' +
                '</button>' +
            '</div>';
        }).join('');
        $('#existing-questions-bar').html('<div class="d-flex flex-wrap align-items-start">' + cardsHtml + '</div>');

        // 确保清空按钮可见
        const headerRight = $('#existing-questions-bar').closest('.card').find('.card-header');
        if (!headerRight.find('.btn-outline-danger').length) {
            headerRight.append('<button class="btn btn-sm btn-outline-danger" onclick="clearExamCases(' + examId + ')"><i class="fas fa-trash-alt me-1"></i>清空全部</button>');
        }
    } else {
        $('#existing-questions-bar').html('<p class="text-muted small mb-0 text-center w-100 py-2">暂未选择案例，从下方表格中选择案例添加</p>');

        // 移除清空按钮
        const clearBtn = $('#existing-questions-bar').closest('.card').find('.card-header .btn-outline-danger');
        if (clearBtn.length) clearBtn.remove();
    }
}

function removeCaseFromExam(examId, caseId) {
    $.ajax({
        url: `/admin/exams/${examId}/questions`,
        method: 'DELETE',
        contentType: 'application/json',
        data: JSON.stringify({ case_ids: [caseId] }),
        success: function(res) {
            if (res.success) {
                showAlert('案例已从考试中移除', 'success');
                window._examExistingIds = (window._examExistingIds || []).filter(function(cid) {
                    return cid !== caseId;
                });
                const activePage = $('.pagination .active .page-link').text() || 1;
                loadExamCaseTable(examId, parseInt(activePage));
                $.get(`/admin/exams/${examId}/questions`, function(r2) {
                    if (r2.success) { refreshExistingCasesPanel(r2.data.questions); }
                });
            } else { showAlert(res.message||'移除失败','error'); }
        }
    });
}

function clearExamCases(examId) {
    if (!confirm('确定要清空该考试的所有题目吗？此操作不可恢复。')) return;
    $.ajax({
        url: `/admin/exams/${examId}/questions/clear`,
        method: 'POST',
        success: function(res) {
            if (res.success) {
                showAlert('已清空', 'success');
                window._examExistingIds = [];
                const activePage = $('.pagination .active .page-link').text() || 1;
                loadExamCaseTable(examId, parseInt(activePage));
                $('#existing-count').text('0');
                $('#existing-total-stations').text('0');
                $('#existing-questions-bar').html('<p class="text-muted small mb-0 text-center w-100 py-2">暂未选择案例，从下方表格中选择案例添加</p>');
                var clearBtn = $('#existing-questions-bar').closest('.card').find('.card-header .btn-outline-danger');
                if (clearBtn.length) clearBtn.remove();
            } else { showAlert(res.message||'操作失败','error'); }
        }
    });
}
