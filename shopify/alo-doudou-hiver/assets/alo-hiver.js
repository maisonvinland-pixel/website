/* ==========================================================
   Alo Doudou : mode hiver
   Neige en 3 profondeurs (flou, vent, rafales), vrais cristaux
   à 6 branches qui scintillent, flocons qui s'écartent du doigt
   ou de la souris, parallaxe au scroll et pluie d'étoiles au clic.
   ========================================================== */
(function () {
  if (window.aloHiverInit) return;
  window.aloHiverInit = true;

  var root = document.getElementById('alo-hiver');
  if (!root) return;

  /* ---------- Décors : aurore, stalactites, congère ---------- */
  function addDecor(host, cls, hostCls) {
    if (!host || host.querySelector(':scope > .' + cls)) return;
    var el = document.createElement('div');
    el.className = cls;
    el.setAttribute('aria-hidden', 'true');
    host.classList.add(hostCls);
    host.insertBefore(el, host.firstChild);
    return el;
  }
  if (root.getAttribute('data-aurora') === 'true') {
    var topbar = document.getElementById('topbar');
    addDecor(topbar, 'alo-hv-stars', 'alo-hv-has-aurora');
    addDecor(topbar, 'alo-hv-aurora', 'alo-hv-has-aurora');
  }
  if (root.getAttribute('data-icicles') === 'true') {
    var sticky = document.getElementById('header-sticky');
    if (sticky) {
      var ice = document.createElement('div');
      ice.className = 'alo-hv-icicles';
      ice.setAttribute('aria-hidden', 'true');
      sticky.appendChild(ice);
      var header = sticky.closest('.header');
      if (header) header.classList.add('alo-hv-has-icicles');
    }
  }
  if (root.getAttribute('data-drift') === 'true') {
    var main = document.getElementById('MainContent');
    var foot = main && main.nextElementSibling;
    if (foot && foot.classList.contains('shopify-section')) addDecor(foot, 'alo-hv-drift', 'alo-hv-has-drift');
  }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var cfg = {
    density: parseInt(root.getAttribute('data-density'), 10) || 90,
    crystals: root.getAttribute('data-crystals') === 'true',
    interact: root.getAttribute('data-interact') === 'true',
    burst: root.getAttribute('data-burst') === 'true',
    tint: root.getAttribute('data-tint') || '#9fc3e6'
  };

  var canvas = document.createElement('canvas');
  canvas.className = 'alo-hiver__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  root.appendChild(canvas);
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;
  var isMobile = window.matchMedia('(max-width: 767px)').matches;

  /* ---------- Sprites pré-rendus (rapide : un drawImage par flocon) ---------- */
  function makeSprite(size, draw) {
    var c = document.createElement('canvas');
    c.width = c.height = Math.ceil(size * DPR);
    var g = c.getContext('2d');
    g.scale(DPR, DPR);
    draw(g, size);
    return c;
  }

  // Flocon doux : cœur blanc, halo bleu glacier (visible sur fond blanc ET sur fond foncé)
  var dot = makeSprite(32, function (g, s) {
    var r = s / 2;
    var grd = g.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.34, 'rgba(255,255,255,0.97)');
    grd.addColorStop(0.5, hexA(cfg.tint, 0.95));
    grd.addColorStop(0.7, hexA(cfg.tint, 0.35));
    grd.addColorStop(1, hexA(cfg.tint, 0));
    g.fillStyle = grd;
    g.beginPath();
    g.arc(r, r, r, 0, Math.PI * 2);
    g.fill();
  });

  // Cristaux à 6 branches, 3 dessins différents
  function crystal(variant) {
    return makeSprite(64, function (g, s) {
      var c = s / 2;
      var L = s * 0.42;
      g.translate(c, c);
      g.lineCap = 'round';
      function arms(width, color) {
        g.strokeStyle = color;
        g.lineWidth = width;
        for (var i = 0; i < 6; i++) {
          g.save();
          g.rotate((Math.PI / 3) * i);
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(0, -L);
          if (variant === 0) {
            branch(g, L * 0.45, L * 0.22);
            branch(g, L * 0.7, L * 0.16);
          } else if (variant === 1) {
            branch(g, L * 0.32, L * 0.3);
            branch(g, L * 0.58, L * 0.22);
            branch(g, L * 0.8, L * 0.12);
          } else {
            g.moveTo(0, -L * 0.55);
            g.lineTo(-L * 0.14, -L * 0.72);
            g.lineTo(0, -L * 0.9);
            g.lineTo(L * 0.14, -L * 0.72);
            g.closePath();
            branch(g, L * 0.3, L * 0.18);
          }
          g.stroke();
          g.restore();
        }
      }
      function branch(g2, at, len) {
        g2.moveTo(0, -at);
        g2.lineTo(-len, -at - len);
        g2.moveTo(0, -at);
        g2.lineTo(len, -at - len);
      }
      arms(5.5, hexA(cfg.tint, 0.8));   // contour glacé
      arms(2.2, 'rgba(255,255,255,1)'); // cœur blanc
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(0, 0, 3.2, 0, Math.PI * 2);
      g.fill();
    });
  }
  var crystals = [crystal(0), crystal(1), crystal(2)];

  // Étincelle à 4 branches (scintillement + éclats au clic)
  var spark = makeSprite(32, function (g, s) {
    var c = s / 2;
    var grd = g.createRadialGradient(c, c, 0, c, c, c);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, hexA(cfg.tint, 0.6));
    grd.addColorStop(1, hexA(cfg.tint, 0));
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(c, 0);
    g.quadraticCurveTo(c, c, s, c);
    g.quadraticCurveTo(c, c, c, s);
    g.quadraticCurveTo(c, c, 0, c);
    g.quadraticCurveTo(c, c, c, 0);
    g.fill();
  });

  /* ---------- Flocons ---------- */
  var flakes = [];
  var bursts = [];

  function rand(a, b) { return a + Math.random() * (b - a); }

  function makeFlake(fromTop) {
    // z : 0.25 (loin, petit, flou, lent) -> 1 (proche, gros, net, rapide)
    var z = Math.pow(Math.random(), 1.6) * 0.75 + 0.25;
    var isCrystal = cfg.crystals && z > 0.62 && Math.random() < 0.42;
    var size = isCrystal ? rand(14, 26) * z : rand(4, 11) * z;
    return {
      x: Math.random() * W,
      y: fromTop ? rand(-H * 0.2, -10) : Math.random() * H,
      z: z,
      size: size,
      vy: rand(0.35, 0.8) * (0.4 + z),
      vx: 0,
      sway: rand(0.4, 1.4) * z,
      swayF: rand(0.006, 0.016),
      phase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI,
      vr: rand(-0.012, 0.012),
      alpha: isCrystal ? rand(0.75, 1) : rand(0.6, 1) * (0.6 + z * 0.4),
      sprite: isCrystal ? crystals[(Math.random() * 3) | 0] : dot,
      crystal: isCrystal,
      tw: Math.random() * 1000
    };
  }

  function targetCount() {
    var area = Math.sqrt((W * H) / (1440 * 900));
    return Math.round(cfg.density * Math.max(0.6, Math.min(area, 1.4)));
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    isMobile = window.matchMedia('(max-width: 767px)').matches;
    var n = targetCount();
    while (flakes.length < n) flakes.push(makeFlake(false));
    if (flakes.length > n) flakes.length = n;
  }

  /* ---------- Vent : rafales douces ---------- */
  var t = 0;
  var gust = 0;
  function wind() {
    var base = Math.sin(t * 0.0021) * 0.35 + Math.sin(t * 0.0057 + 1.3) * 0.2;
    if (Math.random() < 0.0016) gust = rand(-1.6, 1.6);
    gust *= 0.992;
    return base + gust;
  }

  /* ---------- Interactions ---------- */
  var pointer = { x: -9999, y: -9999, active: false };
  var scrollV = 0;
  var lastScroll = window.scrollY;

  if (cfg.interact) {
    window.addEventListener('pointermove', function (e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    }, { passive: true });
    window.addEventListener('pointerleave', function () { pointer.active = false; }, { passive: true });
    window.addEventListener('touchend', function () { pointer.active = false; }, { passive: true });
  }

  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    scrollV += (y - lastScroll);
    lastScroll = y;
  }, { passive: true });

  if (cfg.burst) {
    window.addEventListener('pointerdown', function (e) {
      var n = isMobile ? 10 : 14;
      for (var i = 0; i < n; i++) {
        var a = (Math.PI * 2 * i) / n + rand(-0.2, 0.2);
        var sp = rand(1.4, 3.6);
        bursts.push({
          x: e.clientX, y: e.clientY,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6,
          life: 1, size: rand(8, 16),
          sprite: i % 3 === 0 && cfg.crystals ? crystals[i % 3] : spark,
          rot: Math.random() * Math.PI, vr: rand(-0.1, 0.1)
        });
      }
      if (bursts.length > 120) bursts.splice(0, bursts.length - 120);
    }, { passive: true });
  }

  /* ---------- Boucle d'animation ---------- */
  var running = true;
  var last = performance.now();

  function frame(now) {
    if (!running) return;
    var dt = Math.min((now - last) / 16.667, 3);
    last = now;
    t += 16.667 * dt;

    ctx.clearRect(0, 0, W, H);
    var w = wind();
    var sv = scrollV;
    scrollV *= 0.82;

    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];

      // Répulsion douce autour du doigt / de la souris
      if (pointer.active) {
        var dx = f.x - pointer.x;
        var dy = f.y - pointer.y;
        var d2 = dx * dx + dy * dy;
        var R = 120;
        if (d2 < R * R && d2 > 1) {
          var d = Math.sqrt(d2);
          var force = (1 - d / R) * 1.8 * f.z;
          f.vx += (dx / d) * force;
          f.y += (dy / d) * force * 0.6;
        }
      }
      f.vx *= 0.94;

      f.phase += f.swayF * dt;
      f.x += (Math.sin(f.phase) * f.sway + w * (0.5 + f.z) + f.vx) * dt;
      f.y += f.vy * dt - sv * 0.18 * f.z;
      f.rot += f.vr * dt;

      if (f.y > H + 30 || f.x < -40 || f.x > W + 40 || f.y < -H * 0.5) {
        var nf = makeFlake(true);
        if (f.x < -40) { nf.x = W + 20; nf.y = Math.random() * H; }
        else if (f.x > W + 40) { nf.x = -20; nf.y = Math.random() * H; }
        flakes[i] = nf;
        continue;
      }

      var a = f.alpha;
      if (f.crystal) {
        f.tw += dt;
        var tw = Math.sin(f.tw * 0.05);
        if (tw > 0.97) a = Math.min(1, a + 0.4);
      }
      ctx.globalAlpha = a;
      var s = f.size;
      if (f.crystal) {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        ctx.drawImage(f.sprite, -s, -s, s * 2, s * 2);
        if (tw > 0.97) {
          ctx.globalAlpha = (tw - 0.97) / 0.03;
          ctx.drawImage(spark, -s * 0.9, -s * 0.9, s * 1.8, s * 1.8);
        }
        ctx.restore();
      } else {
        ctx.drawImage(f.sprite, f.x - s, f.y - s, s * 2, s * 2);
      }
    }

    for (var j = bursts.length - 1; j >= 0; j--) {
      var b = bursts[j];
      b.vx *= 0.95;
      b.vy = b.vy * 0.95 + 0.06;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.vr * dt;
      b.life -= 0.022 * dt;
      if (b.life <= 0) { bursts.splice(j, 1); continue; }
      ctx.globalAlpha = b.life;
      var bs = b.size * (0.6 + b.life * 0.4);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.drawImage(b.sprite, -bs, -bs, bs * 2, bs * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  resize();
  requestAnimationFrame(frame);

  /* ---------- Utilitaire couleur ---------- */
  function hexA(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
})();
