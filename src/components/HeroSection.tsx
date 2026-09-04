'use client';

import { motion } from 'framer-motion';
import { ArrowDown, Utensils } from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="relative h-screen w-full flex items-center justify-center overflow-hidden bg-stone-950">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-40 scale-105 filter brightness-90"
      >
        <source src="/videos/hero-bg.mp4" type="video/mp4" />
      </video>

      {/* Dégradé Chocolat & Ambre */}
      <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-900/50 to-black/70 z-10" />

      <div className="relative z-20 text-center px-4 max-w-4xl mx-auto flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-600/20 border border-amber-500/30 text-amber-400 text-xs md:text-sm font-semibold uppercase tracking-widest mb-6 backdrop-blur-sm"
        >
          <span>👑 Les Almadies · Dakar</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-5xl md:text-8xl font-black text-stone-50 tracking-tight leading-none uppercase font-serif"
        >
          KING <span className="text-amber-500 italic">CRÊPERIE</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-6 text-base md:text-xl text-stone-200 font-light max-w-xl leading-relaxed"
        >
          L'authenticité de la crêpe bretonne retravaillée aux saveurs locales dakaroises. Une expérience gourmande d'exception.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-10 flex flex-wrap justify-center gap-4"
        >
          <a
            href="#menu"
            className="px-8 py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-full shadow-lg shadow-amber-600/25 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <Utensils className="w-5 h-5" />
            <span>Découvrir le Menu</span>
          </a>
        </motion.div>
      </div>

      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 text-stone-400"
      >
        <ArrowDown className="w-6 h-6" />
      </motion.div>
    </section>
  );
}