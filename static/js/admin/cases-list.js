// 管理员端 — 案例管理 · 列表页（筛选/搜索/批量导入导出/删除）
// caseCategoryFilter / caseSearch：列表筛选状态，navToCasesPage 分页时需要回填 URL
let caseCategoryFilter = '';
let caseSearch = '';
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
                        <button class="btn btn-primary btn-sm" onclick="navToCaseCreate()">
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
                        <div class="input-group">
                            <select class="form-select" id="case-category-filter" onchange="filterCasesByCategory()">
                                <option value="">所有类别</option>
                                ${data.categories.map(cat => `
                                    <option value="${cat.id}" ${String(cat.id)===String(caseCategoryFilter)?'selected':''}>${cat.name}</option>
                                `).join('')}
                            </select>
                            <button class="btn btn-outline-secondary" type="button"
                                    title="重命名 / 合并类别" onclick="renameCategoryPrompt()">✎</button>
                        </div>
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
                                        <button class="btn btn-outline-success btn-sm" onclick="batchExportCases()">
                                          <i class="fas fa-download me-1"></i>导出选中
                                        </button>
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
                                                    <td>${case_.title}${case_.is_knowledge_only ? ' <span class="badge bg-info" title="仅含知识问答，无考核站点">知识型</span>' : ''}</td>
                                                    <td class="d-none d-sm-table-cell"><span class="badge bg-secondary">${case_.category_name}</span></td>
                                                    <td class="d-none d-md-table-cell">${getDifficultyBadge(case_.difficulty)}</td>
                                                    <td class="d-none d-md-table-cell">${getCaseTypeBadge(case_.case_type)}</td>
                                                    <td>${case_.station_count}</td>
                                                    <td class="d-none d-sm-table-cell">${case_.learning_count}</td>
                                                    <td class="d-none d-lg-table-cell">${formatDateTime(case_.created_at)}</td>
                                                    <td>
                                                        <div class="btn-action-group">
                                                        <button class="btn btn-sm btn-outline-primary" onclick="navToCaseDetail(${case_.id})">
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
                                
                                ${generatePagination(data.pagination, 'navToCasesPage')}
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

// 重命名类别；若新名与其他类别同名，其下案例并入该类别
function renameCategoryPrompt() {
    const select = $('#case-category-filter');
    const categoryId = select.val();
    if (!categoryId) {
        showAlert('请先在下拉框中选择要重命名的类别', 'warning');
        return;
    }
    const currentName = select.find('option:selected').text();
    const newName = prompt(
        `将类别「${currentName}」重命名为：\n` +
        '（若新名与其他类别同名，其下所有案例将并入该类别）', currentName);
    if (newName === null) return;
    if (!newName.trim()) {
        showAlert('类别名不能为空', 'error');
        return;
    }
    $.ajax({
        url: `/admin/categories/${categoryId}`,
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({ name: newName.trim() }),
        success: function(response) {
            if (response.success) {
                showAlert(response.message, 'success');
                if (response.data.merged) {
                    caseCategoryFilter = ''; // 源类别已删除，清空筛选
                }
                loadCases(1);
            } else {
                showAlert(response.message, 'error');
            }
        }
    });
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

// 批量导出
function batchExportCases(){
  const ids = $('.case-check:checked').map((_,el)=>parseInt(el.value)).get();
  if(ids.length===0){ showAlert('请先勾选要导出的案例', 'error'); return; }
  if (ids.length === 1) {
    window.open(`/admin/cases/${ids[0]}/export`, '_blank');
    return;
  }
  // 多选：POST 下载 zip
  fetch('/admin/cases/export-batch', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({case_ids: ids})
  }).then(r => {
    if (!r.ok) { showAlert('导出失败', 'error'); return; }
    return r.blob();
  }).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `案例批量导出_${new Date().toISOString().slice(0,10)}.zip`;
    a.click(); URL.revokeObjectURL(url);
    showAlert(`已导出 ${ids.length} 个案例`, 'success');
  }).catch(() => showAlert('导出失败', 'error'));
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

