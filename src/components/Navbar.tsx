'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBag, Crown, Menu as MenuIcon, X } from 'lucide-react';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#1C2B45]/90 backdrop-blur-md shadow-lg py-3'
          : 'bg-gradient-to-b from-black/80 to-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Crown className="w-7 h-7 text-amber-400 group-hover:rotate-12 transition-transform" />
          <span className="font-serif text-xl font-black tracking-wider text-white">
            KING <span className="text-amber-400">CRÊPERIE</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-200">
          <Link href="#menu" className="hover:text-amber-400 transition-colors">
            Notre Carte
          </Link>
          <Link href="/suivi" className="hover:text-amber-400 transition-colors">
            Suivi de Commande
          </Link>
          <Link
            href="/commande"
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2.5 rounded-full transition-all hover:scale-105 active:scale-95"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Commander</span>
          </Link>
        </nav>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-white p-2"
          aria-label="Menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-[#1C2B45] border-b border-slate-800 px-6 py-6 flex flex-col gap-4 text-center">
          <Link
            href="#menu"
            onClick={() => setMobileMenuOpen(false)}
            className="text-slate-200 font-medium hover:text-amber-400 py-2"
          >
            Notre Carte
          </Link>
          <Link
            href="/suivi"
            onClick={() => setMobileMenuOpen(false)}
            className="text-slate-200 font-medium hover:text-amber-400 py-2"
          >
            Suivi de Commande
          </Link>
          <Link
            href="/commande"
            onClick={() => setMobileMenuOpen(false)}
            className="bg-amber-500 text-slate-950 font-bold px-5 py-3 rounded-full justify-center flex items-center gap-2"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Commander</span>
          </Link>
        </div>
      )}
    </header>
  );
}