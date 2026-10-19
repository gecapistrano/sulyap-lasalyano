/* Focus helpers, reduced-motion class, and fit-text for nowrap display titles. */
(function(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.documentElement.classList.add('reduce');
  }
  /* Close mobile sheet on focus leave is handled in view-chrome.
     Ensure dialog traps focus via native <dialog>. */

  /* Shrink #nxEduTitle (and same-pattern siblings) to one line within .nx-edu-inner. */
  var FIT_SEL = '.nx-edu-heading';
  var fitRaf = 0;

  function fitOne(el){
    var box = el.closest('.nx-edu-inner') || el.parentElement;
    if(!box) return;
    el.style.fontSize = '';
    var avail = box.clientWidth;
    if(avail <= 0) return;
    if(el.scrollWidth <= avail + 0.5) return;
    var cs = getComputedStyle(el);
    var hi = parseFloat(cs.fontSize) || 40;
    var lo = Math.min(12, hi);
    var best = lo;
    for(var i = 0; i < 14; i++){
      var mid = (lo + hi) / 2;
      el.style.fontSize = mid + 'px';
      if(el.scrollWidth <= avail + 0.5){
        best = mid;
        lo = mid;
      }else{
        hi = mid;
      }
    }
    el.style.fontSize = best + 'px';
  }

  function fitEduHeadings(){
    document.querySelectorAll(FIT_SEL).forEach(fitOne);
  }

  function scheduleFit(){
    if(fitRaf) cancelAnimationFrame(fitRaf);
    fitRaf = requestAnimationFrame(function(){
      fitRaf = 0;
      fitEduHeadings();
    });
  }

  function boot(){
    scheduleFit();
    if(document.fonts && document.fonts.ready){
      document.fonts.ready.then(scheduleFit).catch(function(){});
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }

  window.addEventListener('resize', scheduleFit, {passive:true});
  document.addEventListener('langchange', scheduleFit);

  if(typeof ResizeObserver === 'function'){
    var ro = new ResizeObserver(scheduleFit);
    document.querySelectorAll('.nx-edu-inner').forEach(function(n){ ro.observe(n); });
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', function(){
        document.querySelectorAll('.nx-edu-inner').forEach(function(n){ ro.observe(n); });
      });
    }
  }
})();
