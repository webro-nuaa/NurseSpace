// 管理员端 — 用户管理 · 详情/编辑/创建页
// =========== 用户详情页面（含学习进度 + 密码重置）===========
function renderUserDetailPage(userId) {
    $.when(
        $.get(`/admin/users/${userId}`),
        $.get(`/admin/users/${userId}/progress`)
    ).done(function(userRes, progRes) {
        if (!userRes[0].success) { showAlert('用户不存在', 'error'); return; }
        const u = userRes[0].data;
        const p = progRes[0].success ? progRes[0].data : {};
        const html = `
            <nav aria-label="breadcrumb"><ol class="breadcrumb">
                <li class="breadcrumb-item"><a href="#" onclick="navToUsers(); return false;">用户管理</a></li>
                <li class="breadcrumb-item active">${u.real_name}</li>
            </ol></nav>
            <div class="row g-3">
                <div class="col-lg-4">
                    <div class="card"><div class="card-body text-center">
                        <i class="fas fa-user-circle fa-4x text-primary mb-2"></i>
                        <h4>${u.real_name}</h4>
                        <p class="text-muted">${u.department || '未分配科室'}</p>
                        <span class="badge ${u.status==='active'?'bg-success':'bg-danger'}">${u.status==='active'?'正常':'禁用'}</span>
                        <span class="badge bg-info ms-1">${u.role==='admin'?'管理员':'护士'}</span>
                        <hr>
                        <div class="small text-start">
                            <div><strong>用户名：</strong>${u.username}</div>
                            <div><strong>邮箱：</strong>${u.email || '-'}</div>
                            <div><strong>手机号：</strong>${u.phone || '-'}</div>
                            <div><strong>积分：</strong>${u.points}</div>
                        </div>
                        <div class="d-grid gap-2 mt-3">
                            <button class="btn btn-outline-primary btn-sm" onclick="navToUserEdit(${u.id})"><i class="fas fa-edit me-1"></i>编辑信息</button>
                            <button class="btn btn-outline-warning btn-sm" onclick="resetUserPassword(${u.id})"><i class="fas fa-key me-1"></i>重置密码</button>
                        </div>
                    </div></div>
                </div>
                <div class="col-lg-8">
                    <div class="card mb-3"><div class="card-header"><h6 class="mb-0">学习进度</h6></div>
                    <div class="card-body">
                        ${p.category_progress && p.category_progress.length ? p.category_progress.map(cp => `
                            <div class="mb-2"><div class="d-flex justify-content-between small"><span>${cp.category}</span><span>${cp.completed}/${cp.total}</span></div>
                            <div class="progress" style="height:8px"><div class="progress-bar" style="width:${cp.progress}%"></div></div></div>
                        `).join('') : '<p class="text-muted small">暂无学习记录</p>'}
                    </div></div>
                    <div class="card mb-3"><div class="card-header"><h6 class="mb-0">最近学习记录</h6></div>
                    <div class="card-body p-0"><div class="table-responsive">
                        <table class="table table-sm mb-0">
                            <thead><tr><th>案例</th><th>站点</th><th>得分</th><th>时间</th></tr></thead>
                            <tbody>
                                ${p.recent_records && p.recent_records.length ? p.recent_records.map(r => `
                                    <tr><td>${r.case_title}</td><td>${r.station_name}</td>
                                    <td><span class="badge ${getScoreBadgeClass(r.score)}">${r.score != null ? r.score : '-'}</span></td><td>${formatDateTime(r.completed_at)}</td></tr>
                                `).join('') : '<tr><td colspan="4" class="text-muted">暂无记录</td></tr>'}
                            </tbody>
                        </table>
                    </div></div></div>
                    <div class="card mb-3"><div class="card-header"><h6 class="mb-0">考试记录</h6></div>
                    <div class="card-body p-0"><div class="table-responsive">
                        <table class="table table-sm mb-0">
                            <thead><tr><th>考试ID</th><th>总分</th><th>状态</th><th>提交时间</th></tr></thead>
                            <tbody>
                                ${p.exam_records && p.exam_records.length ? p.exam_records.map(e => `
                                    <tr><td>${e.exam_id}</td><td>${e.total_score}</td>
                                    <td><span class="badge ${e.status==='submitted'?'bg-success':'bg-warning'}">${e.status}</span></td>
                                    <td>${e.submit_time ? formatDateTime(e.submit_time) : '-'}</td></tr>
                                `).join('') : '<tr><td colspan="4" class="text-muted">暂无记录</td></tr>'}
                            </tbody>
                        </table>
                    </div></div></div>
                    <div class="card"><div class="card-header"><h6 class="mb-0">积分变动</h6></div>
                    <div class="card-body p-0"><div class="table-responsive">
                        <table class="table table-sm mb-0">
                            <thead><tr><th>积分</th><th>原因</th><th>时间</th></tr></thead>
                            <tbody>
                                ${p.point_records && p.point_records.length ? p.point_records.map(pr => `
                                    <tr><td><span class="${pr.points>0?'text-success':'text-danger'}">${pr.points>0?'+':''}${pr.points}</span></td>
                                    <td>${pr.reason}</td><td>${formatDateTime(pr.created_at)}</td></tr>
                                `).join('') : '<tr><td colspan="3" class="text-muted">暂无记录</td></tr>'}
                            </tbody>
                        </table>
                    </div></div></div>
                </div>
            </div>
        `;
        $('#main-content').html(html);
    });
}

function renderUserEditPage(userId) {
    $.get(`/admin/users/${userId}`, function(res) {
        if (!res.success) { showAlert(res.message||'加载失败','error'); return; }
        const u = res.data;
        const html = `
            <nav aria-label="breadcrumb"><ol class="breadcrumb">
                <li class="breadcrumb-item"><a href="#" onclick="navToUsers(); return false;">用户管理</a></li>
                <li class="breadcrumb-item"><a href="#" onclick="navToUserDetail(${u.id}); return false;">${u.real_name}</a></li>
                <li class="breadcrumb-item active">编辑</li>
            </ol></nav>
            <div class="page-header">
                <div>
                    <h4><i class="fas fa-user-edit me-2"></i>编辑用户 - ${u.real_name}</h4>
                </div>
            </div>
            <div class="row"><div class="col-lg-6">
                <div class="card"><div class="card-body">
                    <div class="mb-2">
                        <label class="form-label">用户名</label>
                        <input type="text" class="form-control" value="${u.username}" disabled>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">真实姓名</label>
                        <input type="text" class="form-control" id="edit-real-name" value="${u.real_name||''}">
                    </div>
                    <div class="mb-2">
                        <label class="form-label">科室</label>
                        <input type="text" class="form-control" id="edit-department" value="${u.department||''}">
                    </div>
                    <div class="mb-2">
                        <label class="form-label">学校</label>
                        <input type="text" class="form-control" id="edit-school" value="${u.school||''}">
                    </div>
                    <div class="mb-2">
                        <label class="form-label">学号</label>
                        <input type="text" class="form-control" id="edit-serial-number" value="${u.serial_number||''}">
                    </div>
                    <div class="mb-2">
                        <label class="form-label">邮箱</label>
                        <input type="email" class="form-control" id="edit-email" value="${u.email||''}">
                    </div>
                    <div class="mb-2">
                        <label class="form-label">手机号</label>
                        <input type="tel" class="form-control" id="edit-phone" value="${u.phone||''}">
                    </div>
                    <div class="row g-2 mb-3">
                        <div class="col-6">
                            <label class="form-label">角色</label>
                            <select class="form-select" id="edit-role">
                                <option value="nurse" ${u.role==='nurse'?'selected':''}>护士</option>
                                <option value="admin" ${u.role==='admin'?'selected':''}>管理员</option>
                            </select>
                        </div>
                        <div class="col-6">
                            <label class="form-label">状态</label>
                            <select class="form-select" id="edit-status">
                                <option value="active" ${u.status==='active'?'selected':''}>正常</option>
                                <option value="disabled" ${u.status==='disabled'?'selected':''}>禁用</option>
                            </select>
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-primary" onclick="submitEditUserPage(${u.id})">保存</button>
                        <button class="btn btn-outline-secondary" onclick="navToUserDetail(${u.id})">取消</button>
                    </div>
                </div></div>
            </div></div>
        `;
        $('#main-content').html(html);
    });
}

function submitEditUserPage(userId) {
    const payload = {
        real_name: $('#edit-real-name').val(),
        department: $('#edit-department').val(),
        school: $('#edit-school').val(),
        serial_number: $('#edit-serial-number').val(),
        email: $('#edit-email').val(),
        phone: $('#edit-phone').val(),
        role: $('#edit-role').val(),
        status: $('#edit-status').val()
    };
    $.ajax({
        url: `/admin/users/${userId}`,
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(payload),
        success: function(res) {
            if (res.success) { showAlert('保存成功','success'); if (typeof adminReplaceView === 'function') adminReplaceView({tab: 'users', user_id: String(userId)}); renderUserDetailPage(userId); }
            else { showAlert(res.message||'保存失败','error'); }
        }
    });
}

function resetUserPassword(userId) {
    if (!confirm('确定重置该用户的密码？')) return;
    $.ajax({
        url: `/auth/users/${userId}/reset-password`,
        method: 'POST',
        success: function(res) {
            if (res.success) {
                showAlert('密码已重置！新密码：' + res.new_password + '——请妥善保管并告知用户', 'success', 0);
            } else { showAlert(res.message || '操作失败', 'error'); }
        }
    });
}

function renderUserCreatePage() {
    const html = `
        <nav aria-label="breadcrumb"><ol class="breadcrumb">
            <li class="breadcrumb-item"><a href="#" onclick="navToUsers(); return false;">用户管理</a></li>
            <li class="breadcrumb-item active">添加用户</li>
        </ol></nav>
        <div class="page-header">
            <div>
                <h4><i class="fas fa-user-plus me-2"></i>添加用户</h4>
            </div>
        </div>
        <div class="row"><div class="col-lg-6">
            <div class="card"><div class="card-body">
                <div class="mb-3">
                    <label class="form-label">用户名 *</label>
                    <input type="text" class="form-control" id="add-username" required>
                    <div class="form-text">只能包含字母、数字和下划线，长度3-50位</div>
                </div>
                <div class="mb-3">
                    <label class="form-label">密码 *</label>
                    <input type="password" class="form-control" id="add-password" required>
                    <div class="form-text">长度至少8位，需包含字母和数字</div>
                </div>
                <div class="mb-3">
                    <label class="form-label">真实姓名 *</label>
                    <input type="text" class="form-control" id="add-real-name" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">邮箱</label>
                    <input type="email" class="form-control" id="add-email">
                </div>
                <div class="mb-3">
                    <label class="form-label">手机号</label>
                    <input type="tel" class="form-control" id="add-phone">
                </div>
                <div class="mb-3">
                    <label class="form-label">科室</label>
                    <input type="text" class="form-control" id="add-department">
                </div>
                <div class="mb-3 nurse-only" id="add-school-group">
                    <label class="form-label">学校</label>
                    <input type="text" class="form-control" id="add-school">
                </div>
                <div class="mb-3 nurse-only" id="add-serial-number-group">
                    <label class="form-label">学号</label>
                    <input type="text" class="form-control" id="add-serial-number">
                </div>
                <div class="mb-3">
                    <label class="form-label">角色</label>
                    <select class="form-select" id="add-role" onchange="toggleNurseFields()">
                        <option value="nurse">护士</option>
                        <option value="admin">管理员</option>
                    </select>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-primary" onclick="submitAddUser()">添加</button>
                    <button class="btn btn-outline-secondary" onclick="navToUsers()">取消</button>
                </div>
            </div></div>
        </div></div>
    `;
    $('#main-content').html(html);
}

