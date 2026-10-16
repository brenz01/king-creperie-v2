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

function base64UrlVersUint8(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const brut = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const sortie = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i++) sortie[i] = brut.charCodeAt(i);
  return sortie;
}

async function obtenirAbonnement(): Promise<PushSubscription> {
  const registration = await navigator.serviceWorker.ready;
  const existant = await registration.pushManager.getSubscription();
  if (existant) return existant;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlVersUint8(VAPID_PUBLIC_KEY),
  });
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
