/* Gallery grid + native <dialog> lightbox with wrap-around nav. */
(function(){
  var grid = document.getElementById('grid');
  var lb = document.getElementById('lb');
  if(!grid || !lb) return;

  var current = 0;

  function items(){
    var L = window.pmLang ? window.pmLang() : 'en';
    return (window.T && window.T[L] && window.T[L].items) || [];
  }

  function render(){
    var list = items();
    var esc = window.pmEsc || function(s){ return s; };
    var fmt = window.pmFmt || function(s){ return s; };
    grid.innerHTML = list.map(function(it, i){
      return '<button class="card" type="button" data-idx="'+i+'">'+
        '<div class="art" data-fail="">'+(window.pmArt ? window.pmArt(i,'c'+i) : '')+'</div>'+
        '<div class="cap"><h3>'+esc(it.t)+'</h3><p>'+fmt(it.d)+'</p></div></button>';
    }).join('');
  }

  function showItem(i){
    var list = items();
    var n = list.length || 1;
    current = ((i % n) + n) % n;
    var it = list[current];
    var fmt = window.pmFmt || function(s){ return s; };
    document.getElementById('lbArt').innerHTML = window.pmArt ? window.pmArt(current,'lb') : '';
    document.getElementById('lbTitle').textContent = it.t;
    document.getElementById('lbDesc').innerHTML = fmt(it.d);
  }

  grid.addEventListener('click', function(e){
    var c = e.target.closest('.card');
    if(!c) return;
    showItem(+c.dataset.idx);
    lb.showModal();
  });

  document.getElementById('lbClose').addEventListener('click', function(){ lb.close(); });
  document.getElementById('lbPrev').addEventListener('click', function(){ showItem(current - 1); });
  document.getElementById('lbNext').addEventListener('click', function(){ showItem(current + 1); });
  lb.addEventListener('click', function(e){ if(e.target === lb) lb.close(); });
  lb.addEventListener('keydown', function(e){
    if(e.key === 'ArrowLeft'){ e.preventDefault(); showItem(current - 1); }
    if(e.key === 'ArrowRight'){ e.preventDefault(); showItem(current + 1); }
  });

  document.addEventListener('langchange', function(){
    render();
    if(lb.open) showItem(current);
  });

  render();
  window.pmRenderGallery = render;
})();
