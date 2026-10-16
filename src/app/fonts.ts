import localFont from 'next/font/local';

// Identité « la plaque » :
// - Bagel Fat One : lettrage rond et gras, façon enseigne peinte. Titres,
//   noms de rubriques et prix uniquement (une seule graisse, jamais en
//   texte courant).
// - Onest : grotesque lisible, chaleureuse, pour tout le reste.
// Auto-hébergées (@fontsource) : aucun appel à Google Fonts.
export const onest = localFont({
  src: '../../node_modules/@fontsource-variable/onest/files/onest-latin-wght-normal.woff2',
  variable: '--font-onest',
  weight: '100 900',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});

export const bagel = localFont({
  src: '../../node_modules/@fontsource/bagel-fat-one/files/bagel-fat-one-latin-400-normal.woff2',
  variable: '--font-bagel',
  weight: '400',
  display: 'swap',
  fallback: ['Arial Rounded MT Bold', 'Trebuchet MS', 'sans-serif'],
});
