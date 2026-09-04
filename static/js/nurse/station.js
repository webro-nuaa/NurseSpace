// 护士端 — 站点考核页（由 templates/nurse/station.html 外置）
  const qs = new URLSearchParams(location.search);
  const stationId = parseInt(qs.get('id'));
  const caseId = parseInt(qs.get('case'));

  let _stationType = 'assessment';

  function renderStation(data){
    _stationType = data.station_type || 'assessment';
    const isKnowledge = _stationType === 'knowledge';
    const nl2br = (value) => sanitizeHTML(value || '').replace(/\n/g, '<br>');
    // 动态设置页面标题
    $('.page-title h2').html(isKnowledge
      ? '<i class="fas fa-lightbulb me-2"></i>扩展知识答题'
      : '<i class="fas fa-edit me-2"></i>答题站点');
    $('.page-title p').text(isKnowledge ? '思考并回答扩展知识问题' : '仔细阅读题目，认真作答');

    const html = `
      ${data.case_guide ? `
      <div class="card mb-3 border-info">
        <div class="card-header bg-info bg-opacity-10 py-2">
          <i class="fas fa-info-circle me-2 text-info"></i><strong>案例指引</strong>
          <small class="text-muted ms-2">— ${sanitizeHTML(data.case_title || '')}</small>
        </div>
        <div class="card-body py-2 small">${nl2br(data.case_guide)}</div>
      </div>` : ''}
      ${data.condition_report ? `
      <div class="card mb-3 border-warning">
        <div class="card-header bg-warning bg-opacity-10 py-2">
          <i class="fas fa-clipboard-list me-2 text-warning"></i><strong>病情汇报</strong>
        </div>
        <div class="card-body py-2 small" style="white-space:pre-wrap;">${sanitizeHTML(data.condition_report)}</div>
      </div>` : ''}
      <div class="mb-3">
        <div class="fw-bold">题目：</div>
        <div>${nl2br(data.question)}</div>
      </div>
      ${!isKnowledge && data.assessment_task ? `
      <div class="mb-3">
        <div class="fw-bold">考核任务：</div>
        <div class="small">${nl2br(data.assessment_task)}</div>
      </div>` : ''}
    `;
    document.getElementById('station-content').innerHTML = html;
  }

  function renderEvaluation(result, std){
    const scoreClass = result.score >= 90 ? 'score-excellent' : result.score >= 60 ? 'score-good' : 'score-poor';
    // 分区渲染：标题与内容紧凑贴合，区块间以虚线分隔（样式见 .feedback-section-*）
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
        <ol>${std.map(a=>`<li class="content-wrap">${sanitizeHTML(a.answer_item)}</li>`).join('')}</ol>
      </div>
    `;
    document.getElementById('evaluation-body').innerHTML = html;
    document.getElementById('evaluation-card').classList.remove('d-none');
  }

  $(document).ready(function(){
    initStandalonePageAuth();
    initStandaloneNav('cases');

    // Build breadcrumb + back navigation from case info
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
            {label: '答题'}
          ]));
          $('#btn-back-station').attr('onclick', 'if(document.referrer.indexOf("/nurse")!==-1){window.history.back()}else{window.location.href=hrefWithToken("/nurse?tab=cases&case_id=' + caseId + '")}');
        }
      });
    }

    // Set answer view link with token
    $('#link-answer-view').attr('href', hrefWithToken('/nurse/answer-view?id=' + stationId + '&case=' + (caseId || 0)));

    // 加载题目
    $.get(`/api/stations/${stationId}`, function(res){
      if (res.success){ renderStation(res.data); }
      else { showAlert(res.message || '加载失败', 'error'); }
    });

    // 提交
    $('#btn-submit').on('click', function(){
      const answer = $('#station-answer').val().trim();
      if (!answer){ showAlert('请输入答案', 'error'); return; }
      const btn = $(this); const old = btn.html();
      btn.html('<i class="fas fa-spinner fa-spin me-1"></i>评分中...').prop('disabled', true);
      $.ajax({
        url: `/nurse/stations/${stationId}/submit`,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ answer }),
        success: function(r){
          if (r.success){ renderEvaluation(r.evaluation, r.standard_answers || []); }
          else { showAlert(r.message || '提交失败', 'error'); }
        },
        complete: function(){ btn.html(old).prop('disabled', false); }
      });
    });
  });
