// 护士端 — 考试准入页：token 校验与考试入口（独立布局页，由 templates/nurse/exam_access.html 外置）
    var token = new URLSearchParams(window.location.search).get('token');
    var examId = new URLSearchParams(window.location.search).get('exam_id');

    if (!token || !examId) {
        $('#exam-title').text('无效链接');
        $('#status-area').html('<div class="alert alert-danger">考试链接无效，请联系管理员重新生成二维码</div>');
    } else {
        checkAuthAndLoad();
    }

    function checkAuthAndLoad() {
        $.ajax({
            url: '/nurse/exams'
        }).done(function(res) {
            if (res.success) {
                var exam = (res.data.exams || []).find(function(e) { return e.id == examId; });
                if (exam) {
                    showExam(exam);
                } else {
                    $('#exam-title').text('考试未找到');
                    $('#status-area').html('<div class="alert alert-warning">该考试可能已结束或尚未发布，请确认考试状态</div>');
                }
            } else {
                showLoginPrompt();
            }
        }).fail(function(xhr) {
            if (xhr.status === 401) {
                showLoginPrompt();
            } else {
                $('#exam-title').text('加载失败');
                $('#status-area').html('<div class="alert alert-danger">加载失败，请稍后重试</div>');
            }
        });
    }

    function showExam(exam) {
        $('#exam-title').text(exam.title);
        $('#exam-desc').text(exam.description || '');
        $('#exam-duration').text('时长 ' + exam.duration + ' 分钟');
        if (exam.end_time) {
            $('#exam-time').text('截止 ' + new Date(exam.end_time).toLocaleString('zh-CN'));
        }
        $('#status-area').hide();
        $('#action-area').show();
    }

    function showLoginPrompt() {
        $('#exam-title').text('需要登录');
        var currentUrl = '/nurse/exam-access?token=' + encodeURIComponent(token) + '&exam_id=' + encodeURIComponent(examId);
        var loginUrl = '/auth/login?next=' + encodeURIComponent(currentUrl);
        $('#status-area').html(
            '<div class="alert alert-info">请先登录后再进入考试<br>' +
            '<a href="' + loginUrl + '" class="btn btn-primary btn-sm mt-2 rounded-pill">' +
            '<i class="fas fa-sign-in-alt me-1"></i>前往登录</a>' +
            '<p class="text-muted small mt-2 mb-0">登录后将自动返回此页面</p></div>'
        );
    }
