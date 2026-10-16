import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'King Crêperie — Dakar',
    short_name: 'King Crêperie',
    description: 'Commandez vos crêpes aux Almadies et suivez la livraison en direct.',
    lang: 'fr-SN',
    dir: 'ltr',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: '#FBF3E7',
    theme_color: '#FBF3E7',
    categories: ['food', 'shopping', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Voir la carte', short_name: 'Carte', url: '/?source=pwa-shortcut#menu', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Suivre ma commande', short_name: 'Suivi', url: '/suivi?source=pwa-shortcut', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
