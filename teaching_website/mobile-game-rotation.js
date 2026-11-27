// The game exports use the existing fullscreen control and its browser fallback.
(() => {
  let host = window;
  try {
    if (window.parent !== window && window.parent.location.origin === location.origin) host = window.parent;
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== 'SecurityError') throw error;
  }
  const orientation = host.matchMedia('(orientation: landscape)');
  const touch = host.matchMedia('(pointer: coarse)');
  const surface = document.querySelector('.game-surface');
  const fullscreen = document.querySelector('.toolbar [data-pixel-fullscreen]');
  if (!surface || !fullscreen) return;
  document.documentElement.dataset.gameRotation = 'true';
  const settings = document.querySelector('.toolbar-settings');
  if (settings && matchMedia('(pointer: coarse) and (max-width: 480px)').matches) settings.open = false;
  const ios = /iPhone|iPod/.test(host.navigator.userAgent);
  let cancelScrollPrompt = null;
  const stylesheetUrl = new URL('mobile-game-rotation.css', document.currentScript.src).href;

  function visible(element, viewport) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 &&
      rect.bottom > 0 && rect.right > 0 && rect.top < viewport.innerHeight && rect.left < viewport.innerWidth;
  }

  function prepareScroll() {
    const doc = host.document;
    if (!doc.querySelector('link[data-game-rotation-style]')) {
      const style = doc.createElement('link');
      style.rel = 'stylesheet';
      style.href = stylesheetUrl;
      style.dataset.gameRotationStyle = 'true';
      doc.head.append(style);
    }
    const originalScroll = host.scrollY;
    const spacer = doc.createElement('div');
    spacer.style.height = '100vh';
    spacer.setAttribute('aria-hidden', 'true');
    const prompt = doc.createElement('div');
    prompt.className = 'game-rotation-scroll-prompt';
    prompt.setAttribute('role', 'dialog');
    prompt.setAttribute('aria-modal', 'true');
    const language = doc.documentElement.lang.toLowerCase();
    const text = language.startsWith('es')
      ? ['Desliza hacia arriba para ocultar los controles del navegador.', 'Jugar ahora']
      : language.startsWith('fr')
        ? ['Balayez vers le haut pour masquer les commandes du navigateur.', 'Jouer maintenant']
        : ['Swipe up to hide the browser controls.', 'Play now'];
    const message = doc.createElement('p');
    message.textContent = text[0];
    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = text[1];
    prompt.setAttribute('aria-label', text[0]);
    prompt.append(message, button);
    doc.body.append(spacer, prompt);
    button.focus({ preventScroll: true });
    let active = true;
    let moved = false, didScroll = false, released = false, scrollTimer = 0;
    function cleanup() {
      if (!active) return;
      active = false;
      host.clearTimeout(scrollTimer);
      host.removeEventListener('scroll', onScroll);
      host.removeEventListener('touchmove', onTouchMove);
      host.removeEventListener('touchend', onTouchEnd);
      host.removeEventListener('touchcancel', onTouchEnd);
      button.removeEventListener('click', finish);
      prompt.remove();
      cancelScrollPrompt = null;
    }
    function removeSpacer() {
      spacer.remove();
      host.scrollTo(host.scrollX, originalScroll);
    }
    function finish() {
      if (!active) return;
      cleanup();
      const afterExit = () => {
        if (!surface.classList.contains('rune-pixel3d-expanded') &&
            document.fullscreenElement !== surface && document.webkitFullscreenElement !== surface) {
          observer.disconnect();
          document.removeEventListener('fullscreenchange', afterExit);
          document.removeEventListener('webkitfullscreenchange', afterExit);
          removeSpacer();
        }
      };
      const observer = new MutationObserver(afterExit);
      observer.observe(surface, { attributes: true, attributeFilter: ['class'] });
      document.addEventListener('fullscreenchange', afterExit);
      document.addEventListener('webkitfullscreenchange', afterExit);
      fullscreen.click();
      host.setTimeout(() => {
        if (!surface.classList.contains('rune-pixel3d-expanded') &&
            document.fullscreenElement !== surface && document.webkitFullscreenElement !== surface) {
          observer.disconnect();
          document.removeEventListener('fullscreenchange', afterExit);
          document.removeEventListener('webkitfullscreenchange', afterExit);
          removeSpacer();
        }
      }, 1000);
    }
    function scheduleFinish() {
      if (!released || !didScroll) return;
      host.clearTimeout(scrollTimer);
      scrollTimer = host.setTimeout(finish, 300);
    }
    function onTouchMove() { moved = true; }
    function onTouchEnd() { released = true; scheduleFinish(); }
    function onScroll() {
      if (moved) { didScroll = true; scheduleFinish(); }
    }
    host.addEventListener('touchmove', onTouchMove, { passive: true });
    host.addEventListener('touchend', onTouchEnd, { passive: true });
    host.addEventListener('touchcancel', onTouchEnd, { passive: true });
    host.addEventListener('scroll', onScroll, { passive: true });
    button.addEventListener('click', finish);
    cancelScrollPrompt = () => { cleanup(); removeSpacer(); };
  }

  orientation.addEventListener('change', event => {
    if (!event.matches) { cancelScrollPrompt?.(); return; }
    if (!touch.matches || cancelScrollPrompt) return;
    host.requestAnimationFrame(() => {
      if (!orientation.matches || document.hidden || host.document.hidden ||
          document.fullscreenElement || document.webkitFullscreenElement ||
          surface.classList.contains('rune-pixel3d-expanded')) return;
      const frame = host === window ? null : window.frameElement;
      if (frame) {
        const panel = frame.closest('.example-game-panel');
        const intro = host.document.querySelector('.showcase-intro');
        if (!panel || panel.hidden || frame.hasAttribute('inert') ||
            (!visible(frame, host) && !(intro && visible(intro, host)))) return;
      } else {
        const prompt = document.querySelector('.rotate-to-play');
        if (!visible(surface, window) && !(prompt && visible(prompt.parentElement, window))) return;
      }
      if (ios) prepareScroll();
      else fullscreen.click();
    });
  });
  window.addEventListener('pagehide', () => cancelScrollPrompt?.());
})();
