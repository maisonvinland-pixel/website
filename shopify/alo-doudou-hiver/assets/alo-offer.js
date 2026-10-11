/* ==========================================================
   Alo Doudou : offre « 2 ensembles achetés = 1 sac cabas offert »
   Lit l'état calculé en Liquid (snippets/alo-gift-offer.liquid) et
   ajoute ou retire le sac du panier. La gratuité elle-même est
   appliquée par la réduction automatique Shopify.

   Garde-fous :
   - le sac n'est jamais laissé payant : si la réduction ne s'applique
     pas, il est retiré et l'offre est masquée pour la session ;
   - si la cliente retire le sac, il n'est pas rajouté de force :
     un bouton lui permet de le récupérer ;
   - une même action n'est jamais répétée en boucle.
   ========================================================== */
(function () {
  if (window.aloOfferInit) return;
  window.aloOfferInit = true;

  var OFF_KEY = 'alo-gift-off';
  var DECLINED_KEY = 'alo-gift-declined';
  var busy = false;
  var lastAction = '';
  var lastActionAt = 0;

  function store(key, value) {
    try {
      if (value === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    } catch (e) {}
  }
  function read(key) {
    try { return sessionStorage.getItem(key); } catch (e) { return null; }
  }

  function root() {
    return (window.Shopify && Shopify.routes && Shopify.routes.root) || '/';
  }

  function post(url, body) {
    return fetch(root() + url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) throw new Error('cart ' + res.status);
      return res.json();
    });
  }

  function hideOffer() {
    document.querySelectorAll('[data-alo-gift-ui]').forEach(function (el) {
      el.hidden = true;
    });
  }

  /* Rafraîchit le tiroir panier comme le fait le thème après un ajout. */
  function refresh() {
    if (document.getElementById('main-cart-items')) {
      window.location.reload();
      return Promise.resolve();
    }
    var drawerForm = document.getElementById('minicart-form');
    var sectionReq = drawerForm
      ? fetch(root() + '?section_id=minicart-form', { credentials: 'same-origin' })
          .then(function (res) { return res.text(); })
          .then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var fresh = doc.getElementById('minicart-form');
            if (fresh) drawerForm.innerHTML = fresh.innerHTML;
            var notif = document.querySelector('cart-notification');
            if (notif && typeof notif.cartAction === 'function') notif.cartAction();
          })
      : Promise.resolve();
    var cartReq = fetch(root() + 'cart.js', { credentials: 'same-origin' })
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        document.querySelectorAll('.cart-count').forEach(function (el) {
          if (el.classList.contains('cart-count-drawer')) el.innerHTML = '(' + cart.item_count + ')';
          else el.innerHTML = cart.item_count > 100 ? '~' : cart.item_count;
        });
        var bar = document.querySelector('free-ship-progress-bar');
        if (bar && typeof bar.init === 'function') bar.init(cart.items_subtotal_price);
      });
    return Promise.all([sectionReq, cartReq]);
  }

  function run(action, task) {
    var now = Date.now();
    if (busy) return;
    if (action === lastAction && now - lastActionAt < 15000) return;
    busy = true;
    lastAction = action;
    lastActionAt = now;
    task()
      .then(refresh)
      .catch(function () {
        store(OFF_KEY, '1');
        hideOffer();
      })
      .finally(function () {
        busy = false;
      });
  }

  function addGift(el) {
    var id = parseInt(el.getAttribute('data-variant-id'), 10);
    if (!id) return;
    run('add', function () {
      return post('cart/add.js', { items: [{ id: id, quantity: 1, properties: { _alo_gift: '1' } }] });
    });
  }

  function removeGift(el) {
    var key = el.getAttribute('data-line-key');
    if (!key) return;
    run('remove:' + key, function () {
      return post('cart/change.js', { id: key, quantity: 0 });
    });
  }

  function sync() {
    if (read(OFF_KEY) === '1') {
      hideOffer();
      return;
    }
    var el = document.querySelector('#main-cart-items [data-alo-gift]') || document.querySelector('[data-alo-gift]');
    if (!el) return;
    var state = el.getAttribute('data-state');

    if (state === 'paid') {
      /* Le sac n'est pas remisé : la réduction automatique est absente ou inactive. */
      store(OFF_KEY, '1');
      hideOffer();
      removeGift(el);
      return;
    }
    if (state === 'remove') {
      store(DECLINED_KEY, null);
      removeGift(el);
      return;
    }
    if (state === 'add' && el.getAttribute('data-auto-add') === 'true' && read(DECLINED_KEY) !== '1') {
      addGift(el);
      return;
    }
    if (state === 'ok' && !el.classList.contains('is-eligible')) {
      store(DECLINED_KEY, null);
    }
  }

  document.addEventListener('click', function (event) {
    var addBtn = event.target.closest('[data-alo-gift-add]');
    if (addBtn) {
      event.preventDefault();
      store(DECLINED_KEY, null);
      var el = addBtn.closest('[data-alo-gift]');
      if (el) {
        addBtn.disabled = true;
        lastAction = '';
        addGift(el);
      }
      return;
    }
    /* La cliente retire elle-même son sac offert : on respecte son choix. */
    var line = event.target.closest('[data-alo-gift-line]');
    if (line && event.target.closest('mini-cart-remove-button, cart-remove-button, .cart-remove, .minicart__item-remove')) {
      store(DECLINED_KEY, '1');
    }
  }, true);

  var scheduled = null;
  function scheduleSync() {
    clearTimeout(scheduled);
    scheduled = setTimeout(sync, 150);
  }

  function init() {
    sync();
    if (!window.MutationObserver) return;
    ['minicart-form', 'main-cart-items'].forEach(function (id) {
      var target = document.getElementById(id);
      if (target) new MutationObserver(scheduleSync).observe(target, { childList: true, subtree: true });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
