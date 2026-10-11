/* Alo Doudou : ticket BIENVENUE10 appliqué en un clic dans le panier */
(function () {
  if (window.aloDoudouInit) return;
  window.aloDoudouInit = true;

  var KEY = 'alo-coupon-applied';

  function isApplied() {
    try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }

  function markApplied(root) {
    if (!isApplied()) return;
    (root || document).querySelectorAll('.alo-coupon:not(.is-applied)').forEach(function (el) {
      el.classList.add('is-applied');
      var btn = el.querySelector('.alo-coupon__btn');
      if (btn) btn.textContent = 'Appliqué ✓';
      var hint = el.querySelector('.alo-coupon__hint');
      if (hint) hint.textContent = 'La réduction sera déduite au paiement.';
    });
  }

  document.addEventListener('click', function (event) {
    var btn = event.target.closest('.alo-coupon__btn');
    if (!btn) return;
    event.preventDefault();
    var code = btn.getAttribute('data-code');
    btn.disabled = true;
    btn.textContent = '…';
    fetch('/discount/' + encodeURIComponent(code), { credentials: 'same-origin' })
      .then(function () {
        try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
        markApplied();
      })
      .catch(function () {
        if (navigator.clipboard) navigator.clipboard.writeText(code);
        btn.textContent = 'Code copié';
      })
      .finally(function () {
        btn.disabled = false;
      });
  });

  function init() {
    markApplied();
    var minicart = document.querySelector('.minicart');
    if (minicart && window.MutationObserver) {
      new MutationObserver(function () { markApplied(minicart); })
        .observe(minicart, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
