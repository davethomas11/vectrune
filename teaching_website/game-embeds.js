// Keep each game's state while switching between play and its source files.
(() => {
  const initialized = new WeakSet();
  let nextId = 0;

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
      function fit() {
        observer?.disconnect();
        const body = iframe.contentDocument?.body;
        if (!body) return;
        resize = () => {
          if (!iframe.isConnected) {
            observer.disconnect();
            return;
          }
          if (panels[0].hidden || iframe.classList.contains('iframe-fullscreen')) return;
          const style = iframe.contentWindow.getComputedStyle(body);
          const margin = parseFloat(style.marginTop) + parseFloat(style.marginBottom);
          const border = getComputedStyle(iframe);
          const chrome = parseFloat(border.borderTopWidth) + parseFloat(border.borderBottomWidth);
          const height = Math.ceil(Math.max(body.scrollHeight, body.getBoundingClientRect().height) + margin + chrome);
          if (height > 2 && iframe.style.height !== `${height}px`) iframe.style.height = `${height}px`;
        };
        observer = new ResizeObserver(resize);
        observer.observe(body);
        resize();
        iframe.contentDocument.fonts.ready.then(resize);
      }
      iframe.addEventListener('load', fit);
      if (iframe.contentDocument?.readyState === 'complete') fit();
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
