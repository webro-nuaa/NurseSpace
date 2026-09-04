// 登录页脚本（由 templates/auth/login.html 外置）
        $(document).ready(function() {
            $('#loginForm').on('submit', function(e) {
                e.preventDefault();
                
                const username = $('#username').val();
                const password = $('#password').val();
                
                if (!username || !password) {
                    showAlert('请输入用户名和密码', 'error');
                    return;
                }
                
                // 显示加载状态
                const submitBtn = $(this).find('button[type="submit"]');
                const originalText = submitBtn.html();
                submitBtn.html('<i class="fas fa-spinner fa-spin me-2"></i>登录中...').prop('disabled', true);
                
                const nextUrl = new URLSearchParams(window.location.search).get('next') || '';
                $.ajax({
                    url: '/auth/login',
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': $('meta[name="csrf-token"]').attr('content') || ''
                    },
                    contentType: 'application/json',
                    data: JSON.stringify({
                        username: username,
                        password: password,
                        next: nextUrl
                    }),
                    success: function(response) {
                        if (response.success) {
                            // 保存token
                            localStorage.setItem('access_token', response.access_token);
                            localStorage.setItem('user_info', JSON.stringify(response.user));

                            showAlert('登录成功！', 'success');

                            // 根据角色跳转（支持 next 参数）
                            setTimeout(() => {
                                var target = nextUrl || (response.user.role === 'admin' ? '/admin' : '/nurse');
                                window.location.replace(target);
                            }, 1000);
                        } else {
                            showAlert(response.message, 'error');
                        }
                    },
                    error: function() {
                        showAlert('登录失败，请稍后重试', 'error');
                    },
                    complete: function() {
                        submitBtn.html(originalText).prop('disabled', false);
                    }
                });
            });
        });
        
        function showAlert(message, type) {
            const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
            const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
            
            const alert = `
                <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
                    <i class="fas ${icon} me-2"></i>${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
            
            // 清空并添加新提示到固定容器
            $('#alert-container').html(alert);
            
            // 3秒后自动隐藏
            setTimeout(() => {
                $('#alert-container .alert').fadeOut();
            }, 3000);
        }
