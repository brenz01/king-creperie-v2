import Link from 'next/link';
import { Banknote, Bike } from 'lucide-react';
import PlaqueAccueil from './accueil/PlaqueAccueil';
import { PastilleBoutique } from './StatutBoutique';

// Accueil asymétrique : le titre en lettrage d'enseigne à gauche, la
// plaque qui déborde à droite. Les informations pratiques (livraison,
// paiement, ouverture) sont lisibles sans attendre l'animation.
export default function HeroSection() {
  return (
    <section aria-labelledby="titre-accueil" className="relative overflow-hidden bg-kc-indigo text-kc-beurre pt-16">
      <div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-6 pb-12 md:py-20 md:grid md:grid-cols-[1.15fr_1fr] md:items-center md:gap-10">
        {/* La plaque, en débord à droite sur téléphone */}
        <div className="relative md:order-2 h-[min(78vw,22rem)] md:h-auto">
          <div className="absolute -right-[22vw] -top-2 w-[min(92vw,26rem)] aspect-square md:static md:w-full md:max-w-[30rem] md:mx-auto">
            <div className="absolute inset-0 rounded-full bg-kc-nuit shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7)]" />
            <div className="absolute inset-[5%]">
              <PlaqueAccueil />
            </div>
          </div>
        </div>

        <div className="relative md:order-1 -mt-16 md:mt-0">
          <h1
            id="titre-accueil"
            className="font-display text-[clamp(3.1rem,15vw,6.6rem)] leading-[0.92] tracking-tight max-w-[9ch] md:max-w-none"
          >
            Chaude, sortie de la plaque.
          </h1>
          <p className="mt-5 max-w-[30ch] text-lg leading-relaxed text-kc-brume">
            Crêpes salées, sucrées et jus maison, préparés minute aux Almadies.
          </p>

          <ul className="mt-5 space-y-2 text-[0.95rem] text-kc-lait">
            <li className="flex items-center gap-2.5">
              <Bike className="w-5 h-5 shrink-0 text-kc-caramel" aria-hidden />
              {/* Espaces fines insécables dans les nombres, insécable avant F : jamais « 2 / 000 F ». */}
              Livrées de Ngor au Plateau, de 1&#8239;000 à 2&#8239;000&nbsp;F selon le quartier
            </li>
            <li className="flex items-center gap-2.5">
              <Banknote className="w-5 h-5 shrink-0 text-kc-caramel" aria-hidden />
              Paiement en espèces à la réception
            </li>
          </ul>
          <PastilleBoutique />

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href="#carte"
              className="appui inline-flex items-center bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold text-base px-7 py-4 rounded-full"
            >
              Voir la carte
            </a>
            <Link
              href="/suivi"
              className="py-2.5 font-semibold text-kc-beurre underline underline-offset-4 decoration-kc-beurre/40 hover:decoration-kc-beurre"
            >
              Suivre ma commande
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
