// 管理员端 — 学习统计（进度/错题热力/科室活跃图表）
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

