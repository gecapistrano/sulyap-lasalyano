/* Focus management helpers and reduced-motion class. */
(function(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.documentElement.classList.add('reduce');
  }
  /* Close mobile sheet on focus leave is handled in view-chrome.
     Ensure dialog traps focus via native <dialog>. */
})();
