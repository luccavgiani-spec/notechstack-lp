/* Cursor da Agência, compartilhado pelas páginas públicas da nó. */
(function () {
  'use strict';
  if (window.noSmoothCursor) return;
  window.noSmoothCursor = true;
  const fine = matchMedia('(hover:hover) and (pointer:fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const cursor = document.createElement('div');
  cursor.className = 'magic-smooth-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = '<svg viewBox="0 0 32 32" focusable="false"><path d="M3.5 2.5 5.4 25l5.5-5.7 5.1 9 4.2-2.4-5.1-8.9 8.2-1.1z"/><circle cx="5" cy="4" r="2.2"/></svg>';
  document.body.append(cursor);
  let x = 0, y = 0, targetX = 0, targetY = 0, vx = 0, vy = 0;
  let angle = 0, targetAngle = 0, last = 0, frame = 0, started = false;
  // Keep native text cursors and media controls, including inside top-layer dialogs.
  const native = 'input,textarea,select,[contenteditable]:not([contenteditable="false"]),video[controls],dialog[open]';
  function hide() {
    cursor.classList.remove('is-visible');
    document.documentElement.classList.remove('has-smooth-cursor');
    cancelAnimationFrame(frame);
    frame = 0; started = false; vx = vy = angle = targetAngle = 0;
  }
  function animate(now) {
    const dt = Math.min((now - last) / 1000, .032); last = now;
    vx += ((targetX - x) * 400 - vx * 45) * dt;
    vy += ((targetY - y) * 400 - vy * 45) * dt;
    x += vx * dt; y += vy * dt;
    angle += (targetAngle - angle) * Math.min(1, dt * 13);
    targetAngle *= .9;
    cursor.style.transform = `translate3d(${x - 4}px,${y - 4}px,0) rotate(${angle}deg)`;
    frame = 0;
    if (Math.abs(targetX - x) + Math.abs(targetY - y) + Math.abs(vx) + Math.abs(vy) + Math.abs(angle) > .05) {
      frame = requestAnimationFrame(animate);
    }
  }
  document.addEventListener('pointermove', event => {
    if (!fine.matches || reduced.matches || event.pointerType === 'touch' || event.target.closest(native)) return hide();
    const dx = event.clientX - targetX;
    targetX = event.clientX; targetY = event.clientY;
    if (!started) { x = targetX; y = targetY; started = true; }
    else targetAngle = Math.max(-14, Math.min(14, dx * .65));
    if (!frame) { last = performance.now(); frame = requestAnimationFrame(animate); }
    document.documentElement.classList.add('has-smooth-cursor');
    cursor.classList.add('is-visible');
  }, { passive: true });
  document.addEventListener('pointerover', event => { if (event.target.closest(native)) hide(); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', hide, { passive: true });
  document.addEventListener('keydown', event => { if (event.key === 'Tab' || event.key === 'Escape') hide(); });
  window.addEventListener('blur', hide);
  window.addEventListener('pagehide', hide);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
  fine.addEventListener('change', hide);
  reduced.addEventListener('change', hide);
})();
