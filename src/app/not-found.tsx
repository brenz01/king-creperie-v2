import Link from 'next/link';
import { ArrowLeft, Crown } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] bg-brand-cream pt-32 pb-16 px-6 flex items-center justify-center">
      <div className="max-w-md w-full text-center bg-white/70 backdrop-blur-sm rounded-2xl border border-stone-200/80 shadow-sm p-8">
        <Crown className="w-10 h-10 text-amber-700 mx-auto" />
        <p className="mt-3 font-serif text-7xl font-semibold leading-none text-stone-900">404</p>
        <h1 className="mt-4 font-serif text-2xl font-semibold leading-tight text-stone-900">Cette page n’existe pas.</h1>
        <p className="mt-3 text-stone-600 leading-relaxed">Le lien est peut-être ancien ou mal recopié. La carte, elle, est toujours là.</p>
        <Link
          href="/#carte"
          className="mt-8 inline-flex items-center gap-2 bg-stone-900 hover:bg-amber-700 text-white font-semibold px-6 py-3.5 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voir la carte
        </Link>
      </div>
    </div>
  );
}
