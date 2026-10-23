'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
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

  // Les abonnements client sont rattachés à UNE commande (et purgés quand
  // elle est livrée). Si le client a déjà autorisé les notifications lors
  // d'une commande précédente, la nouvelle commande doit être abonnée
  // d'office : sans ça, le bouton affichait « Vous serez prévenu » sans
  // rien enregistrer, et plus aucune notification n'arrivait.
  // Permission déjà accordée : aucune fenêtre ne s'ouvre, pas de clic requis.
  const commandeId = 'commandeId' in cible ? cible.commandeId : null;
  useEffect(() => {
    if (permission !== 'granted' || !commandeId) return;
    let annule = false;
    void activerPush({ commandeId }).then((r) => {
      if (!annule) setEtat(r === 'ok' ? 'actif' : r === 'refuse' ? 'refuse' : 'erreur');
    });
    return () => {
      annule = true;
    };
  }, [permission, commandeId]);

  const texteDiscret = compact ? 'text-kc-sable/70' : 'text-stone-600'; // stone-500 : contraste insuffisant sur le fond crème (WCAG AA)

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
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
            actif ? 'bg-white/10 text-kc-creme' : 'bg-amber-600 hover:bg-amber-500 text-white'
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
        {etat === 'erreur' && <p className="text-xs text-rose-400">Activation impossible. Réessayez dans un instant.</p>}
      </div>
    );
  }

  if (actif) {
    return (
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
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
        className="appui inline-flex items-center gap-2 bg-stone-900 hover:bg-amber-700 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
      >
        {etat === 'chargement' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
        {libelle ?? 'Me prévenir à chaque étape'}
      </button>
      {etat === 'erreur' && (
        <p className="text-sm text-rose-600">Activation impossible pour le moment. Réessayez dans un instant.</p>
      )}
    </div>
  );
}
