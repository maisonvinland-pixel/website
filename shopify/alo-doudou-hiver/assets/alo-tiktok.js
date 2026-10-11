/* ==========================================================
   Alo Doudou : « Vu sur TikTok »
   Chargement des vidéos à l'approche, lecture auto (sans son) quand
   elles sont visibles, son au toucher, flèches, chiffres animés.
   ========================================================== */
(function () {
  if (window.aloTiktokInit) return;
  window.aloTiktokInit = true;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function load(video) {
    if (video.dataset.loaded) return;
    video.dataset.loaded = '1';
    video.src = video.dataset.src;
    video.preload = 'metadata';
  }

  function play(card) {
    var v = card.querySelector('video');
    if (!v) return;
    load(v);
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }

  function pause(card) {
    var v = card.querySelector('video');
    if (v && !v.paused) v.pause();
  }

  function initSection(sec) {
    if (sec.dataset.aloReady) return;
    sec.dataset.aloReady = '1';
    var track = sec.querySelector('[data-alo-tt-track]');
    var originals = Array.prototype.slice.call(sec.querySelectorAll('[data-alo-tt-card]'));
    var auto = !reduce && sec.dataset.auto === 'true' && originals.length > 1 && track;

    // Boucle infinie : on recopie les vidéos à la suite pour que le défilement ne s'arrête jamais
    var setWidth = 0;
    if (auto) {
      sec.classList.add('is-auto');
      var copies = 0;
      while (copies < 6 && (copies === 0 || track.scrollWidth < track.clientWidth * 2 + setWidth)) {
        originals.forEach(function (card) {
          var clone = card.cloneNode(true);
          clone.setAttribute('aria-hidden', 'true');
          clone.classList.add('is-clone');
          Array.prototype.slice.call(clone.attributes).forEach(function (a) {
            if (a.name.indexOf('data-shopify') === 0) clone.removeAttribute(a.name);
          });
          clone.querySelectorAll('a, button').forEach(function (el) { el.setAttribute('tabindex', '-1'); });
          track.appendChild(clone);
        });
        copies++;
        var firstClone = track.querySelector('.is-clone');
        setWidth = firstClone.offsetLeft - originals[0].offsetLeft;
      }
    }
    var cards = Array.prototype.slice.call(sec.querySelectorAll('[data-alo-tt-card]'));
    var prev = sec.querySelector('[data-alo-tt-prev]');
    var next = sec.querySelector('[data-alo-tt-next]');

    function muteOthers(current) {
      cards.forEach(function (c) {
        if (c === current) return;
        var v = c.querySelector('video');
        if (v) v.muted = true;
        c.classList.remove('is-sound');
      });
    }

    cards.forEach(function (card) {
      var v = card.querySelector('video');
      if (!v) return;
      v.muted = true;
      v.addEventListener('play', function () { card.classList.add('is-playing'); });
      v.addEventListener('pause', function () { card.classList.remove('is-playing'); });

      var sound = card.querySelector('[data-alo-tt-sound]');
      function toggleSound() {
        load(v);
        v.muted = !v.muted;
        card.classList.toggle('is-sound', !v.muted);
        if (sound) sound.setAttribute('aria-label', v.muted ? 'Activer le son' : 'Couper le son');
        if (!v.muted) {
          muteOthers(card);
          if (v.paused) play(card);
        }
      }
      if (sound) {
        sound.addEventListener('click', function (e) {
          e.stopPropagation();
          toggleSound();
        });
      }
      // Toucher la vidéo : lecture si en pause, sinon active / coupe le son
      card.querySelector('[data-alo-tt-media]').addEventListener('click', function (e) {
        if (e.target.closest('a, button')) return;
        if (v.paused) { play(card); return; }
        toggleSound();
      });
    });

    // Chargement à l'approche + lecture seulement quand la vidéo est bien visible
    if ('IntersectionObserver' in window) {
      var near = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var v = en.target.querySelector('video');
          if (v) load(v);
          near.unobserve(en.target);
        });
      }, { rootMargin: '300px' });
      var seen = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && en.intersectionRatio >= .6) {
            if (!reduce) play(en.target);
          } else {
            pause(en.target);
          }
        });
      }, { threshold: [0, .6] });
      cards.forEach(function (c) { near.observe(c); seen.observe(c); });
    } else {
      cards.forEach(function (c) { var v = c.querySelector('video'); if (v) load(v); });
    }

    // Flèches
    function step() {
      var c = cards[0];
      if (!c) return track.clientWidth;
      var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 16;
      return c.getBoundingClientRect().width + gap;
    }
    function update() {
      if (!track || auto) return;
      var max = track.scrollWidth - track.clientWidth;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max - 2;
    }
    if (prev) prev.addEventListener('click', function () {
      if (auto) { holdFor(2500); if (track.scrollLeft < step()) track.scrollLeft += setWidth; }
      track.scrollBy({ left: -step(), behavior: 'smooth' });
    });
    if (next) next.addEventListener('click', function () {
      if (auto) holdFor(2500);
      track.scrollBy({ left: step(), behavior: 'smooth' });
    });
    if (track) track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    update();

    /* ---------- Défilement automatique vers la gauche ---------- */
    var pos = 0;
    var hovering = false;
    var holdUntil = 0;
    var visible = true;
    var last = 0;
    function holdFor(ms) { holdUntil = Math.max(holdUntil, performance.now() + ms); }
    function soundOn() { return !!sec.querySelector('.alo-tt__card.is-sound'); }

    if (auto) {
      var speed = Math.max(5, parseFloat(sec.dataset.speed) || 40);
      if (window.Shopify && window.Shopify.designMode) speed = speed / 2;

      track.addEventListener('mouseenter', function () { hovering = true; });
      track.addEventListener('mouseleave', function () { hovering = false; });
      track.addEventListener('touchstart', function () { holdFor(60000); }, { passive: true });
      track.addEventListener('touchend', function () { holdUntil = performance.now() + 2500; }, { passive: true });
      track.addEventListener('wheel', function () { holdFor(1500); }, { passive: true });
      track.addEventListener('focusin', function () { holdFor(4000); });

      // Défilement manuel : on reprend là où la personne s'est arrêtée, et on reboucle
      track.addEventListener('scroll', function () {
        if (setWidth > 0 && track.scrollLeft >= setWidth) {
          track.scrollLeft -= setWidth;
        }
        if (Math.abs(track.scrollLeft - pos) > 2) pos = track.scrollLeft;
      }, { passive: true });

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
        }).observe(sec);
      }
      document.addEventListener('visibilitychange', function () { last = 0; });
      window.addEventListener('resize', function () {
        var fc = track.querySelector('.is-clone');
        if (fc) setWidth = fc.offsetLeft - originals[0].offsetLeft;
      });

      var tick = function (now) {
        if (last && visible && !hovering && now > holdUntil && !soundOn() && !document.hidden) {
          var dt = Math.min(now - last, 64) / 1000;
          pos += speed * dt;
          if (pos >= setWidth) pos -= setWidth;
          track.scrollLeft = pos;
        } else if (!last || hovering || now <= holdUntil) {
          pos = track.scrollLeft;
        }
        last = now;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    // Chiffres animés (ex. « 18,3K », « +11M », « 4,8/5 »)
    var counters = Array.prototype.slice.call(sec.querySelectorAll('[data-alo-tt-count]'));
    if (!reduce && counters.length && 'IntersectionObserver' in window) {
      var co = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          co.unobserve(en.target);
          countUp(en.target);
        });
      }, { threshold: .6 });
      counters.forEach(function (el) { co.observe(el); });
    }
  }

  function countUp(el) {
    var text = el.textContent.trim();
    var m = text.match(/^([^\d]*)(\d+(?:[.,]\d+)?)(.*)$/);
    if (!m) return;
    var sep = m[2].indexOf(',') !== -1 ? ',' : '.';
    var target = parseFloat(m[2].replace(',', '.'));
    var decimals = (m[2].split(/[.,]/)[1] || '').length;
    var start = performance.now();
    var dur = 1400;
    function frame(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      var val = (target * eased).toFixed(decimals).replace('.', sep);
      el.textContent = m[1] + val + m[3];
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = text;
    }
    requestAnimationFrame(frame);
  }

  function init(root) {
    (root || document).querySelectorAll('[data-alo-tt]').forEach(initSection);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
