'use client';

import { useState, useSyncExternalStore } from 'react';
import { Bell, BellRing, BellOff, Loader2 } from 'lucide-react';
import { activerPush, pushSupporte } from '@/lib/pwa/push';
import { useInstallation } from '@/lib/pwa/install';

type Etat = 'inactif' | 'chargement' | 'actif' | 'refuse' | 'erreur';

const sAbonner = () => () => {};
const lirePermission = () => (pushSupporte() ? Notification.permission : 'unsupported');

interface PushOptInProps {
  cible: { commandeId: string } | { accessToken: string };
  libelle?: string;
  compact?: boolean;
}

export default function PushOptIn({ cible, libelle, compact }: PushOptInProps) {
  const permission = useSyncExternalStore(sAbonner, lirePermission, () => 'unsupported');
  const installation = useInstallation();
  const [etat, setEtat] = useState<Etat>('inactif');

  if (permission === 'unsupported') {
    // iOS : le push web n'existe que dans l'app installée (iOS 16.4+).
    if (installation.mode === 'ios' && !compact) {
      return (
        <p className="text-xs text-stone-500 flex items-center gap-2">
          <Bell className="w-4 h-4 shrink-0" />
          Sur iPhone, installez l’app (ci-dessus) pour recevoir les notifications de suivi.
        </p>
      );
    }
    return null;
  }

  const activer = async () => {
    setEtat('chargement');
    const r = await activerPush(cible);
    setEtat(r === 'ok' ? 'actif' : r === 'refuse' ? 'refuse' : 'erreur');
  };

  if (etat === 'actif') {
    return (
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
        <BellRing className="w-4 h-4" /> Notifications activées
      </p>
    );
  }

  if (etat === 'refuse' || permission === 'denied') {
    return (
      <p className="inline-flex items-center gap-2 text-xs text-stone-500">
        <BellOff className="w-4 h-4" /> Notifications bloquées dans les réglages du navigateur.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={activer}
        disabled={etat === 'chargement'}
        className={
          compact
            ? 'inline-flex items-center gap-2 bg-[#26201A] border border-[#3D332A] text-kc-caramel font-bold px-4 py-2.5 rounded-xl hover:border-amber-600/50 text-sm transition-colors disabled:opacity-60'
            : 'inline-flex items-center gap-2 bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors disabled:opacity-60'
        }
      >
        {etat === 'chargement' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
        {libelle ?? 'Me prévenir à chaque étape'}
      </button>
      {etat === 'erreur' && <p className="text-xs text-rose-600">Activation impossible pour le moment. Réessayez plus tard.</p>}
    </div>
  );
}
