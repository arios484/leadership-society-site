// The Leadership Society: menu toggle, session filter, and the application form (validation only).
(function () {
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      var label = toggle.querySelector('.mt-label');
      if (label) label.textContent = open ? 'Close' : 'Menu';
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
  }

  var params = new URLSearchParams(location.search);

  // Training catalogue filter (also preset from ?topic=)
  document.querySelectorAll('.filters').forEach(function (group) {
    var list = group.parentElement.querySelector('.catalogue');
    function apply(f) {
      group.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-filter') === f ? 'true' : 'false');
      });
      list.querySelectorAll('.session').forEach(function (row) {
        row.hidden = !(f === 'all' || row.getAttribute('data-track') === f);
      });
    }
    group.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-filter]');
      if (btn && list) apply(btn.getAttribute('data-filter'));
    });
    var topic = (params.get('topic') || '').replace(/[^a-z]/g, '');
    if (topic && list && group.querySelector('button[data-filter="' + topic + '"]')) apply(topic);
  });

  var form = document.getElementById('join-form');
  if (!form) return;
  var status = form.querySelector('#form-status');

  // Presets from links: ?goal=organization, ?training=speaking
  var goal = (params.get('goal') || '').replace(/[^a-z]/g, '');
  if (goal) { var g = form.querySelector('input[name="goal"][value="' + goal + '"]'); if (g) g.checked = true; }
  // Hidden source field for the application backend: flyer, instagram or linkedin; otherwise Direct.
  var srcField = form.querySelector('#utm_source');
  if (srcField) {
    var src = (params.get('utm_source') || '').toLowerCase().replace(/[^a-z]/g, '');
    srcField.value = ['flyer', 'instagram', 'linkedin'].indexOf(src) >= 0 ? src : 'Direct';
  }
  var training = (params.get('training') || '').replace(/[^a-z-]/g, '');
  if (training) {
    var sel = form.querySelector('#training');
    if (sel.querySelector('option[value="' + training + '"]')) {
      sel.value = training;
      var t = form.querySelector('input[name="goal"][value="training"]'); if (t) t.checked = true;
    }
  }

  function setError(id, msg) {
    var el = document.getElementById(id + '-err');
    var input = document.getElementById(id);
    if (el) el.textContent = msg || '';
    if (input) {
      if (msg) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
    return !msg;
  }

  function validate() {
    var ok = true;
    var v = function (id) { return form.querySelector('#' + id).value.trim(); };
    ok = setError('name', v('name') ? '' : 'Please enter your name.') && ok;
    var email = v('email');
    var emailMsg = '';
    if (!email) emailMsg = 'Please enter your email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) emailMsg = 'Please enter a valid email address.';
    ok = setError('email', emailMsg) && ok;
    ok = setError('role', v('role') ? '' : 'Please choose one.') && ok;
    var any = form.querySelector('input[name="goal"]:checked');
    document.getElementById('goal-err').textContent = any ? '' : 'Pick at least one.';
    return ok && !!any;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.hidden = true;
    if (!validate()) {
      var first = form.querySelector('[aria-invalid="true"]') || form.querySelector('input[name="goal"]');
      first.focus();
      return;
    }
    // TODO(application backend): send the application once the delivery backend is integrated.
    status.textContent = 'Thank you. Online applications are not connected yet, so nothing was sent. ' +
      'Until they are, please email your name, college and what you want to lead to recruitment@leadershipsocietyamerica.org.';
    status.hidden = false;
    status.setAttribute('tabindex', '-1');
    status.focus();
  });
})();
