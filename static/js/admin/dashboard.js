// 管理员端 — 数据看板

// ============================================================================

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

