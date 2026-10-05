// 管理员端 — 用户管理 · Excel 批量导入页

function renderUserImportPage() {
    const html = `
        <nav aria-label="breadcrumb"><ol class="breadcrumb">
            <li class="breadcrumb-item"><a href="#" onclick="navToUsers(); return false;">用户管理</a></li>
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
                    <button class="btn btn-outline-secondary" onclick="navToUsers()">返回</button>
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
                window._lastImportedAccounts = users;
                let userList = users.map(u => '<tr><td>' + sanitizeHTML(u.username) + '</td><td>' + sanitizeHTML(u.password) + '</td><td>' + sanitizeHTML(u.real_name) + '</td></tr>').join('');
                showAlert(res.message || '导入成功', 'success', 3000);
                if (users.length) {
                    var modalHtml = '<div class="modal fade" id="importResultModal" tabindex="-1">' +
                        '<div class="modal-dialog modal-lg"><div class="modal-content">' +
                        '<div class="modal-header"><h6 class="modal-title">导入用户清单</h6>' +
                        '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>' +
                        '<div class="modal-body"><div class="alert alert-warning small mb-2"><i class="fas fa-exclamation-triangle me-1"></i>初始密码仅此次展示，关闭后无法再查看，请先下载保存！</div>' +
                        '<div class="table-responsive"><table class="table table-sm table-bordered small">' +
                        '<thead><tr><th>工号</th><th>初始密码</th><th>姓名</th></tr></thead>' +
                        '<tbody>' + userList + '</tbody></table></div></div>' +
                        '<div class="modal-footer">' +
                        '<button class="btn btn-success btn-sm" onclick="downloadImportedAccounts()"><i class="fas fa-download me-1"></i>下载账号表（Excel）</button>' +
                        '<button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">关闭</button></div>' +
                        '</div></div></div>';
                    $('#modal-container').html(modalHtml);
                    $('#importResultModal').modal('show');
                }
                navToUsers();
            } else { showAlert(res.message || '导入失败', 'error'); }
        }
    });
}

// 把本次导入返回的账号清单交给后端生成 Excel 下载（密码仅存于此响应中）
function downloadImportedAccounts() {
    const users = window._lastImportedAccounts || [];
    if (!users.length) { showAlert('没有可下载的账号数据', 'error'); return; }
    $.ajax({
        url: '/admin/users/export-accounts-xlsx',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ users: users }),
        xhrFields: { responseType: 'blob' },
        success: function(blob, status, xhr) {
            if (xhr.getResponseHeader('Content-Type').indexOf('json') >= 0) {
                blob.text().then(t => showAlert(JSON.parse(t).message || '导出失败', 'error'));
                return;
            }
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = '新用户账号清单.xlsx';
            a.click();
            URL.revokeObjectURL(a.href);
        },
        error: function() { showAlert('导出失败，请稍后重试', 'error'); }
    });
}
