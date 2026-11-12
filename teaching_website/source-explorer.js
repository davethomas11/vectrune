// Progressive enhancement for the native, keyboard-accessible source disclosures.
(() => {
  const initialized = new WeakSet();
  let nextId = 0;
  function enhance() {
    document.querySelectorAll('.example-source').forEach(explorer => {
      if (initialized.has(explorer)) return;
      initialized.add(explorer);
      const files = [...explorer.querySelectorAll('.source-file')];
      const filter = explorer.querySelector('.source-filter');
      if (!filter || !files.length) return;
      const group = `source-explorer-${++nextId}`;
      const count = explorer.querySelector('.source-count');
      const empty = explorer.querySelector('.source-empty');
      files.forEach((file, index) => {
        file.setAttribute('name', group);
        file.open = index === 0;
        const path = file.querySelector('summary').textContent;
        const code = () => file.querySelector('code').textContent;
        const copy = file.querySelector('.source-copy');
        const label = copy.textContent;
        copy.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(code());
            copy.textContent = copy.dataset.copied;
          } catch (_) {
            copy.textContent = copy.dataset.failed;
          }
          setTimeout(() => { copy.textContent = label; }, 2500);
        });
        file.querySelector('.source-download').addEventListener('click', () => {
          const url = URL.createObjectURL(new Blob([code()], { type: 'text/plain;charset=utf-8' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = path.split('/').pop();
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
      });
      function update() {
        const query = filter.value.trim().toLowerCase();
        files.forEach(file => {
          file.hidden = !file.querySelector('summary').textContent.toLowerCase().includes(query);
        });
        const visible = files.filter(file => !file.hidden);
        count.textContent = `${visible.length} / ${files.length}`;
        empty.hidden = visible.length > 0;
        if (!visible.some(file => file.open) && visible[0]) visible[0].open = true;
      }
      filter.addEventListener('input', update);
      update();
    });
  }
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; enhance(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  enhance();
})();
