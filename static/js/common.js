// 通用JavaScript函数

// CSRF Token 设置（SPA 模式下全局携带）
$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type)) {
            const token = $('meta[name="csrf-token"]').attr('content');
            if (token) {
                xhr.setRequestHeader('X-CSRFToken', token);
            }
        }
    }
});

// 显示提示消息（右上角 toast，自动消失，无声音）
function showAlert(message, type = 'info', duration = 3000) {
    const bgColors = {
        'success': '#d1fae5',
        'error': '#fee2e2',
        'warning': '#fef3c7',
        'info': '#dbeafe'
    };
    const textColors = {
        'success': '#065f46',
        'error': '#991b1b',
        'warning': '#92400e',
        'info': '#1e40af'
    };
    const borderColors = {
        'success': '#a7f3d0',
        'error': '#fecaca',
        'warning': '#fde68a',
        'info': '#bfdbfe'
    };
    const icons = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    };

    const bg = bgColors[type] || bgColors.info;
    const color = textColors[type] || textColors.info;
    const border = borderColors[type] || borderColors.info;
    const icon = icons[type] || icons.info;

    const alertId = 'alert-' + Date.now();
    const toast = $(`
        <div id="${alertId}" style="
            background:${bg}; color:${color}; border:1px solid ${border};
            border-radius:10px; padding:0.65rem 1rem; margin-bottom:0.5rem;
            font-weight:500; font-size:0.9rem; max-width:400px;
            box-shadow:0 4px 16px rgba(0,0,0,0.12);
            display:flex; align-items:center; gap:0.5rem;
        ">
            <i class="fas ${icon}"></i>
            <span style="flex:1">${message}</span>
            <button type="button" class="btn-close btn-close-sm" style="flex-shrink:0" onclick="$(this).closest('#${alertId}').remove()"></button>
        </div>
    `);

    $('#alert-container').prepend(toast);

    if (duration > 0) {
        setTimeout(() => {
            toast.fadeOut(300, function() { $(this).remove(); });
        }, duration);
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

// 日期时间格式化
function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch (e) {
        return dateStr;
    }
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

// ========= 页面版个人信息 & 密码修改（覆盖旧模态版本）=========
// 注意：以下函数定义会覆盖文件前面的同名模态版本

showProfile = function() {
    $.get('/auth/profile', function(response) {
        if (!response.success) { showAlert(response.message||'加载失败','error'); return; }
        const user = response.user;
        const isAdmin = user.role === 'admin';
        const html = `
            <div class="row"><div class="col-12">
                <h2><i class="fas fa-user-circle me-2"></i>个人信息</h2>
            </div></div>
            <div class="row"><div class="col-lg-6">
                <div class="card"><div class="card-body">
                    <div class="mb-3">
                        <label class="form-label">用户名</label>
                        <input type="text" class="form-control" value="${user.username}" readonly>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">真实姓名</label>
                        <input type="text" class="form-control" id="profile-real-name" value="${user.real_name||''}" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">邮箱</label>
                        <input type="email" class="form-control" id="profile-email" value="${user.email||''}">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">手机号</label>
                        <input type="tel" class="form-control" id="profile-phone" value="${user.phone||''}">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">科室</label>
                        <input type="text" class="form-control" id="profile-department" value="${user.department||''}" ${isAdmin?'':'readonly'}>
                        ${isAdmin?'':'<div class="form-text">科室信息由管理员维护</div>'}
                    </div>
                    <div class="mb-3">
                        <label class="form-label">角色 / 积分</label>
                        <input type="text" class="form-control" value="${isAdmin?'管理员':'护士'} · 积分: ${user.points||0}" readonly>
                    </div>
                    <button class="btn btn-primary" onclick="updateProfile_v2()"><i class="fas fa-save me-1"></i>保存</button>
                </div></div>
            </div></div>
        `;
        $('#main-content').html(html);
    });
};

updateProfile_v2 = function() {
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
                $('#user-name').text(data.real_name);
            } else { showAlert(response.message, 'error'); }
        }
    });
};

changePassword = function() {
    const html = `
        <div class="row"><div class="col-12">
            <h2><i class="fas fa-key me-2"></i>修改密码</h2>
        </div></div>
        <div class="row"><div class="col-lg-6">
            <div class="card"><div class="card-body">
                <div class="mb-3">
                    <label class="form-label">当前密码</label>
                    <input type="password" class="form-control" id="old-password" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">新密码</label>
                    <input type="password" class="form-control" id="new-password" required minlength="8">
                    <div class="form-text">长度至少8位，需包含字母和数字</div>
                </div>
                <div class="mb-3">
                    <label class="form-label">确认新密码</label>
                    <input type="password" class="form-control" id="confirm-password" required>
                </div>
                <button class="btn btn-primary" onclick="submitPasswordChange_v2()"><i class="fas fa-check me-1"></i>确认修改</button>
            </div></div>
        </div></div>
    `;
    $('#main-content').html(html);
};

submitPasswordChange_v2 = function() {
    const oldPassword = $('#old-password').val();
    const newPassword = $('#new-password').val();
    const confirmPassword = $('#confirm-password').val();
    if (!oldPassword || !newPassword || !confirmPassword) {
        showAlert('请填写所有字段', 'error'); return;
    }
    if (newPassword !== confirmPassword) {
        showAlert('两次输入的新密码不一致', 'error'); return;
    }
    if (newPassword.length < 8) {
        showAlert('新密码长度至少8位', 'error'); return;
    }
    $.ajax({
        url: '/auth/change-password',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
        success: function(response) {
            if (response.success) { showAlert('密码修改成功', 'success'); }
            else { showAlert(response.message, 'error'); }
        }
    });
};

// ========= 语音输入（浏览器 Web Speech API） =========
// 桌面端 Chrome：先用 getUserMedia 获取麦克风权限，再启动 SpeechRecognition
// 移动端 Android Chrome：跳过 getUserMedia，直接 SpeechRecognition.start()（避免音频设备冲突）
// iOS Safari：不支持 Web Speech API，引导用户使用键盘内置听写
var _voiceRecognition = null;
var _voiceTargetId = null;
var _voiceOriginalText = '';    // 录音前的原始文本
var _voiceFinalTranscript = ''; // 已确认的最终识别文字
var _voiceStartTimer = null;
var _voiceStarting = false;     // 防止短时间内重复 start

function _createSpeechRecognition() {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    var rec = new SpeechRecognition();
    rec.lang = 'zh-CN';
    rec.interimResults = true;
    rec.continuous = true;

    rec.onresult = function(event) {
        var interim = '';
        for (var i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                _voiceFinalTranscript += event.results[i][0].transcript;
            } else {
                interim += event.results[i][0].transcript;
            }
        }
        // 最终文本 = 原始内容 + 已确认文字 + 当前候补文字
        var combined = _voiceOriginalText;
        if (_voiceFinalTranscript) {
            combined += (combined ? ' ' : '') + _voiceFinalTranscript;
        }
        if (interim) {
            combined += (combined ? ' ' : '') + interim;
        }
        $('#' + _voiceTargetId).val(combined);
    };

    rec.onerror = function(event) {
        if (event.error === 'no-speech') return;
        if (event.error === 'not-allowed') {
            showAlert('麦克风权限未授予。请点击地址栏左侧锁图标 → 网站设置 → 麦克风 → 允许', 'error', 6000);
        } else if (event.error !== 'aborted') {
            showAlert('语音识别出错：' + event.error, 'warning');
        }
        // Force-cleanup: null out recognition BEFORE calling abort to break re-entrancy
        var r = _voiceRecognition;
        _voiceRecognition = null;
        try { r.abort(); } catch(e) {}
        _finishRecording();
    };

    rec.onend = function() {
        // Only treat as natural end if recognition is still set (not already cleaned up by onerror)
        if (_voiceRecognition) {
            _voiceRecognition = null;
            _finishRecording();
        }
    };
    return rec;
}

function _finishRecording() {
    _voiceTargetId = null;
    _voiceOriginalText = '';
    _voiceFinalTranscript = '';
    _voiceStarting = false;
    if (_voiceStartTimer) {
        clearTimeout(_voiceStartTimer);
        _voiceStartTimer = null;
    }
    resetVoiceButton();
}

function toggleVoiceInput(textareaId, btnEl) {
    if (_voiceStarting) return; // debounce — start in progress

    if (_voiceRecognition && _voiceTargetId === textareaId) {
        // Currently recording for this field — stop
        var r = _voiceRecognition;
        _voiceRecognition = null;
        try { r.abort(); } catch(e) {}
        _finishRecording();
        return;
    }

    // If another field was recording, stop it first
    if (_voiceRecognition) {
        var old = _voiceRecognition;
        _voiceRecognition = null;
        try { old.abort(); } catch(e) {}
        _finishRecording();
        // Fall through to start new recording after a short delay
        _voiceStartTimer = setTimeout(_doStart, 150, textareaId, btnEl);
        return;
    }

    _doStart(textareaId, btnEl);
}

function _doStart(textareaId, btnEl) {
    _voiceStartTimer = null;

    var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
            stream.getTracks().forEach(function(t) { t.stop(); });
            _startRecognition(textareaId, btnEl);
        }).catch(function(err) {
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                showAlert('麦克风权限未授予。请点击地址栏左侧锁图标 → 网站设置 → 麦克风 → 允许', 'error', 6000);
            } else if (err.name === 'NotFoundError') {
                showAlert('未检测到麦克风设备', 'error');
            } else {
                showAlert('麦克风访问失败：' + (err.message || err.name), 'error');
            }
        });
    } else {
        _startRecognition(textareaId, btnEl);
    }
}

function _startRecognition(textareaId, btnEl) {
    var rec = _createSpeechRecognition();
    if (!rec) {
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            showAlert('iOS 暂不支持语音识别。请使用键盘上的麦克风按钮进行听写输入', 'info', 5000);
            $('#' + textareaId).focus();
        } else {
            showAlert('当前浏览器不支持语音识别，请使用 Chrome 或 Edge', 'error');
        }
        return;
    }
    _voiceRecognition = rec;
    _voiceTargetId = textareaId;
    _voiceOriginalText = $('#' + textareaId).val().trim();
    _voiceFinalTranscript = '';
    _voiceStarting = true;
    try {
        _voiceRecognition.start();
        $(btnEl).addClass('btn-danger').removeClass('btn-outline-secondary');
        $(btnEl).find('i').addClass('fa-beat');
        $(btnEl).find('span').text('录音中...点击停止');
    } catch(e) {
        _voiceRecognition = null;
        if (e.message && e.message.indexOf('already started') !== -1) {
            // Chrome 未完全释放上一次识别 — 延迟重试
            _voiceStartTimer = setTimeout(_doStart, 150, textareaId, btnEl);
            return;
        }
        showAlert('无法启动语音：' + e.message, 'error');
        _finishRecording();
    }
}

function resetVoiceButton() {
    $('.btn-voice-input').each(function() {
        $(this).removeClass('btn-danger').addClass('btn-outline-secondary');
        $(this).find('i').removeClass('fa-beat');
        $(this).find('span').text('语音输入');
    });
}
