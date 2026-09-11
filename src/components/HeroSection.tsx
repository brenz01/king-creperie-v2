'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Utensils } from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="relative w-full min-h-screen grid grid-cols-1 lg:grid-cols-2 items-stretch bg-brand-cream">
      {/* Colonne texte */}
      <div className="flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-24 lg:py-0 order-2 lg:order-1">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="inline-flex items-center gap-2 mb-6 text-amber-700 text-xs sm:text-sm font-bold uppercase tracking-wide"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-700" />
          <span>Les Almadies · Dakar</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="font-serif text-5xl sm:text-6xl lg:text-[3.6rem] leading-[1.02] text-stone-900 mb-6"
        >
          La crêpe bretonne,
          <br />
          <em className="italic font-medium text-amber-700">version Dakar</em>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="text-stone-600 text-base sm:text-lg max-w-md mb-10 leading-relaxed"
        >
          Pâte tournée minute, garnitures locales, servie chaude sur commande. Une adresse de quartier qui prend la crêpe au sérieux.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="flex flex-wrap gap-3"
        >
          <a href="#menu" className="inline-flex items-center gap-2 bg-stone-900 hover:bg-amber-700 text-white font-bold px-7 py-4 rounded-lg transition-colors">
            <Utensils className="w-4 h-4" />
            <span>Voir la carte</span>
          </a>
          <a href="/suivi" className="inline-flex items-center gap-2 border-2 border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-white font-bold px-6 py-4 rounded-lg transition-colors">
            <span>Suivre ma commande</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>
      </div>

      {/* Colonne vidéo */}
      <div className="relative min-h-[340px] lg:min-h-0 order-1 lg:order-2 overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/videos/hero-bg.mp4" type="video/mp4" />
        </video>

        {/* Dégradé qui fond la vidéo vers le crème, pas de voile noir */}
        <div className="absolute inset-0 bg-gradient-to-r from-brand-cream via-transparent to-transparent lg:from-brand-cream lg:via-transparent lg:to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="absolute bottom-6 left-6 lg:bottom-10 lg:left-10 bg-white rounded-xl shadow-lg px-5 py-4 flex items-center gap-3"
        >
          <span className="font-serif text-2xl font-bold text-amber-700">50+</span>
          <span className="text-xs text-stone-600 leading-tight max-w-[110px]">
            crêpes et formules à composer
          </span>
        </motion.div>
      </div>
    </section>
  );
}