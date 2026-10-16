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
      ? 'Ajoutez King Crêperie à votre écran d’accueil pour suivre vos commandes et être prévenu quand le livreur part.'
      : 'Retrouvez la carte depuis votre écran d’accueil, sans passer par un store.';

  return (
    <div className="relative bg-kc-indigo text-kc-beurre rounded-2xl p-5 shadow-lg">
      <button
        onClick={fermer}
        aria-label="Plus tard"
        className="absolute top-3 right-3 p-2 rounded-full text-kc-beurre/70 hover:text-kc-beurre hover:bg-white/10"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="bg-white/10 p-2.5 rounded-full shrink-0">
          <Smartphone className="w-5 h-5" />
        </div>
        <div className="space-y-3">
          <div>
            <p className="font-display text-xl leading-tight">Gardez la crêperie sous la main</p>
            <p className="text-sm text-kc-brume mt-1.5 leading-relaxed">{accroche}</p>
          </div>
          {etat.mode === 'android' ? (
            <button
              onClick={async () => {
                const ok = await etat.installer();
                if (!ok) fermer();
              }}
              className="inline-flex items-center gap-2 bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold text-sm px-5 py-3 rounded-full transition-colors"
            >
              <Download className="w-4 h-4" />
              Ajouter à l’écran d’accueil
            </button>
          ) : (
            <ol className="text-sm text-kc-brume space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="text-kc-caramel font-bold">1.</span> Touchez
                <Share className="w-4 h-4 inline text-kc-caramel" aria-label="Partager" />
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
