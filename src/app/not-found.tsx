import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] bg-kc-indigo text-kc-beurre pt-32 pb-16 px-6 flex items-center justify-center">
      <div className="max-w-md w-full text-center">
        <p className="font-display text-8xl leading-none text-kc-caramel">404</p>
        <h1 className="mt-4 font-display text-3xl leading-tight">Cette page n’est pas sur la plaque.</h1>
        <p className="mt-3 text-kc-brume leading-relaxed">Le lien est peut-être ancien ou mal recopié. La carte, elle, est toujours là.</p>
        <Link
          href="/#carte"
          className="mt-8 inline-flex items-center gap-2 bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold px-6 py-3.5 rounded-full transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voir la carte
        </Link>
      </div>
    </div>
  );
}
