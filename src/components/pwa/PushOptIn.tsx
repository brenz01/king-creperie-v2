'use client';

import { useState, useSyncExternalStore } from 'react';
import { Bell, BellRing, BellOff, Loader2 } from 'lucide-react';
import { activerPush, pushSupporte, raisonPushIndisponible } from '@/lib/pwa/push';
import { useInstallation } from '@/lib/pwa/install';
import { useEstHydrate } from '@/lib/useEstHydrate';

type Etat = 'inactif' | 'chargement' | 'actif' | 'refuse' | 'erreur';

const sAbonner = () => () => {};
const lirePermission = () => (pushSupporte() ? Notification.permission : 'unsupported');

interface PushOptInProps {
  cible: { commandeId: string } | { accessToken: string };
  libelle?: string;
  /** Variante compacte pour l'en-tête sombre de l'espace staff. */
  compact?: boolean;
  /** Ne rien afficher une fois les alertes actives (bandeau de rappel). */
  masquerSiActif?: boolean;
}

export default function PushOptIn({ cible, libelle, compact, masquerSiActif }: PushOptInProps) {
  const permission = useSyncExternalStore(sAbonner, lirePermission, () => 'unsupported');
  const installation = useInstallation();
  const hydrate = useEstHydrate();
  const [etat, setEtat] = useState<Etat>('inactif');

  const texteDiscret = compact ? 'text-kc-brume/70' : 'text-kc-encre/60';

  if (permission === 'unsupported') {
    // iOS : le push web n'existe que dans l'app installée (iOS 16.4+).
    if (installation.mode === 'ios' && !compact) {
      return (
        <p className={`text-sm flex items-center gap-2 ${texteDiscret}`}>
          <Bell className="w-4 h-4 shrink-0" />
          Sur iPhone, ajoutez l’app à l’écran d’accueil pour être prévenu à chaque étape.
        </p>
      );
    }
    if (compact && hydrate) {
      const raison = raisonPushIndisponible();
      if (raison)
        return (
          <p className={`flex items-start gap-2 text-xs leading-snug ${texteDiscret}`}>
            <BellOff className="w-4 h-4 shrink-0 mt-px" /> {raison}
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

  if (etat === 'refuse' || permission === 'denied') {
    return (
      <p className={`flex items-start gap-2 text-xs leading-snug ${texteDiscret}`}>
        <BellOff className="w-4 h-4 shrink-0 mt-px" />
        Notifications bloquées : autorisez-les dans les réglages du navigateur pour ce site.
      </p>
    );
  }

  // Déjà autorisé : l'abonnement est réenregistré au toucher (idempotent),
  // utile après un changement de téléphone ou une réinstallation.
  const actif = etat === 'actif' || (permission === 'granted' && etat !== 'erreur' && etat !== 'chargement');

  if (actif && masquerSiActif) return null;

  if (compact) {
    return (
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={() => void activer()}
          disabled={etat === 'chargement'}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
            actif ? 'bg-white/10 text-kc-beurre' : 'bg-kc-caramel text-kc-nuit hover:bg-kc-beurre'
          }`}
        >
          {etat === 'chargement' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : actif ? (
            <BellRing className="w-4 h-4" />
          ) : (
            <Bell className="w-4 h-4" />
          )}
          {actif ? 'Alertes actives' : (libelle ?? 'Activer les alertes')}
        </button>
        {etat === 'erreur' && <p className="text-xs text-kc-beurre/80">Activation impossible. Réessayez dans un instant.</p>}
      </div>
    );
  }

  if (actif) {
    return (
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-kc-indigo">
        <BellRing className="w-4 h-4" /> Vous serez prévenu à chaque étape.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => void activer()}
        disabled={etat === 'chargement'}
        className="inline-flex items-center gap-2 bg-kc-indigo hover:bg-kc-nuit text-kc-beurre font-semibold text-sm px-5 py-3 rounded-full transition-colors disabled:opacity-60"
      >
        {etat === 'chargement' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
        {libelle ?? 'Me prévenir à chaque étape'}
      </button>
      {etat === 'erreur' && (
        <p className="text-sm text-kc-bissap">Activation impossible pour le moment. Réessayez dans un instant.</p>
      )}
    </div>
  );
}
