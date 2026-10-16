import { createSerwistRoute } from '@serwist/turbopack';

// Révision du précache : SHA du commit sur Vercel, sinon horodatage du build.
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? `${Date.now()}`;

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: 'src/app/sw.ts',
  useNativeEsbuild: true,
  esbuildOptions: { sourcemap: false },
  // Précache volontairement minimal (forfaits data au Sénégal) : page
  // hors ligne + icônes. Le reste (JS, CSS, polices, images) est mis en
  // cache à la demande par les règles runtime de sw.ts. La vidéo du hero
  // n'est jamais mise en cache.
  globPatterns: ['public/icons/**/*.png'],
  additionalPrecacheEntries: [{ url: '/~offline', revision }],
});
