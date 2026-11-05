// Theme toggle: cycles auto -> light -> dark -> auto.
// "auto" follows the system setting (no data-theme attribute, nothing stored).
(function () {
  var order = ['auto', 'light', 'dark'];
  var labels = { auto: 'Theme: auto', light: 'Theme: light', dark: 'Theme: dark' };

  function current() {
    try {
      var t = localStorage.getItem('theme');
      return t === 'light' || t === 'dark' ? t : 'auto';
    } catch (e) { return 'auto'; }
  }

  function apply(mode) {
    var root = document.documentElement;
    if (mode === 'auto') {
      root.removeAttribute('data-theme');
      try { localStorage.removeItem('theme'); } catch (e) {}
    } else {
      root.setAttribute('data-theme', mode);
      try { localStorage.setItem('theme', mode); } catch (e) {}
    }
  }

  function render(button, mode) {
    var icons = { auto: '.icon-auto', light: '.icon-light', dark: '.icon-dark' };
    Object.keys(icons).forEach(function (k) {
      var el = button.querySelector(icons[k]);
      if (el) el.hidden = (k !== mode);
    });
    var text = button.querySelector('.visually-hidden');
    if (text) text.textContent = labels[mode];
    button.setAttribute('aria-label', labels[mode] + '. Click to change.');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.querySelector('.theme-toggle');
    if (!button) return;
    var mode = current();
    render(button, mode);
    button.addEventListener('click', function () {
      mode = order[(order.indexOf(mode) + 1) % order.length];
      apply(mode);
      render(button, mode);
    });
  });
})();
