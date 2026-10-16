'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Produit } from '@/types';
import { estPersonnalisable } from '@/lib/extras';
import { estEpuise, memoriserOrigine, portionsRestantes, prixF } from '@/lib/produit';

interface PlaqueTournanteProps {
  produits: Produit[];
  libelle: string;
  onComposer: (p: Produit) => void;
  onAjouter: (p: Produit, photo: HTMLElement | null) => void;
}

// La signature de la carte : les recettes posées sur le bord d'une plaque
// qui tourne sous le doigt. Le défilement reste natif (inertie, clavier,
// lecteurs d'écran) ; on ne fait que lire sa position pour placer chaque
// crêpe sur l'arc (variables CSS, aucun rendu React par image).
export default function PlaqueTournante({ produits, libelle, onComposer, onAjouter }: PlaqueTournanteProps) {
  const rail = useRef<HTMLUListElement>(null);
  const cadre = useRef<HTMLDivElement>(null);
  const [actif, setActif] = useState(0);
  const actifRef = useRef(0);
  const image = useRef(0);

  const placer = useCallback(() => {
    const ul = rail.current;
    if (!ul) return;
    const milieu = ul.scrollLeft + ul.clientWidth / 2;
    const items = ul.children as HTMLCollectionOf<HTMLElement>;
    let pas = 1;
    if (items.length > 1) pas = items[1].offsetLeft - items[0].offsetLeft || 1;
    let proche = 0;
    let min = Infinity;
    for (let i = 0; i < items.length; i++) {
      const el = items[i];
      const d = (el.offsetLeft + el.offsetWidth / 2 - milieu) / pas;
      const ad = Math.abs(d);
      if (ad < 3.5 || el.dataset.vu === '1') {
        el.style.setProperty('--d', d.toFixed(3));
        el.style.setProperty('--ad', ad.toFixed(3));
        el.dataset.vu = ad < 3.5 ? '1' : '';
      }
      if (ad < min) {
        min = ad;
        proche = i;
      }
    }
    cadre.current?.style.setProperty('--tour', `${(ul.scrollLeft * 0.12).toFixed(1)}deg`);
    if (proche !== actifRef.current) {
      actifRef.current = proche;
      setActif(proche);
    }
  }, []);

  const auDefilement = () => {
    cancelAnimationFrame(image.current);
    image.current = requestAnimationFrame(placer);
  };

  useLayoutEffect(() => {
    placer();
  }, [placer, produits]);

  useEffect(() => {
    const surRedim = () => placer();
    window.addEventListener('resize', surRedim);
    return () => {
      window.removeEventListener('resize', surRedim);
      cancelAnimationFrame(image.current);
    };
  }, [placer]);

  const centrer = (i: number) => {
    const ul = rail.current;
    const el = ul?.children[i] as HTMLElement | undefined;
    if (!ul || !el) return;
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ul.scrollTo({ left: el.offsetLeft + el.offsetWidth / 2 - ul.clientWidth / 2, behavior: reduit ? 'auto' : 'smooth' });
  };

  const p = produits[actif];
  if (!p) return null;
  const epuise = estEpuise(p);
  const aComposer = estPersonnalisable(p.categorie);
  const restant = portionsRestantes(p);
  const photoActive = () => rail.current?.children[actif]?.querySelector<HTMLElement>('[data-photo]') ?? null;

  const agir = () => {
    if (epuise) return;
    if (aComposer) {
      memoriserOrigine(photoActive()?.getBoundingClientRect() ?? null);
      onComposer(p);
    } else {
      onAjouter(p, photoActive());
    }
  };

  return (
    <div ref={cadre} className="relative isolate">
      {/* La plaque : cercles de pâte qui tournent avec le défilement. */}
      <svg
        aria-hidden
        viewBox="-100 -100 200 200"
        className="pointer-events-none absolute -z-10 left-1/2 top-[50%] -translate-x-1/2 -translate-y-1/2 w-[150vw] max-w-[44rem] aspect-square"
      >
        <circle r="98" className="fill-kc-nuit" />
        <g style={{ transform: 'rotate(var(--tour, 0deg))', transformOrigin: 'center' }} className="stroke-kc-beurre" fill="none">
          <circle r="90" strokeOpacity="0.07" strokeWidth="0.6" strokeDasharray="3 5" />
          <circle r="76" strokeOpacity="0.06" strokeWidth="0.5" strokeDasharray="12 7" />
          <circle r="60" strokeOpacity="0.05" strokeWidth="0.5" strokeDasharray="22 9" />
        </g>
      </svg>

      {/* pb-44 / -mb-34 : les crêpes descendent sur l'arc et sortaient de
          la zone visible du rail (overflow-x impose aussi overflow-y).
          Marge nette inchangée (2,5 rem) ; la scène reste au-dessus. */}
      <ul
        ref={rail}
        onScroll={auDefilement}
        aria-label={libelle}
        className="plaque-tour relative flex overflow-x-auto overscroll-x-contain snap-x snap-mandatory scrollbar-none pt-8 pb-44 -mb-34 px-[calc(50%-min(26vw,7rem))] sm:px-[calc(50%-8rem)]"
      >
        {produits.map((prod, i) => {
          const ko = estEpuise(prod);
          const centre = i === actif;
          return (
            <li key={prod.id} className="snap-center shrink-0 w-[min(52vw,14rem)] sm:w-64 flex justify-center">
              <button
                type="button"
                onClick={() => (centre ? agir() : centrer(i))}
                onFocus={() => !centre && centrer(i)}
                aria-current={centre ? 'true' : undefined}
                aria-label={`${prod.nom}, ${prixF(prod.prix)}${ko ? ', épuisé' : ''}`}
                className="appui relative w-full aspect-square max-w-full rounded-full"
              >
                <span className="absolute inset-0 rounded-full bg-kc-nuit shadow-[0_24px_40px_-18px_rgba(0,0,0,0.75)] ring-1 ring-kc-beurre/10" />
                <span data-photo className="photo-tourne absolute inset-[6%] rounded-full overflow-hidden bg-kc-indigo">
                  {prod.image_url && (
                    <Image
                      src={prod.image_url}
                      alt=""
                      fill
                      unoptimized
                      sizes="(min-width: 640px) 256px, 52vw"
                      loading={i < 3 ? 'eager' : 'lazy'}
                      className={`object-cover ${ko ? 'grayscale opacity-45' : ''}`}
                    />
                  )}
                </span>
                {ko && (
                  <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto w-fit rounded-full bg-kc-lait px-3 py-1 text-sm font-semibold text-kc-encre">
                    Épuisé
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* La scène : la recette au centre de la plaque, lisible en entier. */}
      <div className="relative max-w-xl mx-auto px-5 sm:px-6 -mt-2 pb-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => centrer(Math.max(0, actif - 1))}
            disabled={actif === 0}
            aria-label="Recette précédente"
            className="appui shrink-0 w-11 h-11 rounded-full border border-kc-beurre/35 text-kc-beurre flex items-center justify-center disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div key={p.id} className="kc-apparait flex-1 min-w-0 text-center" aria-live="polite">
            <p className="text-sm text-kc-brume tabular-nums">
              {actif + 1} sur {produits.length}
            </p>
            <h3 className="mt-1 text-[1.6rem] leading-tight font-extrabold text-kc-beurre text-balance">{p.nom}</h3>
          </div>
          <button
            type="button"
            onClick={() => centrer(Math.min(produits.length - 1, actif + 1))}
            disabled={actif === produits.length - 1}
            aria-label="Recette suivante"
            className="appui shrink-0 w-11 h-11 rounded-full border border-kc-beurre/35 text-kc-beurre flex items-center justify-center disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div key={`${p.id}-d`} className="kc-apparait text-center">
          {p.description && <p className="mt-2 text-kc-brume leading-relaxed line-clamp-2 min-h-[3.2em]">{p.description}</p>}
          <p className="mt-3 flex items-baseline justify-center gap-3">
            <span className="prix text-3xl text-kc-caramel">{prixF(p.prix)}</span>
            {restant && <span className="text-sm font-semibold text-kc-beurre">Plus que {restant}</span>}
          </p>
        </div>

        <button
          type="button"
          onClick={agir}
          disabled={epuise}
          className="appui mt-4 w-full rounded-full bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold text-base py-4 flex items-center justify-center gap-2 disabled:bg-kc-brume/20 disabled:text-kc-brume"
        >
          {epuise ? (
            'Épuisé pour le moment'
          ) : aComposer ? (
            'Composer cette crêpe'
          ) : (
            <>
              <Plus className="w-5 h-5" strokeWidth={2.6} /> Ajouter au panier
            </>
          )}
        </button>
      </div>
    </div>
  );
}
