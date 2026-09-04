// 管理员端 — 考试管理 · 考试列表与创建/编辑/发布/二维码
// getExamStatusBadgeClass / getExamStatusText：考试状态徽章，仅考试域使用
// 获取考试状态徽章类
function getExamStatusBadgeClass(status) {
    const classes = {
        'draft': 'bg-secondary',
        'published': 'bg-success',
        'ended': 'bg-danger'
    };
    return classes[status] || 'bg-secondary';
}

// 获取考试状态文本
function getExamStatusText(status) {
    const texts = {
        'draft': '草稿',
        'published': '已发布',
        'ended': '已结束'
    };
    return texts[status] || '未知';
}

// =========== 增强考试管理 ===========
function loadExams() {
    setActiveNav('考试管理');

    $.get('/admin/exams', function(response) {
        if (response.success) {
            const data = response.data;
            const html = `
                <div class="page-header">
                    <div>
                        <h4><i class="fas fa-file-alt me-2"></i>考试管理</h4>
                        <p class="text-muted mb-0">创建和管理考试</p>
                    </div>
                </div>

                <div class="row mb-3">
                    <div class="col-md-6">
                        <button class="btn btn-primary" onclick="navToExamCreate()">
                            <i class="fas fa-plus me-1"></i>创建考试
                        </button>
                    </div>
                </div>

                <div class="row">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-hover">
                                        <thead>
                                            <tr>
                                                <th>考试标题</th>
                                                <th>状态</th>
                                                <th>题目数</th>
                                                <th>参加人数</th>
                                                <th class="d-none d-sm-table-cell">时长</th>
                                                <th class="d-none d-md-table-cell">创建时间</th>
                                                <th>操作</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.exams.map(exam => `
                                                <tr>
                                                    <td>${exam.title}</td>
                                                    <td>
                                                        <span class="badge ${getExamStatusBadgeClass(exam.status)}">
                                                            ${getExamStatusText(exam.status)}
                                                        </span>
                                                    </td>
                                                    <td>${exam.question_count}</td>
                                                    <td>${exam.participant_count}</td>
                                                    <td class="d-none d-sm-table-cell">${exam.duration}分钟</td>
                                                    <td class="d-none d-md-table-cell">${formatDateTime(exam.created_at)}</td>
                                                    <td>
                                                        <div class="btn-action-group">
                                                        <button class="btn btn-sm btn-outline-primary" onclick="navToExamQuestions(${exam.id})">
                                                            <i class="fas fa-list"></i><span class="d-none d-md-inline ms-1">题目</span>
                                                        </button>
                                                        <button class="btn btn-sm btn-outline-warning" onclick="showExamQrCode(${exam.id})">
                                                            <i class="fas fa-qrcode"></i>
                                                        </button>
                                                        ${exam.status === 'draft' ? `
                                                            <button class="btn btn-sm btn-outline-success" onclick="publishExam(${exam.id})">
                                                                <i class="fas fa-paper-plane"></i>
                                                            </button>
                                                        ` : `
                                                            <button class="btn btn-sm btn-outline-success" onclick="navToExamReview(${exam.id})">
                                                                <i class="fas fa-check-double"></i><span class="d-none d-md-inline ms-1">批阅</span>
                                                            </button>
                                                        `}
                                                        <button class="btn btn-sm btn-outline-info" onclick="navToExamEdit(${exam.id})">
                                                            <i class="fas fa-edit"></i>
                                                        </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            $('#main-content').html(html);
        }
    });
}

function renderExamCreatePage() {
    const html = `
        <nav aria-label="breadcrumb"><ol class="breadcrumb">
            <li class="breadcrumb-item"><a href="#" onclick="navToExams(); return false;">考试管理</a></li>
            <li class="breadcrumb-item active">创建考试</li>
        </ol></nav>
        <div class="page-header">
            <div>
                <h4><i class="fas fa-plus me-2"></i>创建考试</h4>
            </div>
        </div>
        <div class="row"><div class="col-lg-8">
            <div class="card"><div class="card-body">
                <div class="mb-3">
                    <label class="form-label">考试标题 *</label>
                    <input type="text" class="form-control" id="exam-title" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">考试描述</label>
                    <textarea class="form-control" id="exam-description" rows="3"></textarea>
                </div>
                <div class="row g-2 mb-3">
                    <div class="col-md-6">
                        <label class="form-label">开始时间</label>
                        <input type="datetime-local" class="form-control" id="exam-start-time">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">时长（分钟）</label>
                        <input type="number" class="form-control" id="exam-duration" value="60" min="10" max="480">
                    </div>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-primary" onclick="submitCreateExam()">创建</button>
                    <button class="btn btn-outline-secondary" onclick="navToExams()">取消</button>
                </div>
            </div></div>
        </div></div>
    `;
    $('#main-content').html(html);
}

function submitCreateExam() {
    const data = {
        title: $('#exam-title').val(),
        description: $('#exam-description').val(),
        duration: parseInt($('#exam-duration').val()),
        start_time: $('#exam-start-time').val() || null
    };

    $.ajax({
        url: '/admin/exams',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function(response) {
            if (response.success) {
                showAlert('考试创建成功', 'success');
                if (typeof adminReplaceView === 'function') adminReplaceView({tab: 'exams'});
                loadExams();
            } else {
                showAlert(response.message, 'error');
            }
        }
    });
}

function renderExamEditPage(examId) {
    $.get('/admin/exams', function(res) {
        if (!res.success) return;
        const exam = (res.data.exams || []).find(e => e.id == examId);
        if (!exam) { showAlert('考试不存在','error'); return; }
        const html = `
            <nav aria-label="breadcrumb"><ol class="breadcrumb">
                <li class="breadcrumb-item"><a href="#" onclick="navToExams(); return false;">考试管理</a></li>
                <li class="breadcrumb-item active">编辑：${exam.title}</li>
            </ol></nav>
            <div class="page-header">
                <div>
                    <h4><i class="fas fa-edit me-2"></i>编辑考试 - ${exam.title}</h4>
                </div>
            </div>
            <div class="row"><div class="col-lg-6">
                <div class="card"><div class="card-body">
                    <div class="mb-3">
                        <label class="form-label">标题</label>
                        <input type="text" class="form-control" id="exam-edit-title" value="${exam.title}">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">描述</label>
                        <textarea class="form-control" id="exam-edit-desc" rows="3">${exam.description || ''}</textarea>
                    </div>
                    <div class="row g-2 mb-3">
                        <div class="col-md-6">
                            <label class="form-label">开始时间</label>
                            <input type="datetime-local" class="form-control" id="exam-edit-start" value="${exam.start_time ? exam.start_time.substring(0,16) : ''}">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">时长（分钟）</label>
                            <input type="number" class="form-control" id="exam-edit-duration" value="${exam.duration}" min="10" max="480">
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-primary" onclick="submitExamEdit(${examId})">保存</button>
                        <button class="btn btn-outline-secondary" onclick="navToExams()">取消</button>
                    </div>
                </div></div>
            </div></div>
        `;
        $('#main-content').html(html);
    });
}

function submitExamEdit(examId) {
    const payload = {
        title: ($('#exam-edit-title').val() || '').trim(),
        description: ($('#exam-edit-desc').val() || '').trim(),
        duration: parseInt($('#exam-edit-duration').val()),
        start_time: $('#exam-edit-start').val() ? $('#exam-edit-start').val() + ':00' : null
    };
    $.ajax({
        url: `/admin/exams/${examId}`,
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(payload),
        success: function(res) {
            if (res.success) { showAlert('已更新','success'); if (typeof adminReplaceView === 'function') adminReplaceView({tab: 'exams'}); loadExams(); }
            else { showAlert(res.message||'更新失败','error'); }
        }
    });
}

function showExamQrCode(examId) {
    // 先显示 modal 含 loading 状态，AJAX 加载图片更可靠
    const modal = `
        <div class="modal fade" id="qrModal" tabindex="-1">
            <div class="modal-dialog modal-sm modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h6 class="modal-title">考试二维码</h6>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center">
                        <div id="qr-loading" class="py-4">
                            <div class="spinner-border text-primary mb-2" role="status"></div>
                            <p class="text-muted small mb-0">生成二维码中...</p>
                        </div>
                        <div id="qr-result" style="display:none;">
                            <img id="qr-img" class="img-fluid border rounded" alt="QR Code" onload="$('#qr-loading').hide();$('#qr-result').show();" onerror="$('#qr-loading').hide();$('#qr-error-msg').text('二维码加载失败，请确认已登录');$('#qr-error').show();">
                            <p class="text-muted small mt-2">用手机扫描进入考试</p>
                        </div>
                        <div id="qr-error" class="py-3 text-danger" style="display:none;">
                            <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
                            <p class="mb-0 small" id="qr-error-msg">二维码加载失败</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    $('#modal-container').html(modal);
    $('#qrModal').modal('show');

    // 直接用 <img src> 加载，利用 session cookie 鉴权，避免 blob: CSP 问题
    $('#qr-img').attr('src', '/admin/exams/' + examId + '/qr-code?t=' + Date.now());
}

function publishExam(examId) {
    if (!confirm('确定发布该考试？发布后不可撤销')) return;
    $.ajax({
        url: `/admin/exams/${examId}/publish`,
        method: 'POST',
        success: function(res) {
            if (res.success) { showAlert('考试已发布','success'); loadExams(); }
            else { showAlert(res.message||'发布失败','error'); }
        }
    });
}
