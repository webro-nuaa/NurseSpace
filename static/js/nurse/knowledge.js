// 护士端 — 扩展知识学习页（由 templates/nurse/knowledge.html 外置）
  const qs = new URLSearchParams(location.search);
  const knowledgeId = parseInt(qs.get('id'));

  function renderQuestion(data){
    const html = `
      <div class="mb-3">
        <div class="fw-bold">题目：</div>
        <div>${(data.question||'').replace(/\n/g,'<br>')}</div>
      </div>`;
    $('#k-content').html(html);
  }

  function renderEvaluation(result, std){
    const scoreClass = result.score >= 90 ? 'score-excellent' : result.score >= 60 ? 'score-good' : 'score-poor';
    // 分区渲染：与 station.js 保持一致（样式见 .feedback-section-*）
    const section = (icon, tone, title, body) => `
      <div class="feedback-section">
        <div class="feedback-section-title ${tone}"><i class="fas ${icon} me-2"></i>${title}</div>
        <div class="feedback-section-body">${body}</div>
      </div>`;
    const pointList = (items, tone, icon) =>
      `<ul class="feedback-list ${tone}">${items.map(p=>`<li><i class="fas ${icon} me-2"></i>${sanitizeHTML(p)}</li>`).join('')}</ul>`;

    const html = `
      <div class="feedback-score ${scoreClass}">
        <i class="fas fa-star me-2"></i> 得分：${result.score} / ${result.max_score}
      </div>
      <div class="feedback-container">
        ${section('fa-comments', '', 'AI 反馈', `<div class="content-wrap">${sanitizeHTML(result.feedback || '')}</div>`)}
        ${result.reason ? section('fa-info-circle', '', '评分理由', `<div class="content-wrap">${sanitizeHTML(result.reason)}</div>`) : ''}
        ${result.covered_points?.length ? section('fa-check-circle', 'text-success', '答对要点', pointList(result.covered_points, 'text-success', 'fa-check')) : ''}
        ${result.missed_points?.length ? section('fa-exclamation-triangle', 'text-warning', '遗漏要点', pointList(result.missed_points, 'text-warning', 'fa-minus')) : ''}
        ${result.suggestions ? section('fa-lightbulb', 'text-info', '改进建议', `<div class="content-wrap text-info">${sanitizeHTML(result.suggestions)}</div>`) : ''}
      </div>
      <div class="mt-3">
        <h6><i class="fas fa-clipboard-list me-2"></i>标准答案</h6>
        <ol>${std.map(a=>`<li class="content-wrap">${sanitizeHTML(a)}</li>`).join('')}</ol>
      </div>`;
    $('#k-eval-body').html(html); $('#k-eval-card').removeClass('d-none');
  }

  $(function(){
    initStandalonePageAuth();
    initStandaloneNav('cases');

    // Breadcrumb from knowledge → case info
    $.get(`/api/knowledge/${knowledgeId}`, function(r){
      if (r.success){
        renderQuestion(r.data);
        var caseId = r.data.case_id;
        if (caseId) {
          $.get(`/nurse/cases/${caseId}`, function(cr) {
            if (cr.success) {
              var c = cr.data.case;
              var catId = c.category_id || 0;
              var catName = c.category_name || '案例学习';
              var catEsc = catName.replace(/'/g, "\\'");
              $('#breadcrumb-container').html(renderStandaloneBreadcrumb([
                {label: '案例学习', href: hrefWithToken('/nurse?tab=cases')},
                {label: catName, href: hrefWithToken('/nurse?tab=cases&category_id=' + catId)},
                {label: c.title, href: hrefWithToken('/nurse?tab=cases&case_id=' + caseId)},
                {label: '扩展知识作答'}
              ]));
              $('#btn-back-knowledge').attr('onclick', 'if(document.referrer.indexOf("/nurse")!==-1){window.history.back()}else{window.location.href=hrefWithToken("/nurse?tab=cases&case_id=' + caseId + '")}');
            }
          });
        }
        // Set links with token
        $('#link-knowledge-answer').attr('href', hrefWithToken('/nurse/knowledge-answer-view?id=' + knowledgeId));
      }
      else { showAlert(r.message || '加载失败', 'error'); }
    });

    $('#k-btn').on('click', function(){
      const answer = $('#k-answer').val().trim(); if(!answer){ showAlert('请输入答案', 'error'); return; }
      const btn = $(this), old = btn.html();
      btn.html('<i class="fas fa-spinner fa-spin me-1"></i>评分中...').prop('disabled', true);
      $.ajax({
        url: `/nurse/knowledge/${knowledgeId}/submit`,
        method: 'POST', contentType: 'application/json', data: JSON.stringify({ answer }),
        success: function(r){ if(r.success){ renderEvaluation(r.evaluation, r.standard_answers.map(a=>a.answer_item)); } else { showAlert(r.message||'提交失败','error'); } },
        complete: function(){ btn.html(old).prop('disabled', false); }
      })
    });
  })
