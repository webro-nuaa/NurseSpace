// 管理员端 — 用户管理 · 列表页（列表渲染、新增用户、启用/禁用）
// currentPage：用户列表当前页，供操作后刷新当前页使用
let currentPage = 1;
// 加载用户管理
function loadUsers(page = 1, role = 'nurse') {
    setActiveNav('用户管理');
    currentPage = page;
    
    $.get(`/admin/users?page=${page}&role=${role}`, function(response) {
        if (response.success) {
            const data = response.data;
            const html = `
                <div class="page-header">
                    <div>
                        <h4><i class="fas fa-users me-2"></i>用户管理</h4>
                        <p class="text-muted mb-0">管理护士账号和权限</p>
                    </div>
                    <div class="d-flex gap-2 flex-wrap">
                        <button class="btn btn-primary btn-sm" onclick="navToUserCreate()">
                            <i class="fas fa-plus me-1"></i>添加用户
                        </button>
                        <button class="btn btn-outline-success btn-sm" onclick="navToUserImport()">
                            <i class="fas fa-file-excel me-1"></i>批量导入
                        </button>
                        <a class="btn btn-outline-secondary btn-sm" href="/admin/users/xlsx-template">
                            <i class="fas fa-download me-1"></i>下载模板
                        </a>
                    </div>
                </div>

                <div class="row mb-3">
                    <div class="col-md-4">
                        <div class="search-box">
                            <i class="fas fa-search search-icon"></i>
                            <input type="text" class="form-control" placeholder="搜索用户..." id="user-search">
                        </div>
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
                                                <th>用户名</th>
                                                <th>真实姓名</th>
                                                <th class="d-none d-md-table-cell">科室</th>
                                                <th class="d-none d-lg-table-cell">邮箱</th>
                                                <th>状态</th>
                                                <th>知情同意</th>
                                                <th class="d-none d-lg-table-cell">学习统计</th>
                                                <th class="d-none d-md-table-cell">注册时间</th>
                                                <th>操作</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.users.map(user => `
                                                <tr>
                                                    <td>${user.username}</td>
                                                    <td>${user.real_name}</td>
                                                    <td class="d-none d-md-table-cell">${user.department || '-'}</td>
                                                    <td class="d-none d-lg-table-cell">${user.email || '-'}</td>
                                                    <td>
                                                        <span class="badge ${user.status === 'active' ? 'bg-success' : 'bg-danger'}">
                                                            ${user.status === 'active' ? '正常' : '禁用'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span class="badge ${user.consent_accepted ? 'bg-success' : 'bg-warning text-dark'}">
                                                            ${user.consent_accepted ? '已同意' : '未同意'}
                                                        </span>
                                                    </td>
                                                    <td class="d-none d-lg-table-cell">
                                                        <small>
                                                            学习: ${user.learning_count}<br>
                                                            错题: ${user.wrong_count}
                                                        </small>
                                                    </td>
                                                    <td class="d-none d-md-table-cell">${formatDateTime(user.created_at)}</td>
                                                    <td>
                                                        <div class="btn-action-group">
                                                        <button class="btn btn-sm btn-outline-primary" onclick="navToUserDetail(${user.id})">
                                                            <i class="fas fa-eye"></i>
                                                        </button>
                                                        <button class="btn btn-sm btn-outline-warning" onclick="navToUserEdit(${user.id})">
                                                            <i class="fas fa-edit"></i>
                                                        </button>
                                                        <button class="btn btn-sm ${user.status === 'active' ? 'btn-outline-danger' : 'btn-outline-success'}"
                                                                onclick="toggleUserStatus(${user.id}, '${user.status}')">
                                                            <i class="fas ${user.status === 'active' ? 'fa-ban' : 'fa-check'}"></i>
                                                        </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                                
                                ${generatePagination(data.pagination, 'navToUsersPage')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            $('#main-content').html(html);
        }
    });
}

// 按角色显隐护士专属字段
function toggleNurseFields() {
    const isNurse = $('#add-role').val() === 'nurse';
    $('#add-school-group, #add-serial-number-group').toggle(isNurse);
}

// 提交添加用户
function submitAddUser() {
    const data = {
        username: $('#add-username').val(),
        password: $('#add-password').val(),
        real_name: $('#add-real-name').val(),
        email: $('#add-email').val(),
        phone: $('#add-phone').val(),
        department: $('#add-department').val(),
        school: $('#add-school').val(),
        serial_number: $('#add-serial-number').val(),
        role: $('#add-role').val()
    };
    
    $.ajax({
        url: '/auth/register',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function(response) {
            if (response.success) {
                showAlert('用户添加成功', 'success');
                $('#addUserModal').modal('hide');
                navToUsers(); // 返回列表
            } else {
                showAlert(response.message, 'error');
            }
        }
    });
}

// 切换用户状态
function toggleUserStatus(userId, currentStatus) {
    const newStatus = currentStatus === 'active' ? '禁用' : '启用';
    
    if (confirm(`确定要${newStatus}该用户吗？`)) {
        $.ajax({
            url: `/auth/users/${userId}/toggle-status`,
            method: 'POST',
            success: function(response) {
                if (response.success) {
                    showAlert(response.message, 'success');
                    loadUsers(currentPage); // 刷新当前页
                } else {
                    showAlert(response.message, 'error');
                }
            }
        });
    }
}

