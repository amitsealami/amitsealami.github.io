// Drives the scrolling vine and the sticky title bar.
//
// Progress follows a reading line forty percent down the viewport: 0 when that line is
// at the top of #main, 1 when the page is scrolled as far as it goes. So on load
// only what sits above mid-screen is grown, and the final bloom opens at the end.
// The desktop vine (.vine-aside) is a chain of copies of the drawing stacked to the
// height of #main; copy i grows while progress runs from i/N to (i+1)/N. The bar
// vine (.title-bar__vine) is a single copy driven by the whole progress.
// Reduced-motion users get everything fully grown at once.
(function () {
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var main = document.getElementById('main');
  var aside = document.querySelector('.vine-aside');
  var bar = document.querySelector('.title-bar');
  var masthead = document.querySelector('.wrapper-masthead');
  if (!main) return;

  var SEG_RATIO = 1000 / 60;   // drawing height per unit of width
  var MAX_W = 54;              // widest the desktop vine gets, in px

  function parts(svg) {
    return Array.prototype.slice.call(svg.querySelectorAll('[data-at]')).map(function (el) {
      return { el: el, at: parseFloat(el.getAttribute('data-at')) || 0 };
    });
  }

  // Build or rebuild the stacked copies so they fill #main exactly.
  var segments = [];
  function layout() {
    if (!aside) return;
    var template = aside.querySelector('.vine');
    if (!template) return;
    var height = main.offsetHeight;
    var n = Math.max(1, Math.ceil(height / (MAX_W * SEG_RATIO)));
    var w = height / n / SEG_RATIO;
    aside.style.setProperty('--vine-w', w.toFixed(2) + 'px');
    while (aside.children.length > n) aside.removeChild(aside.lastChild);
    while (aside.children.length < n) aside.appendChild(template.cloneNode(true));
    segments = Array.prototype.slice.call(aside.children).map(function (svg) {
      return { svg: svg, parts: parts(svg) };
    });
  }

  var barVines = Array.prototype.slice.call(document.querySelectorAll('.title-bar__vine .vine')).map(function (svg) {
    return { svg: svg, parts: parts(svg) };
  });

  function progress() {
    var doc = document.documentElement;
    var top = main.getBoundingClientRect().top + window.pageYOffset;
    var half = window.innerHeight * 0.4;   // the reading line sits a bit above centre
    var maxScroll = (doc.scrollHeight || document.body.scrollHeight) - window.innerHeight;
    var span = maxScroll + half - top;   // reading-line travel from the top of #main to the end of the page
    if (span <= 0) return 1;
    var p = (window.pageYOffset + half - top) / span;
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }

  function paintOne(item, p) {
    item.svg.style.setProperty('--vine-progress', p.toFixed(4));
    item.parts.forEach(function (part) {
      part.el.classList.toggle('is-open', p >= part.at);
    });
  }

  function paint(p) {
    var n = segments.length;
    segments.forEach(function (item, i) {
      var local = p * n - i;
      paintOne(item, local < 0 ? 0 : local > 1 ? 1 : local);
    });
    barVines.forEach(function (item) { paintOne(item, p); });
  }

  layout();

  if (reduced) {
    paint(1);
  } else {
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        paint(progress());
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { layout(); onScroll(); });
    window.addEventListener('load', function () { layout(); onScroll(); });
    paint(progress());
  }

  if (bar && masthead && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      bar.classList.toggle('is-visible', !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(masthead);
  }
})();
