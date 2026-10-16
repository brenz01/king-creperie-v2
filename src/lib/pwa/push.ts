'use client';

export const VAPID_PUBLIC_KEY = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '').trim().replace(/^["']|["']$/g, '');

export function pushSupporte(): boolean {
  return (
    typeof window !== 'undefined' &&
    VAPID_PUBLIC_KEY.length > 0 &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// Explique pourquoi le push n'est pas disponible (affiché dans l'admin
// au lieu de masquer le bouton sans rien dire).
export function raisonPushIndisponible(): string {
  if (typeof window === 'undefined') return '';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  if (VAPID_PUBLIC_KEY.length === 0) return 'Notifications non configurées sur ce déploiement (clé VAPID publique absente).';
  if (ios && !standalone)
    return 'Sur iPhone : Partager → « Sur l’écran d’accueil », puis ouvrez l’app depuis l’icône pour activer les alertes.';
  if (!('serviceWorker' in navigator)) return 'Ce navigateur ne gère pas les notifications (navigation privée ?).';
  if (!('PushManager' in window) || !('Notification' in window))
    return ios ? 'iOS 16.4 ou plus récent requis pour les notifications.' : 'Ce navigateur ne gère pas les notifications.';
  return '';
}

function base64UrlVersUint8(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const brut = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const sortie = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i++) sortie[i] = brut.charCodeAt(i);
  return sortie;
}

// Évite un bouton qui tourne indéfiniment si le service worker n'est pas
// actif ou si le service push du navigateur ne répond pas.
function avecDelai<T>(promesse: Promise<T>, ms: number, etape: string): Promise<T> {
  return Promise.race([
    promesse,
    new Promise<T>((_, rejeter) => setTimeout(() => rejeter(new Error(`Délai dépassé : ${etape}`)), ms)),
  ]);
}

async function obtenirAbonnement(): Promise<PushSubscription> {
  const registration = await avecDelai(navigator.serviceWorker.ready, 10_000, 'service worker');
  const existant = await registration.pushManager.getSubscription();
  if (existant) return existant;
  return avecDelai(
    registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlVersUint8(VAPID_PUBLIC_KEY),
    }),
    15_000,
    'abonnement push'
  );
}

export type ResultatPush = 'ok' | 'refuse' | 'erreur';

// Demande la permission (doit être appelé depuis un clic), crée
// l'abonnement navigateur et l'enregistre côté serveur, rattaché soit
// à une commande (client anonyme), soit au compte staff (jeton d'accès).
export async function activerPush(
  cible: { commandeId: string } | { accessToken: string }
): Promise<ResultatPush> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'refuse';
    const abonnement = await obtenirAbonnement();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if ('accessToken' in cible) headers.Authorization = `Bearer ${cible.accessToken}`;
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subscription: abonnement.toJSON(),
        commande_id: 'commandeId' in cible ? cible.commandeId : undefined,
      }),
    });
    return res.ok ? 'ok' : 'erreur';
  } catch (e) {
    console.error('Activation push impossible:', e);
    return 'erreur';
  }
}
