/* Warm ivory/gold dust motes + soft shooting streaks.
   Mounts on sticky header (#bar) and Sulyap section (#nx-gallery).
   Canvas sits behind content; pauses when offscreen or tab-hidden. */
(function(){
  var COLORS = [
    'rgba(247,244,239,',
    'rgba(232,212,138,',
    'rgba(196,164,132,',
    'rgba(168,196,170,'
  ];

  function mountParticles(host, opts){
    if(!host) return;
    opts = opts || {};
    var className = opts.className || 'bar-particles';
    var density = opts.density || 3000;
    var minN = opts.min != null ? opts.min : 18;
    var maxN = opts.max != null ? opts.max : 40;
    var insertBefore = opts.insertBefore || null;

    var canvas = document.createElement('canvas');
    canvas.className = className;
    canvas.setAttribute('aria-hidden', 'true');
    if(insertBefore && insertBefore.parentNode === host){
      host.insertBefore(canvas, insertBefore);
    } else {
      host.insertBefore(canvas, host.firstChild);
    }

    var ctx = canvas.getContext('2d', {alpha:true});
    if(!ctx) return;

    var reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
    var reduced = reducedMQ.matches;
    var dpr = 1, w = 0, h = 0;
    var particles = [];
    var streaks = [];
    var raf = 0;
    var running = false;
    var visible = true;
    var lastT = 0;
    var nextStreak = 0;

    function countForSize(){
      var area = w * h;
      return Math.max(minN, Math.min(maxN, Math.round(area / density)));
    }

    function spawnParticle(){
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.35 + Math.random() * 1.15,
        a: 0.12 + Math.random() * 0.42,
        tw: 0.35 + Math.random() * 1.1,
        ph: Math.random() * Math.PI * 2,
        vx: (Math.random() - 0.5) * 0.07,
        vy: (Math.random() - 0.5) * 0.05,
        c: COLORS[(Math.random() * COLORS.length) | 0]
      };
    }

    function spawnStreak(){
      var fromTop = Math.random() > 0.3;
      var ang = Math.PI * 0.2 + Math.random() * 0.2;
      var speed = 2.0 + Math.random() * 2.2;
      return {
        x: Math.random() * w * 0.88,
        y: fromTop ? -6 : Math.random() * h * 0.45,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        len: 24 + Math.random() * 44,
        life: 0,
        max: 0.5 + Math.random() * 0.5,
        a: 0.28 + Math.random() * 0.22
      };
    }

    function resize(){
      var rect = host.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var n = countForSize();
      if(particles.length !== n){
        particles = [];
        for(var i = 0; i < n; i++) particles.push(spawnParticle());
      }
      if(reduced) drawStatic();
    }

    function drawStatic(){
      ctx.clearRect(0, 0, w, h);
      for(var i = 0; i < particles.length; i++){
        var p = particles[i];
        ctx.beginPath();
        ctx.fillStyle = p.c + (p.a * 0.5).toFixed(3) + ')';
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function tick(t){
      raf = 0;
      if(!running || !visible || document.hidden) return;
      if(!lastT) lastT = t;
      var dt = Math.min(32, t - lastT) / 16.67;
      lastT = t;

      ctx.clearRect(0, 0, w, h);

      for(var i = 0; i < particles.length; i++){
        var p = particles[i];
        p.ph += p.tw * 0.04 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if(p.x < -2) p.x = w + 2;
        else if(p.x > w + 2) p.x = -2;
        if(p.y < -2) p.y = h + 2;
        else if(p.y > h + 2) p.y = -2;
        var alpha = p.a * (0.55 + 0.45 * Math.sin(p.ph));
        ctx.beginPath();
        ctx.fillStyle = p.c + alpha.toFixed(3) + ')';
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if(t > nextStreak && streaks.length < 2){
        streaks.push(spawnStreak());
        nextStreak = t + 2800 + Math.random() * 5200;
      }

      for(var s = streaks.length - 1; s >= 0; s--){
        var st = streaks[s];
        st.life += 0.016 * dt;
        st.x += st.vx * dt;
        st.y += st.vy * dt;
        var fade = 1 - st.life / st.max;
        if(fade <= 0 || st.x > w + 48 || st.y > h + 48){
          streaks.splice(s, 1);
          continue;
        }
        var hyp = Math.hypot(st.vx, st.vy) || 1;
        var tx = st.x - (st.vx / hyp) * st.len;
        var ty = st.y - (st.vy / hyp) * st.len;
        var g = ctx.createLinearGradient(tx, ty, st.x, st.y);
        g.addColorStop(0, 'rgba(247,244,239,0)');
        g.addColorStop(0.5, 'rgba(232,212,138,' + (st.a * fade * 0.4).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(247,244,239,' + (st.a * fade).toFixed(3) + ')');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.05;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(st.x, st.y);
        ctx.stroke();
      }

      raf = requestAnimationFrame(tick);
    }

    function start(){
      if(reduced || running) return;
      running = true;
      lastT = 0;
      nextStreak = performance.now() + 900 + Math.random() * 1400;
      if(!raf) raf = requestAnimationFrame(tick);
    }

    function stop(){
      running = false;
      if(raf){ cancelAnimationFrame(raf); raf = 0; }
    }

    function syncRun(){
      if(reduced) return;
      if(visible && !document.hidden) start();
      else stop();
    }

    resize();
    if(reduced) drawStatic();
    else syncRun();

    if(typeof ResizeObserver !== 'undefined'){
      new ResizeObserver(function(){ resize(); }).observe(host);
    } else {
      addEventListener('resize', resize);
    }

    if(typeof IntersectionObserver !== 'undefined'){
      new IntersectionObserver(function(entries){
        visible = !!(entries[0] && entries[0].isIntersecting);
        syncRun();
        if(reduced && visible) drawStatic();
      }, {threshold:0}).observe(host);
    }

    document.addEventListener('visibilitychange', syncRun);

    function onReduceChange(e){
      reduced = e.matches;
      streaks = [];
      stop();
      resize();
      if(reduced) drawStatic();
      else syncRun();
    }
    if(reducedMQ.addEventListener) reducedMQ.addEventListener('change', onReduceChange);
    else if(reducedMQ.addListener) reducedMQ.addListener(onReduceChange);
  }

  var bar = document.getElementById('bar');
  mountParticles(bar, {className:'bar-particles', density:3000, min:18, max:40});

  var nx = document.getElementById('nx-gallery');
  if(nx){
    mountParticles(nx, {
      className:'nx-edu-particles',
      density:12000,
      min:28,
      max:64,
      insertBefore: nx.querySelector('.nx-edu-inner')
    });
  }
})();
