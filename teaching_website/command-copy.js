document.addEventListener('click', async event => {
  const button = event.target.closest('.command-copy');
  if (!button) return;
  const source = button.closest('.command-block')?.querySelector('code');
  if (!source) return;
  const label = button.textContent;
  try {
    await navigator.clipboard.writeText(source.textContent);
    button.textContent = button.dataset.copied;
  } catch (_) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(source);
    selection?.removeAllRanges();
    selection?.addRange(range);
    button.textContent = button.dataset.failed;
  }
  setTimeout(() => { button.textContent = label; }, 2500);
});
