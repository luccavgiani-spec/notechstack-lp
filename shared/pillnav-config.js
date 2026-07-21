/* Pill nav — identidade v2.
   Cores dos itens saem da paleta da marca (brand/tokens/tokens.css):
   Home = âmbar (marca-mãe / nó principal) · Health = verde (vertical saúde)
   · Roteador = azul · Contact = vermelho. As 4 cores do sistema aparecem
   juntas na barra de topo e no rodapé das páginas — aqui a nav mostra o
   acento de cada destino, uma cor por item, sem repetir. */
export const pillNavItems = [
  { label: 'Home',     href: '/',          color: '#EDA33B' },
  { label: 'Health',   href: '/health/',   color: '#30A46C' },
  { label: 'Roteador', href: '/roteador/', color: '#3D63DB' },
  { label: 'Contact',  href: '/#cta',      color: '#E0543C' }
];

export const pillNavConfig = {
  // `nó.` branca sobre tinta — ponto âmbar. Páginas de vertical sobrescrevem
  // com o mark do próprio contexto (ex.: /health usa o de ponto verde).
  logo: '/brand/favicon/favicon-dark.svg',
  logoAlt: 'nó tech stack',
  items: pillNavItems,
  ease: 'power3.easeOut',
  baseColor: '#141414',
  pillColor: '#FAFAF7',
  hoveredPillTextColor: '#FFFFFF',
  pillTextColor: '#141414',
  initialLoadAnimation: true
};
