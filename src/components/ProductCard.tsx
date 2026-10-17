'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { Minus, Plus } from 'lucide-react';
import type { Produit } from '@/types';
import { cleLigne, useCart } from '@/context/CartContext';
import { estPersonnalisable } from '@/lib/extras';
import { estEpuise, messageStockAtteint, portionsRestantes, prixF, stockCommandable } from '@/lib/produit';
import { afficherToast, confirmerAjout } from '@/lib/toast';
import { envolerVersPanier } from '@/lib/volPanier';
import InfoBulle from './ui/InfoBulle';

interface ProductCardProps {
  produit: Produit;
  onOuvrir: (produit: Produit) => void;
  /** Rang dans la grille : décalage d'entrée (30 ms par carte, 180 ms max). */
  rang?: number;
  /** Image prioritaire (premières cartes visibles au chargement). */
  prioritaire?: boolean;
}

// Carte produit réduite à l'essentiel : la photo, le nom, le prix. Toucher
// la photo d'une crêpe ouvre la fiche (extras) ; le rond « + » ajoute tout
// de suite, la photo file vers le panier, et le rond devient un compteur.
export default function ProductCard({ produit, onOuvrir, rang = 0, prioritaire = false }: ProductCardProps) {
  const { cart, addToCart, updateQuantity, plafond } = useCart();
  const photo = useRef<HTMLDivElement>(null);
  const epuise = estEpuise(produit);
  const restantes = portionsRestantes(produit);
  const ouvrable = !epuise && estPersonnalisable(produit.categorie);

  // Ligne « nature » (sans extras) : c'est elle que le compteur pilote.
  const cle = cleLigne(produit);
  const quantite = cart.find((i) => cleLigne(i.produit) === cle)?.quantite ?? 0;

  // Stock suivi : le « + » s'arrête aux portions restantes.
  const stock = stockCommandable(produit);
  const complet = quantite >= plafond(produit);

  const ajouter = () => {
    if (addToCart(produit) === 0) {
      afficherToast(stock !== null ? messageStockAtteint(stock) : 'Quantité maximale atteinte', 2600, 'limite');
      return;
    }
    confirmerAjout('Ajouté au panier');
    envolerVersPanier(photo.current);
  };

  return (
    <article
      aria-label={produit.nom}
      style={{ animationDelay: `${Math.min(rang, 6) * 30}ms` }}
      className="kc-apparait group relative flex flex-col"
    >
      <div
        ref={photo}
        className="relative aspect-square rounded-2xl overflow-hidden bg-[#efe4d2] border border-stone-900/10 shadow-[0_6px_20px_-8px_rgba(42,27,18,0.07)]"
      >
        {produit.image_url ? (
          <Image
            src={produit.image_url}
            alt=""
            fill
            unoptimized
            priority={prioritaire}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={`object-cover transition-transform duration-300 ease-out motion-safe:group-hover:scale-[1.02] ${
              epuise ? 'grayscale opacity-60' : ''
            }`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-stone-600 text-sm">Photo à venir</div>
        )}

        {/* Toute la photo ouvre la fiche (crêpes) : grande cible au pouce. */}
        {ouvrable && (
          <button
            type="button"
            onClick={() => onOuvrir(produit)}
            aria-label={`Composer ${produit.nom}`}
            className="absolute inset-0 rounded-2xl focus-visible:outline-offset-[-3px]"
          />
        )}

        {(epuise || restantes !== null) && (
          <span
            className={`absolute top-2.5 left-2.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              epuise ? 'bg-stone-900 text-white' : 'bg-white text-rose-700 border border-rose-200'
            }`}
          >
            {epuise ? 'Épuisé' : `Plus que ${restantes}`}
          </span>
        )}

        {/* Le rond « + », puis le compteur, posé sur la photo. */}
        {!epuise && (
          <div className="absolute bottom-2.5 right-2.5">
            {quantite === 0 ? (
              <InfoBulle libelle="Ajouter au panier" cote="haut">
                <button
                  type="button"
                  onClick={ajouter}
                  aria-label={`Ajouter ${produit.nom}`}
                  className="appui w-11 h-11 rounded-full bg-white border border-stone-900/10 text-stone-900 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.25)] flex items-center justify-center pointer-fine:hover:bg-stone-900 pointer-fine:hover:text-white"
                >
                  <Plus className="w-5 h-5" strokeWidth={2.5} />
                </button>
              </InfoBulle>
            ) : (
              <div
                role="group"
                aria-label={`${produit.nom} au panier`}
                className="kc-fondu flex items-center h-11 rounded-full bg-stone-900 text-white shadow-[0_4px_12px_-4px_rgba(0,0,0,0.35)]"
              >
                <InfoBulle libelle="Retirer une" cote="haut">
                  <button
                    type="button"
                    onClick={() => updateQuantity(cle, -1)}
                    aria-label={`Une ${produit.nom} de moins`}
                    className="appui w-11 h-11 rounded-full flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </InfoBulle>
                <output key={quantite} className="kc-fondu min-w-5 text-center font-semibold tabular-nums" aria-live="polite">
                  {quantite}
                </output>
                <InfoBulle libelle={complet ? (stock !== null ? messageStockAtteint(stock) : 'Maximum atteint') : 'Ajouter une'} cote="haut">
                  <button
                    type="button"
                    onClick={ajouter}
                    aria-label={`Une ${produit.nom} de plus`}
                    aria-disabled={complet || undefined}
                    className={`appui w-11 h-11 rounded-full flex items-center justify-center ${complet ? 'text-white/35' : 'text-amber-300'}`}
                  >
                    <Plus className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </InfoBulle>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-3 px-0.5">
        <h3 className="font-serif text-base sm:text-lg font-semibold leading-snug text-stone-900 line-clamp-2">{produit.nom}</h3>
        <p className={`prix mt-0.5 ${epuise ? 'text-stone-600' : 'text-amber-800'}`}>{prixF(produit.prix)}</p>
        {/* Boissons : pas de fiche, le format (« 33 cl ») se lit ici. */}
        {!ouvrable && !epuise && produit.description && (
          <p className="mt-0.5 text-sm text-stone-600 line-clamp-1">{produit.description}</p>
        )}
      </div>
    </article>
  );
}
