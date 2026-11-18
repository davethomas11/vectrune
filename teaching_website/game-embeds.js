// Keep each game's state while switching between play and its source files.
(() => {
  const initialized = new WeakSet();
  const readyHandlers = new WeakMap();
  let nextId = 0;
  window.addEventListener('message', event => {
    if (event.origin === location.origin && event.data?.type === 'rune-game-ready' && event.source) {
      readyHandlers.get(event.source)?.();
    }
  });

  function enhanceGames() {
    document.querySelectorAll('.web-example[data-game="true"]').forEach(example => {
      if (initialized.has(example)) return;
      initialized.add(example);
      const tabs = [...example.querySelectorAll('[data-example-tab]')];
      const panels = [example.querySelector('.example-game-panel'), example.querySelector('.example-source-panel')];
      const iframe = example.querySelector('.example-preview');
      const id = `game-example-${++nextId}`;
      let resize;

      function select(index, focus = false) {
        example.dataset.activeTab = tabs[index].dataset.exampleTab;
        tabs.forEach((tab, i) => {
          tab.setAttribute('aria-selected', String(i === index));
          tab.tabIndex = i === index ? 0 : -1;
          panels[i].hidden = i !== index;
        });
        if (focus) tabs[index].focus();
        if (index === 0) requestAnimationFrame(() => resize?.());
      }

      tabs.forEach((tab, index) => {
        tab.id = `${id}-tab-${index}`;
        panels[index].id = `${id}-panel-${index}`;
        tab.setAttribute('aria-controls', panels[index].id);
        panels[index].setAttribute('role', 'tabpanel');
        panels[index].setAttribute('aria-labelledby', tab.id);
        tab.addEventListener('click', () => select(index));
        tab.addEventListener('keydown', event => {
          let target;
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') target = 1 - index;
          if (event.key === 'Home') target = 0;
          if (event.key === 'End') target = tabs.length - 1;
          if (target === undefined) return;
          event.preventDefault();
          select(target, true);
        });
      });
      select(0);

      // Same-origin exports let the cabinet grow when menus, touch controls,
      // fonts or responsive layouts change, without an inner scrollbar.
      iframe.setAttribute('scrolling', 'no');
      let observer;
      let loaded = false, retiredDocument = null, legacyDocument = null;
      let poll = 0, slowTimer = 0;
      const loader = example.querySelector('.game-loader');
      const status = example.querySelector('.game-load-status');
      const progress = example.querySelector('.game-load-progress');
      const retry = example.querySelector('.game-load-retry');
      function documentForGame() {
        try {
          const doc = iframe.contentDocument;
          return doc && doc !== retiredDocument && doc.URL !== 'about:blank' ? doc : null;
        } catch { return null; }
      }
      function stopWaiting() { clearInterval(poll); clearTimeout(slowTimer); }
      function reveal(doc) {
        if (!loaded || !iframe.isConnected || doc !== documentForGame() || example.dataset.loadState === 'ready') return;
        stopWaiting();
        example.dataset.loadState = 'ready';
        panels[0].setAttribute('aria-busy', 'false');
        iframe.removeAttribute('inert');
        iframe.removeAttribute('aria-hidden');
        iframe.removeAttribute('tabindex');
        if (loader) loader.hidden = true;
        resize?.();
      }
      function checkReady() {
        if (!iframe.isConnected) { stopWaiting(); observer?.disconnect(); return; }
        const doc = loaded && documentForGame();
        if (!doc) return;
        if (doc.documentElement.dataset.runeGameState === 'ready') { reveal(doc); return; }
        if (doc.documentElement.dataset.runeGameState === 'loading' || legacyDocument === doc) return;
        // An older cached export has no handshake. Let navigation settle on the
        // host's clock; covered child frames can be throttled by the browser.
        const win = iframe.contentWindow;
        if (win.__RunePixel || win.__RunePixel3D || win.runeWebApp) {
          legacyDocument = doc;
          requestAnimationFrame(() => requestAnimationFrame(() => reveal(doc)));
        }
      }
      function showProblem(kind) {
        if (example.dataset.loadState === 'ready') return;
        example.dataset.loadState = kind;
        if (status) status.textContent = kind === 'slow' ? status.dataset.slow : status.dataset.failed;
        if (progress) progress.hidden = kind === 'error';
        if (retry) retry.hidden = false;
        panels[0].setAttribute('aria-busy', kind === 'slow' ? 'true' : 'false');
      }
      function startWaiting() {
        stopWaiting();
        // Render behind the opaque loading panel: hiding the iframe itself can
        // suspend WebKit's first animation frame and prevent its ready signal.
        example.dataset.loadState = 'loading';
        panels[0].setAttribute('aria-busy', 'true');
        iframe.setAttribute('inert', '');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.tabIndex = -1;
        if (loader) loader.hidden = false;
        if (status) status.textContent = status.dataset.loading;
        if (progress) progress.hidden = false;
        if (retry) retry.hidden = true;
        poll = setInterval(checkReady, 100);
        slowTimer = setTimeout(() => showProblem('slow'), 30000);
      }
      function fit() {
        observer?.disconnect();
        const body = documentForGame()?.body;
        if (!body) return;
        body.classList.add('rune-embedded-game');
        resize = () => {
          if (!iframe.isConnected) {
            observer.disconnect();
            return;
          }
          if (body.ownerDocument !== documentForGame() || example.dataset.loadState !== 'ready' ||
              panels[0].hidden || iframe.classList.contains('iframe-fullscreen')) return;
          const style = iframe.contentWindow.getComputedStyle(body);
          const margin = parseFloat(style.marginTop) + parseFloat(style.marginBottom);
          const border = getComputedStyle(iframe);
          const chrome = parseFloat(border.borderTopWidth) + parseFloat(border.borderBottomWidth);
          const height = Math.ceil(Math.max(body.scrollHeight, body.getBoundingClientRect().height) + margin + chrome);
          if (height > 2 && iframe.style.height !== `${height}px`) iframe.style.height = `${height}px`;
        };
        // Resize outside observer delivery so changing the iframe's viewport
        // cannot trigger a nested layout notification in Safari.
        let resizePending = false;
        observer = new ResizeObserver(() => {
          if (resizePending) return;
          resizePending = true;
          requestAnimationFrame(() => { resizePending = false; resize(); });
        });
        observer.observe(body);
        resize();
        iframe.contentDocument.fonts.ready.then(resize);
      }
      function onLoad() {
        if (!documentForGame()) return;
        loaded = true;
        retiredDocument = null;
        fit();
        checkReady();
      }
      if (iframe.contentWindow) readyHandlers.set(iframe.contentWindow, checkReady);
      iframe.addEventListener('load', onLoad);
      iframe.addEventListener('error', () => { clearTimeout(slowTimer); showProblem('error'); });
      retry?.addEventListener('click', () => {
        retiredDocument = iframe.contentDocument;
        legacyDocument = null;
        loaded = false;
        observer?.disconnect();
        startWaiting();
        iframe.src = iframe.src;
      });
      startWaiting();
      if (documentForGame()?.readyState === 'complete') onLoad();
    });
  }

  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhanceGames();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
  enhanceGames();
})();
