/* Inline SVG artwork — no external images. */
(function(){
  function style(v){ return 'style="fill:var('+v+')"'; }
  function arch(cx,y,w,h,lit){
    var r = w/2;
    return '<path d="M'+(cx-r)+' '+(y+h)+'V'+(y+r)+'A'+r+' '+r+' 0 0 1 '+(cx+r)+' '+(y+r)+'V'+(y+h)+'Z" style="fill:'+(lit?'#F2FFF7':'#00351C')+'"/>';
  }
  function facade(x,w,base,h){
    var top = base-h, f = 'fill="#004D29"', s = '';
    s += '<rect x="'+x+'" y="'+top+'" width="'+w+'" height="'+h+'" '+f+'/>';
    s += '<rect x="'+(x-12)+'" y="'+(top-12)+'" width="'+(w+24)+'" height="14" '+f+'/>';
    var pw = Math.round(w*0.26), px = x+w/2-pw/2, ph = Math.round(h*0.38), cx = x+w/2, peak = top-ph-pw*0.27;
    s += '<rect x="'+px+'" y="'+(top-ph)+'" width="'+pw+'" height="'+(ph+4)+'" '+f+'/>';
    s += '<polygon points="'+(px-16)+','+(top-ph)+' '+cx+','+peak+' '+(px+pw+16)+','+(top-ph)+'" '+f+'/>';
    var cols = Math.floor(w/62), gap = w/cols, r, c, wx, yy;
    for(r=0;r<2;r++){
      yy = top+30+r*((h-70)/2);
      for(c=0;c<cols;c++){
        wx = x+gap*(c+.5);
        if(Math.abs(wx-cx)<38 && r===1) continue;
        s += arch(wx,yy,22,44,((c*7+r*11+3)%5)<2);
      }
    }
    s += arch(cx,base-92,46,92,false);
    return s;
  }
  function tree(cx,base,k){
    return '<rect x="'+(cx-6*k)+'" y="'+(base-90*k)+'" width="'+(12*k)+'" height="'+(90*k)+'" fill="#00301A"/>'+
      '<circle cx="'+cx+'" cy="'+(base-130*k)+'" r="'+(50*k)+'" fill="#00301A"/>'+
      '<circle cx="'+(cx-34*k)+'" cy="'+(base-100*k)+'" r="'+(38*k)+'" fill="#00301A"/>'+
      '<circle cx="'+(cx+34*k)+'" cy="'+(base-100*k)+'" r="'+(38*k)+'" fill="#00301A"/>';
  }
  function svg(vb,inner,ar){
    return '<svg viewBox="'+vb+'" preserveAspectRatio="'+(ar||'xMidYMid slice')+'" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+inner+'</svg>';
  }

  function star(cx,cy,R,r,n){
    var p='', i, a, d;
    for(i=0;i<n*2;i++){
      a = Math.PI/n*i - Math.PI/2; d = i%2 ? r : R;
      p += (cx+Math.cos(a)*d).toFixed(1)+','+(cy+Math.sin(a)*d).toFixed(1)+' ';
    }
    return p;
  }

  window.pmArt = function(i, id){
    var defs = '<defs><linearGradient id="gold'+id+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#E3F0E8"/><stop offset="1" stop-color="#B5D3C3"/></linearGradient><linearGradient id="bg'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00703C"/><stop offset="1" stop-color="#004D29"/></linearGradient></defs>';
    var G = 'url(#gold'+id+')';
    var b = '<rect width="400" height="300" fill="url(#bg'+id+')"/><ellipse cx="200" cy="270" rx="130" ry="9" fill="#000" opacity=".28"/>';
    if(i===0){
      b += '<polygon points="150,14 192,14 214,112 172,112" fill="#003B20"/><polygon points="250,14 208,14 186,112 228,112" fill="#B5D3C3"/>'+
        '<circle cx="200" cy="170" r="82" fill="'+G+'"/><circle cx="200" cy="170" r="68" fill="none" stroke="#00703C" stroke-width="2"/>'+
        '<circle cx="200" cy="170" r="56" fill="#00703C"/><polygon points="'+star(200,170,36,15,5)+'" fill="'+G+'"/>';
    } else if(i===1){
      b += '<rect x="112" y="22" width="176" height="238" rx="4" fill="'+G+'"/><rect x="126" y="36" width="148" height="210" fill="#004D29"/>'+
        '<ellipse cx="200" cy="140" rx="62" ry="86" fill="#00703C"/><circle cx="200" cy="122" r="26" fill="#FFFFFF" opacity=".92"/>'+
        '<path d="M148 246C148 184 252 184 252 246Z" fill="#FFFFFF" opacity=".92"/>';
    } else if(i===2){
      b += '<rect x="124" y="238" width="152" height="24" rx="4" fill="#003B20"/>'+
        '<g transform="rotate(35 200 200)"><rect x="195" y="70" width="10" height="112" rx="4" fill="#E3F0E8"/>'+
        '<rect x="150" y="178" width="100" height="44" rx="6" fill="#FFFFFF"/></g>';
    } else {
      b += '<rect x="92" y="32" width="216" height="226" rx="3" fill="#FFFFFF"/>'+
        '<rect x="120" y="60" width="160" height="9" fill="#00703C"/>'+
        '<rect x="120" y="92" width="160" height="6" fill="#BFD9CB"/><rect x="120" y="108" width="148" height="6" fill="#BFD9CB"/>'+
        '<rect x="120" y="124" width="160" height="6" fill="#BFD9CB"/><rect x="120" y="140" width="108" height="6" fill="#BFD9CB"/>'+
        '<circle cx="252" cy="218" r="24" fill="#00703C"/><polygon points="'+star(252,218,13,5.5,5)+'" fill="#FFFFFF"/>';
    }
    return '<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+defs+b+'</svg>';
  };

  function buildStage(){
    var building = document.getElementById('buildingArt');
    if(building){
      building.innerHTML = svg('0 0 1200 514',
        '<defs><linearGradient id="skyB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00703C"/><stop offset="1" stop-color="#D4EBDF"/></linearGradient></defs>'+
        '<rect width="1200" height="514" fill="url(#skyB)"/>'+
        '<path d="M0 420C250 395 500 410 700 405C900 400 1050 385 1200 405V514H0Z" fill="#003B20"/>'+
        facade(160,880,470,190)+tree(70,500,.8)+tree(1130,500,.8)+
        '<path d="M0 480C300 470 900 470 1200 480V514H0Z" fill="#001F12"/>');
    }
    var photo = document.getElementById('devPhoto');
    if(photo){
      photo.innerHTML = svg('0 0 400 480',
        '<defs><linearGradient id="dp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00703C"/><stop offset="1" stop-color="#004D29"/></linearGradient></defs>'+
        '<rect width="400" height="480" fill="url(#dp)"/><circle cx="200" cy="190" r="62" fill="#FFFFFF" opacity=".85"/><path d="M70 480C70 350 330 350 330 480Z" fill="#FFFFFF" opacity=".85"/>');
    }
    var sil = document.getElementById('stageSilhouette');
    if(sil){
      sil.innerHTML = svg('0 0 400 600',
        '<defs><linearGradient id="sil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00703C"/><stop offset="1" stop-color="#004D29"/></linearGradient></defs>'+
        '<rect width="400" height="600" fill="transparent"/>'+
        '<ellipse cx="200" cy="560" rx="140" ry="18" fill="#000" opacity=".2"/>'+
        '<circle cx="200" cy="160" r="70" fill="url(#sil)"/>'+
        '<path d="M80 560 C80 340 320 340 320 560Z" fill="url(#sil)"/>'+
        '<rect x="155" y="250" width="90" height="12" rx="2" fill="#F7F4EF" opacity=".35"/>');
    }
    document.querySelectorAll('.sticker .badge[data-art]').forEach(function(el){
      var i = +el.dataset.art;
      el.innerHTML = window.pmArt(i, 'st'+i);
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildStage);
  else buildStage();
})();
