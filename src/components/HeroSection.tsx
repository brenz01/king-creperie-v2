import Link from 'next/link';
import { PastilleBoutique } from './StatutBoutique';

// Accueil : une phrase, une crêpe qui tourne (la vidéo dans un cercle,
// comme sur la plaque), deux actions. Le cercle annonce la forme de
// toute la carte en dessous.
export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-kc-indigo text-kc-beurre pt-16">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 grid md:grid-cols-[1.1fr_1fr] items-center gap-6 md:gap-10 pt-6 pb-14 md:py-20">
        {/* La plaque */}
        <div className="relative order-1 md:order-2 flex justify-end md:justify-center">
          <div className="relative w-[78vw] max-w-[26rem] md:w-[30rem] md:max-w-none aspect-square -mr-[18vw] md:mr-0">
            <div className="absolute inset-0 rounded-full bg-kc-nuit shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]" />
            <div className="absolute inset-[5%] rounded-full overflow-hidden ring-[10px] ring-kc-caramel/25">
              <video
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                poster="/videos/hero-poster.jpg"
                aria-hidden="true"
                className="w-full h-full object-cover scale-110"
              >
                <source src="/videos/hero-bg.webm" type="video/webm" />
                <source src="/videos/hero-bg.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>

        <div className="order-2 md:order-1 -mt-10 md:mt-0 relative">
          <h1 className="font-display text-[2.35rem] leading-[1.04] sm:text-6xl md:text-[4.2rem] md:leading-[0.98] tracking-tight text-balance">
            Chaude, sortie de la plaque, livrée chez vous.
          </h1>
          <p className="mt-5 max-w-md text-base sm:text-lg text-kc-brume leading-relaxed">
            Crêpes salées, sucrées et jus maison. Préparées aux Almadies, livrées de Ngor au Plateau. Vous payez en espèces à la réception.
          </p>
          <PastilleBoutique />
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#carte"
              className="inline-flex items-center bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold text-base px-6 py-3.5 rounded-full transition-colors"
            >
              Choisir mes crêpes
            </a>
            <Link
              href="/suivi"
              className="inline-flex items-center border border-kc-beurre/40 hover:border-kc-beurre text-kc-beurre font-semibold text-base px-6 py-3.5 rounded-full transition-colors"
            >
              Suivre ma commande
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
