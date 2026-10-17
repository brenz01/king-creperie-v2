import { ArrowRight, Utensils } from 'lucide-react';
import Link from 'next/link';
import { PastilleBoutique } from './StatutBoutique';

export default function HeroSection() {
  return (
    <section className="relative w-full min-h-[100svh] pt-16 grid grid-cols-1 lg:grid-cols-2 items-stretch bg-brand-cream">
      {/* Colonne texte */}
      <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-14 lg:py-0 order-2 lg:order-1">
        <div
          style={{ animationDelay: '100ms' }}
          className="kc-apparait inline-flex items-center gap-2 mb-6 text-amber-700 text-xs sm:text-sm font-semibold uppercase tracking-wide"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-700" />
          <span>Les Almadies · Dakar</span>
        </div>

        <h1
          style={{ animationDelay: '200ms' }}
          className="kc-apparait font-serif text-5xl sm:text-6xl lg:text-[3.6rem] leading-[1.02] text-stone-900 mb-6"
        >
          La crêpe bretonne,
          <br />
          <em className="italic font-medium text-amber-700">version Dakar</em>
        </h1>

        <p
          style={{ animationDelay: '350ms' }}
          className="kc-apparait text-stone-600 text-base sm:text-lg max-w-md leading-relaxed"
        >
          Pâte tournée minute, garnitures locales, servie chaude sur commande. Une adresse de quartier qui prend la crêpe au sérieux.
        </p>

        <PastilleBoutique />

        <div
          style={{ animationDelay: '450ms' }}
          className="kc-apparait mt-9 flex flex-wrap gap-3"
        >
          <a href="#carte" className="appui inline-flex items-center gap-2 bg-stone-900 hover:bg-amber-700 text-white font-semibold px-7 py-4 rounded-lg transition-colors">
            <Utensils className="w-4 h-4" />
            <span>Voir la carte</span>
          </a>
          <Link href="/suivi" className="appui inline-flex items-center gap-2 border-2 border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-white font-semibold px-6 py-4 rounded-lg transition-colors">
            <span>Suivre ma commande</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Colonne vidéo */}
      <div className="relative min-h-[340px] lg:min-h-0 order-1 lg:order-2 overflow-hidden">
        {/* 720p sans piste audio : 0,5 Mo (WebM) / 0,7 Mo (MP4). Le poster
            s'affiche immédiatement (LCP) et sert de repli si l'autoplay est
            bloqué (mode économie de données). */}
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster="/videos/hero-poster.jpg"
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/videos/hero-bg.webm" type="video/webm" />
          <source src="/videos/hero-bg.mp4" type="video/mp4" />
        </video>

        {/* Dégradé qui fond la vidéo vers le crème, pas de voile noir */}
        <div className="absolute inset-0 bg-gradient-to-r from-creme via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />

        <div
          style={{ animationDelay: '600ms' }}
          className="kc-apparait absolute bottom-6 left-6 lg:bottom-10 lg:left-10 bg-white border border-stone-200 rounded-xl shadow-[0_8px_24px_-12px_rgba(42,27,18,0.08)] px-5 py-4 flex items-center gap-3"
        >
          <span className="font-serif text-2xl font-semibold text-amber-700">50+</span>
          <span className="text-xs text-stone-600 leading-tight max-w-[110px]">
            crêpes et formules à composer
          </span>
        </div>
      </div>
    </section>
  );
}
