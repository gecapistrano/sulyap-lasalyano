/* Dark-only site — keep data-theme locked; no light toggle. */
(function(){
  var root = document.documentElement;
  var meta = document.getElementById('theme-color-meta');
  try{ localStorage.removeItem('pm-theme'); }catch(e){}
  root.setAttribute('data-theme', 'dark');
  if(meta) meta.setAttribute('content', '#122018');
})();
