/* Mounts each template into a scaled stage + caption. */
(function () {
  function mount(containerId, items) {
    const el = document.getElementById(containerId);
    if (!el || !items) return;
    items.forEach((t) => {
      const dw = Math.round(t.w * t.scale);
      const dh = Math.round(t.h * t.scale);

      const item = document.createElement('div');
      item.className = 'item';

      const stage = document.createElement('div');
      stage.className = 'stage';
      stage.style.width = dw + 'px';
      stage.style.height = dh + 'px';

      const post = document.createElement('div');
      post.className = 'post';
      post.style.width = t.w + 'px';
      post.style.height = t.h + 'px';
      post.style.transform = 'scale(' + t.scale + ')';
      post.innerHTML = t.html;

      stage.appendChild(post);

      const cap = document.createElement('div');
      cap.className = 'cap';
      cap.textContent = t.cap + '  ·  ' + t.w + '×' + t.h;

      item.appendChild(stage);
      item.appendChild(cap);
      el.appendChild(item);
    });
  }

  const T = window.LIGHT_TEMPLATES || {};
  mount('g-square', T.square);
  mount('g-story', T.story);
  mount('g-li', T.li);

  // Render Lucide icons after markup is in the DOM.
  function icons() { if (window.lucide) lucide.createIcons(); }
  if (document.readyState === 'complete') icons();
  else window.addEventListener('load', icons);
  setTimeout(icons, 200);
})();
