// 护士端JavaScript功能

let currentPage = 1;
let currentCaseId = null;
let currentStationId = null;
let currentKnowledgeId = null;
let caseKnowledgeMap = {}; // 缓存当前案例的扩展知识题目
let currentCategoryId = null; // 当前选中的类别
let currentCategoryName = null; // 当前选中的类别名称
let _popstateInProgress = false; // suppress history manipulation during popstate

// 全局 AJAX 401 处理：token 过期自动跳转登录
$(document).ajaxError(function(event, jqXHR) {
    if (jqXHR.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_info');
        window.location.href = '/auth/login';
    }
});

// 为独立页面链接附加 JWT token，避免 session 过期后跳登录页
function hrefWithToken(baseUrl) {
    const token = localStorage.getItem('access_token');
    if (!token) return baseUrl;
    const sep = baseUrl.includes('?') ? '&' : '?';
    return baseUrl + sep + 'token=' + encodeURIComponent(token);
}


// 加载案例列表
function loadCases(page = 1, categoryId = null, categoryName = null) {
    setActiveNav('案例学习');
    // 分页点击时只有 page 参数，保持当前类别上下文（popstate 期间跳过，由 URL 决定）
    if (!_popstateInProgress && arguments.length === 1 && currentCategoryId) {
        categoryId = currentCategoryId;
        categoryName = currentCategoryName;
    }
    currentPage = page;
    currentCategoryId = categoryId || null;
    if (categoryName !== undefined) currentCategoryName = categoryName;

    // Update URL to reflect navigation state
    var navUrl = new URL(window.location);
    navUrl.searchParams.set('tab', 'cases');
    if (categoryId) {
        navUrl.searchParams.set('category_id', categoryId);
        navUrl.searchParams.delete('case_id');
    } else {
        navUrl.searchParams.delete('category_id');
        navUrl.searchParams.delete('case_id');
    }
    // pushState for explicit drill-down, replaceState for pagination / top-level
    if (!_popstateInProgress) {
        if (arguments.length >= 2 && categoryId) {
            window.history.pushState({}, '', navUrl);
        } else {
            window.history.replaceState({}, '', navUrl);
        }
    }

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
                    <nav aria-label="breadcrumb">
                        <ol class="breadcrumb">
                            <li class="breadcrumb-item"><a href="#" onclick="navigateTo('dashboard')">首页</a></li>
                            <li class="breadcrumb-item active">案例学习</li>
                        </ol>
                    </nav>
                    <div class="page-title">
                        <h2><i class="fas fa-th-large me-2"></i>案例学习</h2>
                        <p>点击类别查看该类别的案例</p>
                    </div>
                    <div class="row">
                        ${data.categories.map((cat, idx) => `
                            <div class="col-sm-6 col-lg-4 mb-3">
                                <div class="card h-100 fade-in shadow-sm" style="animation-delay: ${idx * 0.05}s; cursor: pointer;" onclick="loadCases(1, ${cat.id}, '${(cat.name || '').replace(/'/g, "\\'")}')">
                                    <div class="card-body">
                                        <div class="d-flex align-items-start justify-content-between mb-2">
                                            <div class="d-flex align-items-center">
                                                <i class="fas fa-folder-open fa-lg text-primary me-2"></i>
                                                <h6 class="card-title mb-0">${cat.name}</h6>
                                            </div>
                                            <span class="badge bg-primary rounded-pill">${cat.case_count || 0} 案例</span>
                                        </div>
                                        ${cat.description ? '<p class="text-muted small mb-0">' + cat.description + '</p>' : ''}
                                    </div>
                                    <div class="card-footer bg-transparent border-top-0 pt-0">
                                        <button type="button" class="btn btn-outline-primary btn-sm w-100">
                                            <i class="fas fa-arrow-right me-1"></i>查看
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

            // 从服务端数据补充类别名（页面刷新/deeplink 时 currentCategoryName 可能为空）
            if (!currentCategoryName && data.cases && data.cases.length > 0 && data.cases[0].category) {
                currentCategoryName = data.cases[0].category;
            }
            const html = `
                <nav aria-label="breadcrumb">
                    <ol class="breadcrumb">
                        <li class="breadcrumb-item"><a href="#" onclick="navigateTo('dashboard')">首页</a></li>
                        <li class="breadcrumb-item"><a href="#" onclick="loadCases(1, null)">案例学习</a></li>
                        <li class="breadcrumb-item active">${currentCategoryName || '案例学习'}</li>
                    </ol>
                </nav>
                <div class="page-title d-flex justify-content-between align-items-center">
                    <div>
                        <h2><i class="fas fa-book-medical me-2"></i>${currentCategoryName || '案例学习'}</h2>
                        <p>点击案例卡片开始学习</p>
                    </div>
                </div>

                ${categoryId ? `
                <div class="row mb-3">
                    <div class="col-md-6 col-lg-4">
                        <div class="input-group">
                            <span class="input-group-text"><i class="fas fa-search"></i></span>
                            <input type="text" class="form-control" id="nurse-case-search"
                                   placeholder="搜索案例标题..."
                                   oninput="filterCasesClientSide()">
                            <button class="btn btn-outline-secondary" type="button" id="btn-clear-search" style="display:none"
                                    onclick="$('#nurse-case-search').val('');filterCasesClientSide();">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                </div>` : ''}

                <div class="row">
                    ${data.cases.map((case_, index) => `
                        <div class="col-md-6 col-lg-4 mb-4 case-card-item" data-case-title="${case_.title.replace(/"/g, '&quot;')}">
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
                                    <button type="button" class="btn btn-primary btn-glow w-100" onclick="viewCase(${case_.id})">
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

// 客户端案例搜索过滤
function filterCasesClientSide() {
    const query = ($('#nurse-case-search').val() || '').trim().toLowerCase();
    let visibleCount = 0;
    $('.case-card-item').each(function() {
        const title = ($(this).attr('data-case-title') || '').toLowerCase();
        const match = !query || title.includes(query);
        $(this).toggle(match);
        if (match) visibleCount++;
    });
    $('#btn-clear-search').toggle(query.length > 0);
    // Show/hide no-results message
    if (query && visibleCount === 0) {
        if (!$('#no-case-results').length) {
            $('.case-card-item').first().closest('.row').after(
                '<div id="no-case-results" class="text-center py-4 text-muted">' +
                '<i class="fas fa-search fa-2x mb-2"></i><p>没有匹配的案例</p></div>');
        }
    } else {
        $('#no-case-results').remove();
    }
}

// 搜索案例（客户端过滤）
// 查看案例详情
function viewCase(caseId) {
    currentCaseId = caseId;

    // Update URL to reflect case state
    var navUrl = new URL(window.location);
    navUrl.searchParams.set('tab', 'cases');
    navUrl.searchParams.set('case_id', caseId);
    navUrl.searchParams.delete('category_id');
    if (!_popstateInProgress) {
        window.history.pushState({}, '', navUrl);
    }

    $.get(`/nurse/cases/${caseId}`, function(response) {
        if (response.success) {
            const data = response.data;
            // 缓存扩展知识
            caseKnowledgeMap = {};
            (data.extended_knowledge || []).forEach(k => caseKnowledgeMap[k.id] = k);

            // 持久化类别信息，popstate 回退时可用
            if (data.case.category_id) currentCategoryId = data.case.category_id;
            if (data.case.category_name) currentCategoryName = data.case.category_name;
            const catId = data.case.category_id || currentCategoryId;
            const catName = data.case.category_name || currentCategoryName || '案例学习';
            const catNameEsc = (catName || '').replace(/'/g, "\\'");
            const html = `
                <div class="row">
                    <div class="col-12">
                        <nav aria-label="breadcrumb">
                            <ol class="breadcrumb">
                                <li class="breadcrumb-item">
                                    <a href="#" onclick="navigateTo('dashboard')">首页</a>
                                </li>
                                <li class="breadcrumb-item">
                                    <a href="#" onclick="loadCases(1, null)">案例学习</a>
                                </li>
                                <li class="breadcrumb-item">
                                    <a href="#" onclick="loadCases(1, ${catId}, '${catNameEsc}')">${catName}</a>
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
                                                <div class="d-flex gap-1">
                                                    <a class="btn btn-sm btn-outline-primary" href="${hrefWithToken('/nurse/station?id=' + station.id + '&case=' + currentCaseId)}" title="${station.completed ? '重新答题' : '开始答题'}">
                                                        <i class="fas fa-play"></i><span class="d-none d-md-inline ms-1">${station.completed ? '重新答题' : '开始答题'}</span>
                                                    </a>
                                                    <a class="btn btn-sm btn-outline-info" href="${hrefWithToken('/nurse/answer-view?id=' + station.id + '&case=' + currentCaseId)}" title="查看答案">
                                                        <i class="fas fa-eye"></i><span class="d-none d-md-inline ms-1">查看答案</span>
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
                                                <div class="text-end">
                                                    ${k.completed ?
                                                        (() => {
                                                            const s = (k.score === null || k.score === undefined) ? null : Number(k.score);
                                                            const label = (s === null || isNaN(s)) ? '未评分' : `${s}分`;
                                                            const cls = getScoreBadgeClass(s);
                                                            return `<span class="badge ${cls}">${label}</span>`;
                                                        })() :
                                                        '<span class="badge bg-secondary">未完成</span>'
                                                    }
                                                    <br>
                                                    <div class="d-flex gap-1">
                                                        <a class="btn btn-sm btn-outline-primary" href="${hrefWithToken('/nurse/knowledge?id=' + k.id)}" title="${k.completed ? '重新作答' : '作答'}">
                                                            <i class="fas fa-pen"></i><span class="d-none d-md-inline ms-1">${k.completed ? '重新作答' : '作答'}</span>
                                                        </a>
                                                        <a class="btn btn-sm btn-outline-info" href="${hrefWithToken('/nurse/knowledge-answer-view?id=' + k.id)}" title="查看答案">
                                                            <i class="fas fa-eye"></i><span class="d-none d-md-inline ms-1">查看答案</span>
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
    const queryCase = currentCaseId ? '&case=' + currentCaseId : '';
    window.location.href = hrefWithToken('/nurse/station?id=' + stationId + queryCase);
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
                                                        <a href="${wrong.type === 'knowledge' ? hrefWithToken('/nurse/knowledge?id=' + wrong.knowledge_id) : hrefWithToken('/nurse/wrong-detail?station=' + wrong.station_id)}" class="stretched-link" aria-label="查看错题详情"></a>
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
                <div class="page-title d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div>
                        <h2><i class="fas fa-chart-line me-2"></i>薄弱点分析</h2>
                        <p class="text-muted mb-0">基于您的错题数据，AI为您生成个性化学习建议${generatedAt ? `（上次分析：${formatDateTime(generatedAt)}）` : ''}</p>
                    </div>
                    <button class="btn btn-primary btn-glow" id="btn-run-weakness" title="${generatedAt ? '重新AI分析' : '开始AI分析'}">
                        <i class="fas fa-magic"></i><span class="d-none d-md-inline ms-1">${generatedAt ? '重新分析' : '开始分析'}</span>
                    </button>
                </div>

                <div class="row">
                    <div class="col-md-6 mb-3">
                        <div class="card h-100">
                            <div class="card-header">
                                <h6 class="mb-0"><i class="fas fa-exclamation-circle me-2"></i>薄弱领域</h6>
                            </div>
                            <div class="card-body">
                                ${analysis.weak_categories.length > 0 ?
                                    analysis.weak_categories.map(category => `
                                        <span class="badge bg-warning me-2 mb-2 content-wrap">${category}</span>
                                    `).join('') :
                                    '<p class="text-muted">暂无薄弱领域数据</p>'
                                }
                            </div>
                        </div>
                    </div>

                    <div class="col-md-6 mb-3">
                        <div class="card h-100">
                            <div class="card-header">
                                <h6 class="mb-0"><i class="fas fa-list me-2"></i>主要问题</h6>
                            </div>
                            <div class="card-body">
                                ${analysis.main_issues.length > 0 ? `
                                    <ul class="list-unstyled mb-0">
                                        ${analysis.main_issues.map(issue => `
                                            <li class="mb-3">
                                                <i class="fas fa-caret-right text-warning me-2"></i>
                                                <span class="content-wrap">${issue.replace(/\n/g, '<br>')}</span>
                                            </li>
                                        `).join('')}
                                    </ul>
                                ` : '<p class="text-muted">暂无主要问题数据</p>'}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6 mb-3">
                        <div class="card h-100">
                            <div class="card-header">
                                <h6 class="mb-0"><i class="fas fa-lightbulb me-2"></i>改进建议</h6>
                            </div>
                            <div class="card-body">
                                ${analysis.improvement_suggestions.length > 0 ?
                                    analysis.improvement_suggestions.map(suggestion => `
                                        <div class="mb-3">
                                            <h6 class="text-primary">${suggestion.category || '综合'}</h6>
                                            <p class="small mb-0 content-wrap">${(suggestion.suggestion || '').replace(/\n/g, '<br>')}</p>
                                        </div>
                                    `).join('') :
                                    '<p class="text-muted">暂无具体建议</p>'
                                }
                            </div>
                        </div>
                    </div>

                    <div class="col-md-6 mb-3">
                        <div class="card h-100">
                            <div class="card-header">
                                <h6 class="mb-0"><i class="fas fa-graduation-cap me-2"></i>学习计划</h6>
                            </div>
                            <div class="card-body">
                                <p class="content-wrap">${(analysis.study_plan || '暂无学习计划').replace(/\n/g, '<br>')}</p>

                                ${analysis.priority_areas.length > 0 ? `
                                    <div class="mt-3">
                                        <h6>优先加强领域：</h6>
                                        ${analysis.priority_areas.map(area => `
                                            <span class="badge bg-danger me-2 mb-1 content-wrap">${area}</span>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            $('#main-content').html(html);

            // 绑定"开始/重新分析"按钮：调用保存接口
            $('#btn-run-weakness').on('click', function(){
                $('#btn-run-weakness').prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i><span class="d-none d-md-inline ms-1">分析中...</span>');
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
                        $('#btn-run-weakness').prop('disabled', false).html('<i class="fas fa-rotate-right"></i><span class="d-none d-md-inline ms-1">重新分析</span>');
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
                                                已参加 ${exam.score != null ? `(总分: ${exam.score})` : ''}
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div class="card-footer">
                                        ${exam.participated ? `
                                            <button class="btn btn-outline-primary btn-sm" onclick="viewExamResult(${exam.id})">
                                                <i class="fas fa-eye me-1"></i>查看结果
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
var _examTimer = null;
var _examSeconds = 0;

function startExam(examId) {
    if (!confirm('确定要开始考试吗？开始后将无法中断。')) return;

    $.ajax({
        url: '/nurse/exams/' + examId + '/start',
        method: 'POST',
        success: function(res) {
            if (!res.success) { showAlert(res.message, 'error'); return; }
            renderExamUI(res.data);
        },
        error: function(xhr) {
            var msg = '开始考试失败，请稍后重试';
            try {
                var body = JSON.parse(xhr.responseText);
                if (body.message) msg = body.message;
            } catch(e) {}
            showAlert(msg + ' (' + xhr.status + ')', 'error');
        }
    });
}

function renderExamUI(data) {
    var questions = data.questions;
    var exam = data.exam;
    var totalScore = data.total_score;
    var durationMin = exam.duration || 60;

    _examSeconds = durationMin * 60;
    var recordId = data.record_id;

    var totalStationCount = 0;
    var questionsHtml = questions.map(function(q, i) {
        totalStationCount += q.stations.length;
        var caseGuideHtml = q.case_guide ?
            '<div class="alert alert-light border mb-3"><small class="text-muted fw-bold d-block mb-1">案例背景</small>' + sanitizeHTML(q.case_guide) + '</div>' : '';

        var stationsHtml = q.stations.map(function(s, si) {
            return `
                <div class="border rounded p-3 mb-2 bg-light">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="fw-bold small text-muted">题目 ${si + 1}</span>
                        <span class="text-muted small">${sanitizeHTML(s.name)}</span>
                    </div>
                    ${s.assessment_task ? '<p class="text-muted small mb-1"><i class="fas fa-tasks me-1"></i>' + sanitizeHTML(s.assessment_task) + '</p>' : ''}
                    <p class="fw-bold mb-2">${sanitizeHTML(s.question)}</p>
                    <textarea class="form-control exam-answer" data-station-id="${s.id}" data-exam-question-id="${q.id}"
                        rows="3" placeholder="请输入您的答案..."></textarea>
                </div>`;
        }).join('');

        return `
            <div class="card mb-4" id="question-card-${q.id}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <span>
                        <span class="badge bg-primary me-2">第${i + 1}题</span>
                        <strong>${sanitizeHTML(q.case_title)}</strong>
                        <span class="badge bg-secondary ms-2">${q.difficulty === 'advanced' ? '高级' : (q.difficulty === 'basic' ? '基础' : '中级')}</span>
                    </span>
                    <span class="badge bg-info">${q.score}分</span>
                </div>
                <div class="card-body">
                    ${caseGuideHtml}
                    ${stationsHtml}
                </div>
            </div>`;
    }).join('');

    var html = `
        <div class="exam-page">
            <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <div>
                    <h2 class="mb-1"><i class="fas fa-file-alt me-2"></i>${sanitizeHTML(exam.title)}</h2>
                    <p class="text-muted mb-0 small">${sanitizeHTML(exam.description || '')}</p>
                </div>
                <div class="text-end">
                    <div class="exam-timer badge bg-warning text-dark fs-5" id="exam-timer">
                        <i class="fas fa-clock me-1"></i><span id="timer-display">--:--</span>
                    </div>
                </div>
            </div>

            <div class="alert alert-info small mb-3">
                <i class="fas fa-info-circle me-1"></i>
                共 <strong>${questions.length}</strong> 个案例，<strong>${totalStationCount}</strong> 道题目，满分 <strong>${totalScore}</strong> 分，时长 <strong>${exam.duration}</strong> 分钟。
                请认真作答，提交后不可修改。
            </div>

            <div id="exam-questions">
                ${questionsHtml}
            </div>

            <div class="text-center my-4">
                <button class="btn btn-success btn-lg" onclick="submitExam(${exam.id}, ${recordId})">
                    <i class="fas fa-check me-2"></i>提交答卷
                </button>
                <p class="text-muted small mt-2">提交后将无法修改，请确认所有题目已作答完毕</p>
            </div>
        </div>`;

    $('#main-content').html(html);

    // Start timer
    updateTimerDisplay();
    _examTimer = setInterval(function() {
        _examSeconds--;
        updateTimerDisplay();
        if (_examSeconds <= 0) {
            clearInterval(_examTimer);
            showAlert('考试时间已到，系统将自动提交', 'warning', 5000);
            autoSubmitExam(exam.id, recordId);
        }
        // Warning at 5 minutes
        if (_examSeconds === 300) {
            showAlert('考试还剩5分钟，请尽快作答', 'warning', 5000);
        }
    }, 1000);

    // Scroll to first question
    $('html, body').animate({ scrollTop: $('#exam-questions').offset().top - 80 }, 300);
}

function updateTimerDisplay() {
    var m = Math.floor(_examSeconds / 60);
    var s = _examSeconds % 60;
    $('#timer-display').text(
        String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
    );
    if (_examSeconds < 300) {
        $('#exam-timer').removeClass('bg-warning text-dark').addClass('bg-danger text-white');
    }
}

function viewExamResult(examId) {
    $.get('/nurse/exams/' + examId + '/result', function(res) {
        if (!res.success) { showAlert(res.message || '加载失败', 'error'); return; }
        var d = res.data;
        var totalStations = 0;
        (d.cases || []).forEach(function(c) { totalStations += c.stations.length; });
        var html = `
            <nav aria-label="breadcrumb"><ol class="breadcrumb">
                <li class="breadcrumb-item"><a href="#" onclick="loadTab('exams')">考试中心</a></li>
                <li class="breadcrumb-item active">考试结果</li>
            </ol></nav>
            <div class="page-title">
                <h2><i class="fas fa-poll me-2"></i>${d.exam ? d.exam.title : '考试结果'}</h2>
                <p>总分 <span class="fw-bold fs-4 text-primary">${d.total_score.toFixed(0)}</span> / ${d.max_score.toFixed(0)} — 共 ${(d.cases || []).length} 个案例，${totalStations} 个站点</p>
            </div>

            ${(d.cases || []).map(function(c, ci) {
                return `
                <div class="card mb-4">
                    <div class="card-header">
                        <h6 class="mb-0"><i class="fas fa-folder-open me-2 text-primary"></i>案例 #${ci + 1}：${c.case_title}</h6>
                    </div>
                    <div class="card-body py-2">
                        ${c.stations.map(function(a, i) {
                            var badgeClass = a.score >= 80 ? 'bg-success' : (a.score >= 60 ? 'bg-warning text-dark' : 'bg-danger');
                            return `
                                <div class="card mb-2 ${i === c.stations.length - 1 ? '' : ''}">
                                    <div class="card-header py-2 d-flex justify-content-between align-items-center">
                                        <span><strong>#${i + 1}</strong> ${a.station_name}</span>
                                        <span class="badge ${badgeClass}">${a.score.toFixed(0)} 分</span>
                                    </div>
                                    <div class="card-body py-2">
                                        <div class="mb-2 content-wrap"><small class="text-muted">题目：</small>${a.question}</div>
                                        <div class="mb-2"><small class="text-muted">你的作答：</small><div class="border rounded p-2 bg-white content-wrap">${a.user_answer || '<span class="text-muted">(未作答)</span>'}</div></div>
                                        ${a.ai_feedback ? '<div class="mb-2"><small class="text-muted">AI 反馈：</small><div class="border rounded p-2 bg-light content-wrap">' + a.ai_feedback + '</div></div>' : ''}
                                        ${a.standard_answers && a.standard_answers.length ? `
                                            <div class="mb-2"><small class="text-muted">标准答案：</small>
                                                <div class="border rounded p-3 bg-white">
                                                    <ol class="mb-0 ps-3">${a.standard_answers.map(function(sa) {
                                                        return '<li class="mb-1 content-wrap">' + sa.answer_item + (sa.score_weight !== 1 ? ' <span class="badge bg-info ms-1" style="font-size:0.65rem;">权重 ' + sa.score_weight + '</span>' : '') + '</li>';
                                                    }).join('')}</ol>
                                                </div>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>`;
                        }).join('')}
                    </div>
                </div>`;
            }).join('')}`;
        $('#main-content').html(html);
    });
}

function submitExam(examId) {
    if (!confirm('确定要提交答卷吗？提交后将无法修改。')) return;
    _doSubmit(examId);
}

function autoSubmitExam(examId) {
    _doSubmit(examId);
}

function _doSubmit(examId) {
    if (_examTimer) { clearInterval(_examTimer); _examTimer = null; }

    var answers = [];
    $('.exam-answer').each(function() {
        answers.push({
            station_id: parseInt($(this).data('station-id')),
            exam_question_id: parseInt($(this).data('exam-question-id')),
            answer: $(this).val().trim()
        });
    });

    $.ajax({
        url: '/nurse/exams/' + examId + '/submit',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ answers: answers }),
        success: function(res) {
            if (res.success) {
                var html = `
                    <div class="text-center py-5">
                        <i class="fas fa-check-circle fa-4x text-success mb-3"></i>
                        <h3>考试已提交</h3>
                        <p class="text-muted">您的答卷已成功提交</p>
                        <p class="mb-1">共作答 <strong>${res.data.questions_answered}</strong> 题</p>
                        ${res.data.total_score !== undefined ? '<p class="h4 text-primary mt-2">AI评分：<strong>' + res.data.total_score.toFixed(0) + '</strong> / ' + res.data.max_score.toFixed(0) + '</p>' : ''}
                        <p class="text-muted small">管理员批阅后会更新成绩</p>
                        <div class="mt-4">
                            <button class="btn btn-primary" onclick="loadExams()">
                                <i class="fas fa-list me-1"></i>返回考试列表
                            </button>
                        </div>
                    </div>`;
                $('#main-content').html(html);
                showAlert('考试提交成功', 'success');
            } else {
                showAlert(res.message || '提交失败', 'error');
            }
        },
        error: function(xhr) {
            var msg = '提交失败，请稍后重试';
            try {
                var body = JSON.parse(xhr.responseText);
                if (body.message) msg = body.message;
            } catch(e) {}
            showAlert(msg + ' (' + xhr.status + ')', 'error');
        }
    });
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

// ============================================================
//  Standalone page helpers
// ============================================================

// 独立页面统一鉴权初始化：优先 checkLogin（SPA），fallback 从 URL/localStorage 提取 token
function initStandalonePageAuth() {
    if (typeof checkLogin === 'function') {
        checkLogin();
        return;
    }
    let token = localStorage.getItem('access_token');

    // 显示用户名（独立页面没有 checkLogin，需自行设置）
    const userInfo = localStorage.getItem('user_info');
    if (userInfo) {
        try {
            const user = JSON.parse(userInfo);
            if (user.real_name) $('#user-name').text(user.real_name);
        } catch(e) {}
    }

    if (!token) {
        const urlToken = new URLSearchParams(location.search).get('token');
        if (urlToken) {
            token = urlToken;
            localStorage.setItem('access_token', token);
        }
    }
    if (token) {
        $.ajaxSetup({ headers: { 'Authorization': 'Bearer ' + token } });
    }
}

function initStandaloneNav(activeTab) {
    let token = localStorage.getItem('access_token');
    if (!token) return;

    $('.navbar-nav-horizontal .nav-link').each(function () {
        var href = $(this).attr('href');
        if (href && href.indexOf('/nurse?') !== -1 && href.indexOf('token=') === -1) {
            $(this).attr('href', href + '&token=' + encodeURIComponent(token));
        }
    });

    $('#nurseNavCollapse .nav-link-mobile').each(function () {
        var href = $(this).attr('href');
        if (href && href.indexOf('/nurse?') !== -1 && href.indexOf('token=') === -1) {
            $(this).attr('href', href + '&token=' + encodeURIComponent(token));
        }
    });

    if (activeTab) {
        $('.navbar-nav-horizontal .nav-link').removeClass('active');
        $('#nurseNavCollapse .nav-link-mobile').removeClass('active');
        $('.navbar-nav-horizontal .nav-link[href*="tab=' + activeTab + '"]').addClass('active');
        $('#nurseNavCollapse .nav-link-mobile[href*="tab=' + activeTab + '"]').addClass('active');
    }

    $('a[href^="/nurse/station"], a[href^="/nurse/knowledge"], a[href^="/nurse/answer-view"], a[href^="/nurse/knowledge-answer-view"], a[href^="/nurse/wrong-detail"]').each(function () {
        var href = $(this).attr('href');
        if (href && href.indexOf('token=') === -1) {
            $(this).attr('href', hrefWithToken(href));
        }
    });
}

function renderStandaloneBreadcrumb(items) {
    var html = '<nav aria-label="breadcrumb"><ol class="breadcrumb">';
    items.forEach(function (item, i) {
        if (i === items.length - 1) {
            html += '<li class="breadcrumb-item active">' + item.label + '</li>';
        } else {
            var attrs = '';
            if (item.href) {
                attrs = ' href="' + item.href + '"';
            } else if (item.onclick) {
                attrs = ' href="#" onclick="' + item.onclick + '"';
            }
            html += '<li class="breadcrumb-item"><a' + attrs + '>' + item.label + '</a></li>';
        }
    });
    html += '</ol></nav>';
    return html;
}