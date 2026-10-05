/*!
 * ONX — couche conversion (vanilla JS, sans dépendance).
 * Chargé en `defer` après theme.js. Chaque module est indépendant et tolérant
 * à l'absence de ses éléments. Réinitialisé à chaque rechargement de section dans l'éditeur.
 */
(function () {
  'use strict';

  var ONX = (window.ONX = window.ONX || {});
  var cfg = window.onxConfig || {};
  var strings = cfg.strings || {};
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function money(cents) {
    try {
      if (window.slate && slate.Currency && slate.Currency.formatMoney) {
        return slate.Currency.formatMoney(cents, (window.theme && theme.moneyFormat) || '{{amount_with_comma_separator}} €');
      }
    } catch (e) { /* fallback ci-dessous */ }
    return (cents / 100).toFixed(2).replace('.', ',') + ' €';
  }

  /* ------------------------------------------------------------------
   * 1. Mesure — dataLayer (GTM) + Shopify.analytics (pixels personnalisés)
   *    Les événements natifs (add_to_cart, checkout, purchase) restent
   *    collectés par Shopify : on n'émet ici que des micro-conversions.
   * ------------------------------------------------------------------ */
  ONX.track = function (event, data) {
    if (!cfg.tracking) return;
    var payload = Object.assign({ event: 'onx_' + event, page_type: cfg.pageType || '' }, data || {});
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(payload);
    } catch (e) { /* noop */ }
    try {
      if (window.Shopify && Shopify.analytics && typeof Shopify.analytics.publish === 'function') {
        Shopify.analytics.publish('onx_' + event, payload);
      }
    } catch (e) { /* noop */ }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-onx-track]');
    if (!el) return;
    var section = el.closest('[data-onx-section]');
    var test = el.closest('[data-onx-test]');
    ONX.track(el.getAttribute('data-onx-track'), {
      label: el.getAttribute('data-onx-track-label') || (el.textContent || '').trim().slice(0, 60),
      section: section ? section.getAttribute('data-onx-section') : '',
      variant_test: test ? test.getAttribute('data-onx-test') : ''
    });
  });

  document.addEventListener('theme:cart:open', function () {
    ONX.track('cart_open');
    var d = document.querySelector('[data-cart-drawer]');
    if (!d) return;
    d.classList.add('onx-opening');
    clearTimeout(d.__onxOpenT);
    d.__onxOpenT = setTimeout(function () { d.classList.remove('onx-opening'); }, 1900);
  });
  document.addEventListener('click', function (e) {
    var up = e.target.closest && e.target.closest('[data-upsell-btn]');
    if (up) ONX.track('upsell_add', { label: up.getAttribute('data-product-id') || '' });
  });

  /* ------------------------------------------------------------------
   * 2. Panier — compteur, économies, palier cadeau
   * ------------------------------------------------------------------ */
  var cartTimer = null;

  /* --- Offre « X achetés = Y offert » ----------------------------- */
  var bxgyState = null;
  function renderBxgy(qty) {
    $$('[data-onx-bxgy]').forEach(function (box) {
      var buy = parseInt(box.getAttribute('data-buy'), 10) || 3;
      var get = parseInt(box.getAttribute('data-get'), 10) || 1;
      var cycle = buy + get;
      var rest = qty % cycle;
      var free = Math.floor(qty / cycle) * get;
      var state = rest >= buy ? 'ready' : (rest === 0 && qty > 0 ? 'done' : 'progress');
      var text = $('[data-onx-bxgy-text]', box);
      if (text) {
        var label = state === 'ready' ? box.getAttribute('data-label-ready')
          : state === 'done' ? (box.getAttribute('data-label-done') || '').replace('||free||', free)
          : (box.getAttribute('data-label-left') || '').replace('||count||', buy - rest);
        if (text.textContent.trim() !== label) text.textContent = label;
      }
      $$('[data-onx-bxgy-step]', box).forEach(function (step, i) {
        step.classList.toggle('is-filled', state === 'done' || i < rest);
      });
      var cta = $('[data-onx-bxgy-cta]', box);
      if (cta) cta.hidden = state !== 'ready';
      box.classList.remove('is-progress', 'is-ready', 'is-done');
      box.classList.add('is-' + state);
      var key = state + ':' + free;
      if (bxgyState !== null && key !== bxgyState && (state === 'ready' || (state === 'done' && free > 0))) {
        ONX.celebrate(box);
        ONX.track('bxgy_' + state, { label: String(qty) });
      }
      bxgyState = key;
    });
  }

  function renderCartMeta() {
    var meta = $('[data-cart-drawer] [data-onx-cart-meta]') || $('[data-onx-cart-meta]');
    if (meta && meta.hasAttribute('data-bxgy-qty')) renderBxgy(parseInt(meta.getAttribute('data-bxgy-qty'), 10) || 0);
    var row = $('[data-onx-cart-savings]');
    if (row) {
      var savings = meta ? parseInt(meta.getAttribute('data-savings'), 10) || 0 : 0;
      if (savings > 0) {
        var v = $('[data-onx-cart-savings-value]', row);
        if (v) v.textContent = meta.getAttribute('data-savings-formatted') || money(savings);
        row.hidden = false;
      } else {
        row.hidden = true;
      }
    }
  }

  function renderGift(total) {
    $$('[data-onx-gift]').forEach(function (gift) {
      var threshold = parseInt(gift.getAttribute('data-threshold'), 10) || 0;
      if (!threshold) return;
      var left = threshold - total;
      var bar = $('[data-onx-gift-bar]', gift);
      var text = $('[data-onx-gift-text]', gift);
      if (bar) bar.style.width = Math.min(100, Math.round((total / threshold) * 100)) + '%';
      if (text) {
        if (left > 0) {
          text.innerHTML = (gift.getAttribute('data-label-left') || '').replace('||amount||', '<strong>' + money(left) + '</strong>');
        } else {
          text.textContent = gift.getAttribute('data-label-done') || '';
        }
      }
      gift.classList.toggle('is-unlocked', left <= 0);
    });
  }

  function refreshCart() {
    clearTimeout(cartTimer);
    cartTimer = setTimeout(function () {
      fetch(((window.theme && theme.routes && theme.routes.root) || '/') + 'cart.js', { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (cart) {
          $$('[data-onx-cart-count]').forEach(function (el) {
            var prev = parseInt(el.textContent, 10) || 0;
            el.textContent = cart.item_count;
            el.hidden = cart.item_count === 0;
            if (cart.item_count !== prev) bump(el);
          });
          highlightAdded();
          renderGift(cart.total_price);
          renderShip(cart.total_price);
          renderCartMeta();
        })
        .catch(function () { /* silencieux */ });
    }, 250);
  }

  // Observe uniquement le remplacement des lignes (childList, sans subtree) pour
  // éviter toute boucle avec nos propres mises à jour d'affichage.
  var itemsObserver = null;
  function observeItems() {
    var holder = $('[data-cart-drawer] [data-items-holder]');
    if (!holder || holder.__onxObserved) return;
    holder.__onxObserved = true;
    if (itemsObserver) itemsObserver.disconnect();
    itemsObserver = new MutationObserver(refreshCart);
    itemsObserver.observe(holder, { childList: true });
  }
  function watchCart() {
    var drawer = $('[data-cart-drawer]');
    if (!drawer || !window.MutationObserver) return;
    new MutationObserver(function () { observeItems(); refreshCart(); }).observe(drawer, { childList: true });
    observeItems();
  }

  document.addEventListener('theme:cart:add', function () { justAdded = true; refreshCart(); });

  /* --- Animations du panier ---------------------------------------- */
  var animOn = !!cfg.cartAnimations && !reduceMotion;
  var justAdded = false;

  function bump(el) {
    if (!animOn || !el) return;
    el.classList.remove('is-bump');
    void el.offsetWidth;
    el.classList.add('is-bump');
  }

  function highlightAdded() {
    if (!justAdded) return;
    var first = $('[data-cart-drawer] [data-items-holder] .cart__item');
    if (!first) return;
    justAdded = false;
    if (!animOn) return;
    first.classList.remove('onx-just-added');
    void first.offsetWidth;
    first.classList.add('onx-just-added');
  }

  function visibleCartIcon() {
    var icons = $$('.site-header .cart__toggle, .site-header [data-cart-drawer-toggle]');
    for (var i = 0; i < icons.length; i++) {
      var r = icons[i].getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.top >= 0) return icons[i];
    }
    return null;
  }

  function sourceImage(btn) {
    var scope = btn.closest('.product-grid-item, [data-upsell-holder], .onx-pack');
    var img = scope && scope.querySelector('img, .product__media--featured, .product-upsell__image__thumb');
    if (!img && btn.closest('[data-onx-sticky-atc]')) img = $('[data-onx-sticky-atc] img');
    if (!img && btn.closest('.product-single, [data-section-type="product-template"]')) {
      var sec = btn.closest('[data-section-type]') || document;
      img = sec.querySelector('.product-single__media:not(.media--hidden) img, [data-product-single-media-wrapper]:not(.media--hidden) img, .product-single__media img');
    }
    return img;
  }

  // Le produit « vole » jusqu'à l'icône panier (Web Animations API, aucune librairie)
  ONX.flyToCart = function (btn) {
    if (!animOn || !btn || !Element.prototype.animate) return;
    var img = sourceImage(btn);
    var target = visibleCartIcon();
    if (!img || !target) return;
    var from = img.getBoundingClientRect();
    var to = target.getBoundingClientRect();
    if (!from.width) return;
    var size = Math.min(from.width, from.height, 180);
    var ghost = document.createElement('div');
    ghost.className = 'onx-fly';
    var src = img.currentSrc || img.src || '';
    if (!src) {
      var bg = getComputedStyle(img).backgroundImage;
      ghost.style.backgroundImage = bg;
    } else {
      ghost.style.backgroundImage = 'url("' + src.replace(/"/g, '%22') + '")';
    }
    ghost.style.width = size + 'px';
    ghost.style.height = size + 'px';
    ghost.style.left = (from.left + from.width / 2 - size / 2) + 'px';
    ghost.style.top = (from.top + from.height / 2 - size / 2) + 'px';
    document.body.appendChild(ghost);
    var dx = (to.left + to.width / 2) - (from.left + from.width / 2);
    var dy = (to.top + to.height / 2) - (from.top + from.height / 2);
    var anim = ghost.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1, borderRadius: '14px' },
      { transform: 'translate(' + dx * 0.55 + 'px,' + (dy * 0.55 - 60) + 'px) scale(0.55)', opacity: 0.95, offset: 0.55 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(0.12)', opacity: 0.2, borderRadius: '50%' }
    ], { duration: 720, easing: 'cubic-bezier(0.5, 0, 0.2, 1)', fill: 'forwards' });
    anim.onfinish = function () {
      ghost.remove();
      $$('[data-onx-cart-count]').forEach(bump);
      target.classList.remove('onx-cart-hit'); void target.offsetWidth; target.classList.add('onx-cart-hit');
    };
  };

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-add-to-cart]');
    if (!btn || btn.disabled || btn.hasAttribute('disabled')) return;
    if (btn.closest('[data-cart-drawer]') && !btn.closest('[data-pair-products-holder]')) return;
    ONX.flyToCart(btn);
  }, true);

  // Petite célébration (canvas, ~1 s, couleurs ONX) quand une offre est débloquée
  ONX.celebrate = function (anchor) {
    if (!animOn) return;
    var r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 3, width: 0, height: 0 };
    var c = document.createElement('canvas');
    c.className = 'onx-confetti';
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    document.body.appendChild(c);
    var ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
    var colors = ['#1652F0', '#5B8CFF', '#8FD8FF', '#FFFFFF', '#0E2A5E'];
    var ox = r.left + r.width / 2, oy = r.top + r.height / 2;
    var parts = [];
    for (var i = 0; i < 70; i++) {
      var a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 6;
      parts.push({ x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, s: 4 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[i % colors.length] });
    }
    var start = performance.now();
    (function frame(t) {
      var k = (t - start) / 1100;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach(function (p) {
        p.vy += 0.22; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      });
      if (k < 1) requestAnimationFrame(frame); else c.remove();
    })(start);
  };
  document.addEventListener('theme:cart:loaded', refreshCart);

  /* ------------------------------------------------------------------
   * 3. Onglets produits
   * ------------------------------------------------------------------ */
  function initTabs(ctx) {
    $$('[data-onx-tabs]', ctx).forEach(function (wrap) {
      var tabs = $$('[data-onx-tab]', wrap);
      if (tabs.length < 2) return;
      function select(tab, focus) {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.tabIndex = on ? 0 : -1;
          var panel = document.getElementById(t.getAttribute('aria-controls'));
          if (panel) panel.hidden = !on;
        });
        if (focus) tab.focus();
        ONX.track('tab_select', { label: tab.textContent.trim() });
      }
      tabs.forEach(function (tab, i) {
        tab.addEventListener('click', function () { select(tab, false); });
        tab.addEventListener('keydown', function (e) {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
          select(next, true);
        });
      });
    });
  }

  /* Active la vue rapide / swatches du thème dans les grilles ONX */
  function initGrids(ctx) {
    $$('[data-onx-product-grid]', ctx).forEach(function (grid) {
      if (grid.__onxGrid) return;
      grid.__onxGrid = true;
      try {
        if (window.PaloAlto && typeof PaloAlto.ProductGrid === 'function') new PaloAlto.ProductGrid(grid);
      } catch (e) { /* le lien produit reste fonctionnel */ }
    });
  }

  /* ------------------------------------------------------------------
   * 4. Copier un code promo
   * ------------------------------------------------------------------ */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-onx-copy]');
    if (!btn) return;
    var code = btn.getAttribute('data-onx-copy');
    var label = $('[data-onx-copy-label]', btn);
    var done = function () {
      btn.classList.add('is-copied');
      if (label) { label.setAttribute('data-prev', label.innerHTML); label.textContent = strings.copied || 'Copié !'; }
      setTimeout(function () {
        btn.classList.remove('is-copied');
        if (label && label.getAttribute('data-prev')) label.innerHTML = label.getAttribute('data-prev');
      }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done, done);
    } else {
      var ta = document.createElement('textarea');
      ta.value = code; ta.setAttribute('readonly', ''); ta.style.position = 'absolute'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (err) { /* noop */ }
      document.body.removeChild(ta); done();
    }
  });

  /* ------------------------------------------------------------------
   * 5. Compte à rebours (uniquement si une vraie date de fin est saisie)
   * ------------------------------------------------------------------ */
  function initCountdowns(ctx) {
    $$('[data-onx-countdown]', ctx).forEach(function (el) {
      var end = new Date(el.getAttribute('data-onx-countdown')).getTime();
      var out = $('[data-onx-countdown-value]', el);
      if (!end || isNaN(end) || !out) return;
      function tick() {
        var diff = end - Date.now();
        if (diff <= 0) { el.hidden = true; return; }
        var d = Math.floor(diff / 864e5), h = Math.floor((diff % 864e5) / 36e5),
            m = Math.floor((diff % 36e5) / 6e4), s = Math.floor((diff % 6e4) / 1e3);
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        out.textContent = (d > 0 ? d + (strings.days_short || 'j') + ' ' : '') + pad(h) + ':' + pad(m) + ':' + pad(s);
        el.hidden = false;
        setTimeout(tick, 1000);
      }
      tick();
    });
  }

  /* ------------------------------------------------------------------
   * 6. Vidéos UGC — lecture sur place, une seule à la fois
   * ------------------------------------------------------------------ */
  function pauseAllExcept(current) {
    $$('[data-onx-video-el]').forEach(function (v) {
      if (v !== current && !v.paused) v.pause();
    });
  }

  function initVideos(ctx) {
    $$('[data-onx-video]', ctx).forEach(function (frame) {
      if (frame.__onx) return;
      frame.__onx = true;
      var video = $('[data-onx-video-el]', frame);
      var toggle = $('[data-onx-video-toggle]', frame);
      var mute = $('[data-onx-video-mute]', frame);
      if (!video || !toggle) return;

      function sync() {
        var playing = !video.paused;
        frame.classList.toggle('is-playing', playing);
        toggle.setAttribute('aria-label', playing ? toggle.getAttribute('data-label-pause') : toggle.getAttribute('data-label-play'));
      }
      toggle.addEventListener('click', function () {
        if (video.paused) {
          pauseAllExcept(video);
          video.muted = false;
          if (mute) mute.setAttribute('aria-pressed', 'false');
          var p = video.play();
          if (p && p.catch) p.catch(function () { video.muted = true; video.play(); });
        } else {
          video.pause();
        }
      });
      if (mute) {
        mute.addEventListener('click', function () {
          video.muted = !video.muted;
          mute.setAttribute('aria-pressed', video.muted ? 'true' : 'false');
          frame.classList.toggle('is-muted', video.muted);
        });
      }
      video.addEventListener('play', sync);
      video.addEventListener('pause', sync);
    });

    // Met en pause les vidéos qui sortent de l'écran (batterie / données mobiles)
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (!en.isIntersecting && !en.target.paused) en.target.pause(); });
      }, { threshold: 0.15 });
      $$('[data-onx-video-el]', ctx).forEach(function (v) { io.observe(v); });
    }
  }

  /* ------------------------------------------------------------------
   * 7. Comparateur avant / après
   * ------------------------------------------------------------------ */
  function initCompare(ctx) {
    $$('[data-onx-compare]', ctx).forEach(function (el) {
      var range = $('[data-onx-compare-range]', el);
      if (!range) return;
      var set = function () { el.style.setProperty('--pos', range.value + '%'); };
      range.addEventListener('input', set);
      set();
    });
  }

  /* ------------------------------------------------------------------
   * 8. Page produit — économie dynamique + barre d'achat collante
   * ------------------------------------------------------------------ */
  function updateSaving(scope, variant) {
    $$('[data-onx-saving]', scope).forEach(function (el) {
      if (variant && variant.compare_at_price > variant.price) {
        var save = variant.compare_at_price - variant.price;
        var pct = Math.round((save / variant.compare_at_price) * 100);
        var pctEl = $('[data-onx-saving-pct]', el);
        var txt = $('[data-onx-saving-text]', el);
        if (pctEl) pctEl.textContent = '-' + pct + '%';
        if (txt) txt.textContent = (strings.you_save_amount || 'Vous économisez ||amount||').replace('||amount||', money(save));
        el.hidden = false;
      } else {
        el.hidden = true;
      }
    });
  }

  function updateSticky(variant) {
    var bar = $('[data-onx-sticky-atc]');
    if (!bar || !variant) return;
    var price = $('[data-onx-sticky-price]', bar);
    var compare = $('[data-onx-sticky-compare]', bar);
    var label = $('[data-onx-sticky-label]', bar);
    if (price) price.textContent = money(variant.price);
    if (compare) {
      compare.hidden = !(variant.compare_at_price > variant.price);
      if (!compare.hidden) compare.textContent = money(variant.compare_at_price);
    }
    if (label) label.textContent = variant.available ? (strings.add_to_cart || 'Ajouter au panier') : (strings.sold_out || 'Épuisé');
    bar.classList.toggle('is-soldout', !variant.available);
  }

  document.addEventListener('theme:variant:change', function (e) {
    var variant = e.detail && e.detail.variant;
    var scope = e.target && e.target.closest ? (e.target.closest('[data-section-type]') || document) : document;
    updateSaving(scope, variant);
    // la barre collante ne suit que le produit principal (pas la vue rapide)
    if (!(e.target.closest && e.target.closest('.mfp-content'))) updateSticky(variant);
  });

  function initSticky() {
    var bar = $('[data-onx-sticky-atc]');
    if (!bar || bar.__onx) return;
    bar.__onx = true;
    var target = $(bar.getAttribute('data-target'));
    var btn = $('[data-onx-sticky-btn]', bar);
    if (!target || !btn || !('IntersectionObserver' in window)) return;

    var footer = $('.site-footer');
    var targetVisible = true;
    var footerVisible = false;

    function render() {
      var show = !targetVisible && !footerVisible;
      bar.classList.toggle('is-visible', show);
      bar.setAttribute('aria-hidden', show ? 'false' : 'true');
      btn.tabIndex = show ? 0 : -1;
      document.documentElement.classList.toggle('onx-has-sticky-atc', show);
    }
    new IntersectionObserver(function (entries) {
      // visible si à l'écran, ou si l'utilisateur ne l'a pas encore dépassé (au-dessus du pli)
      entries.forEach(function (en) { targetVisible = en.isIntersecting || en.boundingClientRect.top > 0; });
      render();
    }).observe(target);
    if (footer) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { footerVisible = en.isIntersecting; });
        render();
      }).observe(footer);
    }

    btn.addEventListener('click', function () {
      if (target.disabled) {
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        return;
      }
      target.click();
    });
  }

  /* ------------------------------------------------------------------
   * 8b. Page produit — packs (X achetés = Y offert), stock réel,
   *     délais de livraison, barre livraison offerte
   * ------------------------------------------------------------------ */
  function bundleItems(box) {
    var tier = $('[data-onx-tier-input]:checked', box);
    if (!tier) return null;
    var wrap = tier.closest('.onx-tier-wrap');
    var qty = parseInt(tier.value, 10) || 1;
    var slots = $$('[data-onx-slot]', wrap);
    return { qty: qty, wrap: wrap, slots: slots };
  }

  function currentVariantId(form) {
    var input = form && form.querySelector('[name="id"]');
    return input ? parseInt(input.value, 10) : null;
  }

  function renderBundles(box, variant) {
    var buy = parseInt(box.getAttribute('data-buy'), 10) || 3;
    var get = parseInt(box.getAttribute('data-get'), 10) || 1;
    var cycle = buy + get;
    var unitLabel = box.getAttribute('data-unit-label') || '||price||';
    var saveLabel = box.getAttribute('data-save-label') || '-||pct|| %';
    $$('[data-onx-tier]', box).forEach(function (tier) {
      var wrap = tier.closest('.onx-tier-wrap');
      var qty = parseInt(tier.getAttribute('data-qty'), 10) || 1;
      var free = Math.floor(qty / cycle) * get;
      var prices = [];
      var slots = $$('[data-onx-slot]', wrap);
      if (slots.length) {
        slots.forEach(function (sel) {
          var opt = sel.options[sel.selectedIndex];
          prices.push(parseInt(opt && opt.getAttribute('data-price'), 10) || 0);
        });
      } else if (variant) {
        for (var i = 0; i < qty; i++) prices.push(variant.price);
      } else {
        return;
      }
      // la remise Shopify offre les articles les moins chers
      var sorted = prices.slice().sort(function (a, b) { return a - b; });
      var full = prices.reduce(function (a, b) { return a + b; }, 0);
      var discount = sorted.slice(0, free).reduce(function (a, b) { return a + b; }, 0);
      var total = full - discount;
      var compare = free > 0 ? full : (variant && variant.compare_at_price > variant.price ? variant.compare_at_price * qty : 0);
      var pct = compare > total ? Math.round(((compare - total) / compare) * 100) : 0;
      var per = Math.round(total / qty);

      var totalEl = $('[data-onx-tier-total]', tier);
      var compareEl = $('[data-onx-tier-compare]', tier);
      var chip = $('[data-onx-tier-chip]', tier);
      var unit = $('[data-onx-tier-unit]', tier);
      var perEl = $('[data-onx-tier-per]', tier);
      if (totalEl) totalEl.textContent = money(total);
      if (compareEl) { compareEl.hidden = !(compare > total); compareEl.textContent = money(compare); }
      if (chip) { chip.hidden = pct <= 0; chip.textContent = saveLabel.replace('||pct||', pct); }
      if (unit) unit.textContent = unitLabel.replace('||price||', money(per));
      if (perEl) perEl.textContent = perEl.textContent.replace(/^[^/]+/, money(per) + ' ');
    });
  }

  function selectTier(box, input) {
    $$('[data-onx-tier]', box).forEach(function (t) {
      var on = t.contains(input);
      t.classList.toggle('is-selected', on);
      var slots = $('[data-onx-slots]', t.closest('.onx-tier-wrap'));
      if (slots) slots.hidden = !on;
    });
    ONX.track('bundle_select', { qty: parseInt(input.value, 10) || 1 });
  }

  function initBundles(ctx) {
    $$('[data-onx-bundles]', ctx).forEach(function (box) {
      if (box.__onx) return;
      box.__onx = true;
      var form = document.getElementById(box.getAttribute('data-form'));
      box.addEventListener('change', function (e) {
        if (e.target.matches('[data-onx-tier-input]')) selectTier(box, e.target);
        if (e.target.matches('[data-onx-slot]')) {
          e.target.__touched = true;
          renderBundles(box, null);
        }
      });
      // la variante choisie en haut devient celle des emplacements non modifiés
      document.addEventListener('theme:variant:change', function (e) {
        var v = e.detail && e.detail.variant;
        if (!v || !form || !(e.target === form || form.contains(e.target) || (e.target.contains && e.target.contains(form)))) return;
        $$('[data-onx-slot]', box).forEach(function (sel) {
          if (!sel.__touched && v.available) sel.value = String(v.id);
        });
        renderBundles(box, v);
      });
    });
  }

  // Avant que le thème lise le formulaire (écouteur en phase de capture) :
  // pack > 1 => envoi de items[] (une ligne par variante), la remise automatique fait le reste.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-add-to-cart]');
    if (!btn) return;
    var form = btn.closest('form');
    var formId = form && form.getAttribute('id'); // form.id = champ name="id" du formulaire produit
    if (!formId) return;
    var box = $('[data-onx-bundles][data-form="' + formId + '"]');
    if (!box) return;
    var info = bundleItems(box);
    if (!info || info.qty <= 1) return;

    var counts = {};
    var order = [];
    if (info.slots.length) {
      info.slots.forEach(function (sel) {
        var id = sel.value;
        if (!counts[id]) { counts[id] = 0; order.push(id); }
        counts[id]++;
      });
    } else {
      var vid = currentVariantId(form);
      if (!vid) return;
      counts[vid] = info.qty;
      order.push(String(vid));
    }

    var disabled = $$('[name="id"], [name="quantity"]', form).filter(function (el) { return !el.disabled; });
    disabled.forEach(function (el) { el.disabled = true; });
    var temp = [];
    order.forEach(function (id) {
      [['items[][id]', id], ['items[][quantity]', counts[id]]].forEach(function (pair) {
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = pair[0];
        input.value = pair[1];
        form.appendChild(input);
        temp.push(input);
      });
    });
    ONX.track('bundle_add', { qty: info.qty, lines: order.length });
    setTimeout(function () {
      temp.forEach(function (el) { el.remove(); });
      disabled.forEach(function (el) { el.disabled = false; });
    }, 0);
  }, true);

  function updateStock(scope, variant) {
    $$('[data-onx-stock]', scope).forEach(function (el) {
      if (!variant) return;
      var data = {};
      try { data = JSON.parse(($('[data-onx-stock-data]', el) || {}).textContent || '{}'); } catch (err) { /* ignore */ }
      var v = data[variant.id] || { a: variant.available, m: false, s: false };
      var state = 'out';
      var text = el.getAttribute('data-text-out');
      if (v.a) {
        if (v.m && v.s) {
          state = 'in';
          text = el.getAttribute('data-text-in');
          if (typeof v.q === 'number' && el.getAttribute('data-text-low')) {
            state = 'low';
            text = el.getAttribute('data-text-low').replace('||count||', v.q);
          }
        } else {
          state = 'untracked';
          text = el.getAttribute('data-text-untracked');
        }
      }
      el.className = el.className.replace(/\bis-(in|low|out|untracked)\b/, '') + ' is-' + state;
      var t = $('[data-onx-stock-text]', el);
      if (t) t.textContent = text || '';
      el.hidden = !text;
    });
  }

  function addDays(date, days, business) {
    var d = new Date(date.getTime());
    if (!business) { d.setDate(d.getDate() + days); return d; }
    while (days > 0) {
      d.setDate(d.getDate() + 1);
      var wd = d.getDay();
      if (wd !== 0 && wd !== 6) days--;
    }
    return d;
  }

  function initDelivery(ctx) {
    $$('[data-onx-delivery]', ctx).forEach(function (el) {
      var ship = parseInt(el.getAttribute('data-ship'), 10);
      var min = parseInt(el.getAttribute('data-min'), 10);
      var max = parseInt(el.getAttribute('data-max'), 10) || min;
      if (isNaN(ship) || isNaN(min)) return;
      var business = el.getAttribute('data-business') === 'true';
      var cutoff = parseInt(el.getAttribute('data-cutoff'), 10) || 0;
      var lang = document.documentElement.lang || 'fr';
      var fmt;
      try { fmt = new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' }); }
      catch (err) { fmt = { format: function (d) { return d.toLocaleDateString(); } }; }

      var now = new Date();
      var start = new Date(now.getTime());
      var wd = start.getDay();
      // commande passée après l'heure limite, ou le week-end en jours ouvrés : départ au jour ouvré suivant
      if ((cutoff && now.getHours() >= cutoff) || (business && (wd === 0 || wd === 6))) start = addDays(start, 1, business);

      var shipDate = addDays(start, ship, business);
      var dMin = addDays(start, min, business);
      var dMax = addDays(start, max, business);
      var set = function (key, text) { var t = $('[data-onx-date="' + key + '"]', el); if (t) t.textContent = text; };
      set('order', fmt.format(now));
      set('ship', fmt.format(shipDate));
      set('delivery', max > min ? fmt.format(dMin) + ' – ' + fmt.format(dMax) : fmt.format(dMin));
      el.hidden = false;
    });
  }

  function renderShip(total) {
    $$('[data-onx-ship]').forEach(function (el) {
      var limit = parseInt(el.getAttribute('data-limit'), 10) || 0;
      if (!limit) return;
      var left = limit - total;
      var done = left <= 0;
      var t = $('[data-onx-ship-text]', el);
      var bar = $('[data-onx-ship-bar]', el);
      if (t) t.textContent = done ? el.getAttribute('data-text-done') : el.getAttribute('data-text-left').replace('||amount||', money(left));
      if (bar) bar.style.setProperty('--p', Math.min(100, Math.round((total / limit) * 100)) + '%');
      var pb = $('[role="progressbar"]', el);
      if (pb) pb.setAttribute('aria-valuenow', Math.min(100, Math.round((total / limit) * 100)));
      el.classList.toggle('is-done', done);
    });
  }
  ONX.renderShip = renderShip;

  document.addEventListener('theme:variant:change', function (e) {
    var scope = e.target && e.target.closest ? (e.target.closest('[data-section-type]') || document) : document;
    updateStock(scope, e.detail && e.detail.variant);
  });

  /* ------------------------------------------------------------------
   * 9. Apparition douce au scroll (respecte prefers-reduced-motion)
   * ------------------------------------------------------------------ */
  function initReveal(ctx) {
    if (reduceMotion || !('IntersectionObserver' in window) || window.Shopify && Shopify.designMode) return;
    var items = $$('.onx-section .onx-section__head, .onx-benefit, .onx-collection-card, .onx-review, .onx-why__reason, .onx-ugc__item', ctx);
    if (!items.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    items.forEach(function (el, i) {
      el.classList.add('onx-reveal');
      el.style.setProperty('--onx-delay', (i % 4) * 60 + 'ms');
      io.observe(el);
    });
  }

  /* ------------------------------------------------------------------
   * Init
   * ------------------------------------------------------------------ */
  function init(ctx) {
    initTabs(ctx);
    initGrids(ctx);
    initCountdowns(ctx);
    initVideos(ctx);
    initCompare(ctx);
    initBundles(ctx);
    initDelivery(ctx);
    initReveal(ctx);
  }

  function boot() {
    if (animOn) document.documentElement.classList.add('onx-anim');
    init(document);
    initSticky();
    watchCart();
    renderCartMeta();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  document.addEventListener('shopify:section:load', function (e) {
    init(e.target);
    initSticky();
  });
})();
