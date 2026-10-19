/*
 * Haleema Ramzan — portfolio behaviour.
 * Progressive enhancement only: without JavaScript every card is expanded,
 * the site stays in the light theme, and all links work. The `js` class and
 * the initial theme are set by the inline script in <head>.
 */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const EASE = 'cubic-bezier(.22, 1, .36, 1)'; /* same curve as --ease in style.css */

  /* ---------- Theme toggle ------------------------------------------------ */
  function initTheme() {
    const btn = $('#theme');
    const themeColors = $$('meta[name="theme-color"]');

    function paint() {
      const dark = root.dataset.theme === 'dark';
      btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
      $('use', btn).setAttribute('href', dark ? '#i-sun' : '#i-moon');
      /* Browser chrome follows the chosen theme, not just the system one. */
      const bg = getComputedStyle(document.body).backgroundColor;
      themeColors.forEach((meta) => meta.setAttribute('content', bg));
    }

    /* Cross-fade between themes so the brightness change is never abrupt. */
    function setTheme(theme) {
      const apply = () => { root.dataset.theme = theme; paint(); };
      if (document.startViewTransition && !reduceMotion.matches) document.startViewTransition(apply);
      else apply();
    }

    btn.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', next); } catch { /* storage blocked: keep for this visit only */ }
      setTheme(next);
    });

    /* Follow the system setting live until the visitor makes their own choice. */
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      let saved = null;
      try { saved = localStorage.getItem('theme'); } catch { /* storage blocked */ }
      if (!saved) setTheme(e.matches ? 'dark' : 'light');
    });

    btn.hidden = false;
    paint();
  }

  /* ---------- "Read more" for long cards ---------------------------------- */
  function initReadMore() {
    const SLACK = 64; /* px: collapse only when a meaningful amount would be hidden */

    const items = $$('.clip').map((clip, i) => {
      clip.id ||= `clip-${i + 1}`;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'more';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', clip.id);
      btn.innerHTML = '<span>Read more</span><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-chevron"/></svg>';

      /* Always animate from the height on screen right now, so a second click
         mid-animation reverses smoothly instead of jumping. */
      let anim;
      btn.addEventListener('click', () => {
        const from = clip.offsetHeight;
        anim?.cancel();
        const open = clip.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', String(open));
        $('span', btn).textContent = open ? 'Show less' : 'Read more';
        if (reduceMotion.matches) return;
        anim = clip.animate(
          { maxHeight: [`${from}px`, `${clip.offsetHeight}px`] },
          { duration: 500, easing: EASE }
        );
      });

      clip.after(btn);
      return { clip, btn };
    });

    function measure() {
      items.forEach(({ clip, btn }) => {
        if (clip.classList.contains('is-open')) return;
        clip.classList.remove('is-short');
        const short = clip.scrollHeight <= clip.clientHeight + SLACK;
        clip.classList.toggle('is-short', short);
        btn.hidden = short;
      });
    }

    let frame;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    /* Custom fonts change line breaks, so measure again once they are ready. */
    document.fonts.ready.then(measure);
    measure();
  }

  /* ---------- Section nav: menu, active section, scroll edge -------------- */
  function initNav() {
    const nav = $('.topnav');
    const btn = $('.menu-btn', nav);
    const links = $$('a[href^="#"]', nav);
    const last = links[links.length - 1].hash.slice(1);

    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
      $('use', btn).setAttribute('href', open ? '#i-close' : '#i-menu');
    }

    btn.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
    /* Close after picking a section, on an outside click, or on Escape. */
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('click', (e) => { if (!nav.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        btn.focus();
      }
    });

    function setActive(id) {
      links.forEach((a) => {
        if (a.hash === `#${id}`) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }

    /* The last section is shorter than the viewport and may never reach the
       observer's band, so it is pinned as active once the page hits the end. */
    const atEnd = () => window.innerHeight + window.scrollY >= root.scrollHeight - 2;

    const observer = new IntersectionObserver((entries) => {
      if (atEnd()) { setActive(last); return; }
      entries.forEach((entry) => { if (entry.isIntersecting) setActive(entry.target.id); });
    }, { rootMargin: '-30% 0px -60% 0px' });

    links.forEach((a) => {
      const section = document.getElementById(a.hash.slice(1));
      if (section) observer.observe(section);
    });

    let ticking = false;
    function onScroll() {
      ticking = false;
      nav.classList.toggle('is-scrolled', window.scrollY > 4);
      if (atEnd()) setActive(last);
    }
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(onScroll);
    }, { passive: true });
    onScroll();
  }

  /* ---------- Reveal content as it scrolls into view ---------------------- */
  function initReveal() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        target.classList.add('is-visible');
        observer.unobserve(target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });

    /* Only content below the fold takes part; what is already on screen at
       load stays put, so the first paint never flickers. */
    $$('main h2, main .card, .prose > p, .chips, .logos')
      .filter((el) => el.getBoundingClientRect().top > window.innerHeight)
      .forEach((el) => {
        el.classList.add('reveal');
        observer.observe(el);
      });
  }

  initTheme();
  initReadMore();
  initNav();
  initReveal();
})();
