import localFont from 'next/font/local';

// Polices auto-hébergées (paquets @fontsource-variable) : plus aucun
// appel à Google Fonts au build ni au runtime — build reproductible hors
// ligne, pas de requête tierce pour les clients, cache SW simple.
export const inter = localFont({
  src: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});

export const fraunces = localFont({
  src: [
    { path: '../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2', style: 'normal' },
    { path: '../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-italic.woff2', style: 'italic' },
  ],
  variable: '--font-fraunces',
  weight: '100 900',
  display: 'swap',
  fallback: ['Georgia', 'Cambria', 'serif'],
});
