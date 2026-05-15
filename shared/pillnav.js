import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm';

export function initPillNav(container, options) {
  const {
    logo,
    logoAlt = 'Logo',
    items,
    activeHref,
    ease = 'power3.easeOut',
    baseColor = '#0f0f0f',
    pillColor = '#ffffff',
    hoveredPillTextColor = '#ffffff',
    pillTextColor = '#0f0f0f',
    initialLoadAnimation = true,
    onMobileMenuClick
  } = options;

  container.innerHTML = `
    <div class="pill-nav-container">
      <nav class="pill-nav" aria-label="Primary"
           style="--base:${baseColor};--pill-bg:${pillColor};--hover-text:${hoveredPillTextColor};--pill-text:${pillTextColor}">
        <a class="pill-logo" href="${items[0].href}" aria-label="Home">
          <img src="${logo}" alt="${logoAlt}" />
        </a>
        <div class="pill-nav-items desktop-only">
          <ul class="pill-list" role="menubar">
            ${items.map((item, i) => `
              <li role="none">
                <a role="menuitem" href="${item.href}"
                   class="pill${activeHref === item.href ? ' is-active' : ''}"
                   data-index="${i}"
                   style="--item-color: ${item.color || baseColor};"
                   aria-label="${item.ariaLabel || item.label}">
                  <span class="hover-circle" aria-hidden="true"></span>
                  <span class="label-stack">
                    <span class="pill-label">${item.label}</span>
                    <span class="pill-label-hover" aria-hidden="true">${item.label}</span>
                  </span>
                </a>
              </li>
            `).join('')}
          </ul>
        </div>
        <button class="mobile-menu-button mobile-only" aria-label="Toggle menu">
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
        </button>
      </nav>
      <div class="mobile-menu-popover mobile-only"
           style="--base:${baseColor};--pill-bg:${pillColor};--hover-text:${hoveredPillTextColor};--pill-text:${pillTextColor}">
        <ul class="mobile-menu-list">
          ${items.map(item => `
            <li><a href="${item.href}" class="mobile-menu-link${activeHref === item.href ? ' is-active' : ''}" style="--item-color: ${item.color || baseColor};">${item.label}</a></li>
          `).join('')}
        </ul>
      </div>
    </div>
  `;

  const pills = container.querySelectorAll('.pill');
  const circles = container.querySelectorAll('.hover-circle');
  const timelines = [];
  const activeTweens = [];
  const logoImg = container.querySelector('.pill-logo img');
  const logoEl = container.querySelector('.pill-logo');
  const hamburger = container.querySelector('.mobile-menu-button');
  const mobileMenu = container.querySelector('.mobile-menu-popover');
  const navItems = container.querySelector('.pill-nav-items');
  const pillNavContainer = container.querySelector('.pill-nav-container');
  let isMobileMenuOpen = false;

  const layout = () => {
    circles.forEach((circle, index) => {
      if (!circle?.parentElement) return;
      const pill = circle.parentElement;
      const rect = pill.getBoundingClientRect();
      const { width: w, height: h } = rect;
      if (w === 0 || h === 0) return;
      const R = ((w * w) / 4 + h * h) / (2 * h);
      const D = Math.ceil(2 * R) + 2;
      const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
      const originY = D - delta;

      circle.style.width = `${D}px`;
      circle.style.height = `${D}px`;
      circle.style.bottom = `-${delta}px`;

      gsap.set(circle, { xPercent: -50, scale: 0, transformOrigin: `50% ${originY}px` });

      const label = pill.querySelector('.pill-label');
      const white = pill.querySelector('.pill-label-hover');

      if (label) gsap.set(label, { y: 0 });
      if (white) gsap.set(white, { y: h + 12, opacity: 0 });

      timelines[index]?.kill();
      const tl = gsap.timeline({ paused: true });
      tl.to(circle, { scale: 1.2, xPercent: -50, duration: 2, ease, overwrite: 'auto' }, 0);
      if (label) tl.to(label, { y: -(h + 8), duration: 2, ease, overwrite: 'auto' }, 0);
      if (white) {
        gsap.set(white, { y: Math.ceil(h + 100), opacity: 0 });
        tl.to(white, { y: 0, opacity: 1, duration: 2, ease, overwrite: 'auto' }, 0);
      }
      timelines[index] = tl;
    });
  };

  layout();
  window.addEventListener('resize', layout);
  if (document.fonts?.ready) document.fonts.ready.then(layout).catch(() => {});

  if (mobileMenu) gsap.set(mobileMenu, { visibility: 'hidden', opacity: 0, scaleY: 1 });

  if (initialLoadAnimation) {
    if (logoEl) {
      gsap.set(logoEl, { scale: 0 });
      gsap.to(logoEl, { scale: 1, duration: 0.6, ease });
    }
    if (navItems) {
      gsap.set(navItems, { width: 0, overflow: 'hidden' });
      gsap.to(navItems, { width: 'auto', duration: 0.6, ease });
    }
    const activePillIndicator = container.querySelector('.pill.is-active');
    if (activePillIndicator) {
      gsap.fromTo(activePillIndicator,
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, delay: 0.3, ease: 'back.out(2)' }
      );
    }
  }

  pills.forEach((pill, i) => {
    pill.addEventListener('mouseenter', () => {
      const tl = timelines[i];
      if (!tl) return;
      activeTweens[i]?.kill();
      activeTweens[i] = tl.tweenTo(tl.duration(), { duration: 0.3, ease, overwrite: 'auto' });
    });
    pill.addEventListener('mouseleave', () => {
      const tl = timelines[i];
      if (!tl) return;
      activeTweens[i]?.kill();
      activeTweens[i] = tl.tweenTo(0, { duration: 0.2, ease, overwrite: 'auto' });
    });
  });

  let logoTween = null;
  logoEl?.addEventListener('mouseenter', () => {
    if (!logoImg) return;
    logoTween?.kill();
    gsap.set(logoImg, { rotate: 0 });
    logoTween = gsap.to(logoImg, { rotate: 360, duration: 0.2, ease, overwrite: 'auto' });
  });

  hamburger?.addEventListener('click', () => {
    isMobileMenuOpen = !isMobileMenuOpen;
    const lines = hamburger.querySelectorAll('.hamburger-line');
    if (isMobileMenuOpen) {
      gsap.to(lines[0], { rotation: 45, y: 3, duration: 0.3, ease });
      gsap.to(lines[1], { rotation: -45, y: -3, duration: 0.3, ease });
      gsap.set(mobileMenu, { visibility: 'visible' });
      gsap.fromTo(mobileMenu,
        { opacity: 0, y: 10, scaleY: 1 },
        { opacity: 1, y: 0, scaleY: 1, duration: 0.3, ease, transformOrigin: 'top center' }
      );
    } else {
      gsap.to(lines[0], { rotation: 0, y: 0, duration: 0.3, ease });
      gsap.to(lines[1], { rotation: 0, y: 0, duration: 0.3, ease });
      gsap.to(mobileMenu, {
        opacity: 0, y: 10, scaleY: 1, duration: 0.2, ease,
        transformOrigin: 'top center',
        onComplete: () => gsap.set(mobileMenu, { visibility: 'hidden' })
      });
    }
    onMobileMenuClick?.();
  });

  const onScroll = () => {
    if (!pillNavContainer) return;
    if (window.scrollY > 100) pillNavContainer.classList.add('scrolled');
    else pillNavContainer.classList.remove('scrolled');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  window.addEventListener('beforeunload', () => {
    const activePill = container.querySelector('.pill.is-active');
    if (activePill) {
      gsap.to(activePill, { scale: 0.95, duration: 0.15, ease: 'power2.in' });
    }
  });

  return () => {
    window.removeEventListener('resize', layout);
    window.removeEventListener('scroll', onScroll);
  };
}
