// Rotate artwork only while its carousel is in view.
(() => {
  const delay = 6000;

  function setup() {
    const root = document.getElementById('app');
    if (!root) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const previews = new Map();

    function schedule(preview) {
      clearTimeout(preview.timer);
      if (!preview.playing || !preview.visible || document.hidden || preview.hover || preview.focused) return;
      preview.timer = setTimeout(() => show(preview, 1, false), delay);
    }

    function show(preview, step, manual) {
      preview.slides[preview.index].hidden = true;
      preview.index = (preview.index + step + preview.slides.length) % preview.slides.length;
      const slide = preview.slides[preview.index];
      slide.hidden = false;
      preview.count.textContent = `${preview.index + 1} / ${preview.slides.length}`;
      if (manual) {
        preview.status.textContent = `${preview.count.textContent} · ${slide.querySelector('strong').textContent}`;
      }
      if (!motion.matches) {
        slide.animate([
          { opacity: 0, transform: `translateX(${step * 12}px)` },
          { opacity: 1, transform: 'none' },
        ], { duration: 210, easing: 'ease-out' });
      }
      schedule(preview);
    }

    function setPlaying(preview, playing) {
      preview.playing = playing;
      preview.toggle.textContent = playing ? preview.toggle.dataset.pause : preview.toggle.dataset.play;
      schedule(preview);
    }

    const viewport = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const preview = previews.get(entry.target);
        if (!preview) continue;
        preview.visible = entry.intersectionRatio >= 0.25;
        if (preview.visible) {
          for (const slide of preview.slides) slide.querySelector('img').loading = 'eager';
        }
        schedule(preview);
      }
    }, { threshold: 0.25 });

    function mount(element) {
      if (previews.has(element)) return;
      const slides = [...element.querySelectorAll('.game-preview-slide')];
      const controls = element.querySelector('.game-preview-controls');
      const preview = {
        slides, index: 0,
        count: controls.querySelector('.game-preview-count'),
        toggle: controls.querySelector('[data-preview-toggle]'),
        status: element.querySelector('.game-preview-status'),
      };
      previews.set(element, preview);
      slides.slice(1).forEach(slide => { slide.hidden = true; });
      element.setAttribute('data-preview-ready', '');
      preview.count.textContent = `${preview.index + 1} / ${slides.length}`;
      controls.hidden = false;
      setPlaying(preview, !motion.matches);
      controls.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (button === preview.toggle) setPlaying(preview, !preview.playing);
        if (button?.dataset.previewStep) show(preview, Number(button.dataset.previewStep), true);
      });
      const track = element.querySelector('.game-preview-track');
      track.addEventListener('pointerenter', event => {
        if (event.pointerType !== 'mouse') return;
        preview.hover = true;
        schedule(preview);
      });
      track.addEventListener('pointerleave', () => {
        preview.hover = false;
        schedule(preview);
      });
      element.addEventListener('focusin', event => {
        preview.focused = event.target !== preview.toggle;
        schedule(preview);
      });
      element.addEventListener('focusout', event => {
        if (element.contains(event.relatedTarget)) return;
        preview.focused = false;
        schedule(preview);
      });
      viewport.observe(element);
    }

    function findPreviews() {
      for (const [element, preview] of previews) {
        if (root.contains(element)) continue;
        clearTimeout(preview.timer);
        viewport.unobserve(element);
        previews.delete(element);
      }
      root.querySelectorAll('[data-game-preview]').forEach(mount);
    }

    document.addEventListener('visibilitychange', () => previews.forEach(schedule));
    motion.addEventListener('change', () => {
      if (motion.matches) previews.forEach(preview => setPlaying(preview, false));
    });
    new MutationObserver(findPreviews).observe(root, { childList: true, subtree: true });
    findPreviews();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
