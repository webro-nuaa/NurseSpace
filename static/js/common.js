// 通用JavaScript函数

// 显示提示消息
function showAlert(message, type = 'info', duration = 5000) {
    const alertClass = {
        'success': 'alert-success',
        'error': 'alert-danger',
        'warning': 'alert-warning',
        'info': 'alert-info'
    }[type] || 'alert-info';
    
    const icon = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    }[type] || 'fa-info-circle';
    
    const alertId = 'alert-' + Date.now();
    const alert = `
        <div id="${alertId}" class="alert ${alertClass} alert-dismissible fade show scale-in" role="alert" style="animation-duration: 0.4s;">
            <i class="fas ${icon} me-2"></i>${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    
    $('#alert-container').prepend(alert);
    
    // 添加点击音效（如果需要）
    if (type === 'success') {
        playNotificationSound();
    }
    
    // 自动关闭
    if (duration > 0) {
        setTimeout(() => {
            $(`#${alertId}`).addClass('fade-out').one('animationend', function() {
                $(this).remove();
            });
        }, duration);
    }
}

// 播放通知音效（可选）
function playNotificationSound() {
    // 可以添加简单的音效，这里使用Web Audio API创建提示音
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        // 忽略音效错误
    }
}

// AJAX错误处理
$(document).ajaxError(function(event, xhr, settings, thrownError) {
    if (xhr.status === 401) {
        // Token过期，重新登录
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_info');
        window.location.href = '/auth/login';
    } else if (xhr.status === 403) {
        showAlert('权限不足', 'error');
    } else if (xhr.status >= 500) {
        showAlert('服务器错误，请稍后重试', 'error');
    }
});

// 退出登录
function logout() {
    if (confirm('确定要退出登录吗？')) {
        $.post('/auth/logout', function() {
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_info');
            window.location.href = '/auth/login';
        }).fail(function() {
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_info');
            window.location.href = '/auth/login';
        });
    }
}

// 显示个人信息模态框
function showProfile() {
    const modal = `
        <div class="modal fade" id="profileModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-user-circle me-2"></i>个人信息
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="profileForm">
                            <div class="mb-3">
                                <label class="form-label">用户名</label>
                                <input type="text" class="form-control" id="profile-username" readonly>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">真实姓名</label>
                                <input type="text" class="form-control" id="profile-real-name" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">邮箱</label>
                                <input type="email" class="form-control" id="profile-email">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">手机号</label>
                                <input type="tel" class="form-control" id="profile-phone">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">科室</label>
                                <input type="text" class="form-control" id="profile-department">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">角色</label>
                                <input type="text" class="form-control" id="profile-role" readonly>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-primary" onclick="updateProfile()">保存</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $('#modal-container').html(modal);
    
    // 加载用户信息
    $.get('/auth/profile', function(response) {
        if (response.success) {
            const user = response.user;
            $('#profile-username').val(user.username);
            $('#profile-real-name').val(user.real_name);
            $('#profile-email').val(user.email || '');
            $('#profile-phone').val(user.phone || '');
            $('#profile-department').val(user.department || '');
            $('#profile-role').val(user.role === 'admin' ? '管理员' : '护士');
            
            // 护士不能修改科室
            if (user.role === 'nurse') {
                $('#profile-department').prop('readonly', true);
            }
        }
    });
    
    $('#profileModal').modal('show');
}

// 更新个人信息
function updateProfile() {
    const data = {
        real_name: $('#profile-real-name').val(),
        email: $('#profile-email').val(),
        phone: $('#profile-phone').val(),
        department: $('#profile-department').val()
    };
    
    $.ajax({
        url: '/auth/profile',
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function(response) {
            if (response.success) {
                showAlert('个人信息更新成功', 'success');
                $('#profileModal').modal('hide');
                
                // 更新本地存储的用户信息
                const userInfo = JSON.parse(localStorage.getItem('user_info'));
                userInfo.real_name = data.real_name;
                userInfo.email = data.email;
                userInfo.phone = data.phone;
                userInfo.department = data.department;
                localStorage.setItem('user_info', JSON.stringify(userInfo));
                
                // 更新页面显示的用户名
                $('#user-name').text(data.real_name);
            } else {
                showAlert(response.message, 'error');
            }
        }
    });
}

// 修改密码
function changePassword() {
    const modal = `
        <div class="modal fade" id="passwordModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-key me-2"></i>修改密码
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="passwordForm">
                            <div class="mb-3">
                                <label class="form-label">当前密码</label>
                                <input type="password" class="form-control" id="old-password" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">新密码</label>
                                <input type="password" class="form-control" id="new-password" required minlength="6">
                                <div class="form-text">密码长度至少6位</div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">确认新密码</label>
                                <input type="password" class="form-control" id="confirm-password" required>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-primary" onclick="submitPasswordChange()">确认修改</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $('#modal-container').html(modal);
    $('#passwordModal').modal('show');
}

// 提交密码修改
function submitPasswordChange() {
    const oldPassword = $('#old-password').val();
    const newPassword = $('#new-password').val();
    const confirmPassword = $('#confirm-password').val();
    
    if (!oldPassword || !newPassword || !confirmPassword) {
        showAlert('请填写所有字段', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showAlert('两次输入的新密码不一致', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showAlert('新密码长度至少6位', 'error');
        return;
    }
    
    $.ajax({
        url: '/auth/change-password',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            old_password: oldPassword,
            new_password: newPassword
        }),
        success: function(response) {
            if (response.success) {
                showAlert('密码修改成功', 'success');
                $('#passwordModal').modal('hide');
            } else {
                showAlert(response.message, 'error');
            }
        }
    });
}

// 格式化日期时间
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 获取分数对应的颜色类
function getScoreColorClass(score) {
    if (score >= 90) return 'text-success';
    if (score >= 80) return 'text-primary';
    if (score >= 60) return 'text-warning';
    return 'text-danger';
}

// 获取分数对应的徽章类
function getScoreBadgeClass(score) {
    if (score === null || score === undefined || isNaN(score)) return 'bg-secondary';
    if (score >= 90) return 'bg-success';
    if (score >= 80) return 'bg-primary';
    if (score >= 60) return 'bg-warning';
    return 'bg-danger';
}

// 生成分页HTML
function generatePagination(pagination, onPageClick) {
    if (pagination.pages <= 1) return '';
    
    let html = '<nav><ul class="pagination justify-content-center">';
    
    // 上一页
    if (pagination.has_prev) {
        html += `<li class="page-item">
            <a class="page-link" href="#" onclick="${onPageClick}(${pagination.page - 1})">
                <i class="fas fa-chevron-left"></i>
            </a>
        </li>`;
    }
    
    // 页码
    const startPage = Math.max(1, pagination.page - 2);
    const endPage = Math.min(pagination.pages, pagination.page + 2);
    
    if (startPage > 1) {
        html += `<li class="page-item">
            <a class="page-link" href="#" onclick="${onPageClick}(1)">1</a>
        </li>`;
        if (startPage > 2) {
            html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === pagination.page ? 'active' : '';
        html += `<li class="page-item ${activeClass}">
            <a class="page-link" href="#" onclick="${onPageClick}(${i})">${i}</a>
        </li>`;
    }
    
    if (endPage < pagination.pages) {
        if (endPage < pagination.pages - 1) {
            html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
        html += `<li class="page-item">
            <a class="page-link" href="#" onclick="${onPageClick}(${pagination.pages})">${pagination.pages}</a>
        </li>`;
    }
    
    // 下一页
    if (pagination.has_next) {
        html += `<li class="page-item">
            <a class="page-link" href="#" onclick="${onPageClick}(${pagination.page + 1})">
                <i class="fas fa-chevron-right"></i>
            </a>
        </li>`;
    }
    
    html += '</ul></nav>';
    return html;
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
