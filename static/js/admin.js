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
            <div class="page-header">
                <div>
                    <h4><i class="fas fa-tachometer-alt me-2"></i>数据看板</h4>
                    <p class="text-muted mb-0">系统运行概况总览</p>
                </div>
            </div>
            <div class="row g-3 mb-4">
                <div class="col-6 col-md-3">
                    <div class="card text-center">
                        <div class="card-body py-3">
                            <div class="fs-2 fw-bold text-primary">${s.total_users}</div>
                            <div class="text-muted small">护士数量（活跃 ${s.active_users}）</div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card text-center">
                        <div class="card-body py-3">
                            <div class="fs-2 fw-bold text-success">${s.total_cases}</div>
                            <div class="text-muted small">案例数量</div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card text-center">
                        <div class="card-body py-3">
                            <div class="fs-2 fw-bold text-info">${s.total_stations}</div>
                            <div class="text-muted small">站点数量</div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card text-center">
                        <div class="card-body py-3">
                            <div class="fs-2 fw-bold text-warning">${s.total_learning_records}</div>
                            <div class="text-muted small">学习记录总数</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row g-3">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header"><i class="fas fa-history me-1"></i>最近学习动态</div>
                        <div class="card-body p-0">
                            <div class="table-responsive" style="max-height:400px;overflow-y:auto;">
                                <table class="table table-sm mb-0">
                                    <thead style="position:sticky;top:0;z-index:1;" class="table-light"><tr><th>姓名</th><th>案例</th><th>站点</th><th>得分</th><th>时间</th></tr></thead>
                                    <tbody>
                                    ${d.recent_activities.length ? d.recent_activities.map(a => `
                                        <tr>
                                            <td>${a.user_name}</td>
                                            <td class="text-truncate" style="max-width:80px" title="${a.case_title}">${a.case_title}</td>
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
                <div class="page-header">
                    <div>
                        <h4><i class="fas fa-users me-2"></i>用户管理</h4>
                        <p class="text-muted mb-0">管理护士账号和权限</p>
                    </div>
                    <div class="d-flex gap-2 flex-wrap">
                        <button class="btn btn-primary btn-sm" onclick="renderUserCreatePage()">
                            <i class="fas fa-plus me-1"></i>添加用户
                        </button>
                        <button class="btn btn-outline-success btn-sm" onclick="renderUserImportPage()">
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
                                                    <td class="d-none d-lg-table-cell">
                                                        <small>
                                                            学习: ${user.learning_count}<br>
                                                            错题: ${user.wrong_count}
                                                        </small>
                                                    </td>
                                                    <td class="d-none d-md-table-cell">${formatDateTime(user.created_at)}</td>
                                                    <td>
                                                        <div class="btn-action-group">
                                                        <button class="btn btn-sm btn-outline-primary" onclick="renderUserDetailPage(${user.id})">
                                                            <i class="fas fa-eye"></i>
                                                        </button>
                                                        <button class="btn btn-sm btn-outline-warning" onclick="renderUserEditPage(${user.id})">
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

// 加载案例管理
function loadCases(page = 1) {
    setActiveNav('案例管理');

    let url = `/admin/cases?page=${page}`;
    if (caseCategoryFilter) url += `&category_id=${caseCategoryFilter}`;
    if (caseSearch) url += `&search=${encodeURIComponent(caseSearch)}`;
    const typeFilter = $('#case-type-filter').val();
    if (typeFilter) url += `&case_type=${typeFilter}`;

    $.get(url, function(response) {
        if (response.success) {
            const data = response.data;
            const html = `
                <div class="page-header">
                    <div>
                        <h4><i class="fas fa-book-medical me-2"></i>案例管理</h4>
                        <p class="text-muted mb-0">管理医疗案例和内容</p>
                    </div>
                    <div class="d-flex gap-2 flex-wrap">
                        <button class="btn btn-primary btn-sm" onclick="renderCaseCreatePage()">
                            <i class="fas fa-plus me-1"></i>创建案例
                        </button>
                        <button class="btn btn-outline-primary btn-sm" onclick="showUploadModal()">
                            <i class="fas fa-upload me-1"></i>上传
                        </button>
                        <button class="btn btn-outline-success btn-sm" onclick="batchUploadCases()">
                            <i class="fas fa-cloud-upload-alt me-1"></i>批量
                        </button>
                    </div>
                </div>

                <div class="row mb-3">
                    <div class="col-md-3">
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
                    <div class="col-md-2">
                        <select class="form-select" id="case-category-filter" onchange="filterCasesByCategory()">
                            <option value="">所有类别</option>
                            ${data.categories.map(cat => `
                                <option value="${cat.id}" ${String(cat.id)===String(caseCategoryFilter)?'selected':''}>${cat.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="col-md-2">
                        <select class="form-select" id="case-type-filter" onchange="loadCases(1)">
                            <option value="">全部类型</option>
                            <option value="learning">学习案例</option>
                            <option value="exam">考试案例</option>
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
                                                <th class="d-none d-sm-table-cell">类别</th>
                                                <th class="d-none d-md-table-cell">难度</th>
                                                <th class="d-none d-md-table-cell">类型</th>
                                                <th>题目数</th>
                                                <th class="d-none d-sm-table-cell">学习次数</th>
                                                <th class="d-none d-lg-table-cell">创建时间</th>
                                                <th>操作</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.cases.map(case_ => `
                                                <tr>
                                                    <td><input type="checkbox" class="case-check" value="${case_.id}"></td>
                                                    <td>${case_.title}</td>
                                                    <td class="d-none d-sm-table-cell"><span class="badge bg-secondary">${case_.category_name}</span></td>
                                                    <td class="d-none d-md-table-cell">${getDifficultyBadge(case_.difficulty)}</td>
                                                    <td class="d-none d-md-table-cell">${getCaseTypeBadge(case_.case_type)}</td>
                                                    <td>${case_.station_count}</td>
                                                    <td class="d-none d-sm-table-cell">${case_.learning_count}</td>
                                                    <td class="d-none d-lg-table-cell">${formatDateTime(case_.created_at)}</td>
                                                    <td>
                                                        <div class="btn-action-group">
                                                        <button class="btn btn-sm btn-outline-primary" onclick="renderCaseDetailPage(${case_.id})">
                                                            <i class="fas fa-eye me-1"></i>详情
                                                        </button>
                                                        <button class="btn btn-sm btn-outline-danger" onclick="deleteCase(${case_.id})">
                                                            <i class="fas fa-trash-alt me-1"></i>删除
                                                        </button>
                                                        </div>
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

// 加载统计数据
function loadStatistics() {
    setActiveNav('学习统计');
    
    $.get('/admin/statistics/learning-data', function(response) {
        if (response.success) {
            const data = response.data;
            const html = `
                <div class="page-header">
                    <div>
                        <h4><i class="fas fa-chart-bar me-2"></i>学习统计</h4>
                        <p class="text-muted mb-0">查看全站学习数据分析</p>
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
        type: 'bar',
        indexAxis: 'y',
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
                <div class="page-header">
                    <div>
                        <h4><i class="fas fa-users-cog me-2"></i>群体薄弱点分析</h4>
                        <p class="text-muted mb-0">基于全站错题数据生成的群体学习分析报告</p>
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

// =========== 辅助函数 ===========
function getDifficultyBadge(d) {
    const map = { basic: 'bg-success', intermediate: 'bg-warning text-dark', advanced: 'bg-danger' };
    const labels = { basic: '基础', intermediate: '中级', advanced: '高级' };
    return `<span class="badge ${map[d] || 'bg-secondary'}">${labels[d] || d}</span>`;
}

function getCaseTypeBadge(t) {
    const map = { learning: 'bg-info', exam: 'bg-primary' };
    const labels = { learning: '学习', exam: '考试' };
    return `<span class="badge ${map[t] || 'bg-secondary'}">${labels[t] || t}</span>`;
}

// =========== 案例创建页面 ===========
function renderCaseCreatePage() {
    _stationIdx = 0; _videoIdx = 0; _linkIdx = 0; _knowledgeIdx = 0;
    $.get('/api/categories', function(res) {
        const cats = res.success ? res.data : [];
        const catOptions = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

        const html = `
            <nav aria-label="breadcrumb"><ol class="breadcrumb">
                <li class="breadcrumb-item"><a href="#" onclick="loadCases()">案例管理</a></li>
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
                <button class="btn btn-outline-secondary btn-lg" onclick="loadCases()">取消</button>
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
                    setTimeout(function() { loadCases(); }, 800);
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

// =========== 案例详情页面（含编辑、站点/视频/链接管理）===========
function renderCaseDetailPage(caseId) {
    $.get(`/admin/cases/${caseId}`, function(response) {
        if (!response.success) { showAlert(response.message || '加载失败', 'error'); return; }
        const d = response.data;
        const c = d.case;
        const html = `
            <div class="row"><div class="col-12">
                <nav aria-label="breadcrumb"><ol class="breadcrumb">
                    <li class="breadcrumb-item"><a href="#" onclick="loadCases()">案例管理</a></li>
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
                        ${d.extended_knowledge.length ? d.extended_knowledge.map(ek => {
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
                        `}).join('') : '<p class="text-muted">暂无扩展知识</p>'}
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
                        <button class="btn btn-sm btn-outline-primary d-block mb-1" onclick="renderStationEditPage(${caseId}, ${s.id})">
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
                    <button class="btn btn-outline-secondary btn-sm" onclick="renderCaseDetailPage(${caseId})">取消</button>
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
                    <button class="btn btn-outline-secondary btn-sm" onclick="renderCaseDetailPage(${caseId})">取消</button>
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
                <button class="btn btn-outline-secondary btn-sm" onclick="renderCaseDetailPage(${caseId})">取消</button>
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
                <button class="btn btn-outline-secondary btn-sm" onclick="renderCaseDetailPage(${caseId})">取消</button>
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
                <button class="btn btn-outline-secondary btn-sm" onclick="renderCaseDetailPage(${caseId})">取消</button>
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
                <li class="breadcrumb-item"><a href="#" onclick="loadCases()">案例管理</a></li>
                <li class="breadcrumb-item"><a href="#" onclick="renderCaseDetailPage(${caseId})">${c.title}</a></li>
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
                <li class="breadcrumb-item"><a href="#" onclick="loadUsers()">用户管理</a></li>
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
                            <button class="btn btn-outline-primary btn-sm" onclick="renderUserEditPage(${u.id})"><i class="fas fa-edit me-1"></i>编辑信息</button>
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
                <li class="breadcrumb-item"><a href="#" onclick="loadUsers()">用户管理</a></li>
                <li class="breadcrumb-item"><a href="#" onclick="renderUserDetailPage(${u.id})">${u.real_name}</a></li>
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
                        <button class="btn btn-outline-secondary" onclick="renderUserDetailPage(${u.id})">取消</button>
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
            if (res.success) { showAlert('保存成功','success'); renderUserDetailPage(userId); }
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
            <li class="breadcrumb-item"><a href="#" onclick="loadUsers()">用户管理</a></li>
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
                <div class="mb-3">
                    <label class="form-label">角色</label>
                    <select class="form-select" id="add-role">
                        <option value="nurse">护士</option>
                        <option value="admin">管理员</option>
                    </select>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-primary" onclick="submitAddUser()">添加</button>
                    <button class="btn btn-outline-secondary" onclick="loadUsers()">取消</button>
                </div>
            </div></div>
        </div></div>
    `;
    $('#main-content').html(html);
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
                        <button class="btn btn-primary" onclick="renderExamCreatePage()">
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
                                                        <button class="btn btn-sm btn-outline-primary" onclick="manageExamQuestions(${exam.id})">
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
                                                            <button class="btn btn-sm btn-outline-success" onclick="reviewExam(${exam.id})">
                                                                <i class="fas fa-check-double"></i><span class="d-none d-md-inline ms-1">批阅</span>
                                                            </button>
                                                        `}
                                                        <button class="btn btn-sm btn-outline-info" onclick="renderExamEditPage(${exam.id})">
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
            <li class="breadcrumb-item"><a href="#" onclick="loadExams()">考试管理</a></li>
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
                <div class="mb-3">
                    <label class="form-label">考试时长（分钟）</label>
                    <input type="number" class="form-control" id="exam-duration" value="60" min="1">
                </div>
                <div class="row g-2 mb-3">
                    <div class="col-md-6">
                        <label class="form-label">开始时间</label>
                        <input type="datetime-local" class="form-control" id="exam-start-time">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">结束时间</label>
                        <input type="datetime-local" class="form-control" id="exam-end-time">
                    </div>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-primary" onclick="submitCreateExam()">创建</button>
                    <button class="btn btn-outline-secondary" onclick="loadExams()">取消</button>
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
        start_time: $('#exam-start-time').val() || null,
        end_time: $('#exam-end-time').val() || null
    };

    $.ajax({
        url: '/admin/exams',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function(response) {
            if (response.success) {
                showAlert('考试创建成功', 'success');
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
                <li class="breadcrumb-item"><a href="#" onclick="loadExams()">考试管理</a></li>
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
                    <div class="mb-3">
                        <label class="form-label">时长（分钟）</label>
                        <input type="number" class="form-control" id="exam-edit-duration" value="${exam.duration}" min="1">
                    </div>
                    <div class="row g-2 mb-3">
                        <div class="col-md-6">
                            <label class="form-label">开始时间</label>
                            <input type="datetime-local" class="form-control" id="exam-edit-start" value="${exam.start_time ? exam.start_time.substring(0,16) : ''}">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">结束时间</label>
                            <input type="datetime-local" class="form-control" id="exam-edit-end" value="${exam.end_time ? exam.end_time.substring(0,16) : ''}">
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-primary" onclick="submitExamEdit(${examId})">保存</button>
                        <button class="btn btn-outline-secondary" onclick="loadExams()">取消</button>
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
        start_time: $('#exam-edit-start').val() ? $('#exam-edit-start').val() + ':00' : null,
        end_time: $('#exam-edit-end').val() ? $('#exam-edit-end').val() + ':00' : null
    };
    $.ajax({
        url: `/admin/exams/${examId}`,
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(payload),
        success: function(res) {
            if (res.success) { showAlert('已更新','success'); loadExams(); }
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
                            <img id="qr-img" class="img-fluid border rounded" alt="QR Code">
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

    const token = localStorage.getItem('access_token');
    const headers = token ? { 'Authorization': 'Bearer ' + token } : {};

    fetch('/admin/exams/' + examId + '/qr-code', {
        headers: headers,
        credentials: 'same-origin'
    })
        .then(function(resp) {
            if (!resp.ok) throw new Error('服务器返回 ' + resp.status);
            return resp.blob();
        })
        .then(function(blob) {
            if (blob.type.startsWith('image/')) {
                $('#qr-loading').hide();
                var oldUrl = $('#qr-img').attr('src');
                if (oldUrl && oldUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(oldUrl);
                }
                $('#qr-img').attr('src', URL.createObjectURL(blob));
                $('#qr-result').show();
            } else {
                throw new Error('返回格式不是图片（可能是登录页面）');
            }
        })
        .catch(function(err) {
            $('#qr-loading').hide();
            $('#qr-error-msg').text('二维码加载失败：' + err.message);
            $('#qr-error').show();
        });
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
            <li class="breadcrumb-item"><a href="#" onclick="loadExams()">考试管理</a></li>
            <li class="breadcrumb-item active">${exam.title} - 添加题目</li>
        </ol></nav>

        <div class="page-header">
            <div>
                <h4><i class="fas fa-list-check me-2"></i>${exam.title} — 添加题目</h4>
                <p class="text-muted mb-0">从考试案例库中选择案例加入本场考试，每个案例包含其全部站点题目</p>
            </div>
            <a href="#" class="btn btn-sm btn-outline-secondary" onclick="loadExams(); return false;">
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
        const extendedKnowledge = res.data.extended_knowledge || [];
        let stationsHtml = '';
        stations.forEach(function(s, i) {
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
                            <h6 class="border-bottom pb-2 mb-3">站点题目（共 ${stations.length} 题）</h6>
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

function reviewExam(examId) {
    setActiveNav('考试管理');
    $.get(`/admin/exams/${examId}/review`, function(res) {
        if (!res.success) { showAlert(res.message||'加载失败','error'); return; }
        const d = res.data;
        const exam = d.exam;
        const participants = d.participants;

        let rows = '';
        if (participants.length === 0) {
            rows = '<tr><td colspan="7" class="text-center text-muted py-4">暂无考生提交</td></tr>';
        } else {
            participants.forEach(function(p) {
                rows += `
                    <tr>
                        <td>${p.real_name}</td>
                        <td>${p.department || '-'}</td>
                        <td><span class="fw-bold">${p.total_score.toFixed(0)}</span> / ${p.max_score.toFixed(0)}</td>
                        <td>${p.submit_time ? formatDateTime(p.submit_time) : '-'}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" onclick="toggleParticipantAnswers(${p.record_id})">
                                <i class="fas fa-chevron-down" id="toggle-icon-${p.record_id}"></i> 展开
                            </button>
                        </td>
                    </tr>
                    <tr id="answers-row-${p.record_id}" style="display:none;">
                        <td colspan="5" class="p-0">
                            <div class="p-3 bg-light border-top">
                                <div class="fw-bold mb-2">答题详情</div>
                                ${p.answers.map(function(a, i) {
                                    return `
                                        <div class="card mb-2">
                                            <div class="card-header d-flex justify-content-between align-items-center py-2">
                                                <span><strong>#${i + 1}</strong> ${a.station_name} <span class="text-muted small">(${a.case_title})</span></span>
                                                <div class="d-flex align-items-center gap-2">
                                                    <span class="fw-bold" id="score-display-${a.id}">${a.score.toFixed(0)} 分</span>
                                                    <button class="btn btn-sm btn-outline-info re-score-btn" id="re-score-btn-${a.id}" onclick="reScoreAnswer(${examId}, ${a.id})" title="AI 重新评分">
                                                        <i class="fas fa-robot"></i>
                                                    </button>
                                                    <button class="btn btn-sm btn-outline-warning" onclick="showScoreEdit(${examId}, ${a.id}, ${a.score})" title="手动调整分数">
                                                        <i class="fas fa-pen"></i>
                                                    </button>
                                                </div>
                                            </div>
                                            <div class="card-body py-2">
                                                <div class="mb-2"><small class="text-muted">题目：</small>${a.question}</div>
                                                <div class="mb-2"><small class="text-muted">考生作答：</small><div class="border rounded p-2 bg-white">${a.user_answer || '<span class="text-muted">(未作答)</span>'}</div></div>
                                                ${a.ai_feedback ? '<div class="mb-2"><small class="text-muted">AI 反馈：</small><div class="border rounded p-2 bg-white">' + a.ai_feedback + '</div></div>' : ''}
                                                ${a.standard_answers && a.standard_answers.length ? `
                                                    <div class="mb-2"><small class="text-muted">标准答案：</small>
                                                        <div class="border rounded p-2 bg-white">
                                                            ${a.standard_answers.map(function(sa) {
                                                                return '<span class="badge bg-light text-dark me-1 mb-1">' + sa.answer_item + (sa.score_weight !== 1 ? ' (权重:' + sa.score_weight + ')' : '') + '</span>';
                                                            }).join('')}
                                                        </div>
                                                    </div>
                                                ` : ''}
                                            </div>
                                        </div>`;
                                }).join('')}
                            </div>
                        </td>
                    </tr>`;
            });
        }

        const html = `
            <nav aria-label="breadcrumb"><ol class="breadcrumb">
                <li class="breadcrumb-item"><a href="#" onclick="loadExams()">考试管理</a></li>
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
                    <a href="#" class="btn btn-sm btn-outline-secondary" onclick="loadExams(); return false;">
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

function toggleParticipantAnswers(recordId) {
    const row = $('#answers-row-' + recordId);
    const icon = $('#toggle-icon-' + recordId);
    if (row.is(':visible')) {
        row.hide();
        icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
    } else {
        row.show();
        icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
    }
}

function showScoreEdit(examId, answerId, currentScore) {
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
                $('#score-display-' + answerId).text(res.data.score.toFixed(0) + ' 分');
                showAlert('分数已更新', 'success');
                // Reload to update total
                setTimeout(function() { reviewExam(examId); }, 500);
            } else { showAlert(res.message||'更新失败','error'); }
        }
    });
}

function reScoreAnswer(examId, answerId) {
    if (!confirm('确定用 AI 重新评分吗？这将覆盖当前分数和反馈。')) return;
    var $btn = $('#re-score-btn-' + answerId);
    $btn.prop('disabled', true).find('i').addClass('fa-spin');
    $.ajax({
        url: '/admin/exams/' + examId + '/review/' + answerId + '/re-score',
        method: 'POST',
        contentType: 'application/json',
        success: function(res) {
            if (res.success) {
                $('#score-display-' + answerId).text(res.data.score.toFixed(0) + ' 分');
                showAlert('AI 重新评分完成', 'success');
                setTimeout(function() { reviewExam(examId); }, 500);
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
                    <p class="text-muted mb-0">配置 AI 评分模型</p>
                </div>
            </div>
            <div class="row"><div class="col-lg-7">
                <div class="card"><div class="card-body">
                    <div class="mb-3">
                        <label class="form-label">模型提供方</label>
                        <select class="form-select" id="ai-provider" onchange="switchAiProvider()">
                            <option value="openai" ${prov==='openai'?'selected':''}>OpenAI</option>
                            <option value="glm" ${prov==='glm'?'selected':''}>智谱 GLM</option>
                            <option value="local" ${prov==='local'?'selected':''}>本地匹配（不使用外部模型）</option>
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

function loadVoiceSettings() {
    setActiveNav('语音设置');

    var html = `
        <div class="page-header">
            <div>
                <h4><i class="fas fa-microphone me-2"></i>语音设置</h4>
                <p class="text-muted mb-0">百度语音识别 Key 管理</p>
            </div>
        </div>
        <div class="row"><div class="col-lg-7">
            <div class="card"><div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="mb-0">百度 ASR Key 列表</h6>
                    <button class="btn btn-sm btn-primary" onclick="showAddBaiduKeyForm()"><i class="fas fa-plus me-1"></i>添加 Key</button>
                </div>
                <p class="text-muted small mb-3">多个 Key 自动轮转：当一个 Key 额度用完时自动切换下一个。每个 Key 免费额度 5 万次/天。<br>
                注册地址：<a href="https://console.bce.baidu.com/ai/#/ai/speech/overview" target="_blank">百度 AI 开放平台 → 语音识别</a></p>
                <div id="baidu-asr-key-list">${renderBaiduKeysLoading()}</div>
                <div id="baidu-asr-key-form" style="display:none"></div>
            </div></div>
        </div></div>
    `;
    $('#main-content').html(html);
    loadBaiduAsrKeys();
}

// ---- Baidu ASR Key Management ----

function renderBaiduKeysLoading() {
    return '<div class="spinner-border spinner-border-sm text-muted me-2"></div>加载中...';
}

function loadBaiduAsrKeys() {
    $.get('/admin/baidu-asr-keys', function(res) {
        if (!res.success) { $('#baidu-asr-key-list').html('<p class="text-danger small">加载失败</p>'); return; }
        var keys = res.data || [];
        if (keys.length === 0) {
            $('#baidu-asr-key-list').html('<p class="text-muted small mb-0">暂无 Key，点击「添加 Key」开始配置。</p>');
            return;
        }
        var html = '<div class="list-group list-group-flush">';
        keys.forEach(function(k) {
            var statusBadge = k.is_active
                ? '<span class="badge bg-success">启用</span>'
                : '<span class="badge bg-secondary">禁用</span>';
            html += '<div class="list-group-item px-0 d-flex justify-content-between align-items-center">' +
                '<div><small class="text-muted">App ID: ' + (k.app_id || '-') +
                ' &nbsp;|&nbsp; Key: ' + k.api_key_masked + '</small><br>' + statusBadge +
                ' <small class="text-muted">' + formatDateTime(k.created_at) + '</small></div>' +
                '<div class="d-flex gap-1">' +
                '<button class="btn btn-sm ' + (k.is_active ? 'btn-outline-warning' : 'btn-outline-success') +
                '" onclick="toggleBaiduKey(' + k.id + ')">' +
                (k.is_active ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>') + '</button>' +
                '<button class="btn btn-sm btn-outline-danger" onclick="deleteBaiduKey(' + k.id +
                ')" title="删除"><i class="fas fa-trash"></i></button>' +
                '</div></div>';
        });
        html += '</div>';
        $('#baidu-asr-key-list').html(html);
    });
}

function showAddBaiduKeyForm() {
    var html = '<hr>' +
        '<div class="mb-2"><label class="form-label small">App ID <span class="text-muted">(可选)</span></label>' +
        '<input type="text" class="form-control form-control-sm" id="new-baidu-app-id" placeholder="百度应用 App ID"></div>' +
        '<div class="mb-2"><label class="form-label small">API Key</label>' +
        '<input type="text" class="form-control form-control-sm" id="new-baidu-api-key" placeholder="百度 API Key"></div>' +
        '<div class="mb-2"><label class="form-label small">Secret Key</label>' +
        '<input type="text" class="form-control form-control-sm" id="new-baidu-secret-key" placeholder="百度 Secret Key"></div>' +
        '<div class="d-flex gap-2">' +
        '<button class="btn btn-sm btn-primary" onclick="addBaiduKey()"><i class="fas fa-check me-1"></i>保存</button>' +
        '<button class="btn btn-sm btn-outline-secondary" onclick="$(\'#baidu-asr-key-form\').hide()">取消</button>' +
        '</div>';
    $('#baidu-asr-key-form').html(html).show();
}

function addBaiduKey() {
    var appId = $('#new-baidu-app-id').val().trim();
    var apiKey = $('#new-baidu-api-key').val().trim();
    var secretKey = $('#new-baidu-secret-key').val().trim();
    if (!apiKey || !secretKey) { showAlert('API Key 和 Secret Key 不能为空', 'error'); return; }
    $.ajax({
        url: '/admin/baidu-asr-keys',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ app_id: appId, api_key: apiKey, secret_key: secretKey }),
        success: function(res) {
            if (res.success) {
                showAlert('Key 已添加', 'success');
                $('#baidu-asr-key-form').hide();
                loadBaiduAsrKeys();
            } else { showAlert(res.message, 'error'); }
        }
    });
}

function toggleBaiduKey(id) {
    $.ajax({
        url: '/admin/baidu-asr-keys/' + id + '/toggle',
        method: 'POST',
        success: function(res) {
            if (res.success) { showAlert(res.message, 'info'); loadBaiduAsrKeys(); }
            else { showAlert(res.message, 'error'); }
        }
    });
}

function deleteBaiduKey(id) {
    if (!confirm('确定要删除这个 Key 吗？')) return;
    $.ajax({
        url: '/admin/baidu-asr-keys/' + id,
        method: 'DELETE',
        success: function(res) {
            if (res.success) { showAlert('Key 已删除', 'info'); loadBaiduAsrKeys(); }
            else { showAlert(res.message, 'error'); }
        }
    });
}

function renderUserImportPage() {
    const html = `
        <nav aria-label="breadcrumb"><ol class="breadcrumb">
            <li class="breadcrumb-item"><a href="#" onclick="loadUsers()">用户管理</a></li>
            <li class="breadcrumb-item active">批量导入</li>
        </ol></nav>
        <div class="page-header">
            <div>
                <h4><i class="fas fa-file-excel me-2"></i>批量导入用户（XLSX）</h4>
            </div>
        </div>
        <div class="row"><div class="col-lg-6">
            <div class="card"><div class="card-body">
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
                <div class="d-flex gap-2">
                    <button type="button" class="btn btn-primary" onclick="submitUserXlsxImportPage()">导入</button>
                    <a class="btn btn-outline-secondary" href="/admin/users/xlsx-template"><i class="fas fa-download me-1"></i>下载模板</a>
                    <button class="btn btn-outline-secondary" onclick="loadUsers()">返回</button>
                </div>
            </div></div>
        </div></div>
    `;
    $('#main-content').html(html);
}

function submitUserXlsxImportPage() {
    const el = document.getElementById('user-xlsx-file');
    if (!el || !el.files || !el.files[0]) { showAlert('请先选择 .xlsx 文件', 'error'); return; }
    const fd = new FormData();
    fd.append('file', el.files[0]);
    $.ajax({
        url: '/admin/users/batch-import-xlsx',
        method: 'POST',
        processData: false,
        contentType: false,
        data: fd,
        success: function(res) {
            if (res.success) {
                const users = res.users || [];
                let userList = users.map(u => '<tr><td>' + sanitizeHTML(u.username) + '</td><td>' + sanitizeHTML(u.password) + '</td><td>' + sanitizeHTML(u.real_name) + '</td></tr>').join('');
                showAlert(res.message || '导入成功', 'success', 3000);
                if (users.length) {
                    var modalHtml = '<div class="modal fade" id="importResultModal" tabindex="-1">' +
                        '<div class="modal-dialog modal-lg"><div class="modal-content">' +
                        '<div class="modal-header"><h6 class="modal-title">导入用户清单</h6>' +
                        '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>' +
                        '<div class="modal-body"><div class="table-responsive"><table class="table table-sm table-bordered small">' +
                        '<thead><tr><th>工号</th><th>初始密码</th><th>姓名</th></tr></thead>' +
                        '<tbody>' + userList + '</tbody></table></div></div>' +
                        '<div class="modal-footer"><button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">关闭</button></div>' +
                        '</div></div></div>';
                    $('#modal-container').html(modalHtml);
                    $('#importResultModal').modal('show');
                }
                loadUsers();
            } else { showAlert(res.message || '导入失败', 'error'); }
        }
    });
}
