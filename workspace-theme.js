'use strict';
const focusButton = document.getElementById('zen-mode');
focusButton.addEventListener('click', () => {
  const active = document.body.classList.toggle('zen');
  focusButton.setAttribute('aria-pressed', String(active));
  focusButton.textContent = active ? 'Exit focus' : 'Focus mode';
});
if (new URLSearchParams(window.location.search).get('demo') === '1') {
  document.getElementById('demo').click();
  const url = new URL(window.location.href);
  url.searchParams.delete('demo');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
}
