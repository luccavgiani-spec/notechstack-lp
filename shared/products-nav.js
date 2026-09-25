/* Navegação da home e da LP: destinos do menu original de colaboradores digitais. */
export function initProductsNav(root, { active = '/', contact = '/#ctafinal' } = {}) {
  root.innerHTML = `<nav class="no-products-nav" aria-label="Navegação principal">
    <a class="no-products-brand" href="/" aria-label="Nó Tech Stack — Home"><img src="/brand/favicon/favicon-dark.svg" alt="nó." width="64" height="64"></a>
    <div class="no-products-pills">
      <a href="/" ${active === '/' ? 'aria-current="page"' : ''}>Home</a>
      <div class="no-products-dropdown">
        <button type="button" aria-expanded="false" aria-controls="no-products-menu">Produtos <span aria-hidden="true">⌄</span></button>
        <div id="no-products-menu" class="no-products-menu" hidden>
          <a href="/colaboradores-digitais/" style="--product-color:#EDA33B" ${active === '/colaboradores-digitais/' ? 'aria-current="page"' : ''}>Agentes</a>
          <a href="/roteador/" style="--product-color:#3D63DB">Roteador</a>
          <a href="/health/" style="--product-color:#30A46C">Nó Health</a>
        </div>
      </div>
      <a href="${contact}">Contato</a>
    </div>
  </nav>`;
  const button = root.querySelector('button');
  const menu = root.querySelector('#no-products-menu');
  const dropdown = root.querySelector('.no-products-dropdown');
  const setOpen = open => { button.setAttribute('aria-expanded', String(open)); menu.hidden = !open; };
  button.addEventListener('click', () => setOpen(menu.hidden));
  dropdown.addEventListener('focusout', e => { if (!dropdown.contains(e.relatedTarget)) setOpen(false); });
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { setOpen(false); button.focus(); } });
  document.addEventListener('click', e => { if (!dropdown.contains(e.target)) setOpen(false); });
  menu.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
}
