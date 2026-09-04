// 护士端 — 站点作答页：案例背景/作答/语音输入/AI 评分结果与评论区（由 templates/nurse/answer_view.html 外置）
  const qs = new URLSearchParams(location.search);
  const stationId = parseInt(qs.get('id'));
  const caseId = parseInt(qs.get('case'));


  function renderStation(data){
    const isKnowledge = (data.station_type || 'assessment') === 'knowledge';
    const nl2br = (value) => sanitizeHTML(value || '').replace(/\n/g, '<br>');
    // 动态设置页面标题
    $('.page-title h2').html(isKnowledge
      ? '<i class="fas fa-lightbulb me-2"></i>扩展知识 - 标准答案'
      : '<i class="fas fa-clipboard-check me-2"></i>标准答案');
    $('.page-title p').text(isKnowledge ? '查看扩展知识题目的答案要点' : '查看题目的标准答案要点');

    const html = `
      <div class="card">
        <div class="card-header bg-primary text-white">
          <h5 class="mb-0"><i class="fas fa-question-circle me-2"></i>题目内容</h5>
        </div>
        <div class="card-body">
          <div class="mb-3">
            <div class="fw-bold text-primary mb-2">题目：</div>
            <div class="question-text">${nl2br(data.question)}</div>
          </div>
          ${!isKnowledge && data.assessment_task ? `
          <div class="mb-3">
            <div class="fw-bold text-primary mb-2">考核任务：</div>
            <div class="assessment-text small">${nl2br(data.assessment_task)}</div>
          </div>` : ''}
        </div>
      </div>
    `;
    document.getElementById('station-content').innerHTML = html;
  }

  function renderAnswers(answers){
    const html = `
      <div class="card">
        <div class="card-header bg-success text-white">
          <h5 class="mb-0"><i class="fas fa-clipboard-check me-2"></i>标准答案要点</h5>
        </div>
        <div class="card-body">
          <div class="alert alert-info">
            <i class="fas fa-info-circle me-2"></i>
            以下是该题目的标准答案要点，建议先独立思考后再查看
          </div>
          <ol class="standard-answers-list">
            ${answers.map((answer, index) => `
              <li class="mb-3">
                <div class="answer-item">
                  <span class="answer-text">${sanitizeHTML(answer.answer_item)}</span>
                  ${answer.score_weight > 1 ? `<span class="badge bg-warning ms-2">权重: ${answer.score_weight}</span>` : ''}
                </div>
              </li>
            `).join('')}
          </ol>
        </div>
      </div>
    `;
    document.getElementById('answers-content').innerHTML = html;
  }

  $(document).ready(function(){

    initStandalonePageAuth();
    initStandaloneNav('cases');

    // Breadcrumb + back navigation from case info
    if (caseId) {
      $.get(`/nurse/cases/${caseId}`, function(r) {
        if (r.success) {
          var c = r.data.case;
          var catId = c.category_id || 0;
          var catName = c.category_name || '案例学习';
          $('#breadcrumb-container').html(renderStandaloneBreadcrumb([
            {label: '案例学习', href: hrefWithToken('/nurse?tab=cases')},
            {label: catName, href: hrefWithToken('/nurse?tab=cases&category_id=' + catId)},
            {label: c.title, href: hrefWithToken('/nurse?tab=cases&case_id=' + caseId)},
            {label: '查看答案'}
          ]));
          $('#btn-back-answer-view').attr('onclick', 'if(document.referrer.indexOf("/nurse")!==-1){window.history.back()}else{window.location.href=hrefWithToken("/nurse?tab=cases&case_id=' + caseId + '")}');
        }
      });
    }
    // Set links with token
    $('#link-go-answer').attr('href', hrefWithToken('/nurse/station?id=' + stationId + '&case=' + (caseId || 0)));

    // 禁止复制功能
    disableCopy();
    
    // 检查按钮是否存在
    const submitBtn = $('#btn-submit-comment');
    
    // 加载题目内容
    $.get(`/api/stations/${stationId}`, function(res){
      if (res.success){ 
        renderStation(res.data);
      } else { 
        showAlert(res.message || '加载题目失败', 'error'); 
      }
    });

    // 加载标准答案
    $.get(`/api/stations/${stationId}/answers`, function(res){
      if (res.success){
        renderAnswers(res.data);
      } else {
        showAlert(res.message || '获取答案失败', 'error');
      }
    }).fail(function(){
      showAlert('网络错误，请重试', 'error');
    });
    
    // 加载评论
    loadComments();
    
    // 绑定评论相关事件
    $('#btn-submit-comment').on('click', submitComment);
  });

  // 禁止复制功能
  function disableCopy() {
    // 禁止选择文本
    document.addEventListener('selectstart', function(e) {
      e.preventDefault();
      return false;
    });
    
    // 禁止右键菜单
    document.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      showAlert('为了保护学习效果，答案内容禁止复制', 'warning');
      return false;
    });
    
    // 禁止键盘快捷键
    document.addEventListener('keydown', function(e) {
      // 禁止 Ctrl+A (全选)
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        showAlert('为了保护学习效果，答案内容禁止复制', 'warning');
        return false;
      }
      // 禁止 Ctrl+C (复制)
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        showAlert('为了保护学习效果，答案内容禁止复制', 'warning');
        return false;
      }
      // 禁止 Ctrl+X (剪切)
      if (e.ctrlKey && e.key === 'x') {
        e.preventDefault();
        showAlert('为了保护学习效果，答案内容禁止复制', 'warning');
        return false;
      }
    });
    
    // 禁止拖拽选择
    document.addEventListener('mousedown', function(e) {
      if (e.target.closest('.standard-answers-list') || 
          e.target.closest('.question-text') || 
          e.target.closest('.assessment-text')) {
        e.preventDefault();
        return false;
      }
    });
  }

  // 评论相关功能
  let currentCommentPage = 1;
  const commentsPerPage = 10;

  // 加载评论
  function loadComments(page = 1) {
    currentCommentPage = page;
    
    $.get(`/api/comments?content_type=station_answer&content_id=${stationId}&page=${page}&per_page=${commentsPerPage}`, function(res) {
      if (res.success) {
        renderComments(res.data.comments);
        renderPagination(res.data.pagination);
      } else {
        showAlert(res.message || '加载评论失败', 'error');
      }
    }).fail(function() {
      showAlert('网络错误，请重试', 'error');
    });
  }

  // 渲染评论列表
  function renderComments(comments) {
    if (comments.length === 0) {
      $('#comments-container').html(`
        <div class="text-center py-4 text-muted">
          <i class="fas fa-comments fa-2x mb-3"></i>
          <p>暂无评论，快来发表第一条评论吧！</p>
        </div>
      `);
      return;
    }

    const html = comments.map(comment => `
      <div class="comment-item mb-3" data-comment-id="${comment.id}">
        <div class="d-flex">
          <div class="flex-shrink-0 me-3">
            <div class="comment-avatar">
              <i class="fas fa-user-circle fa-2x text-primary"></i>
            </div>
          </div>
          <div class="flex-grow-1">
            <div class="comment-header d-flex justify-content-between align-items-start mb-2">
              <div>
                <span class="fw-bold">${sanitizeHTML(comment.user.real_name)}</span>
                <span class="text-muted ms-2">${sanitizeHTML(comment.user.department || '')}</span>
                <span class="badge bg-secondary ms-2">${getCommentTypeLabel(comment.comment_type)}</span>
              </div>
              <small class="text-muted">${formatTime(comment.created_at)}</small>
            </div>
            <div class="comment-content mb-2">
              ${sanitizeHTML(comment.content).replace(/\n/g, '<br>')}
            </div>
            <div class="comment-actions d-flex align-items-center gap-3">
              <button class="btn btn-sm btn-outline-primary" onclick="toggleLike(${comment.id})">
                <i class="fas fa-thumbs-up me-1 ${comment.is_liked ? 'text-primary' : ''}"></i>
                <span class="likes-count">${comment.likes_count}</span>
              </button>
              <button class="btn btn-sm btn-outline-secondary" onclick="showReplyForm(${comment.id})">
                <i class="fas fa-reply me-1"></i>回复
              </button>
              ${comment.replies_count > 0 ? `
                <button class="btn btn-sm btn-outline-info" onclick="toggleReplies(${comment.id})">
                  <i class="fas fa-comments me-1"></i>${comment.replies_count}条回复
                </button>
              ` : ''}
            </div>
            
            <!-- 回复表单 -->
            <div class="reply-form mt-3 d-none" id="reply-form-${comment.id}">
              <div class="input-group">
                <input type="text" class="form-control" placeholder="写下你的回复..." id="reply-content-${comment.id}">
                <button class="btn btn-outline-primary" onclick="submitReply(${comment.id})">
                  <i class="fas fa-paper-plane"></i>
                </button>
              </div>
            </div>
            
            <!-- 回复列表 -->
            <div class="replies-container mt-3 d-none" id="replies-${comment.id}">
              <div class="loading text-center py-2">
                <i class="fas fa-spinner fa-spin me-2"></i>加载回复中...
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    $('#comments-container').html(html);
  }

  // 渲染分页
  function renderPagination(pagination) {
    if (pagination.pages <= 1) {
      $('#comments-pagination').addClass('d-none');
      return;
    }

    $('#comments-pagination').removeClass('d-none');
    
    let paginationHtml = '';
    
    // 上一页
    if (pagination.has_prev) {
      paginationHtml += `
        <li class="page-item">
          <a class="page-link" href="#" onclick="loadComments(${pagination.page - 1})">上一页</a>
        </li>
      `;
    }
    
    // 页码
    for (let i = 1; i <= pagination.pages; i++) {
      if (i === pagination.page) {
        paginationHtml += `<li class="page-item active"><span class="page-link">${i}</span></li>`;
      } else {
        paginationHtml += `<li class="page-item"><a class="page-link" href="#" onclick="loadComments(${i})">${i}</a></li>`;
      }
    }
    
    // 下一页
    if (pagination.has_next) {
      paginationHtml += `
        <li class="page-item">
          <a class="page-link" href="#" onclick="loadComments(${pagination.page + 1})">下一页</a>
        </li>
      `;
    }
    
    $('#pagination-list').html(paginationHtml);
  }

  // 发表评论
  function submitComment() {
    
    // 检查JWT token
    const token = localStorage.getItem('access_token');
    
    // 检查AJAX默认header
    
    const content = $('#comment-content').val().trim();
    const commentType = $('#comment-type').val();
    
    
    if (!content) {
      showAlert('请输入评论内容', 'error');
      return;
    }
    
    if (content.length < 5) {
      showAlert('评论内容至少5个字符', 'error');
      return;
    }
    
    const btn = $('#btn-submit-comment');
    const originalText = btn.html();
    btn.html('<i class="fas fa-spinner fa-spin me-2"></i>发表中...').prop('disabled', true);
    
    
    $.ajax({
      url: '/api/comments',
      method: 'POST',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + token // 显式设置token
      },
      data: JSON.stringify({
        content_type: 'station_answer',
        content_id: stationId,
        content: content,
        comment_type: commentType
      }),
      success: function(res) {
        if (res.success) {
          showAlert('评论发表成功！', 'success');
          $('#comment-content').val('');
          loadComments(1); // 重新加载第一页
        } else {
          showAlert(res.message || '发表评论失败', 'error');
        }
      },
      error: function(xhr, status, error) {
        showAlert('网络错误，请重试', 'error');
      },
      complete: function() {
        btn.html(originalText).prop('disabled', false);
      }
    });
  }

  // 切换点赞
  function toggleLike(commentId) {
    $.ajax({
      url: `/api/comments/${commentId}/like`,
      method: 'POST',
      success: function(res) {
        if (res.success) {
          // 更新UI
          const likeBtn = $(`.comment-item[data-comment-id="${commentId}"] .btn-outline-primary`);
          const likesCount = likeBtn.find('.likes-count');
          const icon = likeBtn.find('.fas');
          
          likesCount.text(res.data.likes_count);
          
          if (res.data.is_liked) {
            icon.addClass('text-primary');
          } else {
            icon.removeClass('text-primary');
          }
        } else {
          showAlert(res.message || '操作失败', 'error');
        }
      }
    });
  }

  // 显示回复表单
  function showReplyForm(commentId) {
    $(`#reply-form-${commentId}`).toggleClass('d-none');
  }

  // 提交回复
  function submitReply(commentId) {
    const content = $(`#reply-content-${commentId}`).val().trim();
    
    if (!content) {
      showAlert('请输入回复内容', 'error');
      return;
    }
    
    if (content.length < 5) {
      showAlert('回复内容至少5个字符', 'error');
      return;
    }
    
    
    $.ajax({
      url: '/api/comments',
      method: 'POST',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('access_token')
      },
      data: JSON.stringify({
        content_type: 'station_answer',
        content_id: stationId,
        content: content,
        comment_type: 'comment',
        parent_id: commentId
      }),
      success: function(res) {
        if (res.success) {
          showAlert('回复发表成功！', 'success');
          $(`#reply-content-${commentId}`).val('');
          $(`#reply-form-${commentId}`).addClass('d-none');
          
          // 重新加载回复列表
          loadReplies(commentId);
          
          // 更新父评论的回复数量
          updateReplyCount(commentId);
        } else {
          showAlert(res.message || '发表回复失败', 'error');
        }
      },
      error: function(xhr, status, error) {
        showAlert('发表回复失败，请重试', 'error');
      }
    });
  }

  // 切换回复显示
  function toggleReplies(commentId) {
    const repliesContainer = $(`#replies-${commentId}`);
    if (repliesContainer.hasClass('d-none')) {
      repliesContainer.removeClass('d-none');
      loadReplies(commentId);
    } else {
      repliesContainer.addClass('d-none');
    }
  }

  // 更新回复数量显示
  function updateReplyCount(commentId) {
    // 重新获取回复数量
    $.get(`/api/comments/${commentId}/replies?page=1&per_page=1`, function(res) {
      if (res.success) {
        const replyCount = res.data.pagination.total;
        const replyButton = $(`.comment-item[data-comment-id="${commentId}"] .btn-outline-info`);
        
        if (replyButton.length > 0) {
          replyButton.html(`<i class="fas fa-comments me-1"></i>${replyCount}条回复`);
        }
        
        // 如果回复数量为0，隐藏回复按钮
        if (replyCount === 0) {
          replyButton.hide();
        } else {
          replyButton.show();
        }
      }
    });
  }

  // 加载回复
  function loadReplies(commentId) {
    
    $.get(`/api/comments/${commentId}/replies`, function(res) {
      if (res.success) {
        renderReplies(commentId, res.data.replies);
      } else {
        showAlert(res.message || '加载回复失败', 'error');
      }
    }).fail(function(xhr, status, error) {
      showAlert('加载回复失败，请重试', 'error');
    });
  }

  // 渲染回复
  function renderReplies(commentId, replies) {
    if (replies.length === 0) {
      $(`#replies-${commentId}`).html('<p class="text-muted text-center">暂无回复</p>');
      return;
    }

    const html = replies.map(reply => `
      <div class="reply-item border-start border-2 border-light ps-3 py-2">
        <div class="d-flex justify-content-between align-items-start mb-1">
          <div>
            <span class="fw-bold">${reply.user.real_name}</span>
            <span class="text-muted ms-2">${reply.user.department || ''}</span>
          </div>
          <small class="text-muted">${formatTime(reply.created_at)}</small>
        </div>
        <div class="reply-content mb-2">
          ${reply.content.replace(/\n/g, '<br>')}
        </div>
        <div class="reply-actions">
          <button class="btn btn-sm btn-outline-primary btn-sm" onclick="toggleReplyLike(${reply.id})">
            <i class="fas fa-thumbs-up me-1 ${reply.is_liked ? 'text-primary' : ''}"></i>
            <span class="likes-count">${reply.likes_count}</span>
          </button>
        </div>
      </div>
    `).join('');

    $(`#replies-${commentId}`).html(html);
  }

  // 切换回复点赞
  function toggleReplyLike(replyId) {
    $.ajax({
      url: `/api/comments/${replyId}/like`,
      method: 'POST',
      success: function(res) {
        if (res.success) {
          // 更新UI
          const likeBtn = $(`.reply-item .btn-outline-primary[onclick*="${replyId}"]`);
          const likesCount = likeBtn.find('.likes-count');
          const icon = likeBtn.find('.fas');
          
          likesCount.text(res.data.likes_count);
          
          if (res.data.is_liked) {
            icon.addClass('text-primary');
          } else {
            icon.removeClass('text-primary');
          }
        } else {
          showAlert(res.message || '操作失败', 'error');
        }
      }
    });
  }

  // 工具函数 getCommentTypeLabel / formatTime 已提取至 static/js/common.js

  // 绑定事件
  // $('#btn-submit-comment').on('click', submitComment); // This line is moved to document.ready
