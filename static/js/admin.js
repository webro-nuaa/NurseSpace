// 管理员端JavaScript功能

let currentPage = 1;
let caseCategoryFilter = '';
let caseSearch = '';

// 加载数据看板
function loadDashboard() {
    setActiveNav('数据看板');

    $.get('/admin/dashboard', function(response) {
        if (!response.success) return;
        const d = response.data;
        const s = d.statistics;
        const html = `
            <div class="row mb-3">
                <div class="col-12">
                    <h2><i class="fas fa-tachometer-alt me-2"></i>数据看板</h2>
                    <p class="text-muted">系统运行概况总览</p>
                </div>
            </div>
            <div class="row g-3 mb-4">
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <div class="fs-2 fw-bold text-primary">${s.total_users}</div>
                            <div class="text-muted small">护士数量（活跃 ${s.active_users}）</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <div class="fs-2 fw-bold text-success">${s.total_cases}</div>
                            <div class="text-muted small">案例数量</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <div class="fs-2 fw-bold text-info">${s.total_stations}</div>
                            <div class="text-muted small">站点数量</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <div class="fs-2 fw-bold text-warning">${s.total_learning_records}</div>
                            <div class="text-muted small">学习记录总数</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row g-3">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header"><i class="fas fa-history me-1"></i>最近学习动态</div>
                        <div class="card-body p-0">
                            <div class="table-responsive">
                                <table class="table table-sm mb-0">
                                    <thead><tr><th>姓名</th><th>案例</th><th>站点</th><th>得分</th><th>时间</th></tr></thead>
                                    <tbody>
                                    ${d.recent_activities.length ? d.recent_activities.map(a => `
                                        <tr>
                                            <td>${a.user_name}</td>
                                            <td class="text-truncate" style="max-width:100px" title="${a.case_title}">${a.case_title}</td>
                                            <td>${a.station_name}</td>
                                            <td><span class="badge ${getScoreBadgeClass(a.score)}">${a.score}</span></td>
                                            <td class="text-muted small">${formatDateTime(a.completed_at)}</td>
                                        </tr>`).join('') : '<tr><td colspan="5" class="text-center text-muted">暂无记录</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header"><i class="fas fa-layer-group me-1"></i>类别概况</div>
                        <div class="card-body p-0">
                            <div class="table-responsive">
                                <table class="table table-sm mb-0">
                                    <thead><tr><th>类别</th><th>案例数</th><th>站点数</th></tr></thead>
                                    <tbody>
                                    ${d.category_data.length ? d.category_data.map(c => `
                                        <tr><td>${c.category}</td><td>${c.case_count}</td><td>${c.station_count}</td></tr>`).join('') : '<tr><td colspan="3" class="text-center text-muted">暂无数据</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        $('#main-content').html(html);
    });
}

// 加载用户管理
function loadUsers(page = 1, role = 'nurse') {
    setActiveNav('用户管理');
    currentPage = page;
    
    $.get(`/admin/users?page=${page}&role=${role}`, function(response) {
        if (response.success) {
            const data = response.data;
            const html = `
                <div class="row">
                    <div class="col-12">
                        <h2><i class="fas fa-users me-2"></i>用户管理</h2>
                        <p class="text-muted">管理护士账号和权限</p>
                    </div>
                </div>
                
                <div class="row mb-3">
                    <div class="col-md-6 d-flex gap-2">
                        <button class="btn btn-primary" onclick="showAddUserModal()">
                            <i class="fas fa-plus me-1"></i>添加用户
                        </button>
                        <div class="btn-group">
                          <button class="btn btn-outline-success" style="white-space:nowrap" onclick="showUserXlsxImportModal()">
                            <i class="fas fa-file-excel me-1"></i>XLSX导入
                          </button>
                          <a class="btn btn-outline-secondary" style="white-space:nowrap" href="/admin/users/xlsx-template">
                            <i class="fas fa-download me-1"></i>下载模板
                          </a>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
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
                                                <th>科室</th>
                                                <th>邮箱</th>
                                                <th>状态</th>
                                                <th>学习统计</th>
                                                <th>注册时间</th>
                                                <th>操作</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.users.map(user => `
                                                <tr>
                                                    <td>${user.username}</td>
                                                    <td>${user.real_name}</td>
                                                    <td>${user.department || '-'}</td>
                                                    <td>${user.email || '-'}</td>
                                                    <td>
                                                        <span class="badge ${user.status === 'active' ? 'bg-success' : 'bg-danger'}">
                                                            ${user.status === 'active' ? '正常' : '禁用'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <small>
                                                            学习: ${user.learning_count}<br>
                                                            错题: ${user.wrong_count}
                                                        </small>
                                                    </td>
                                                    <td>${formatDateTime(user.created_at)}</td>
                                                    <td>
                                                        <button class="btn btn-sm btn-outline-primary" onclick="editUser(${user.id})">
                                                            <i class="fas fa-edit"></i>
                                                        </button>
                                                        <button class="btn btn-sm ${user.status === 'active' ? 'btn-outline-danger' : 'btn-outline-success'}" 
                                                                onclick="toggleUserStatus(${user.id}, '${user.status}')">
                                                            <i class="fas ${user.status === 'active' ? 'fa-ban' : 'fa-check'}"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                                
                                ${generatePagination(data.pagination, 'loadUsers')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            $('#main-content').html(html);
        }
    });
}

// 显示添加用户模态框
function showAddUserModal() {
    const modal = `
        <div class="modal fade" id="addUserModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-user-plus me-2"></i>添加用户
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="addUserForm">
                            <div class="mb-3">
                                <label class="form-label">用户名 *</label>
                                <input type="text" class="form-control" id="add-username" required>
                                <div class="form-text">只能包含字母、数字和下划线，长度3-50位</div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">密码 *</label>
                                <input type="password" class="form-control" id="add-password" required>
                                <div class="form-text">长度至少6位</div>
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
                            <div class="mb-3">
                                <label class="form-label">角色</label>
                                <select class="form-select" id="add-role">
                                    <option value="nurse">护士</option>
                                    <option value="admin">管理员</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-primary" onclick="submitAddUser()">添加</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $('#modal-container').html(modal);
    $('#addUserModal').modal('show');
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
                loadUsers(); // 刷新列表
            } else {
                showAlert(response.message, 'error');
            }
        }
    });
}

// 导入用户：弹窗
function showUserXlsxImportModal(){
  const modal = `
  <div class="modal fade" id="userXlsxImportModal" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><i class="fas fa-file-excel me-2"></i>批量导入用户（XLSX）</h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="alert alert-info small mb-3">
            <strong><i class="fas fa-info-circle me-1"></i>账号规则</strong><br>
            工号自动生成：<code>NS</code> + 年份 + 3位序号（如 <code>NS26001</code>）<br>
            初始密码：工号后6位 + <code>@ns</code>（如 <code>26001@ns</code>）<br>
            <span class="text-muted">模板只需填写真实姓名、科室等信息，无需填写用户名和密码。</span>
          </div>
          <div class="mb-3">
            <label class="form-label">选择 .xlsx 文件</label>
            <input type="file" id="user-xlsx-file" class="form-control" accept=".xlsx" />
          </div>
          <p class="small text-muted">可先下载模板，按列填写后上传。</p>
        </div>
        <div class="modal-footer">
          <a class="btn btn-outline-secondary" href="/admin/users/xlsx-template"><i class="fas fa-download me-1"></i>下载模板</a>
          <button type="button" class="btn btn-primary" onclick="submitUserXlsxImport()">导入</button>
        </div>
      </div>
    </div>
  </div>`;
  $('#modal-container').html(modal);
  $('#userXlsxImportModal').modal('show');
}

function submitUserXlsxImport(){
  const el = document.getElementById('user-xlsx-file');
  if(!el || !el.files || !el.files[0]){ showAlert('请先选择 .xlsx 文件', 'error'); return; }
  const fd = new FormData();
  fd.append('file', el.files[0]);
  $.ajax({
    url:'/admin/users/batch-import-xlsx',
    method:'POST',
    processData:false,
    contentType:false,
    data: fd,
    success:function(res){
      if(res.success){
        const users = res.users || [];
        let userList = users.map(u => `<tr><td>${u.username}</td><td>${u.password}</td><td>${u.real_name}</td></tr>`).join('');
        const msg = `${res.message}<br><br>
          <table class="table table-sm table-bordered small" style="background:#fff">
            <thead><tr><th>工号</th><th>初始密码</th><th>姓名</th></tr></thead>
            <tbody>${userList}</tbody>
          </table>`;
        showAlert(msg,'success',0);
        $('#userXlsxImportModal').modal('hide');
        loadUsers();
      }
      else{ showAlert(res.message||'导入失败','error'); }
    },
    error:function(xhr){ showAlert((xhr.responseJSON&&xhr.responseJSON.message)||'导入失败','error'); }
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

// 编辑用户（弹窗）
function editUser(userId){
  $.get(`/admin/users/${userId}`, function(res){
    if(!res.success){ showAlert(res.message||'加载失败','error'); return; }
    const u = res.data;
    const modal = `
      <div class="modal fade" id="editUserModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="fas fa-user-edit me-2"></i>编辑用户</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-2">
                <label class="form-label">用户名</label>
                <input type="text" class="form-control" value="${u.username}" disabled>
              </div>
              <div class="mb-2">
                <label class="form-label">真实姓名</label>
                <input id="edit-real-name" type="text" class="form-control" value="${u.real_name||''}">
              </div>
              <div class="mb-2">
                <label class="form-label">科室</label>
                <input id="edit-department" type="text" class="form-control" value="${u.department||''}">
              </div>
              <div class="mb-2">
                <label class="form-label">邮箱</label>
                <input id="edit-email" type="email" class="form-control" value="${u.email||''}">
              </div>
              <div class="mb-2">
                <label class="form-label">手机号</label>
                <input id="edit-phone" type="tel" class="form-control" value="${u.phone||''}">
              </div>
              <div class="row g-2">
                <div class="col-6">
                  <label class="form-label">角色</label>
                  <select id="edit-role" class="form-select">
                    <option value="nurse" ${u.role==='nurse'?'selected':''}>护士</option>
                    <option value="admin" ${u.role==='admin'?'selected':''}>管理员</option>
                  </select>
                </div>
                <div class="col-6">
                  <label class="form-label">状态</label>
                  <select id="edit-status" class="form-select">
                    <option value="active" ${u.status==='active'?'selected':''}>正常</option>
                    <option value="disabled" ${u.status==='disabled'?'selected':''}>禁用</option>
                  </select>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
              <button type="button" class="btn btn-primary" onclick="submitEditUser(${u.id})">保存</button>
            </div>
          </div>
        </div>
      </div>`;
    $('#modal-container').html(modal);
    $('#editUserModal').modal('show');
  });
}

function submitEditUser(userId){
  const payload = {
    real_name: $('#edit-real-name').val(),
    department: $('#edit-department').val(),
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
    success: function(res){
      if(res.success){
        showAlert('保存成功','success');
        $('#editUserModal').modal('hide');
        loadUsers(currentPage);
      }else{
        showAlert(res.message||'保存失败','error');
      }
    },
    error: function(xhr){
      showAlert((xhr.responseJSON && xhr.responseJSON.message) || '保存失败','error');
    }
  });
}

// 加载案例管理
function loadCases(page = 1) {
    setActiveNav('案例管理');

    let url = `/admin/cases?page=${page}`;
    if (caseCategoryFilter) url += `&category_id=${caseCategoryFilter}`;
    if (caseSearch) url += `&search=${encodeURIComponent(caseSearch)}`;

    $.get(url, function(response) {
        if (response.success) {
            const data = response.data;
            const html = `
                <div class="row">
                    <div class="col-12">
                        <h2><i class="fas fa-book-medical me-2"></i>案例管理</h2>
                        <p class="text-muted">管理医疗案例和内容</p>
                    </div>
                </div>
                
                <div class="row mb-3">
                    <div class="col-md-4">
                        <button class="btn btn-primary me-2" onclick="showUploadModal()">
                            <i class="fas fa-upload me-1"></i>上传案例
                        </button>
                        <button class="btn btn-success me-2" onclick="batchUploadCases()">
                            <i class="fas fa-cloud-upload-alt me-1"></i>批量上传
                        </button>
                    </div>
                    <div class="col-md-4">
                        <div class="input-group">
                            <span class="input-group-text"><i class="fas fa-search"></i></span>
                            <input type="text" class="form-control" id="case-search-input"
                                   placeholder="搜索案例标题或类别..."
                                   value="${caseSearch}"
                                   onkeydown="if(event.key==='Enter') searchCases()" />
                            <button class="btn btn-outline-secondary" onclick="searchCases()">搜索</button>
                            ${caseSearch ? `<button class="btn btn-outline-danger" onclick="clearCaseSearch()">清除</button>` : ''}
                        </div>
                    </div>
                    <div class="col-md-3">
                        <select class="form-select" id="case-category-filter" onchange="filterCasesByCategory()">
                            <option value="">所有类别</option>
                            ${data.categories.map(cat => `
                                <option value="${cat.id}" ${String(cat.id)===String(caseCategoryFilter)?'selected':''}>${cat.name}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                
                <div class="row">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-body">
                                <div class="table-responsive">
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                      <div>
                                        <button class="btn btn-outline-danger btn-sm" onclick="batchDeleteCases()">
                                          <i class="fas fa-trash-alt me-1"></i>批量删除
                                        </button>
                                      </div>
                                    </div>
                                    <table class="table table-hover align-middle">
                                        <thead>
                                            <tr>
                                                <th style="width:32px"><input type="checkbox" id="case-check-all" onclick="toggleCheckAll(this)"></th>
                                                <th>案例标题</th>
                                                <th>类别</th>
                                                <th>站点</th>
                                                <th>题目数</th>
                                                <th>学习次数</th>
                                                <th>创建时间</th>
                                                <th>操作</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.cases.map(case_ => `
                                                <tr>
                                                    <td><input type="checkbox" class="case-check" value="${case_.id}"></td>
                                                    <td>${case_.title}</td>
                                                    <td><span class="badge bg-secondary">${case_.category_name}</span></td>
                                                    <td>${case_.site_info || '-'}</td>
                                                    <td>${case_.station_count}</td>
                                                    <td>${case_.learning_count}</td>
                                                    <td>${formatDateTime(case_.created_at)}</td>
                                                    <td>
                                                        <button class="btn btn-sm btn-outline-primary me-1" onclick="viewCaseDetail(${case_.id})">
                                                            <i class="fas fa-eye me-1"></i>查看
                                                        </button>
                                                        <button class="btn btn-sm btn-outline-warning me-1" onclick="showEditCaseModal(${case_.id}, '${case_.title.replace(/'/g, "\'")}')">
                                                            <i class="fas fa-edit me-1"></i>编辑
                                                        </button>
                                                        <button class="btn btn-sm btn-outline-danger" onclick="deleteCase(${case_.id})">
                                                            <i class="fas fa-trash-alt me-1"></i>删除
                                                        </button>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                                
                                ${generatePagination(data.pagination, 'loadCases')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            $('#main-content').html(html);
        }
    });
}

// 批量上传案例 —— 上传ZIP/RAR压缩包
function batchUploadCases() {
    const modalHtml = `
        <div class="modal fade" id="batchUploadModal" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title"><i class="fas fa-file-archive me-2"></i>批量上传案例（ZIP / RAR）</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <div class="alert alert-info py-2 mb-3">
                  <div class="fw-semibold mb-1"><i class="fas fa-info-circle me-1"></i>文件命名规范</div>
                  <div>每个 <code>.docx</code> 文件名必须以 <code>【类别名称】</code> 开头，后接案例标题，例如：</div>
                  <ul class="mb-1 mt-1">
                    <li><code>【内科模块】案例7肠癌.docx</code></li>
                    <li><code>【儿科模块】新生儿黄疸护理.docx</code></li>
                  </ul>
                  <div class="text-danger small"><i class="fas fa-times-circle me-1"></i>不符合格式的文件将跳过，并在结果中列出原因。</div>
                </div>
                <div class="mb-3">
                  <label class="form-label fw-semibold">选择压缩包（.zip 或 .rar）</label>
                  <input class="form-control" type="file" id="batch-upload-zip" accept=".zip,.rar" />
                  <div class="form-text">将多个 .docx 文件打包成 ZIP 或 RAR 后上传，支持子目录，系统自动递归解析入库。</div>
                </div>
                <div id="batch-upload-progress" class="d-none mb-2">
                  <div class="progress">
                    <div class="progress-bar progress-bar-striped progress-bar-animated w-100" role="progressbar">解析中，请稍候...</div>
                  </div>
                </div>
                <div id="batch-upload-result" class="d-none"></div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                <button type="button" class="btn btn-success" id="btn-submit-batch" onclick="submitBatchUpload()" disabled>
                  <i class="fas fa-cloud-upload-alt me-1"></i>开始批量上传
                </button>
              </div>
            </div>
          </div>
        </div>`;

    $('#modal-container').html(modalHtml);
    $('#batchUploadModal').modal('show');
    $('#batch-upload-zip').on('change', function() {
        $('#btn-submit-batch').prop('disabled', !this.files.length);
        $('#batch-upload-result').addClass('d-none').html('');
    });
}

function submitBatchUpload() {
    const fileInput = document.getElementById('batch-upload-zip');
    if (!fileInput.files.length) {
        showAlert('请先选择压缩包文件', 'warning');
        return;
    }
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    const $btn = $('#btn-submit-batch');
    $btn.html('<i class="fas fa-spinner fa-spin me-1"></i>上传中...').prop('disabled', true);
    $('#batch-upload-progress').removeClass('d-none');
    $('#batch-upload-result').addClass('d-none').html('');

    $.ajax({
        url: '/admin/cases/batch-upload',
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            $('#batch-upload-progress').addClass('d-none');
            $btn.html('<i class="fas fa-cloud-upload-alt me-1"></i>重新上传').prop('disabled', false);

            let html = '';

            if (response.success) {
                // 汇总行
                const d = response.data || {};
                const hasErr = d.errors && d.errors.length > 0;
                const alertType = hasErr ? 'warning' : 'success';
                const totalFound = d.total_found !== undefined ? d.total_found : ((d.results ? d.results.length : 0) + (d.errors ? d.errors.length : 0));
                const totalInArchive = d.total_in_archive;
                const nonDocx = (totalInArchive !== undefined) ? totalInArchive - totalFound : null;
                html += `<div class="alert alert-${alertType} py-2 mb-2">
                    <i class="fas fa-${hasErr ? 'exclamation-triangle' : 'check-circle'} me-1"></i>
                    压缩包共 <strong>${totalInArchive !== undefined ? totalInArchive : '?'}</strong> 个文件 &nbsp;·&nbsp;
                    识别为 .docx <strong>${totalFound}</strong> 个 &nbsp;·&nbsp;
                    成功 <strong class="text-success">${d.success_count || 0}</strong> 个 &nbsp;·&nbsp;
                    失败 <strong class="text-danger">${d.error_count || 0}</strong> 个
                    ${nonDocx > 0 ? `<br><small class="text-muted">另有 ${nonDocx} 个非 .docx 文件已跳过</small>` : ''}
                </div>`;
                if (totalFound === 0) {
                    html += `<div class="text-muted small"><i class="fas fa-exclamation-circle me-1"></i>压缩包内未找到任何 .docx 文件，请确认文件已放入压缩包中。</div>`;
                }

                // 成功列表
                if (d.results && d.results.length) {
                    html += `<div class="mb-2"><strong class="text-success"><i class="fas fa-check me-1"></i>成功（${d.results.length}个）</strong>
                        <ul class="list-unstyled ms-3 mb-0 small">
                        ${d.results.map(r => `<li><i class="fas fa-file-word text-primary me-1"></i>${r.filename} → <span class="text-muted">${r.case_title}</span></li>`).join('')}
                        </ul></div>`;
                }

                // 失败列表，重点标出原因
                if (d.errors && d.errors.length) {
                    html += `<div class="mb-2"><strong class="text-danger"><i class="fas fa-times me-1"></i>失败（${d.errors.length}个）</strong>
                        <ul class="list-unstyled ms-3 mb-0 small">
                        ${d.errors.map(e => {
                            const isFormat = e.error && e.error.includes('无法从文件名提取类别');
                            const tip = isFormat
                                ? `文件名缺少 <code>【类别】</code> 前缀，请改为：<code>【类别名称】${e.filename}</code>`
                                : e.error;
                            return `<li class="text-danger"><i class="fas fa-exclamation-circle me-1"></i><strong>${e.filename}</strong><br>
                                <span class="ms-3">${tip}</span></li>`;
                        }).join('')}
                        </ul></div>`;
                }

                loadCases();
            } else {
                html += `<div class="alert alert-danger py-2"><i class="fas fa-times-circle me-1"></i>${response.message}</div>`;
            }

            $('#batch-upload-result').removeClass('d-none').html(html);
        },
        error: function() {
            $('#batch-upload-progress').addClass('d-none');
            $btn.html('<i class="fas fa-cloud-upload-alt me-1"></i>开始批量上传').prop('disabled', false);
            $('#batch-upload-result').removeClass('d-none').html(
                '<div class="alert alert-danger py-2"><i class="fas fa-times-circle me-1"></i>请求失败，请检查网络或服务器日志</div>'
            );
        }
    });
}

// 类别筛选
function filterCasesByCategory(){
  caseCategoryFilter = $('#case-category-filter').val() || '';
  loadCases(1);
}

function searchCases() {
    caseSearch = ($('#case-search-input').val() || '').trim();
    caseCategoryFilter = '';
    loadCases(1);
}

function clearCaseSearch() {
    caseSearch = '';
    loadCases(1);
}

// 显示上传案例模态框
function showUploadModal(){
    const modal = `
        <div class="modal fade" id="uploadCaseModal" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title"><i class="fas fa-upload me-2"></i>上传案例（.docx）</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <label class="form-label">选择Word文件（.docx）</label>
                  <input class="form-control" type="file" id="case-file" accept=".docx" />
                  <div class="form-text">文件将保存到“案例”目录，并自动解析入库</div>
                </div>
                <div id="upload-hint" class="text-muted small"></div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                <button type="button" class="btn btn-primary" id="btn-upload-case" disabled onclick="submitUploadCase()">
                  <i class="fas fa-cloud-upload-alt me-1"></i>上传并解析
                </button>
              </div>
            </div>
          </div>
        </div>`;

    $('#modal-container').html(modal);
    const $modal = $('#uploadCaseModal');
    $modal.modal('show');
    $('#case-file').on('change', function(){
        const file = this.files && this.files[0];
        const ok = !!file && /\.docx$/i.test(file.name);
        $('#btn-upload-case').prop('disabled', !ok);
        $('#upload-hint').text(ok ? `已选择：${file.name}` : '请选择 .docx 文件');
    });
}

// 提交上传
function submitUploadCase(){
    const input = document.getElementById('case-file');
    if(!input || !input.files || !input.files[0]){
        showAlert('请先选择 .docx 文件', 'error');
        return;
    }
    const file = input.files[0];
    if(!/\.docx$/i.test(file.name)){
        showAlert('只支持 .docx 格式', 'error');
        return;
    }
    const btn = document.getElementById('btn-upload-case');
    const orig = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> 上传中...';

    const fd = new FormData();
    fd.append('file', file);

    $.ajax({
        url: '/admin/cases',
        method: 'POST',
        processData: false,
        contentType: false,
        data: fd,
        success: function(res){
            if(res.success){
                showAlert(res.message || '上传成功', 'success');
                $('#uploadCaseModal').modal('hide');
                loadCases();
            } else {
                showAlert(res.message || '上传失败', 'error');
            }
        },
        error: function(xhr){
            showAlert((xhr.responseJSON && xhr.responseJSON.message) || '上传失败', 'error');
        },
        complete: function(){
            btn.disabled = false; btn.innerHTML = orig;
        }
    });
}

// 切换全选
function toggleCheckAll(cb){
  $('.case-check').prop('checked', cb.checked);
}

// 批量删除
function batchDeleteCases(){
  const ids = $('.case-check:checked').map((_,el)=>parseInt(el.value)).get();
  if(ids.length===0){ showAlert('请先勾选要删除的案例', 'error'); return; }
  if(!confirm(`确定删除选中的 ${ids.length} 个案例？此操作不可恢复！`)) return;
  $.ajax({
    url:'/admin/cases/batch-delete',
    method:'POST',
    contentType:'application/json',
    data: JSON.stringify({ids}),
    success: function(res){
      if(res.success){ showAlert(res.message,'success'); loadCases(); }
      else{ showAlert(res.message||'删除失败','error'); }
    },
    error: function(xhr){ showAlert((xhr.responseJSON&&xhr.responseJSON.message)||'删除失败','error'); }
  });
}

// 删除单条
function deleteCase(id){
  if(!confirm('确定删除该案例？此操作不可恢复！')) return;
  $.ajax({
    url:`/admin/cases/${id}`,
    method:'DELETE',
    success:function(res){
      if(res.success){ showAlert('删除成功','success'); loadCases(); }
      else{ showAlert(res.message||'删除失败','error'); }
    },
    error:function(xhr){ showAlert((xhr.responseJSON&&xhr.responseJSON.message)||'删除失败','error'); }
  });
}

// 编辑
function showEditCaseModal(id, title){
  const modal = `
  <div class="modal fade" id="editCaseModal" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><i class="fas fa-edit me-2"></i>编辑案例</h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label class="form-label">标题</label>
            <input type="text" id="edit-title" class="form-control" value="${title}">
          </div>
          <div class="mb-3">
            <label class="form-label">站点信息</label>
            <input type="text" id="edit-site" class="form-control" placeholder="可选">
          </div>
          <div class="mb-3">
            <label class="form-label">案例指引</label>
            <textarea id="edit-guide" rows="4" class="form-control" placeholder="可选"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
          <button type="button" class="btn btn-primary" onclick="submitEditCase(${id})">保存</button>
        </div>
      </div>
    </div>
  </div>`;
  $('#modal-container').html(modal);
  $('#editCaseModal').modal('show');
}

function submitEditCase(id){
  const payload = {
    title: $('#edit-title').val(),
    site_info: $('#edit-site').val(),
    case_guide: $('#edit-guide').val()
  };
  $.ajax({
    url:`/admin/cases/${id}`,
    method:'PUT',
    contentType:'application/json',
    data: JSON.stringify(payload),
    success:function(res){
      if(res.success){ showAlert('保存成功','success'); $('#editCaseModal').modal('hide'); loadCases(); }
      else{ showAlert(res.message||'保存失败','error'); }
    },
    error:function(xhr){ showAlert((xhr.responseJSON&&xhr.responseJSON.message)||'保存失败','error'); }
  });
}

// XLSX 导入
function showXlsxImportModal(){
  const modal = `
  <div class="modal fade" id="xlsxImportModal" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><i class="fas fa-file-excel me-2"></i>批量导入（XLSX）</h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label class="form-label">选择模板文件（.xlsx）</label>
            <input type="file" id="xlsx-file" class="form-control" accept=".xlsx" />
          </div>
          <p class="small text-muted">请先下载模板并按列填充，支持多行数据。</p>
        </div>
        <div class="modal-footer">
          <a class="btn btn-outline-secondary" href="/admin/cases/xlsx-template"><i class="fas fa-download me-1"></i>下载模板</a>
          <button type="button" class="btn btn-primary" onclick="submitXlsxImport()">导入</button>
        </div>
      </div>
    </div>
  </div>`;
  $('#modal-container').html(modal);
  $('#xlsxImportModal').modal('show');
}

function submitXlsxImport(){
  const el = document.getElementById('xlsx-file');
  if(!el || !el.files || !el.files[0]){ showAlert('请先选择 .xlsx 文件', 'error'); return; }
  const fd = new FormData();
  fd.append('file', el.files[0]);
  $.ajax({
    url:'/admin/cases/batch-import-xlsx',
    method:'POST',
    processData:false,
    contentType:false,
    data: fd,
    success:function(res){
      if(res.success){ showAlert(res.message||'导入成功','success'); $('#xlsxImportModal').modal('hide'); loadCases(); }
      else{ showAlert(res.message||'导入失败','error'); }
    },
    error:function(xhr){ showAlert((xhr.responseJSON&&xhr.responseJSON.message)||'导入失败','error'); }
  });
}

// 查看案例详情
function viewCaseDetail(caseId) {
    $.get(`/admin/cases/${caseId}`, function(response) {
        if (response.success) {
            const data = response.data;
            const html = `
                <div class="row">
                    <div class="col-12">
                        <nav aria-label="breadcrumb">
                            <ol class="breadcrumb">
                                <li class="breadcrumb-item">
                                    <a href="#" onclick="loadCases()">案例管理</a>
                                </li>
                                <li class="breadcrumb-item active">${data.case.title}</li>
                            </ol>
                        </nav>
                        
                        <h2>${data.case.title}</h2>
                        <p class="text-muted">
                            <i class="fas fa-tag me-1"></i>${data.case.category_name}
                            <i class="fas fa-calendar ms-3 me-1"></i>${formatDateTime(data.case.created_at)}
                        </p>
                    </div>
                </div>
                
                <div class="row">
                    <div class="col-md-8">
                        <div class="card">
                            <div class="card-header">
                                <h5><i class="fas fa-info-circle me-2"></i>案例指引</h5>
                            </div>
                            <div class="card-body">
                                <p>${data.case.case_guide || '暂无案例指引'}</p>
                            </div>
                        </div>
                        
                        <div class="card">
                            <div class="card-header">
                                <h5><i class="fas fa-tasks me-2"></i>学习站点</h5>
                            </div>
                            <div class="card-body">
                                ${data.stations.map(station => `
                                    <div class="card mb-3">
                                        <div class="card-header d-flex justify-content-between align-items-center">
                                            <h6 class="mb-0">${station.name}</h6>
                                            <div>
                                                <span class="badge bg-info">${station.learning_count} 次学习</span>
                                                <span class="badge bg-success">平均分 ${station.avg_score.toFixed(1)}</span>
                                            </div>
                                        </div>
                                        <div class="card-body">
                                            ${station.assessment_task ? `
                                                <div class="mb-2">
                                                    <strong>考核任务：</strong>${station.assessment_task}
                                                </div>
                                            ` : ''}
                                            <div class="mb-3">
                                                <strong>题目：</strong>${station.question}
                                            </div>
                                            <div>
                                                <strong>标准答案：</strong>
                                                <ol>
                                                    ${station.answers.map(answer => `
                                                        <li>${answer.answer_item}</li>
                                                    `).join('')}
                                                </ol>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-header">
                                <h5><i class="fas fa-lightbulb me-2"></i>扩展知识</h5>
                            </div>
                            <div class="card-body">
                                ${data.extended_knowledge.length > 0 ? 
                                    data.extended_knowledge.map(knowledge => `
                                        <div class="mb-3">
                                            <h6 class="text-primary">${knowledge.question}</h6>
                                            <p class="small">${knowledge.answer}</p>
                                        </div>
                                    `).join('') : 
                                    '<p class="text-muted">暂无扩展知识</p>'
                                }
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            $('#main-content').html(html);
        }
    });
}

// 加载考试管理
function loadExams() {
    setActiveNav('考试管理');
    
    $.get('/admin/exams', function(response) {
        if (response.success) {
            const data = response.data;
            const html = `
                <div class="row">
                    <div class="col-12">
                        <h2><i class="fas fa-file-alt me-2"></i>考试管理</h2>
                        <p class="text-muted">创建和管理考试</p>
                    </div>
                </div>
                
                <div class="row mb-3">
                    <div class="col-md-6">
                        <button class="btn btn-primary" onclick="showCreateExamModal()">
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
                                                <th>时长</th>
                                                <th>创建时间</th>
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
                                                    <td>${exam.duration}分钟</td>
                                                    <td>${formatDateTime(exam.created_at)}</td>
                                                    <td>
                                                        <button class="btn btn-sm btn-outline-primary" onclick="manageExamQuestions(${exam.id})">
                                                            <i class="fas fa-list me-1"></i>题目
                                                        </button>
                                                        ${exam.status === 'draft' ? `
                                                            <button class="btn btn-sm btn-outline-success" onclick="publishExam(${exam.id})">
                                                                <i class="fas fa-paper-plane me-1"></i>发布
                                                            </button>
                                                        ` : ''}
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

// 显示创建考试模态框
function showCreateExamModal() {
    const modal = `
        <div class="modal fade" id="createExamModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-plus me-2"></i>创建考试
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="createExamForm">
                            <div class="mb-3">
                                <label class="form-label">考试标题 *</label>
                                <input type="text" class="form-control" id="exam-title" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">考试描述</label>
                                <textarea class="form-control" id="exam-description" rows="3"></textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">考试时长（分钟）</label>
                                <input type="number" class="form-control" id="exam-duration" value="60" min="1">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">开始时间</label>
                                <input type="datetime-local" class="form-control" id="exam-start-time">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">结束时间</label>
                                <input type="datetime-local" class="form-control" id="exam-end-time">
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-primary" onclick="submitCreateExam()">创建</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $('#modal-container').html(modal);
    $('#createExamModal').modal('show');
}

// 提交创建考试
function submitCreateExam() {
    const data = {
        title: $('#exam-title').val(),
        description: $('#exam-description').val(),
        duration: parseInt($('#exam-duration').val()),
        start_time: $('#exam-start-time').val(),
        end_time: $('#exam-end-time').val()
    };
    
    $.ajax({
        url: '/admin/exams',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function(response) {
            if (response.success) {
                showAlert('考试创建成功', 'success');
                $('#createExamModal').modal('hide');
                loadExams(); // 刷新列表
            } else {
                showAlert(response.message, 'error');
            }
        }
    });
}

// 加载统计数据
function loadStatistics() {
    setActiveNav('学习统计');
    
    $.get('/admin/statistics/learning-data', function(response) {
        if (response.success) {
            const data = response.data;
            const html = `
                <div class="row">
                    <div class="col-12">
                        <h2><i class="fas fa-chart-bar me-2"></i>学习统计</h2>
                        <p class="text-muted">查看全站学习数据分析</p>
                    </div>
                </div>
                
                <div class="row mb-4">
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h5><i class="fas fa-chart-pie me-2"></i>学习进度统计</h5>
                            </div>
                            <div class="card-body">
                                <canvas id="progressStatsChart"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h5><i class="fas fa-thermometer-half me-2"></i>错题热力图</h5>
                            </div>
                            <div class="card-body">
                                <canvas id="wrongHeatmapChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h5><i class="fas fa-building me-2"></i>科室活跃度</h5>
                            </div>
                            <div class="card-body">
                                <canvas id="departmentActivityChart"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h5><i class="fas fa-table me-2"></i>详细数据</h5>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>类别</th>
                                                <th>完成率</th>
                                                <th>平均分</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.progress_stats.map(stat => `
                                                <tr>
                                                    <td>${stat.category}</td>
                                                    <td>
                                                        <div class="progress" style="height: 20px;">
                                                            <div class="progress-bar" style="width: ${stat.completion_rate}%">
                                                                ${stat.completion_rate}%
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span class="badge ${getScoreBadgeClass(stat.avg_score)}">
                                                            ${stat.avg_score}
                                                        </span>
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
            
            // 绘制图表
            drawProgressStatsChart(data.progress_stats);
            drawWrongHeatmapChart(data.wrong_distribution);
            drawDepartmentActivityChart(data.user_activity);
        }
    });
}

// 绘制进度统计图表
function drawProgressStatsChart(data) {
    const ctx = document.getElementById('progressStatsChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.category),
            datasets: [{
                label: '完成率 (%)',
                data: data.map(item => item.completion_rate),
                backgroundColor: '#36A2EB'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

// 绘制错题热力图
function drawWrongHeatmapChart(data) {
    const ctx = document.getElementById('wrongHeatmapChart').getContext('2d');
    
    const categories = Object.keys(data);
    const counts = Object.values(data);
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{
                data: counts,
                backgroundColor: [
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0',
                    '#9966FF'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// 绘制科室活跃度图表
function drawDepartmentActivityChart(data) {
    const ctx = document.getElementById('departmentActivityChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'horizontalBar',
        data: {
            labels: data.map(item => item.department),
            datasets: [{
                label: '学习次数',
                data: data.map(item => item.activity_count),
                backgroundColor: '#4BC0C0'
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    });
}

// 群体分析
function loadGroupAnalysis() {
    setActiveNav('群体分析');
    
    $.get('/admin/statistics/group-weakness', function(response) {
        if (response.success) {
            const analysis = response.data.analysis;
            const html = `
                <div class="row">
                    <div class="col-12">
                        <h2><i class="fas fa-users-cog me-2"></i>群体薄弱点分析</h2>
                        <p class="text-muted">基于全站错题数据生成的群体学习分析报告</p>
                    </div>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h5><i class="fas fa-exclamation-triangle me-2"></i>薄弱领域排行</h5>
                            </div>
                            <div class="card-body">
                                ${analysis.weak_categories.length > 0 ? 
                                    analysis.weak_categories.map((category, index) => `
                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                            <span>${index + 1}. ${category}</span>
                                            <span class="badge bg-warning">${analysis.error_distribution[category] || 0} 次错误</span>
                                        </div>
                                    `).join('') : 
                                    '<p class="text-muted">暂无数据</p>'
                                }
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h5><i class="fas fa-list me-2"></i>主要问题</h5>
                            </div>
                            <div class="card-body">
                                <ul class="list-unstyled">
                                    ${analysis.common_issues.map(issue => `
                                        <li class="mb-2">
                                            <i class="fas fa-caret-right text-warning me-2"></i>${issue}
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="row">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-header">
                                <h5><i class="fas fa-lightbulb me-2"></i>改进建议</h5>
                            </div>
                            <div class="card-body">
                                ${analysis.improvement_suggestions.length > 0 ? 
                                    analysis.improvement_suggestions.map(suggestion => `
                                        <div class="alert alert-info">
                                            <h6 class="alert-heading">${suggestion.category}</h6>
                                            <p class="mb-0">${suggestion.suggestion}</p>
                                        </div>
                                    `).join('') : 
                                    '<p class="text-muted">暂无具体建议</p>'
                                }
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            $('#main-content').html(html);
        }
    });
}

// =============== AI 设置 ===============
function loadAiSettings() {
    setActiveNav('AI设置');

    $.get('/admin/ai-settings', function(response) {
        if (!response.success) {
            showAlert(response.message || '加载失败', 'error');
            return;
        }
        const d = response.data;
        const html = `
            <div class="row">
                <div class="col-12">
                    <h2><i class="fas fa-robot me-2"></i>AI设置</h2>
                    <p class="text-muted">配置评分模型与Key，实时生效</p>
                </div>
            </div>
            <div class="row">
                <div class="col-md-8 col-lg-6">
                    <div class="card">
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label">评分提供方</label>
                                <select class="form-select" id="ai-provider">
                                    <option value="glm" ${d.provider==='glm'?'selected':''}>GLM（智谱）</option>
                                    <option value="openai" ${d.provider==='openai'?'selected':''}>OpenAI</option>
                                    <option value="local" ${d.provider==='local'?'selected':''}>本地匹配</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">ZHIPU_API_KEY</label>
                                <input type="password" class="form-control" id="zhipu-key" placeholder="可留空" value="${d.zhipu_key ? '******' : ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">ZHIPU_MODEL</label>
                                <input type="text" class="form-control" id="zhipu-model" placeholder="glm-4-air" value="${d.zhipu_model || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">OPENAI_API_KEY</label>
                                <input type="password" class="form-control" id="openai-key" placeholder="可留空" value="${d.openai_key ? '******' : ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">OpenAI模型</label>
                                <input type="text" class="form-control" id="openai-model" placeholder="gpt-3.5-turbo" value="${d.openai_model || ''}">
                            </div>
                            <div class="d-flex gap-2">
                                <button class="btn btn-primary" onclick="saveAiSettings()"><i class="fas fa-save me-1"></i>保存</button>
                                <button class="btn btn-outline-secondary" onclick="testAiSettings()"><i class="fas fa-vial me-1"></i>测试</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        $('#main-content').html(html);
    });
}

function saveAiSettings() {
    const payload = {
        provider: $('#ai-provider').val(),
        zhipu_key: valOrNull('#zhipu-key'),
        zhipu_model: valOrNull('#zhipu-model'),
        openai_key: valOrNull('#openai-key'),
        openai_model: valOrNull('#openai-model')
    };
    $.ajax({
        url: '/admin/ai-settings',
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(payload),
        success: function(res) {
            if (res.success) {
                showAlert('AI设置已更新', 'success');
            } else {
                showAlert(res.message || '保存失败', 'error');
            }
        }
    });
}

function testAiSettings() {
    showAlert('测试功能：请在护士端任意题目提交答案，即可验证评分是否正常。', 'info');
}

function valOrNull(sel){
    const v = $(sel).val();
    if (!v || v === '******') return null;
    return v;
}
