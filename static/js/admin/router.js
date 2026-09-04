// 管理员端 — SPA 路由器：history 状态管理原语（adminPushView/adminReplaceView）、restoreView、登录检查与启动引导。
// 由 templates/admin/index.html 内联脚本外置；js/admin/navigation.js 的 navTo* shims 在运行时引用本文件的全局函数。
    // ======================================================================
    // Admin SPA Router — history management primitives
    // Defined globally so js/admin/navigation.js navTo* shims can reference them at runtime.
    // ======================================================================

    function updateSidebarActive(page) {
        $('#sidebar .nav-link').removeClass('active');
        $('#sidebar .nav-link[data-page="' + page + '"]').addClass('active');
        $('#adminNavCollapse .nav-link-mobile').removeClass('active');
        $('#adminNavCollapse .nav-link-mobile[data-page="' + page + '"]').addClass('active');
        var collapseEl = document.getElementById('adminNavCollapse');
        if (collapseEl) {
            var bsCollapse = bootstrap.Collapse.getInstance(collapseEl);
            if (bsCollapse) bsCollapse.hide();
        }
    }

    function adminPushView(params) {
        var url = new URL(window.location);
        url.search = '';
        for (var key in params) {
            if (params.hasOwnProperty(key) && params[key] !== undefined && params[key] !== null && params[key] !== '') {
                url.searchParams.set(key, String(params[key]));
            }
        }
        window.history.pushState({}, '', url);
        if (params.tab) updateSidebarActive(params.tab);
    }

    function adminReplaceView(params) {
        var url = new URL(window.location);
        url.search = '';
        for (var key in params) {
            if (params.hasOwnProperty(key) && params[key] !== undefined && params[key] !== null && params[key] !== '') {
                url.searchParams.set(key, String(params[key]));
            }
        }
        window.history.replaceState({}, '', url);
        if (params.tab) updateSidebarActive(params.tab);
    }

    function restoreView() {
        var qs = new URLSearchParams(location.search);
        var tab = qs.get('tab') || 'dashboard';
        updateSidebarActive(tab);

        switch (tab) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'users':
                var uid = qs.get('user_id');
                var uv = qs.get('view');
                if (uid && uv === 'edit') { renderUserEditPage(parseInt(uid)); }
                else if (uid) { renderUserDetailPage(parseInt(uid)); }
                else if (uv === 'create') { renderUserCreatePage(); }
                else if (uv === 'import') { renderUserImportPage(); }
                else { loadUsers(parseInt(qs.get('page')) || 1); }
                break;
            case 'cases':
                var cid = qs.get('case_id');
                var sid = qs.get('station_id');
                if (cid && sid) { renderStationEditPage(parseInt(cid), parseInt(sid)); }
                else if (cid) { renderCaseDetailPage(parseInt(cid)); }
                else if (qs.get('view') === 'create') { renderCaseCreatePage(); }
                else { loadCases(parseInt(qs.get('page')) || 1); }
                break;
            case 'exams':
                var eid = qs.get('exam_id');
                var rid = qs.get('record_id');
                var ev = qs.get('view');
                if (eid && rid) { viewParticipantDetail(parseInt(eid), parseInt(rid)); }
                else if (eid && ev === 'edit') { renderExamEditPage(parseInt(eid)); }
                else if (eid && ev === 'questions') { manageExamQuestions(parseInt(eid)); }
                else if (eid && ev === 'review') { reviewExam(parseInt(eid)); }
                else if (ev === 'create') { renderExamCreatePage(); }
                else { loadExams(); }
                break;
            case 'statistics':   loadStatistics(); break;
            case 'group-analysis': loadGroupAnalysis(); break;
            case 'ai-settings':   loadAiSettings(); break;
            case 'voice-settings': loadVoiceSettings(); break;
            case 'knowledge-base': loadKnowledgeBase(); break;
            case 'knowledge-qa': loadAdminKnowledgeQA(); break;
            case 'personal-ai': loadAdminPersonalAISettings(); break;
            case 'help':          loadHelp(); break;
        }
    }

    // Sidebar tab navigation — pushes clean top-level state
    function navigateTo(page) {
        adminPushView({tab: page});
        restoreView();
    }

    // ======================================================================
    // Bootstrap
    // ======================================================================

    function checkLogin() {
        const token = localStorage.getItem('access_token');
        const userInfo = localStorage.getItem('user_info');

        if (!token || !userInfo) {
            window.location.href = '/auth/login';
            return;
        }

        const user = JSON.parse(userInfo);
        if (user.role !== 'admin') {
            window.location.href = '/auth/login';
            return;
        }

        $('#user-name').text(user.real_name);

        $.ajaxSetup({
            headers: { 'Authorization': 'Bearer ' + token }
        });
    }

    function setActiveNav(title) {
        // Deprecated — now handled by updateSidebarActive.
        // Kept as no-op so existing loader functions that call it don't error.
    }

    $(document).ready(function() {
        checkLogin();

        // Browser back/forward: restore full view from URL params
        window.addEventListener('popstate', function(event) {
            restoreView();
        });

        // Initial load: restore from URL or default to dashboard
        var qs = new URLSearchParams(location.search);
        if (qs.get('tab')) {
            restoreView();
        } else {
            loadDashboard();
        }
    });

