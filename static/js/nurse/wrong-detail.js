// 护士端 — 错题详情页（由 templates/nurse/wrong_detail.html 外置）
  const qs = new URLSearchParams(location.search);
  const stationId = parseInt(qs.get('station'));

  function renderWrongDetail(data){
    const nl2br = (value) => sanitizeHTML(value || '').replace(/\n/g, '<br>');
    const html = `
      ${data.station.assessment_task ? `<div class='mb-3'><div class='fw-bold'>考核任务：</div><div class='small'>${nl2br(data.station.assessment_task)}</div></div>` : ''}
      <div class="mb-3">
        <div class="fw-bold">题目：</div>
        <div>${nl2br(data.station.question)}</div>
      </div>
      <div class="mb-3">
        <div class="fw-bold">我的最近一次作答：</div>
        <div class="mb-2 content-wrap">${data.my_record.user_answer ? nl2br(data.my_record.user_answer) : '<span class="text-muted">暂无记录</span>'}</div>
        <div>得分：<span class="badge ${getScoreBadgeClass(data.my_record.score)}">${(data.my_record.score ?? '—')}</span>
            ${data.my_record.completed_at ? `<small class='text-muted ms-2'>${formatDateTime(data.my_record.completed_at)}</small>` : ''}
        </div>
        ${data.my_record.ai_feedback ? `<div class='mt-2'><div class='fw-bold'>AI反馈：</div><div class="content-wrap">${sanitizeHTML(data.my_record.ai_feedback)}</div></div>` : ''}
        ${data.my_record.reason ? `<div class='mt-2'><div class='fw-bold'>评分理由：</div><div class="content-wrap">${sanitizeHTML(data.my_record.reason)}</div></div>` : ''}
      </div>
      <div class="mb-2">
        <div class="fw-bold">标准答案：</div>
        <ol>${data.standard_answers.map(a=>`<li class="content-wrap">${sanitizeHTML(a.answer_item)}</li>`).join('')}</ol>
      </div>`;
    document.getElementById('wd-content').innerHTML = html;
  }

  $(function(){
    initStandalonePageAuth();
    initStandaloneNav('wrongs');
    $('#breadcrumb-container').html(renderStandaloneBreadcrumb([
      {label: '错题集', href: hrefWithToken('/nurse?tab=wrongs')},
      {label: '错题详情'}
    ]));
    $('#link-back-wrongs').attr('href', hrefWithToken('/nurse?tab=wrongs'));

    $.get(`/nurse/wrong-questions/${stationId}`, function(r){
      if(r.success){
        renderWrongDetail(r.data);
        var redoUrl = hrefWithToken('/nurse/station?id=' + stationId);
        if (r.data.case_id) redoUrl += '&case=' + r.data.case_id;
        $('#btn-redo').attr('href', redoUrl);
      }
      else { showAlert(r.message||'加载失败','error'); }
    });

    $('#btn-redo').on('click', function(e){ e.preventDefault(); startStation(stationId); });
  })
