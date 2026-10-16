'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SerwistProvider, useSerwist } from '@serwist/turbopack/react';
import { RefreshCw, WifiOff } from 'lucide-react';
// Import pour effet de bord : capture précoce de beforeinstallprompt.
import '@/lib/pwa/install';

function sAbonnerReseau(f: () => void) {
  window.addEventListener('online', f);
  window.addEventListener('offline', f);
  return () => {
    window.removeEventListener('online', f);
    window.removeEventListener('offline', f);
  };
}

function BandeauHorsLigne() {
  const enLigne = useSyncExternalStore(sAbonnerReseau, () => navigator.onLine, () => true);
  if (enLigne) return null;
  return (
    <div role="status" className="fixed top-0 inset-x-0 z-[60] bg-kc-nuit text-kc-beurre text-xs font-medium py-1.5 px-4 flex items-center justify-center gap-2 pt-[max(0.375rem,env(safe-area-inset-top))]">
      <WifiOff className="w-3.5 h-3.5" />
      Hors ligne — la carte reste consultable, la commande nécessite une connexion.
    </div>
  );
}

// Le nouveau service worker attend (skipWaiting: false) : on propose
// la mise à jour au lieu de remplacer le code sous les pieds de
// l'utilisateur en plein tunnel de commande.
function ToastMiseAJour() {
  const { serwist } = useSerwist();
  const [disponible, setDisponible] = useState(false);
  // 'controlling' est aussi émis à la toute première installation
  // (clientsClaim) : on ne recharge que si l'utilisateur l'a demandé.
  const majDemandee = useRef(false);

  useEffect(() => {
    if (!serwist) return;
    const surAttente = () => setDisponible(true);
    const surControle = () => {
      if (majDemandee.current) window.location.reload();
    };
    serwist.addEventListener('waiting', surAttente);
    serwist.addEventListener('controlling', surControle);
    return () => {
      serwist.removeEventListener('waiting', surAttente);
      serwist.removeEventListener('controlling', surControle);
    };
  }, [serwist]);

  if (!disponible) return null;
  return (
    <div role="status" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] w-11/12 max-w-sm bg-white border border-stone-200 shadow-xl rounded-xl p-4 flex items-center justify-between gap-3">
      <p className="text-sm text-stone-700">Une nouvelle version de l’app est disponible.</p>
      <button
        onClick={() => {
          majDemandee.current = true;
          serwist?.messageSkipWaiting();
        }}
        className="inline-flex items-center gap-1.5 bg-kc-bissap hover:bg-kc-bissap-fonce text-white text-xs font-bold px-3 py-2 rounded-full shrink-0"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Mettre à jour
      </button>
    </div>
  );
}

const sAbonnerVide = () => () => {};

export default function PwaProvider({ children }: { children: React.ReactNode }) {
  // Navigateurs intégrés (WhatsApp, Instagram…) et contextes non sécurisés :
  // pas de service worker → on n'essaie pas de l'enregistrer (évite une
  // erreur JS « reading 'waiting' » dans @serwist/window).
  const swDisponible = useSyncExternalStore(
    sAbonnerVide,
    () => 'serviceWorker' in navigator && navigator.serviceWorker != null,
    () => false
  );
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      // En dev, le SW gênerait le hot reload ; on le teste via `pnpm build && pnpm start`.
      disable={process.env.NODE_ENV === 'development' || !swDisponible}
      reloadOnOnline={false}
      cacheOnNavigation={false}
    >
      <BandeauHorsLigne />
      {children}
      <ToastMiseAJour />
    </SerwistProvider>
  );
}
