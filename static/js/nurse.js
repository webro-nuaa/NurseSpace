// 护士端JavaScript功能

let currentPage = 1;
let currentCaseId = null;
let currentStationId = null;
let currentKnowledgeId = null;
let caseKnowledgeMap = {}; // 缓存当前案例的扩展知识题目
let currentCategoryId = null; // 当前选中的类别
let currentCategoryName = null; // 当前选中的类别名称


// 加载案例列表
function loadCases(page = 1, categoryId = null, categoryName = null) {
    setActiveNav('案例学习');
    currentPage = page;
    currentCategoryId = categoryId || null;
    if (categoryName !== undefined) currentCategoryName = categoryName;
    
    let url = `/nurse/cases?page=${page}&per_page=10`;
    if (categoryId) {
        url += `&category_id=${categoryId}`;
    }
    
    $.get(url, function(response) {
        if (response.success) {
            const data = response.data;
            // 如果未选择类别，则先展示类别块
            if (!categoryId) {
                const catHtml = `
                    <div class="page-title">
                        <h2><i class="fas fa-th-large me-2"></i>选择类别</h2>
                        <p>点击类别查看该类别的案例</p>
                    </div>
                    <div class="row">
                        ${data.categories.map((cat, idx) => `
                            <div class="col-md-4 mb-4">
                                <div class="card h-100 fade-in" style="animation-delay: ${idx * 0.05}s; cursor: pointer;" onclick="loadCases(1, ${cat.id}, '${cat.name}')">
                                    <div class="card-body d-flex flex-column justify-content-center text-center">
                                        <div class="mb-2"><i class="fas fa-folder-open fa-2x text-primary"></i></div>
                                        <h5 class="card-title mb-1">${cat.name}</h5>
                                        <small class="text-muted">${cat.description || ''}</small>
                                    </div>
                                    <div class="card-footer text-center bg-transparent border-0">
                                        <button class="btn btn-primary btn-glow">
                                            <i class="fas fa-arrow-right me-1"></i>查看该类别
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
                $('#main-content').html(catHtml);
                return;
            }

            const html = `
                <div class="page-title d-flex justify-content-between align-items-center">
                    <div>
                        <h2><i class="fas fa-book-medical me-2"></i>${categoryId ? (currentCategoryName || '案例学习') : '案例学习'}</h2>
                        <p>${categoryId ? '点击案例卡片开始学习' : '选择案例开始学习，提升专业技能'}</p>
                    </div>
                    ${categoryId ? `<button class="btn btn-outline-light btn-sm" onclick="loadCases(1, null)"><i class=\"fas fa-th-large me-1\"></i>返回类别</button>` : ''}
                </div>
                
                <div class="row mb-3">
                    <div class="col-md-6">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" class="form-control" placeholder="搜索案例..." id="case-search">
                        </div>
                    </div>
                    <div class="col-md-3">
                        <select class="form-select" id="category-filter" onchange="filterByCategory()">
                            <option value="">所有类别</option>
                            ${data.categories.map(cat => `
                                <option value="${cat.id}" ${categoryId == cat.id ? 'selected' : ''}>${cat.name}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                
                <div class="row">
                    ${data.cases.map((case_, index) => `
                        <div class="col-md-6 col-lg-4 mb-4">
                            <div class="card h-100 fade-in" style="animation-delay: ${index * 0.1}s;">
                                <div class="card-body">
                                    <div class="d-flex justify-content-between align-items-start mb-3">
                                        <h5 class="card-title mb-0">${case_.title}</h5>
                                        <span class="badge bg-primary">${case_.category}</span>
                                    </div>
                                    <p class="card-text">
                                        <small class="text-muted">
                                            <i class="fas fa-layer-group me-1"></i>${case_.total_stations} 个站点
                                        </small>
                                    </p>
                                    <div class="progress mb-3" style="height: 10px;">
                                        <div class="progress-bar" role="progressbar" style="width: ${case_.progress}%" aria-valuenow="${case_.progress}" aria-valuemin="0" aria-valuemax="100"></div>
                                    </div>
                                    <div class="d-flex justify-content-between align-items-center text-muted small">
                                        <span>${case_.completed_stations}/${case_.total_stations} 题目完成</span>
                                        <span class="fw-bold text-primary">${case_.progress}%</span>
                                    </div>
                                </div>
                                <div class="card-footer bg-transparent border-0">
                                    <button class="btn btn-primary btn-glow w-100" onclick="viewCase(${case_.id})">
                                        <i class="fas fa-play me-2"></i>开始学习
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                ${generatePagination(data.pagination, 'loadCases')}
            `;
            
            $('#main-content').html(html);
            
            // 添加动画效果
            setTimeout(() => {
                $('.card').each(function(index) {
                    $(this).css('animation-delay', (index * 0.1) + 's');
                });
            }, 100);
            
            // 搜索功能
            $('#case-search').on('input', debounce(function() {
                const keyword = $(this).val();
                searchCases(keyword);
            }, 300));
            
            // 添加卡片悬浮效果
            $('.card').hover(
                function() {
                    $(this).addClass('neon-glow');
                },
                function() {
                    $(this).removeClass('neon-glow');
                }
            );
        }
    });
}

// 搜索案例（客户端过滤）
function searchCases(keyword) {
    const kw = (keyword || '').trim().toLowerCase();
    const cards = document.querySelectorAll('#main-content .col-md-6.col-lg-4.mb-4');
    cards.forEach(function(card) {
        const title = (card.querySelector('.card-title')?.textContent || '').toLowerCase();
        card.style.display = (!kw || title.includes(kw)) ? '' : 'none';
    });
}

// 按类别筛选
function filterByCategory() {
    const categoryId = $('#category-filter').val();
    const select = document.getElementById('category-filter');
    const name = select && select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : null;
    loadCases(1, categoryId || null, name);
}

// 查看案例详情
function viewCase(caseId) {
    currentCaseId = caseId;
    
    $.get(`/nurse/cases/${caseId}`, function(response) {
        if (response.success) {
            const data = response.data;
            // 缓存扩展知识
            caseKnowledgeMap = {};
            (data.extended_knowledge || []).forEach(k => caseKnowledgeMap[k.id] = k);

            const html = `
                <div class="row">
                    <div class="col-12">
                        <nav aria-label="breadcrumb">
                            <ol class="breadcrumb">
                                <li class="breadcrumb-item">
                                    <a href="#" onclick="loadCases()">案例学习</a>
                                </li>
                                <li class="breadcrumb-item active">${data.case.title}</li>
                            </ol>
                        </nav>
                        
                        <h2>${data.case.title}</h2>
                        <p class="text-muted">
                            <i class="fas fa-tag me-1"></i>${data.case.category_name}
                            <span class="badge bg-warning text-dark ms-2">${({basic:'基础',intermediate:'中级',advanced:'高级'})[data.case.difficulty] || data.case.difficulty}</span>
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
                                <div class="list-group">
                                    ${data.stations.map(station => `
                                        <div class="list-group-item d-flex justify-content-between align-items-center">
                                            <div>
                                                <h6 class="mb-1">${station.name}</h6>
                                                <p class="mb-1 text-muted">${station.question.substring(0, 100)}...</p>
                                            </div>
                                            <div class="text-end">
                                                ${station.completed ? 
                                                    (() => {
                                                        const s = (station.score === null || station.score === undefined) ? null : Number(station.score);
                                                        const label = (s === null || isNaN(s)) ? '未评分' : `${s}分`;
                                                        const cls = getScoreBadgeClass(s);
                                                        return `<span class="badge ${cls}">${label}</span>`;
                                                    })() : 
                                                    '<span class="badge bg-secondary">未完成</span>'
                                                }
                                                <br>
                                                <div class="btn-group-vertical" role="group">
                                                    <a class="btn btn-sm btn-outline-primary mb-1" href="/nurse/station?id=${station.id}&case=${currentCaseId}">
                                                        ${station.completed ? '重新答题' : '开始答题'}
                                                    </a>
                                                    <a class="btn btn-sm btn-outline-info" href="/nurse/answer-view?id=${station.id}&case=${currentCaseId}">
                                                        <i class="fas fa-eye me-1"></i>查看答案
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-4">
                        ${(data.videos && data.videos.length) ? `
                        <div class="card mb-3">
                            <div class="card-header"><h6 class="mb-0"><i class="fas fa-video me-2"></i>视频资源</h6></div>
                            <div class="card-body p-2">
                                ${data.videos.map(v => `
                                    <div class="mb-2"><a href="${v.url}" target="_blank" class="small">${v.title}</a>
                                    ${v.description ? `<br><small class="text-muted">${v.description}</small>` : ''}</div>
                                `).join('')}
                            </div>
                        </div>` : ''}
                        ${(data.links && data.links.length) ? `
                        <div class="card mb-3">
                            <div class="card-header"><h6 class="mb-0"><i class="fas fa-link me-2"></i>参考链接</h6></div>
                            <div class="card-body p-2">
                                ${data.links.map(l => `
                                    <div class="mb-2"><a href="${l.url}" target="_blank" class="small">${l.title}</a>
                                    ${l.description ? `<br><small class="text-muted">${l.description}</small>` : ''}</div>
                                `).join('')}
                            </div>
                        </div>` : ''}
                        <div class="card">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h5 class="mb-0"><i class="fas fa-lightbulb me-2"></i>扩展知识</h5>
                                <span class="badge bg-secondary">${(data.extended_knowledge||[]).length}</span>
                            </div>
                            <div class="card-body">
                                ${data.extended_knowledge.length > 0 ?
                                    data.extended_knowledge.map(k => `
                                        <div class="border rounded p-2 mb-2">
                                            <div class="d-flex justify-content-between align-items-start">
                                                <div class="pe-2">
                                                    <div class="fw-semibold mb-1">${k.question}</div>
                                                </div>
                                                <div class="text-nowrap">
                                                    <div class="btn-group" role="group">
                                                        <a class="btn btn-sm btn-outline-primary" href="/nurse/knowledge?id=${k.id}">
                                                            <i class="fas fa-pen me-1"></i>作答
                                                        </a>
                                                        <a class="btn btn-sm btn-outline-info" href="/nurse/knowledge-answer-view?id=${k.id}">
                                                            <i class="fas fa-eye me-1"></i>查看答案
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
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

// 跳转到新页面答题（兼容其他入口仍调用 startStation 的情况）
function startStation(stationId) {
    const queryCase = currentCaseId ? `&case=${currentCaseId}` : '';
    window.location.href = `/nurse/station?id=${stationId}${queryCase}`;
}

// 加载错题集
function loadWrongQuestions(page = 1) {
    setActiveNav('错题集');
    
    $.get(`/nurse/wrong-questions?page=${page}`, function(response) {
        if (response.success) {
            const data = response.data;
            const html = `
                <div class="page-title">
                    <h2><i class="fas fa-exclamation-triangle me-2"></i>错题集</h2>
                    <p>回顾和重做错题，提升学习效果</p>
                </div>
                
                <div class="row">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-body">
                                ${data.wrong_questions.length > 0 ? `
                                    <div class="row">
                                        ${data.wrong_questions.map(wrong => `
                                            <div class="col-12 col-md-6 col-lg-4 mb-3">
                                                <div class="card h-100 position-relative">
                                                    <div class="card-body d-flex flex-column">
                                                        <div class="d-flex justify-content-between align-items-start mb-2">
                                                            <span class="badge bg-secondary">${wrong.category_name}</span>
                                                            <span class="badge ${getScoreBadgeClass(wrong.score)}">${wrong.score}分</span>
                                                        </div>
                                                        <div class="mb-1 small text-muted"><i class="fas fa-briefcase me-1"></i>${wrong.case_title}</div>
                                                        <div class="fw-semibold mb-2 line-clamp-2">${wrong.question}</div>
                                                        <a href="/nurse/wrong-detail?station=${wrong.station_id}" class="stretched-link" aria-label="查看错题详情"></a>
                                                        <div class="mt-auto d-flex align-items-center pt-2">
                                                            <small class="text-muted"><i class="fas fa-clock me-1"></i>${formatDateTime(wrong.created_at)}</small>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                    ${generatePagination(data.pagination, 'loadWrongQuestions')}
                                ` : `
                                    <div class="text-center py-5">
                                        <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
                                        <h5>太棒了！目前没有错题</h5>
                                        <p class="text-muted">继续保持良好的学习状态</p>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            $('#main-content').html(html);
        }
    });
}

// 加载薄弱点分析
function loadWeaknessAnalysis() {
    setActiveNav('薄弱点分析');
    // 占位，避免空白感
    $('#main-content').html('<div class="text-muted p-4">正在加载薄弱点分析...</div>');

    // 默认仅读取上次保存的结果
    $.get(`/nurse/weakness-analysis?_=${Date.now()}`, function(response) {
        if (response && response.success) {
            const raw = (response.data && response.data.analysis) ? response.data.analysis : {};
            const generatedAt = (response.data && response.data.generated_at) ? response.data.generated_at : null;
            const analysis = {
                weak_categories: Array.isArray(raw.weak_categories) ? raw.weak_categories : [],
                main_issues: Array.isArray(raw.main_issues) ? raw.main_issues : [],
                improvement_suggestions: Array.isArray(raw.improvement_suggestions) ? raw.improvement_suggestions : [],
                study_plan: raw.study_plan || '',
                priority_areas: Array.isArray(raw.priority_areas) ? raw.priority_areas : []
            };
            const html = `
                <div class="page-title d-flex justify-content-between align-items-center">
                    <div>
                        <h2><i class="fas fa-chart-line me-2"></i>薄弱点分析</h2>
                        <p class="text-muted mb-0">基于您的错题数据，AI为您生成个性化学习建议${generatedAt ? `（上次分析：${formatDateTime(generatedAt)}）` : '（尚未进行分析）'}</p>
                    </div>
                    <div class="text-end">
                        <button class="btn btn-primary btn-lg btn-glow shadow" id="btn-run-weakness" style="padding: 10px 22px;">
                            <i class="fas fa-magic me-2"></i>${generatedAt ? '重新分析' : '开始分析'}
                        </button>
                        <div class="small text-muted mt-1">点击开始将调用AI生成分析</div>
                    </div>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h5><i class="fas fa-exclamation-circle me-2"></i>薄弱领域</h5>
                            </div>
                            <div class="card-body">
                                ${analysis.weak_categories.length > 0 ? 
                                    analysis.weak_categories.map(category => `
                                        <span class="badge bg-warning me-2 mb-2">${category}</span>
                                    `).join('') : 
                                    '<p class="text-muted">暂无薄弱领域数据</p>'
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
                                    ${analysis.main_issues.map(issue => `
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
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h5><i class="fas fa-lightbulb me-2"></i>改进建议</h5>
                            </div>
                            <div class="card-body">
                                ${analysis.improvement_suggestions.length > 0 ? 
                                    analysis.improvement_suggestions.map(suggestion => `
                                        <div class="mb-3">
                                            <h6 class="text-primary">${suggestion.category || '综合'}</h6>
                                            <p class="small">${suggestion.suggestion || ''}</p>
                                        </div>
                                    `).join('') : 
                                    '<p class="text-muted">暂无具体建议</p>'
                                }
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h5><i class="fas fa-graduation-cap me-2"></i>学习计划</h5>
                            </div>
                            <div class="card-body">
                                <p>${analysis.study_plan}</p>
                                
                                ${analysis.priority_areas.length > 0 ? `
                                    <div class="mt-3">
                                        <h6>优先加强领域：</h6>
                                        ${analysis.priority_areas.map(area => `
                                            <span class="badge bg-danger me-2">${area}</span>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            $('#main-content').html(html);

            // 绑定“开始/重新分析”按钮：调用保存接口
            $('#btn-run-weakness').on('click', function(){
                $('#btn-run-weakness').prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-1"></i>分析中...');
                $.ajax({
                    url: '/nurse/weakness-analysis/run',
                    method: 'POST',
                    success: function(res){
                        if (res && res.success) {
                            loadWeaknessAnalysis();
                        } else {
                            showAlert((res && res.message) ? res.message : '分析失败', 'error');
                        }
                    },
                    error: function(){
                        showAlert('分析失败，请稍后重试', 'error');
                    },
                    complete: function(){
                        $('#btn-run-weakness').prop('disabled', false).html('<i class="fas fa-rotate-right me-1"></i>重新分析');
                    }
                });
            });
        } else {
            showAlert((response && response.message) ? response.message : '加载失败', 'error');
        }
    }).fail(function(){
        showAlert('加载失败，请稍后重试', 'error');
    });
}

// 加载考试列表
function loadExams() {
    setActiveNav('考试中心');
    
    $.get('/nurse/exams', function(response) {
        if (response.success) {
            const data = response.data;
            const html = `
                <div class="page-title">
                    <h2><i class="fas fa-file-alt me-2"></i>考试中心</h2>
                    <p>参加管理员发布的考试</p>
                </div>
                
                <div class="row">
                    ${data.exams.length > 0 ? 
                        data.exams.map(exam => `
                            <div class="col-md-6 col-lg-4 mb-4">
                                <div class="card h-100">
                                    <div class="card-body">
                                        <h5 class="card-title">${exam.title}</h5>
                                        <p class="card-text">${exam.description || '暂无描述'}</p>
                                        <p class="card-text">
                                            <small class="text-muted">
                                                <i class="fas fa-clock me-1"></i>时长：${exam.duration}分钟
                                            </small>
                                            <br>
                                            ${exam.end_time ? `
                                                <small class="text-muted">
                                                    <i class="fas fa-calendar me-1"></i>截止：${formatDateTime(exam.end_time)}
                                                </small>
                                            ` : ''}
                                        </p>
                                        
                                        ${exam.participated ? `
                                            <div class="alert alert-info">
                                                <i class="fas fa-check-circle me-2"></i>
                                                已参加 ${exam.score ? `(得分: ${exam.score})` : ''}
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div class="card-footer">
                                        ${exam.participated ? `
                                            <button class="btn btn-secondary btn-sm" disabled>
                                                <i class="fas fa-check me-1"></i>已完成
                                            </button>
                                        ` : `
                                            <button class="btn btn-primary btn-sm" onclick="startExam(${exam.id})">
                                                <i class="fas fa-play me-1"></i>开始考试
                                            </button>
                                        `}
                                    </div>
                                </div>
                            </div>
                        `).join('') : `
                            <div class="col-12">
                                <div class="text-center py-5">
                                    <i class="fas fa-file-alt fa-3x text-muted mb-3"></i>
                                    <h5>暂无可参加的考试</h5>
                                    <p class="text-muted">管理员暂未发布新的考试</p>
                                </div>
                            </div>
                        `
                    }
                </div>
            `;
            
            $('#main-content').html(html);
        }
    });
}

// 开始考试
function startExam(examId) {
    if (confirm('确定要开始考试吗？开始后将无法中断。')) {
        // 这里应该实现考试功能
        showAlert('考试功能正在开发中', 'info');
    }
}

// 加载积分记录
function loadPointRecords(page = 1) {
    setActiveNav('积分记录');
    
    $.get(`/nurse/point-records?page=${page}`, function(response) {
        if (response.success) {
            const data = response.data;
            const html = `
                <div class="page-title">
                    <h2><i class="fas fa-coins me-2"></i>积分记录</h2>
                    <p>当前积分：<span class="badge bg-primary fs-6">${data.current_points}</span></p>
                </div>
                
                <div class="row">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-body">
                                ${data.records.length > 0 ? `
                                    <div class="table-responsive">
                                        <table class="table table-hover">
                                            <thead>
                                                <tr>
                                                    <th>积分变化</th>
                                                    <th>原因</th>
                                                    <th>类型</th>
                                                    <th>时间</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${data.records.map(record => `
                                                    <tr>
                                                        <td>
                                                            <span class="badge ${record.points > 0 ? 'bg-success' : 'bg-danger'}">
                                                                ${record.points > 0 ? '+' : ''}${record.points}
                                                            </span>
                                                        </td>
                                                        <td>${record.reason}</td>
                                                        <td>
                                                            <span class="badge bg-secondary">
                                                                ${record.related_type === 'learning' ? '学习' : '考试'}
                                                            </span>
                                                        </td>
                                                        <td>${formatDateTime(record.created_at)}</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    ${generatePagination(data.pagination, 'loadPointRecords')}
                                ` : `
                                    <div class="text-center py-5">
                                        <i class="fas fa-coins fa-3x text-muted mb-3"></i>
                                        <h5>暂无积分记录</h5>
                                        <p class="text-muted">完成学习任务即可获得积分</p>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            $('#main-content').html(html);
        }
    });
}
