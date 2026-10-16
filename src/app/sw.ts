/// <reference lib="webworker" />
import {
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
} from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const JOUR = 24 * 3600;

// ------------------------------------------------------------------
// Règles de cache. L'ordre compte : la première règle qui correspond
// gagne. Principe : tout ce qui touche à l'argent, au stock ou au
// statut d'une commande ne passe JAMAIS par le cache.
// ------------------------------------------------------------------
const runtimeCaching: RuntimeCaching[] = [
  // 1. API Next (commandes, login, push) : réseau uniquement.
  {
    matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith('/api/'),
    handler: new NetworkOnly(),
  },
  // 2. Espace staff et fichiers du SW : réseau uniquement.
  {
    matcher: ({ sameOrigin, url }) =>
      sameOrigin && (url.pathname.startsWith('/admin') || url.pathname.startsWith('/serwist/')),
    handler: new NetworkOnly(),
  },
  // 3. Vidéo du hero : jamais en cache (taille, requêtes Range).
  {
    matcher: ({ url }) => /\.(?:mp4|webm)$/i.test(url.pathname),
    handler: new NetworkOnly(),
  },
  // 4. Assets Next versionnés (JS, CSS, polices) : immuables.
  {
    matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith('/_next/static/'),
    handler: new CacheFirst({
      cacheName: 'next-static',
      plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * JOUR })],
    }),
  },
  // 5. Images du site (icônes, poster, OG).
  {
    matcher: ({ sameOrigin, request }) => sameOrigin && request.destination === 'image',
    handler: new StaleWhileRevalidate({
      cacheName: 'images-site',
      plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * JOUR })],
    }),
  },
  // 6. Photos produits (Supabase Storage public, Unsplash) : la carte
  //    reste illustrée hors ligne. Les requêtes REST/Realtime/Auth de
  //    Supabase ne correspondent pas → réseau direct, jamais de cache.
  {
    matcher: ({ url, request }) =>
      request.destination === 'image' &&
      ((url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/storage/v1/object/public/')) ||
        url.hostname === 'images.unsplash.com'),
    handler: new StaleWhileRevalidate({
      cacheName: 'images-produits',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 14 * JOUR, purgeOnQuotaError: true }),
      ],
    }),
  },
  // 7. Payloads RSC (navigations client Next) : réseau d'abord.
  {
    matcher: ({ sameOrigin, request }) => sameOrigin && request.headers.get('RSC') === '1',
    handler: new NetworkFirst({
      cacheName: 'pages-rsc',
      networkTimeoutSeconds: 4,
      plugins: [new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 7 * JOUR })],
    }),
  },
  // 8. Pages HTML : réseau d'abord, copie de secours hors ligne
  //    (la carte déjà consultée reste affichable sans réseau).
  {
    matcher: ({ sameOrigin, request }) => sameOrigin && request.mode === 'navigate',
    handler: new NetworkFirst({
      cacheName: 'pages',
      networkTimeoutSeconds: 4,
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 7 * JOUR }),
      ],
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Le nouveau SW attend : l'app affiche « Mettre à jour » (PwaProvider)
  // plutôt que de changer le code en plein tunnel de commande.
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [{ url: '/~offline', matcher: ({ request }) => request.destination === 'document' }],
  },
});

serwist.addEventListeners();

// La toute première visite n'est pas encore contrôlée par le SW : on
// met l'accueil (la carte) en cache dès l'activation, pour qu'elle reste
// consultable hors ligne même après une seule visite. Pas de précache
// (qui servirait une carte figée en ligne) : simple amorçage du cache
// runtime « pages », toujours servi en NetworkFirst.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .open('pages')
      .then((cache) => cache.add(new Request('/', { credentials: 'same-origin' })))
      .catch(() => undefined)
  );
});

// ------------------------------------------------------------------
// Notifications push (envoyées par /api/push/dispatch).
// ------------------------------------------------------------------
interface DonneesPush {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

self.addEventListener('push', (event) => {
  let donnees: DonneesPush;
  try {
    donnees = event.data?.json() as DonneesPush;
  } catch {
    donnees = { title: 'King Crêperie', body: event.data?.text() ?? '' };
  }
  if (!donnees?.title) return;

  event.waitUntil(
    self.registration.showNotification(donnees.title, {
      body: donnees.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: donnees.tag,
      // Une nouvelle étape remplace la précédente mais fait quand même vibrer.
      renotify: !!donnees.tag,
      data: { url: donnees.url ?? '/' },
      lang: 'fr',
    } as NotificationOptions & { renotify?: boolean })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const cible = new URL((event.notification.data as { url?: string })?.url ?? '/', self.location.origin);

  event.waitUntil(
    (async () => {
      const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Réutilise un onglet / l'app déjà ouverte plutôt que d'en ouvrir une nouvelle.
      for (const client of fenetres) {
        if (new URL(client.url).origin === cible.origin && 'focus' in client) {
          await client.focus();
          if ('navigate' in client && client.url !== cible.href) await client.navigate(cible.href);
          return;
        }
      }
      await self.clients.openWindow(cible.href);
    })()
  );
});

// Le navigateur a renouvelé l'abonnement (expiration, rotation de clés) :
// on ré-enregistre le nouvel endpoint en conservant la cible d'origine.
self.addEventListener('pushsubscriptionchange', (event) => {
  const e = event as Event & { oldSubscription?: PushSubscription | null; newSubscription?: PushSubscription | null; waitUntil: (p: Promise<unknown>) => void };
  if (!e.newSubscription || !e.oldSubscription) return;
  e.waitUntil(
    fetch('/api/push/subscribe', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ancien_endpoint: e.oldSubscription.endpoint, subscription: e.newSubscription.toJSON() }),
    })
  );
});
