'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Crown, Menu as MenuIcon, X, Download, Share, ShoppingBag } from 'lucide-react';
import { useInstallation } from '@/lib/pwa/install';
import { useCart } from '@/context/CartContext';
import { ouvrirPanier } from '@/lib/panneauPanier';

export default function Navbar() {
  const [ouvert, setOuvert] = useState(false);
  const installation = useInstallation();
  const { totalCount } = useCart();

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-kc-indigo/95 backdrop-blur-md text-kc-beurre pt-[env(safe-area-inset-top)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOuvert(false)}>
          <Crown className="w-6 h-6 text-kc-caramel" strokeWidth={2.4} />
          <span className="font-display text-xl leading-none tracking-tight">King Crêperie</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <Link href="/#carte" className="hover:text-white transition-colors">La carte</Link>
          <Link href="/suivi" className="hover:text-white transition-colors">Suivre ma commande</Link>
          <button
            type="button"
            onClick={ouvrirPanier}
            className="flex items-center gap-2 bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold px-4 py-2 rounded-full transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            Mon panier{totalCount > 0 ? ` (${totalCount})` : ''}
          </button>
        </nav>

        <button
          onClick={() => setOuvert((o) => !o)}
          className="md:hidden p-2 -mr-2"
          aria-label={ouvert ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={ouvert}
        >
          {ouvert ? <X className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
        </button>
      </div>

      {ouvert && (
        <div className="md:hidden border-t border-white/10 px-4 pb-5 pt-2 flex flex-col text-base">
          <Link href="/#carte" onClick={() => setOuvert(false)} className="py-3 border-b border-white/10">La carte</Link>
          <Link href="/suivi" onClick={() => setOuvert(false)} className="py-3 border-b border-white/10">Suivre ma commande</Link>
          <button
            type="button"
            onClick={() => {
              setOuvert(false);
              ouvrirPanier();
            }}
            className="py-3 border-b border-white/10 text-left"
          >
            Mon panier{totalCount > 0 ? ` (${totalCount})` : ''}
          </button>
          {installation.mode === 'android' && (
            <button onClick={() => void installation.installer()} className="flex items-center gap-2 py-3 text-kc-caramel font-semibold">
              <Download className="w-4 h-4" /> Installer l&apos;app sur ce téléphone
            </button>
          )}
          {installation.mode === 'ios' && (
            <p className="flex items-center gap-1.5 py-3 text-sm text-kc-beurre/70">
              Pour installer l&apos;app : <Share className="w-4 h-4" /> Partager, puis « Sur l&apos;écran d&apos;accueil »
            </p>
          )}
        </div>
      )}
    </header>
  );
}
