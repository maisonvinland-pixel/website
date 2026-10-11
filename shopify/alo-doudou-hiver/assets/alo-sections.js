/* Alo Doudou : sliders, vidéos, avis près du bouton et upsell à cocher */
(function () {
  if (window.aloSectionsInit) return;
  window.aloSectionsInit = true;

  /* ---------- Sliders à défilement (vidéos, avis) ---------- */
  function initSlider(slider) {
    if (slider.dataset.aloReady) return;
    slider.dataset.aloReady = '1';
    var track = slider.querySelector('[data-alo-track]');
    if (!track) return;
    var prev = slider.querySelector('[data-alo-prev]');
    var next = slider.querySelector('[data-alo-next]');
    var wrap = slider.closest('.alo-wrap');
    var progress = wrap ? wrap.querySelector('[data-alo-progress]') : null;

    function step() {
      var card = track.firstElementChild;
      if (!card) return track.clientWidth;
      var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 16;
      return card.getBoundingClientRect().width + gap;
    }
    function update() {
      var max = track.scrollWidth - track.clientWidth;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max - 2;
      if (progress) {
        var ratio = track.scrollWidth ? track.clientWidth / track.scrollWidth : 1;
        var pos = max > 0 ? track.scrollLeft / max : 0;
        progress.style.width = Math.max(ratio * 100, 12) + '%';
        progress.style.transform = 'translateX(' + (pos * (100 / Math.max(ratio, .12) - 100)) + '%)';
      }
    }
    if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    if (next) next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ---------- Vidéos ---------- */
  function initVideos(section) {
    if (section.dataset.aloVideoReady) return;
    section.dataset.aloVideoReady = '1';
    var autoplay = section.dataset.autoplay === 'true';
    var cards = Array.prototype.slice.call(section.querySelectorAll('[data-alo-video-card]'));

    function videoOf(card) { return card.querySelector('video'); }
    function stopOthers(current) {
      cards.forEach(function (card) {
        if (card === current) return;
        var v = videoOf(card);
        if (!v) return;
        v.muted = true;
        card.classList.remove('is-sound');
        if (!autoplay) { v.pause(); card.classList.remove('is-playing'); }
      });
    }

    cards.forEach(function (card) {
      var v = videoOf(card);
      if (!v) return;
      v.muted = true;
      v.setAttribute('playsinline', '');
      v.addEventListener('play', function () { card.classList.add('is-playing'); });
      v.addEventListener('pause', function () { card.classList.remove('is-playing'); });

      card.addEventListener('click', function (event) {
        if (event.target.closest('[data-alo-sound]')) return;
        if (v.paused || v.muted) {
          stopOthers(card);
          v.muted = false;
          card.classList.add('is-sound');
          v.play().catch(function () {});
        } else {
          v.pause();
        }
      });

      var sound = card.querySelector('[data-alo-sound]');
      if (sound) {
        sound.addEventListener('click', function (event) {
          event.stopPropagation();
          v.muted = !v.muted;
          card.classList.toggle('is-sound', !v.muted);
          if (!v.muted) { stopOthers(card); if (v.paused) v.play().catch(function () {}); }
        });
      }
    });

    if (autoplay && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var v = videoOf(entry.target);
          if (!v) return;
          if (entry.isIntersecting) { v.play().catch(function () {}); }
          else { v.pause(); }
        });
      }, { threshold: 0.6 });
      cards.forEach(function (card) { if (videoOf(card)) io.observe(card); });
    }
  }

  /* ---------- Avis près du bouton ---------- */
  function initAtcReviews(box) {
    if (box.dataset.aloReady) return;
    box.dataset.aloReady = '1';
    var track = box.querySelector('.alo-atcr__track');
    var items = track ? track.children.length : 0;
    if (items < 2) return;
    var index = 0;
    function go(i) {
      index = (i + items) % items;
      track.style.transform = 'translateX(' + (-100 * index) + '%)';
    }
    var nextBtn = box.querySelector('.alo-atcr__next');
    if (nextBtn) nextBtn.addEventListener('click', function () { go(index + 1); });
    var timer = setInterval(function () { go(index + 1); }, 6000);
    box.addEventListener('mouseenter', function () { clearInterval(timer); });
  }

  /* ---------- Upsell à cocher : ajouté avant le produit principal ---------- */
  var upsellBusy = false;
  document.addEventListener('click', function (event) {
    var button = event.target.closest('button[type="submit"], [name="add"]');
    if (!button || upsellBusy) return;
    var form = button.form || button.closest('form');
    if (!form || !form.id) return;
    var upsell = document.querySelector('[data-alo-upsell][data-form-id="' + form.id + '"]');
    if (!upsell) return;
    var input = upsell.querySelector('.alo-upsell__input');
    if (!input || !input.checked) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    upsellBusy = true;
    fetch((window.routes && window.routes.cart_add_url ? window.routes.cart_add_url : '/cart/add') + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [{ id: Number(upsell.dataset.variantId), quantity: 1 }] })
    })
      .catch(function () {})
      .finally(function () {
        button.click();
        upsellBusy = false;
      });
  }, true);

  function init(root) {
    var scope = root || document;
    scope.querySelectorAll('.alo-slider').forEach(initSlider);
    scope.querySelectorAll('[data-alo-vs]').forEach(initVideos);
    scope.querySelectorAll('[data-alo-atcr]').forEach(initAtcReviews);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }
  document.addEventListener('shopify:section:load', function (event) { init(event.target); });
})();
