/* ==========================================================
   Alo Doudou : upsell, catalogue (ajout express), FAQ, newsletter
   ========================================================== */
(function () {
  if (window.aloBoutiqueInit) return;
  window.aloBoutiqueInit = true;

  var addUrl = (window.routes && window.routes.cart_add_url ? window.routes.cart_add_url : '/cart/add') + '.js';

  function addItems(items) {
    return fetch(addUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: items })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.description || data.message || 'Erreur');
        return data;
      });
    });
  }

  // Met à jour les compteurs du panier dans l'en-tête et le tiroir
  function refreshCartCount() {
    return fetch('/cart.js', { headers: { Accept: 'application/json' } })
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        document.querySelectorAll('.cart-count').forEach(function (el) {
          if (el.classList.contains('cart-count-drawer')) {
            el.textContent = '(' + cart.item_count + ')';
          } else {
            el.textContent = cart.item_count > 100 ? '~' : cart.item_count;
          }
        });
        var total = document.querySelector('header-total-price');
        if (total && typeof total.updateTotal === 'function') total.updateTotal(cart);
        var bar = document.querySelector('free-ship-progress-bar');
        if (bar && typeof bar.init === 'function') bar.init(cart.items_subtotal_price);
        return cart;
      })
      .catch(function () {});
  }

  // Re-rend le contenu du tiroir panier puis l'ouvre (comme après un ajout natif du thème)
  function refreshDrawer(open) {
    var form = document.getElementById('minicart-form');
    var notif = document.querySelector('cart-notification');
    if (!form) return Promise.resolve();
    return fetch('/?section_id=minicart-form', { credentials: 'same-origin' })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        var fresh = new DOMParser().parseFromString(html, 'text/html').getElementById('minicart-form');
        if (fresh) form.innerHTML = fresh.innerHTML;
        if (notif && typeof notif.cartAction === 'function') notif.cartAction();
        if (open && notif && typeof notif.open === 'function') notif.open();
      })
      .catch(function () {});
  }

  /* ---------- 1. Upsell ---------- */
  function initUpsell(box) {
    if (box.dataset.aloReady) return;
    box.dataset.aloReady = '1';
    var track = box.querySelector('[data-alo-ups-track]');
    var cards = Array.prototype.slice.call(box.querySelectorAll('[data-alo-ups-item]'));
    var dots = Array.prototype.slice.call(box.querySelectorAll('[data-alo-ups-dot]'));
    var prev = box.querySelector('[data-alo-ups-prev]');
    var next = box.querySelector('[data-alo-ups-next]');

    function current() {
      if (!track || !track.clientWidth) return 0;
      return Math.round(track.scrollLeft / track.clientWidth);
    }
    function go(i) {
      i = Math.max(0, Math.min(cards.length - 1, i));
      track.scrollTo({ left: cards[i].offsetLeft - track.offsetLeft, behavior: 'smooth' });
    }
    function update() {
      var i = current();
      dots.forEach(function (d, k) { d.classList.toggle('is-active', k === i); });
      if (prev) prev.disabled = i <= 0;
      if (next) next.disabled = i >= cards.length - 1;
    }
    if (track) track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    dots.forEach(function (d) { d.addEventListener('click', function () { go(Number(d.dataset.aloUpsDot)); }); });
    if (prev) prev.addEventListener('click', function () { go(current() - 1); });
    if (next) next.addEventListener('click', function () { go(current() + 1); });

    cards.forEach(function (card) {
      var input = card.querySelector('.alo-ups__input');
      function sync() { card.classList.toggle('is-on', !!(input && input.checked)); }
      if (input) input.addEventListener('change', sync);
      sync();

      // Un clic n'importe où sur le bandeau active / désactive
      var panel = card.querySelector('.alo-ups__panel');
      if (panel && input) {
        panel.addEventListener('click', function (e) {
          if (e.target.closest('a, button, label, input')) return;
          input.checked = !input.checked;
          sync();
        });
      }

      // Choix du format (ex. la paire / pack de 3)
      card.querySelectorAll('[data-alo-ups-var]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          card.querySelectorAll('[data-alo-ups-var]').forEach(function (b) {
            b.classList.toggle('is-active', b === btn);
            b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
          });
          card.dataset.variantId = btn.dataset.aloUpsVar;
          var price = card.querySelector('[data-alo-ups-price]');
          var compare = card.querySelector('[data-alo-ups-compare]');
          if (price) price.textContent = btn.dataset.price;
          if (compare) {
            compare.textContent = btn.dataset.compare || '';
            compare.hidden = !btn.dataset.compare;
          }
          if (input && !input.checked) { input.checked = true; sync(); }
        });
      });
    });
    update();
  }

  function checkedUpsells(formId) {
    var box = document.querySelector('[data-alo-ups][data-form-id="' + formId + '"]');
    if (!box) return [];
    return Array.prototype.slice.call(box.querySelectorAll('[data-alo-ups-item]'))
      .filter(function (card) {
        var input = card.querySelector('.alo-ups__input');
        return input && input.checked && card.dataset.variantId;
      })
      .map(function (card) { return { id: Number(card.dataset.variantId), quantity: 1 }; });
  }

  // Bouton « Ajouter au panier » : les upsells activés partent d'abord, puis le produit principal
  var upsBusy = false;
  document.addEventListener('click', function (event) {
    if (upsBusy) return;
    var button = event.target.closest('button[type="submit"], [name="add"]');
    if (!button) return;
    var form = button.form || button.closest('form');
    if (!form || !form.id) return;
    var items = checkedUpsells(form.id);
    if (!items.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    upsBusy = true;
    addItems(items)
      .catch(function () {})
      .finally(function () {
        button.click();
        upsBusy = false;
      });
  }, true);

  // Bouton « Acheter maintenant » : produit principal + upsells activés, puis paiement
  document.addEventListener('click', function (event) {
    var buyNow = event.target.closest('.shopify-payment-button__button--unbranded');
    if (!buyNow) return;
    var form = buyNow.closest('form') || document.querySelector('form[id^="product-form"]');
    if (!form || !form.id) return;
    var items = checkedUpsells(form.id);
    if (!items.length) return;
    var idInput = form.querySelector('[name="id"]');
    if (!idInput || !idInput.value) return;
    var qtyInput = form.querySelector('[name="quantity"]');
    event.preventDefault();
    event.stopImmediatePropagation();
    buyNow.setAttribute('aria-busy', 'true');
    addItems([{ id: Number(idInput.value), quantity: Number(qtyInput && qtyInput.value) || 1 }].concat(items))
      .then(function () { window.location.href = '/checkout'; })
      .catch(function () { buyNow.removeAttribute('aria-busy'); });
  }, true);

  /* ---------- 2. Catalogue ---------- */
  function initCatalogue(sec) {
    if (sec.dataset.aloReady) return;
    sec.dataset.aloReady = '1';
    var chips = Array.prototype.slice.call(sec.querySelectorAll('[data-alo-cat-filter]'));
    var items = Array.prototype.slice.call(sec.querySelectorAll('[data-alo-cat-item]'));
    var count = sec.querySelector('[data-alo-cat-count]');

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var f = chip.dataset.aloCatFilter;
        chips.forEach(function (c) {
          c.classList.toggle('is-active', c === chip);
          c.setAttribute('aria-selected', c === chip ? 'true' : 'false');
        });
        var n = 0;
        items.forEach(function (it) {
          var show = f === '*' || it.dataset.type === f;
          it.classList.toggle('is-hidden', !show);
          it.classList.remove('is-in');
          if (show) {
            it.style.setProperty('--i', n);
            void it.offsetWidth;
            it.classList.add('is-in');
            n++;
          }
        });
        if (count) count.textContent = n;
      });
    });
  }

  document.addEventListener('click', function (event) {
    var btn = event.target.closest('[data-alo-qa]');
    if (!btn || btn.disabled) return;
    event.preventDefault();
    var card = btn.closest('.alo-card');
    var msg = card ? card.querySelector('[data-alo-qa-msg]') : null;
    var label = btn.textContent;
    btn.classList.add('is-loading');
    if (msg) { msg.textContent = ''; msg.classList.remove('is-error'); }
    addItems([{ id: Number(btn.dataset.aloQa), quantity: 1 }])
      .then(function () {
        btn.classList.remove('is-loading');
        btn.classList.add('is-done');
        if (btn.classList.contains('alo-card__add')) btn.textContent = 'Ajouté ✓';
        if (msg) {
          msg.innerHTML = 'Ajouté au panier ✓ <a href="' + ((window.routes && window.routes.cart_url) || '/cart') + '">Voir mon panier</a>';
        }
        refreshCartCount();
        refreshDrawer(true);
        setTimeout(function () {
          btn.classList.remove('is-done');
          if (btn.classList.contains('alo-card__add')) btn.textContent = label;
        }, 2200);
      })
      .catch(function (err) {
        btn.classList.remove('is-loading');
        if (msg) {
          msg.classList.add('is-error');
          msg.textContent = err && err.message ? err.message : 'Impossible d’ajouter cet article.';
        }
      });
  });

  /* ---------- 3. FAQ ---------- */
  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function initFaq(sec) {
    if (sec.dataset.aloReady) return;
    sec.dataset.aloReady = '1';
    var tabs = Array.prototype.slice.call(sec.querySelectorAll('[data-alo-faq-tab]'));
    var items = Array.prototype.slice.call(sec.querySelectorAll('[data-alo-faq-item]'));
    var search = sec.querySelector('[data-alo-faq-search]');
    var empty = sec.querySelector('[data-alo-faq-empty]');
    var cat = '*';
    var index = items.map(function (it) { return norm(it.textContent); });

    function apply() {
      var q = norm(search ? search.value.trim() : '');
      var shown = 0;
      items.forEach(function (it, i) {
        var ok = (cat === '*' || it.dataset.cat === cat) && (!q || index[i].indexOf(q) !== -1);
        it.classList.toggle('is-hidden', !ok);
        if (ok) shown++;
        if (q && ok && !it.open) it.open = true;
      });
      if (empty) empty.hidden = shown > 0;
    }
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        cat = tab.dataset.aloFaqTab;
        tabs.forEach(function (t) {
          t.classList.toggle('is-active', t === tab);
          t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        });
        apply();
      });
    });
    if (search) search.addEventListener('input', apply);

    // Une seule réponse ouverte à la fois (hors recherche)
    items.forEach(function (it) {
      it.addEventListener('toggle', function () {
        if (!it.open || (search && search.value.trim())) return;
        items.forEach(function (other) { if (other !== it && other.open) other.open = false; });
      });
    });
  }

  /* ---------- 4. Newsletter ---------- */
  document.addEventListener('click', function (event) {
    var btn = event.target.closest('[data-alo-nl-copy]');
    if (!btn) return;
    var code = btn.parentElement.querySelector('[data-alo-nl-code]');
    if (!code) return;
    var done = function () {
      btn.textContent = 'Copié ✓';
      setTimeout(function () { btn.textContent = 'Copier'; }, 2000);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code.textContent.trim()).then(done).catch(done);
    } else {
      done();
    }
  });

  function init(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-alo-ups]').forEach(initUpsell);
    scope.querySelectorAll('[data-alo-cat]').forEach(initCatalogue);
    scope.querySelectorAll('[data-alo-faq]').forEach(initFaq);
    var ok = scope.querySelector('[data-alo-nl-success]');
    if (ok) {
      ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ok.focus({ preventScroll: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }
  document.addEventListener('shopify:section:load', function (event) { init(event.target); });
})();
