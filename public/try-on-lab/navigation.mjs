/** The gallery buttons retain their studio-owned callbacks. */
export function initStudioNavigation({ locale, t, root = document }) {
  const header = root.querySelector('.site-navigation');
  const toggle = root.getElementById('site-menu-toggle');
  const links = root.getElementById('site-navigation-links');
  const home = locale === 'zh' ? '/zh' : '/';
  header.querySelector('.brand').setAttribute('href', home);
  for (const link of links.querySelectorAll('[data-site-path]')) {
    const path = link.dataset.sitePath;
    link.setAttribute('href', path.startsWith('#') ? `${home}${path}` : `${locale === 'zh' ? '/zh' : ''}${path}`);
  }
  const current = new URL(location.href);
  root.getElementById('nav-studio').setAttribute('href', '#stage');
  for (const lang of ['en', 'zh']) {
    const link = root.getElementById(`nav-language-${lang}`);
    const query = new URLSearchParams(current.search);
    query.set('lang', lang);
    link.setAttribute('href', `${current.pathname}?${query}`);
    if (lang === locale) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
  const setOpen = (open) => {
    header.dataset.menuOpen = String(open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = t(open ? '关闭' : '菜单');
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  // Mirror the site Header: transparent at the top, blurred surface once scrolled.
  const setScrolled = () => {
    header.dataset.scrolled = String(window.scrollY > 50);
  };
  setScrolled();
  window.addEventListener('scroll', setScrolled, { passive: true });
  links.addEventListener('click', (event) => {
    if (event.target.closest('a, button')) setOpen(false);
  });
  header.addEventListener('focusout', (event) => {
    if (!header.contains(event.relatedTarget)) setOpen(false);
  });
  header.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
}
