// The complete index is also rendered as HTML for browsing without JavaScript.
(() => {
  const input = document.getElementById('reference-search');
  const category = document.getElementById('reference-category');
  if (!input || !category) return;
  const panel = document.getElementById('search-panel');
  const content = document.getElementById('reference-content');
  const results = document.getElementById('search-results');
  const status = document.getElementById('search-status');
  const normalize = text => String(text).normalize('NFKD').toLowerCase();
  let indexPromise;
  let request = 0;
  let searching = false;
  const loadIndex = () => indexPromise ||= fetch(document.body.dataset.searchIndex).then(response => {
    if (!response.ok) throw new Error('Search index could not be loaded');
    return response.json();
  }).then(entries => entries.map(entry => ({ ...entry, searchable: normalize(entry.text + ' ' + entry.runtime + ' ' + entry.category_title) })));
  const element = (tag, text) => {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  };

  async function search(updateUrl = true) {
    const current = ++request;
    const query = normalize(input.value.trim());
    const topic = category.value;
    const active = Boolean(query || topic);
    panel.hidden = !active;
    content.hidden = active;
    if (updateUrl) {
      const url = new URL(location.href);
      if (input.value.trim()) url.searchParams.set('q', input.value.trim()); else url.searchParams.delete('q');
      if (topic) url.searchParams.set('topic', topic); else url.searchParams.delete('topic');
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
    if (!active) { searching = false; return; }
    if (!searching && !matchMedia('(max-width:700px)').matches) document.getElementById('docs-main').scrollIntoView({ behavior:'instant', block:'start' });
    searching = true;
    status.textContent = 'Searching…';
    results.replaceChildren();
    try {
      const entries = await loadIndex();
      if (current !== request) return;
      const terms = query.split(/\s+/).filter(Boolean);
      const found = entries.filter(entry => (!topic || entry.category === topic) && terms.every(term => entry.searchable.includes(term)));
      const score = entry => {
        const name = normalize(entry.name);
        return (name === query ? 1000 : name.startsWith(query) && query ? 200 : 0)
          + (entry.aliases.some(alias => normalize(alias) === query) ? 500 : 0)
          + terms.reduce((sum, term) => sum + (name.includes(term) ? 30 : 0), 0);
      };
      found.sort((a,b) => score(b) - score(a) || a.name.localeCompare(b.name));
      const fragment = document.createDocumentFragment();
      for (const entry of found) {
        const item = element('li', '');
        const link = element('a', entry.name);
        link.href = entry.url;
        item.append(link, element('small', ' — ' + entry.category_title + ' · ' + entry.runtime));
        const signature = element('pre', '');
        signature.append(element('code', entry.signature));
        item.append(signature, element('p', entry.summary));
        fragment.append(item);
      }
      results.replaceChildren(fragment);
      status.textContent = found.length ? `${found.length} ${found.length === 1 ? 'entry' : 'entries'} found.` : 'No matching entries. Try a function name, alias, field, or broader topic.';
    } catch (_) {
      indexPromise = undefined;
      if (current !== request) return;
      status.textContent = 'Search is temporarily unavailable. Clear the search to browse the reference and A–Z index.';
    }
  }
  const restoreQuery = () => {
    const query = new URLSearchParams(location.search);
    input.value = query.get('q') || '';
    category.value = query.get('topic') || '';
    search(false);
  };
  input.addEventListener('input', () => search());
  category.addEventListener('change', () => search());
  document.querySelector('.docs-search').addEventListener('submit', event => { event.preventDefault(); search(); });
  document.getElementById('clear-search').addEventListener('click', () => { input.value=''; category.value=''; search(); input.focus(); });
  window.addEventListener('popstate', restoreQuery);
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); input.focus(); }
    if (event.key === 'Escape' && document.activeElement === input) { input.value=''; category.value=''; search(); }
  });
  const menu = document.querySelector('.docs-menu');
  const narrow = matchMedia('(max-width:700px)');
  if (menu) {
    menu.open = !narrow.matches;
    narrow.addEventListener('change', event => { menu.open = !event.matches; });
  }
  for (const link of document.querySelectorAll('.docs-menu a')) {
    if (new URL(link.href).pathname.replace(/\/$/,'') === location.pathname.replace(/\/$/,'')) link.setAttribute('aria-current','page');
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('.docs-copy');
    if (!button) return;
    const source = button.closest('.code-example').querySelector('code');
    try {
      await navigator.clipboard.writeText(source.textContent);
      button.textContent='Copied';
    } catch (_) {
      const range = document.createRange();
      range.selectNodeContents(source);
      const selection = getSelection();
      selection.removeAllRanges(); selection.addRange(range);
      button.textContent='Select and copy';
    }
    setTimeout(() => { button.textContent='Copy'; }, 2000);
  });
  restoreQuery();
})();
