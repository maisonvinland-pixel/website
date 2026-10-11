// Tests navigateur de assets/alo-offer.js (panier simulé).
// Lancer : npm i playwright-core && node shopify/tests/alo-offer.test.js
// (CHROME_PATH=/chemin/vers/chrome si Chromium n'est pas dans /opt/pw-browsers)
const { chromium } = require('playwright-core');
const fs = require('fs');
const script = fs.readFileSync(require('path').join(__dirname, '../alo-doudou-hiver/assets/alo-offer.js'), 'utf8');

function drawer(state, opts = {}) {
  return `<div id="minicart-form"><div class="minicart-body">
    <div class="alo-gift ${opts.eligible ? 'is-eligible' : ''}" data-alo-gift data-alo-gift-ui data-state="${state}"
      data-variant-id="58700421562712" data-line-key="${opts.key || ''}" data-auto-add="true">
      ${opts.button ? '<button data-alo-gift-add>Ajouter mon sac offert</button>' : ''}
    </div>
    ${opts.giftLine ? '<div class="cart-item" data-alo-gift-line><mini-cart-remove-button><a class="cart-remove" href="#">x</a></mini-cart-remove-button></div>' : ''}
  </div></div>`;
}

async function run(name, initialState, opts, serverStateAfter, expect) {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
  const page = await browser.newPage();
  const calls = [];
  await page.route('**/*', async (route) => {
    const req = route.request(); const url = req.url();
    if (url.endsWith('/test')) return route.fulfill({ contentType: 'text/html', body: `<html><body><span class="cart-count">1</span>${drawer(initialState, opts)}<script>${script}</script></body></html>` });
    if (url.includes('cart/add.js') || url.includes('cart/change.js')) { calls.push({ url: url.replace(/^.*\//, ''), body: req.postData() }); return route.fulfill({ contentType: 'application/json', body: '{}' }); }
    if (url.includes('section_id=minicart-form')) { calls.push({ url: 'section' }); return route.fulfill({ contentType: 'text/html', body: drawer(serverStateAfter.state, serverStateAfter) }); }
    if (url.includes('cart.js')) return route.fulfill({ contentType: 'application/json', body: '{"item_count":3,"items_subtotal_price":17980}' });
    return route.fulfill({ status: 404, body: '' });
  });
  if (opts.preDecline) await page.addInitScript(() => sessionStorage.setItem('alo-gift-declined', '1'));
  await page.goto('https://shop.test/test');
  await page.waitForTimeout(800);
  if (opts.clickRemove) { await page.click('.cart-remove'); await page.evaluate(() => { const f = document.getElementById('minicart-form'); f.innerHTML = f.innerHTML; }); await page.waitForTimeout(800); }
  if (opts.clickAdd) { await page.click('[data-alo-gift-add]'); await page.waitForTimeout(800); }
  const hidden = await page.evaluate(() => [...document.querySelectorAll('[data-alo-gift-ui]')].every(e => e.hidden));
  const ss = await page.evaluate(() => ({ off: sessionStorage.getItem('alo-gift-off'), declined: sessionStorage.getItem('alo-gift-declined') }));
  await browser.close();
  const res = expect(calls, hidden, ss);
  console.log((res === true ? 'PASS ' : 'FAIL ') + name, res === true ? '' : res, JSON.stringify(calls));
}

(async () => {
  await run('éligible sans sac -> ajoute le sac (1 seul appel, propriété _alo_gift)', 'add', { eligible: true }, { state: 'ok', eligible: true },
    (c) => c.filter(x => x.url === 'add.js').length === 1 && JSON.parse(c[0].body).items[0].properties._alo_gift === '1' && JSON.parse(c[0].body).items[0].id === 58700421562712 || 'mauvais appel');
  await run('plus éligible -> retire le sac ajouté automatiquement', 'remove', { key: 'k1:abc' }, { state: 'ok' },
    (c) => c.length >= 1 && c[0].url === 'change.js' && JSON.parse(c[0].body).quantity === 0 && JSON.parse(c[0].body).id === 'k1:abc' || 'pas de retrait');
  await run('sac non remisé (réduction absente) -> retiré + offre masquée', 'paid', { key: 'k2:def', eligible: true }, { state: 'ok' },
    (c, hidden, ss) => (c[0] && c[0].url === 'change.js' && ss.off === '1') || 'garde-fou inactif');
  await run('état ok -> aucun appel', 'ok', { eligible: true }, { state: 'ok' }, (c) => c.length === 0 || 'appels inattendus');
  await run('la cliente a retiré son sac -> pas de ré-ajout forcé', 'add', { eligible: true, preDecline: true }, { state: 'add', eligible: true },
    (c) => c.length === 0 || 'ré-ajout forcé');
  await run('bouton "Ajouter mon sac offert" -> ajoute', 'add', { eligible: true, preDecline: true, button: true, clickAdd: true }, { state: 'ok', eligible: true },
    (c) => c.filter(x => x.url === 'add.js').length === 1 || 'bouton inopérant');
  await run('clic corbeille sur la ligne sac -> mémorise le refus', 'ok', { eligible: true, giftLine: true, clickRemove: true }, { state: 'ok', eligible: true },
    (c, h, ss) => ss.declined === '1' || 'refus non mémorisé');
  await run('anti-boucle : serveur renvoie encore "add" -> 1 seul ajout', 'add', { eligible: true }, { state: 'add', eligible: true },
    (c) => c.filter(x => x.url === 'add.js').length === 1 || 'boucle détectée');
})();
