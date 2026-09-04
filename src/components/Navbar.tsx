'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBag, Crown, Menu as MenuIcon, X } from 'lucide-react';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-stone-200/80 py-3'
          : 'bg-white/60 backdrop-blur-sm border-b border-stone-200/40 py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Crown className="w-7 h-7 text-amber-600 group-hover:rotate-12 transition-transform duration-300" />
          <span className="font-serif text-xl font-black tracking-wider text-stone-900">
            KING <span className="text-amber-600">CRÊPERIE</span>
          </span>
        </Link>

        {/* Navigation Desktop */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-700">
          <Link href="/#menu" className="hover:text-amber-600 transition-colors">
            Notre Carte
          </Link>
          <Link href="/suivi" className="hover:text-amber-600 transition-colors">
            Suivi de Commande
          </Link>
          <Link
            href="/commande"
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-5 py-2.5 rounded-full transition-all hover:scale-105 active:scale-95 shadow-md shadow-amber-600/20"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Commander</span>
          </Link>
        </nav>

        {/* Bouton Menu Mobile */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-stone-800 hover:text-amber-600 transition-colors p-2"
          aria-label="Menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
        </button>
      </div>

      {/* Menu Mobile */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-lg border-b border-stone-200 px-6 py-6 flex flex-col gap-4 text-center shadow-lg">
          <Link
            href="/#menu"
            onClick={() => setMobileMenuOpen(false)}
            className="text-stone-800 font-medium hover:text-amber-600 py-2 transition-colors border-b border-stone-100"
          >
            Notre Carte
          </Link>
          <Link
            href="/suivi"
            onClick={() => setMobileMenuOpen(false)}
            className="text-stone-800 font-medium hover:text-amber-600 py-2 transition-colors border-b border-stone-100"
          >
            Suivi de Commande
          </Link>
          <Link
            href="/commande"
            onClick={() => setMobileMenuOpen(false)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-5 py-3 rounded-full justify-center flex items-center gap-2 transition-all shadow-md"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Commander</span>
          </Link>
        </div>
      )}
    </header>
  );
}