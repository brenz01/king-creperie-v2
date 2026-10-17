import type { Metadata } from 'next';
import { WifiOff } from 'lucide-react';

export const metadata: Metadata = { title: 'Hors ligne', robots: { index: false } };

// Page de secours servie par le service worker quand une page jamais
// visitée est demandée sans réseau. Précachée à l'installation du SW.
export default function HorsLignePage() {
  return (
    <div className="min-h-[100dvh] bg-brand-cream pt-32 pb-16 px-6 flex items-center justify-center">
      <div className="max-w-md w-full text-center bg-white/70 backdrop-blur-sm rounded-2xl border border-stone-200/80 shadow-sm p-8">
        <span className="inline-flex w-16 h-16 rounded-full bg-amber-50 border border-amber-200/70 items-center justify-center">
          <WifiOff className="w-7 h-7 text-amber-700" />
        </span>
        <h1 className="mt-5 font-serif text-2xl font-semibold leading-tight text-stone-900">Pas de connexion</h1>
        <p className="mt-3 text-stone-600 leading-relaxed">
          Cette page n’a pas encore été enregistrée sur votre téléphone. La carte déjà consultée reste disponible.
          La commande et le suivi reprendront dès le retour du réseau.
        </p>
        {/* Rechargement complet volontaire (pas de navigation client hors ligne). */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="mt-8 inline-flex items-center gap-2 bg-stone-900 hover:bg-amber-700 text-white font-semibold px-6 py-3.5 rounded-lg transition-colors"
        >
          Réessayer
        </a>
      </div>
    </div>
  );
}
