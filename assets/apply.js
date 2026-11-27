// The Leadership Society: 2027 cohort application. Validates every answer, then sends it to the
// endpoint in the form's data-endpoint attribute (a Google Apps Script web app). With no endpoint
// set, nothing is sent and the applicant is told so.
(function () {
  var form = document.getElementById('application');
  if (!form) return;
  var status = document.getElementById('form-status');
  var confirmBox = document.getElementById('app-confirm');
  var MAX_PDF = 5 * 1024 * 1024;
  var params = new URLSearchParams(location.search);

  var src = (params.get('utm_source') || '').toLowerCase().replace(/[^a-z]/g, '');
  var srcField = document.getElementById('utm_source');
  if (srcField) srcField.value = ['flyer', 'instagram', 'linkedin'].indexOf(src) >= 0 ? src : 'Direct';

  var qs = Array.prototype.slice.call(form.querySelectorAll('.q'));
  function words(t) { t = t.trim(); return t ? t.split(/\s+/).length : 0; }

  // Live word counters for the essays.
  form.querySelectorAll('textarea[data-words]').forEach(function (ta) {
    var c = document.getElementById(ta.id + '-count');
    ta.addEventListener('input', function () { var n = words(ta.value); c.textContent = n + (n === 1 ? ' word' : ' words'); });
  });
  // "Other" boxes tick their choice when typed in.
  form.querySelectorAll('input[data-other]').forEach(function (box) {
    var txt = document.getElementById(box.getAttribute('data-other'));
    txt.addEventListener('input', function () { if (txt.value.trim()) box.checked = true; });
  });
  // Phone: format as (XXX) XXX-XXXX while typing.
  var phone = document.getElementById('q5b');
  if (phone) phone.addEventListener('input', function () {
    var d = phone.value.replace(/\D/g, '').replace(/^1(?=\d{10})/, '').slice(0, 10);
    if (d.length > 6) phone.value = '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
    else if (d.length > 3) phone.value = '(' + d.slice(0, 3) + ') ' + d.slice(3);
    else if (d.length) phone.value = '(' + d;
  });

  function control(q) { return q.querySelector('input:not([type=hidden]), textarea, select'); }

  function check(q) {
    var type = q.getAttribute('data-type');
    var req = q.hasAttribute('data-required');
    var msg = '';
    if (type === 'radio' || type === 'checkbox' || type === 'cbgrid') {
      var picked = q.querySelectorAll('input[type=radio]:checked, input[type=checkbox]:checked');
      if (req && !picked.length) msg = type === 'radio' ? 'Please choose one.' : (type === 'cbgrid' ? 'Check at least one block.' : (q.querySelectorAll('input[type=checkbox]').length === 1 ? 'Please check this box to continue.' : 'Pick at least one.'));
      var other = q.querySelector('input[data-other]');
      if (!msg && other && other.checked && !document.getElementById(other.getAttribute('data-other')).value.trim()) msg = 'Please fill in "Other".';
    } else if (type === 'upload') {
      var f = control(q).files[0];
      if (!f) { if (req) msg = 'Please attach your résumé as a PDF.'; }
      else if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') msg = 'The résumé must be a PDF.';
      else if (f.size > MAX_PDF) msg = 'The PDF is too large. Please keep it under 5 MB.';
    } else {
      var el = control(q);
      var v = el.value.trim();
      if (!v) { if (req) msg = type === 'dropdown' ? 'Please choose one.' : 'Please answer this question.'; }
      else if (q.hasAttribute('data-email') && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msg = 'Please enter a valid email address.';
      else if (q.hasAttribute('data-pattern') && !new RegExp(q.getAttribute('data-pattern')).test(el.value)) msg = q.getAttribute('data-msg');
      else if (q.hasAttribute('data-min')) {
        var n = Number(v), lo = Number(q.getAttribute('data-min')), hi = Number(q.getAttribute('data-max'));
        if (!/^\d+(\.\d+)?$/.test(v) || n < lo || n > hi) msg = q.getAttribute('data-msg');
      }
    }
    var err = q.querySelector('.error');
    err.textContent = msg;
    var target = (type === 'radio' || type === 'checkbox' || type === 'cbgrid') ? q : control(q);
    if (msg) target.setAttribute('aria-invalid', 'true'); else target.removeAttribute('aria-invalid');
    q.classList.toggle('has-error', !!msg);
    return !msg;
  }

  qs.forEach(function (q) {
    q.addEventListener('change', function () { if (q.classList.contains('has-error')) check(q); });
    q.addEventListener('focusout', function (e) {
      var t = q.getAttribute('data-type');
      if ((t === 'text' || t === 'paragraph') && control(q).value.trim()) check(q);
    });
  });

  function answer(q) {
    var type = q.getAttribute('data-type');
    if (type === 'radio' || type === 'checkbox' || type === 'cbgrid') {
      var vals = [];
      q.querySelectorAll('input:checked').forEach(function (i) {
        if (i.value === '__other__') vals.push('Other: ' + document.getElementById(i.getAttribute('data-other')).value.trim());
        else vals.push(i.value);
      });
      return vals.join('; ');
    }
    if (type === 'upload') { var f = control(q).files[0]; return f ? f.name : ''; }
    return control(q).value.trim();
  }

  function readPdf(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(file);
    });
  }

  function say(msg) { status.textContent = msg; status.hidden = false; status.focus(); }

  var sending = false;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    status.hidden = true;
    var bad = qs.filter(function (q) { return !check(q); });
    if (bad.length) {
      say(bad.length === 1 ? 'One answer needs attention before you can submit.' : bad.length + ' answers need attention before you can submit.');
      var first = bad[0].querySelector('[aria-invalid="true"]') || bad[0].querySelector('input, textarea, select');
      setTimeout(function () { first.focus(); bad[0].scrollIntoView({ block: 'center' }); }, 50);
      return;
    }
    var endpoint = form.getAttribute('data-endpoint');
    if (!endpoint) {
      say('Thank you. Online applications are not connected yet, so nothing was sent. Please try again soon, or write to recruitment@leadershipsocietyamerica.org.');
      return;
    }
    var payload = {
      form: '2027 cohort application',
      submitted_at: new Date().toISOString(),
      utm_source: srcField ? srcField.value : 'Direct',
      website: document.getElementById('website').value,
      answers: qs.map(function (q) { return { n: q.getAttribute('data-n'), q: q.getAttribute('data-q'), a: answer(q) }; })
    };
    var fileInput = form.querySelector('input[type=file]');
    var file = fileInput && fileInput.files[0];
    var btn = form.querySelector('button[type=submit]');
    sending = true; btn.disabled = true; btn.textContent = 'Sending…';
    (file ? readPdf(file) : Promise.resolve('')).then(function (b64) {
      if (file) payload.resume = { name: file.name, type: 'application/pdf', data: b64 };
      return fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    }).then(function (res) { return res.json(); }).then(function (data) {
      if (!data || !data.ok) throw new Error((data && data.error) || 'Not saved');
      form.querySelectorAll('.app-intro, .req-note, .app-section, .form-actions, .form-status').forEach(function (el) { el.hidden = true; });
      confirmBox.hidden = false; confirmBox.focus(); confirmBox.scrollIntoView({ block: 'start' });
    }).catch(function () {
      sending = false; btn.disabled = false; btn.textContent = 'Submit application';
      say('Sorry, your application could not be sent. Please check your connection and try again. If it keeps failing, write to recruitment@leadershipsocietyamerica.org.');
    });
  });
})();
