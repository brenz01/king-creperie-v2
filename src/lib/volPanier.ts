'use client';

// « La crêpe file au panier » : une vignette de la photo part de la carte
// et rejoint la barre panier (ou le bas de l'écran si elle n'est pas
// encore affichée). Transform et opacité seulement, 300 ms, coupée quand
// le système demande moins d'animations. Purement visuel : la barre
// panier annonce aussi l'ajout en texte (aria-live).
export function envolerVersPanier(source: HTMLElement | null) {
  if (!source || typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const depart = source.getBoundingClientRect();
  if (!depart.width) return;
  const cible = document.querySelector('[data-cible-panier]')?.getBoundingClientRect();
  const arriveeX = cible ? cible.left + cible.width / 2 : window.innerWidth / 2;
  const arriveeY = cible ? cible.top + cible.height / 2 : window.innerHeight - 40;

  const taille = Math.min(depart.width, depart.height, 160);
  const vignette = document.createElement('div');
  const image = source.querySelector('img');
  Object.assign(vignette.style, {
    position: 'fixed',
    left: `${depart.left + depart.width / 2 - taille / 2}px`,
    top: `${depart.top + depart.height / 2 - taille / 2}px`,
    width: `${taille}px`,
    height: `${taille}px`,
    borderRadius: '9999px',
    backgroundColor: '#e7dcc8',
    backgroundImage: image?.currentSrc ? `url("${image.currentSrc}")` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    boxShadow: '0 0 0 3px #fff',
    zIndex: '70',
    pointerEvents: 'none',
    willChange: 'transform, opacity',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(vignette);

  const dx = arriveeX - (depart.left + depart.width / 2);
  const dy = arriveeY - (depart.top + depart.height / 2);
  const animation = vignette.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.18)`, opacity: 0.7 },
    ],
    { duration: 300, easing: 'cubic-bezier(0.7, 0, 0.84, 0)' },
  );
  animation.onfinish = () => vignette.remove();
  animation.oncancel = () => vignette.remove();
}
