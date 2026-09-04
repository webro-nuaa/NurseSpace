// 管理员端 — 全局基础：AJAX 401 统一处理（token 过期自动跳转登录页）
// 管理员端JavaScript功能

// 全局 AJAX 401 处理：token 过期自动跳转登录
$(document).ajaxError(function(event, jqXHR) {
    if (jqXHR.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_info');
        window.location.href = '/auth/login';
    }
});

