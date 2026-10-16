'use client';

import { useState } from 'react';
import { Download, Share, SquarePlus, X, Smartphone } from 'lucide-react';
import { useInstallation } from '@/lib/pwa/install';

const CLE_REFUS = 'king_creperie_install_refus';

function aRefuseRecemment(): boolean {
  try {
    const t = Number(localStorage.getItem(CLE_REFUS) ?? 0);
    return Date.now() - t < 7 * 24 * 3600 * 1000;
  } catch {
    return false;
  }
}

// Carte d'invitation à installer l'app. Affichée au moment où l'intérêt
// est évident (après une commande, sur /suivi) ; masquée 7 jours si refusée.
export default function InstallPrompt({ contexte = 'suivi' }: { contexte?: 'suivi' | 'accueil' }) {
  const etat = useInstallation();
  const [masque, setMasque] = useState(false);
  const [refusLu] = useState(aRefuseRecemment);

  if (masque || refusLu) return null;
  if (etat.mode !== 'android' && etat.mode !== 'ios') return null;

  const fermer = () => {
    try {
      localStorage.setItem(CLE_REFUS, String(Date.now()));
    } catch {}
    setMasque(true);
  };

  const accroche =
    contexte === 'suivi'
      ? 'Installez King Crêperie pour suivre vos commandes et recevoir une notification quand le livreur part.'
      : 'Commandez en 2 touches depuis votre écran d’accueil — sans passer par un store.';

  return (
    <div className="relative bg-kc-indigo text-kc-beurre rounded-2xl p-5 shadow-lg">
      <button onClick={fermer} aria-label="Plus tard" className="absolute top-3 right-3 p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10">
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="bg-kc-indigo p-2.5 rounded-xl shrink-0">
          <Smartphone className="w-5 h-5" />
        </div>
        <div className="space-y-3">
          <div>
            <p className="font-serif text-lg font-semibold">Ajouter l’app sur votre téléphone</p>
            <p className="text-sm text-stone-300 mt-1">{accroche}</p>
          </div>
          {etat.mode === 'android' ? (
            <button
              onClick={async () => {
                const ok = await etat.installer();
                if (!ok) fermer();
              }}
              className="inline-flex items-center gap-2 bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-bold text-sm px-4 py-2.5 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Installer l’app
            </button>
          ) : (
            <ol className="text-sm text-stone-200 space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="text-kc-caramel font-bold">1.</span> Touchez
                <Share className="w-4 h-4 inline text-sky-400" aria-label="Partager" />
                <span className="font-semibold">Partager</span> dans Safari
              </li>
              <li className="flex items-center gap-2">
                <span className="text-kc-caramel font-bold">2.</span> Choisissez
                <SquarePlus className="w-4 h-4 inline" aria-hidden />
                <span className="font-semibold">Sur l’écran d’accueil</span>
              </li>
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
