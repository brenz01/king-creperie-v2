import type { Metadata } from 'next';
import { WifiOff } from 'lucide-react';

export const metadata: Metadata = { title: 'Hors ligne', robots: { index: false } };

// Page de secours servie par le service worker quand une page jamais
// visitée est demandée sans réseau. Précachée à l'installation du SW.
export default function HorsLignePage() {
  return (
    <div className="min-h-[100dvh] bg-kc-indigo text-kc-beurre pt-32 pb-16 px-6 flex items-center justify-center">
      <div className="max-w-md w-full text-center">
        <span className="inline-flex w-16 h-16 rounded-full bg-white/10 items-center justify-center">
          <WifiOff className="w-7 h-7 text-kc-caramel" />
        </span>
        <h1 className="mt-5 font-display text-3xl leading-tight">Pas de connexion</h1>
        <p className="mt-3 text-kc-brume leading-relaxed">
          Cette page n’a pas encore été enregistrée sur votre téléphone. La carte déjà consultée reste disponible.
          La commande et le suivi reprendront dès le retour du réseau.
        </p>
        {/* Rechargement complet volontaire (pas de navigation client hors ligne). */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="mt-8 inline-flex items-center gap-2 bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold px-6 py-3.5 rounded-full transition-colors"
        >
          Réessayer
        </a>
      </div>
    </div>
  );
}
