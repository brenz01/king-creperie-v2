'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, Crown, Menu as MenuIcon, X, Download, Share } from 'lucide-react';
import { useInstallation } from '@/lib/pwa/install';
import { useCart } from '@/context/CartContext';
import { ouvrirPanier } from '@/lib/panneauPanier';
import InfoBulle from './ui/InfoBulle';

// En-tête crème translucide : la page défile dessous, flouée. Il se
// densifie au défilement pour rester lisible au-dessus des photos.
export default function Navbar() {
  const [defile, setDefile] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const installation = useInstallation();
  const { totalCount } = useCart();
  const pathname = usePathname();

  useEffect(() => {
    const surDefilement = () => setDefile(window.scrollY > 20);
    surDefilement();
    window.addEventListener('scroll', surDefilement, { passive: true });
    return () => window.removeEventListener('scroll', surDefilement);
  }, []);

  // L'espace staff a son propre en-tête.
  if (pathname.startsWith('/admin')) return null;

  const commander = () => {
    setOuvert(false);
    ouvrirPanier();
  };

  return (
    <header
      className={`verre-clair fixed top-0 inset-x-0 z-50 pt-[env(safe-area-inset-top)] backdrop-blur-md border-b transition-colors duration-200 ${
        defile || ouvert ? 'bg-creme/95 border-stone-300/80' : 'bg-creme/85 border-stone-300/50'
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group" onClick={() => setOuvert(false)}>
          <Crown className="w-7 h-7 text-amber-700 group-hover:rotate-12 transition-transform duration-300" />
          <span className="font-serif text-xl font-semibold tracking-wide text-stone-900">
            King <span className="text-amber-700 italic font-medium">Crêperie</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-700">
          <Link href="/#carte" className="hover:text-amber-700 transition-colors">
            Notre carte
          </Link>
          <Link href="/suivi" className="hover:text-amber-700 transition-colors">
            Suivi de commande
          </Link>
          <button
            type="button"
            onClick={commander}
            className="appui flex items-center gap-2 h-11 bg-stone-900 hover:bg-amber-700 text-white font-semibold px-5 rounded-lg transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Commander</span>
            {totalCount > 0 && (
              <span className="ml-0.5 min-w-5 h-5 px-1.5 rounded-full bg-white text-stone-900 text-xs font-semibold flex items-center justify-center tabular-nums">
                {totalCount}
              </span>
            )}
          </button>
        </nav>

        <span className="md:hidden -mr-2">
          <InfoBulle libelle={ouvert ? 'Fermer le menu' : 'Ouvrir le menu'} cote="gauche">
            <button
              onClick={() => setOuvert((o) => !o)}
              className="appui w-11 h-11 rounded-lg flex items-center justify-center text-stone-800 hover:text-amber-700"
              aria-label={ouvert ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={ouvert}
            >
              {ouvert ? <X className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
          </InfoBulle>
        </span>
      </div>

      {ouvert && (
        <div className="kc-fondu md:hidden border-t border-stone-200/80 px-6 py-6 flex flex-col gap-4 text-center">
          <Link
            href="/#carte"
            onClick={() => setOuvert(false)}
            className="text-stone-800 font-medium hover:text-amber-700 py-2 transition-colors border-b border-stone-200/70"
          >
            Notre carte
          </Link>
          <Link
            href="/suivi"
            onClick={() => setOuvert(false)}
            className="text-stone-800 font-medium hover:text-amber-700 py-2 transition-colors border-b border-stone-200/70"
          >
            Suivi de commande
          </Link>
          <button
            type="button"
            onClick={commander}
            className="bg-stone-900 hover:bg-amber-700 text-white font-semibold px-5 py-3 rounded-lg justify-center flex items-center gap-2 transition-colors shadow-md"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Commander{totalCount > 0 ? ` (${totalCount})` : ''}</span>
          </button>
          {installation.mode === 'android' && (
            <button
              onClick={() => void installation.installer()}
              className="flex items-center justify-center gap-2 text-amber-800 font-semibold py-2"
            >
              <Download className="w-4 h-4" /> Installer l&apos;app
            </button>
          )}
          {installation.mode === 'ios' && (
            <p className="flex items-center justify-center gap-1.5 text-xs text-stone-500">
              Installer l&apos;app : <Share className="w-3.5 h-3.5" /> Partager → Sur l&apos;écran d&apos;accueil
            </p>
          )}
        </div>
      )}
    </header>
  );
}
