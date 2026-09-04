// 管理员端 — 群体分析
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

