/* Knowledge Graph — back navigation + empty green/space atmosphere canvas. */
(function(){
  var FALLBACK = 'index.html#hero';

  function goBack(){
    /* Skip splash curtain; home plays in-anim on return / bfcache. */
    try{ sessionStorage.setItem('sl_home_ready', '1'); }catch(e){}
    try{
      if(window.history.length > 1 && document.referrer){
        var sameOrigin = false;
        try{
          sameOrigin = new URL(document.referrer).origin === location.origin;
        }catch(e){}
        if(sameOrigin){
          history.back();
          return;
        }
      }
    }catch(e){}
    location.href = FALLBACK;
  }

  var backBtn = document.getElementById('kgBack');
  if(backBtn){
    backBtn.addEventListener('click', function(e){
      e.preventDefault();
      goBack();
    });
  }

  var canvas = document.getElementById('kgScene');
  if(!canvas) return;
  var ctx = canvas.getContext('2d', { alpha:true });
  if(!ctx) return;

  var reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = reducedMQ.matches;
  var dpr = 1, w = 0, h = 0;
  var particles = [];
  var motes = [];
  var raf = 0;
  var running = false;
  var lastT = 0;
  var pointer = { x:0.5, y:0.42, tx:0.5, ty:0.42 };

  function countForSize(){
    var area = w * h;
    return Math.max(28, Math.min(72, Math.round(area / 14000)));
  }

  function spawnParticle(){
    var depth = 0.25 + Math.random() * 0.75;
    return {
      x: Math.random(),
      y: Math.random(),
      z: depth,
      r: (0.4 + Math.random() * 1.6) * depth,
      a: 0.08 + Math.random() * 0.35 * depth,
      tw: 0.4 + Math.random() * 1.2,
      ph: Math.random() * Math.PI * 2,
      drift: (Math.random() - 0.5) * 0.00012,
      rise: -0.00004 - Math.random() * 0.00008
    };
  }

  function spawnMote(){
    return {
      x: 0.2 + Math.random() * 0.6,
      y: 0.25 + Math.random() * 0.45,
      r: 18 + Math.random() * 48,
      a: 0.02 + Math.random() * 0.04,
      ph: Math.random() * Math.PI * 2,
      tw: 0.15 + Math.random() * 0.25
    };
  }

  function resize(){
    var rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var n = reduced ? Math.min(18, countForSize()) : countForSize();
    particles = [];
    for(var i = 0; i < n; i++) particles.push(spawnParticle());
    motes = [];
    var mn = reduced ? 3 : 6;
    for(var j = 0; j < mn; j++) motes.push(spawnMote());
  }

  function drawRoom(px, py){
    var cx = w * (0.5 + (px - 0.5) * 0.04);
    var cy = h * (0.38 + (py - 0.42) * 0.03);

    /* Soft volumetric core — green room depth */
    var core = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.55);
    core.addColorStop(0, 'rgba(30,90,58,0.22)');
    core.addColorStop(0.35, 'rgba(14,40,28,0.12)');
    core.addColorStop(0.7, 'rgba(6,14,10,0.04)');
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, w, h);

    /* Horizon / floor plane suggestion */
    var floorY = h * 0.72;
    var floor = ctx.createLinearGradient(0, floorY - h * 0.08, 0, h);
    floor.addColorStop(0, 'rgba(0,0,0,0)');
    floor.addColorStop(0.35, 'rgba(4,10,7,0.35)');
    floor.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = floor;
    ctx.fillRect(0, floorY - h * 0.08, w, h - floorY + h * 0.08);

    /* Gentle corner shadows for room enclosure */
    var left = ctx.createLinearGradient(0, 0, w * 0.28, 0);
    left.addColorStop(0, 'rgba(0,0,0,0.45)');
    left.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = left;
    ctx.fillRect(0, 0, w * 0.28, h);

    var right = ctx.createLinearGradient(w, 0, w * 0.72, 0);
    right.addColorStop(0, 'rgba(0,0,0,0.45)');
    right.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = right;
    ctx.fillRect(w * 0.72, 0, w * 0.28, h);
  }

  function drawFrame(t){
    var dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;

    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);

    ctx.clearRect(0, 0, w, h);
    drawRoom(pointer.x, pointer.y);

    var i, p, mx, my, pulse, alpha;

    for(i = 0; i < motes.length; i++){
      p = motes[i];
      pulse = 0.65 + 0.35 * Math.sin(t * 0.001 * p.tw + p.ph);
      mx = (p.x + (pointer.x - 0.5) * 0.03) * w;
      my = (p.y + (pointer.y - 0.42) * 0.02) * h;
      var g = ctx.createRadialGradient(mx, my, 0, mx, my, p.r * pulse);
      g.addColorStop(0, 'rgba(46,155,95,' + (p.a * pulse) + ')');
      g.addColorStop(0.55, 'rgba(0,112,60,' + (p.a * 0.35 * pulse) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(mx, my, p.r * pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    for(i = 0; i < particles.length; i++){
      p = particles[i];
      if(!reduced){
        p.x += p.drift + (pointer.tx - 0.5) * 0.00002;
        p.y += p.rise;
        if(p.y < -0.02){ p.y = 1.02; p.x = Math.random(); }
        if(p.x < -0.02) p.x = 1.02;
        if(p.x > 1.02) p.x = -0.02;
      }
      pulse = 0.55 + 0.45 * Math.sin(t * 0.001 * p.tw + p.ph);
      alpha = p.a * pulse;
      mx = (p.x + (pointer.x - 0.5) * 0.02 * p.z) * w;
      my = (p.y + (pointer.y - 0.42) * 0.015 * p.z) * h;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(232,244,236,' + alpha + ')';
      ctx.arc(mx, my, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Distant soft “stars” for outer-space read */
    ctx.fillStyle = 'rgba(201,184,164,0.08)';
    for(i = 0; i < 12; i++){
      var sx = ((i * 97) % 100) / 100;
      var sy = ((i * 53) % 55) / 100;
      ctx.fillRect(sx * w, sy * h * 0.55, 1.2, 1.2);
    }
  }

  function loop(t){
    if(!running) return;
    drawFrame(t || 0);
    raf = requestAnimationFrame(loop);
  }

  function start(){
    if(running) return;
    running = true;
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function stop(){
    running = false;
    if(raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function onPointer(clientX, clientY){
    if(!w || !h) return;
    pointer.tx = Math.max(0, Math.min(1, clientX / w));
    pointer.ty = Math.max(0, Math.min(1, clientY / h));
  }

  function onMove(e){
    if(reduced) return;
    onPointer(e.clientX, e.clientY);
  }

  function onTouch(e){
    if(reduced || !e.touches || !e.touches[0]) return;
    onPointer(e.touches[0].clientX, e.touches[0].clientY);
  }

  reducedMQ.addEventListener('change', function(){
    reduced = reducedMQ.matches;
    resize();
    if(reduced){
      drawFrame(performance.now());
      stop();
    } else {
      start();
    }
  });

  window.addEventListener('resize', resize, { passive:true });
  window.addEventListener('mousemove', onMove, { passive:true });
  window.addEventListener('touchmove', onTouch, { passive:true });
  document.addEventListener('visibilitychange', function(){
    if(document.hidden) stop();
    else if(!reduced) start();
  });

  resize();
  if(reduced){
    drawFrame(0);
  } else {
    start();
  }
})();
