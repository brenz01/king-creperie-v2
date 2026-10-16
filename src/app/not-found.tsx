import Link from 'next/link';
import { Crown, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen pt-32 pb-16 px-6 max-w-lg mx-auto text-center flex flex-col items-center justify-center">
      <div className="bg-white border border-stone-200/80 shadow-sm p-8 rounded-3xl w-full flex flex-col items-center">
        <Crown className="w-12 h-12 text-kc-bissap mb-4" />
        <h1 className="text-4xl font-serif text-kc-encre mb-2">404</h1>
        <h2 className="text-xl font-bold text-stone-800 mb-2">Page Introuvable</h2>
        <p className="text-stone-500 text-sm mb-6">
          Oups ! La page que vous recherchez n&apos;existe pas ou a été déplacée.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-bold px-6 py-3 rounded-full transition-all shadow-md "
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l&apos;accueil</span>
        </Link>
      </div>
    </div>
  );
}