'use client';

import { useEffect, useState } from 'react';
import type { Produit } from '@/types';
import type { Extra } from '@/lib/extras';
import { useCart } from '@/context/CartContext';
import { motion, useDragControls } from 'framer-motion';
import { X, Plus, Minus, Check, Share2 } from 'lucide-react';
import { confirmerAjout } from '@/lib/toast';
import { urlPartage } from '@/lib/whatsapp';
import Image from 'next/image';

interface ProductModalProps {
  produit: Produit;
  extras: readonly Extra[];
  onClose: () => void;
}

// Fiche produit en « bottom sheet » : la crêpe déborde en haut de la
// feuille, puis extras, quantité, et un seul bouton qui affiche le total.
export default function ProductModal({ produit, extras, onClose }: ProductModalProps) {
  const { addToCart } = useCart();
  const [selection, setSelection] = useState<Extra[]>([]);
  const [quantite, setQuantite] = useState(1);
  // Fermer en tirant la feuille vers le bas, depuis la crêpe ou la poignée
  // (pas depuis la liste, qui doit pouvoir défiler).
  const tirer = useDragControls();
  const saisir = (e: React.PointerEvent) => tirer.start(e);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const basculer = (extra: Extra) =>
    setSelection((prev) => (prev.some((e) => e.id === extra.id) ? prev.filter((e) => e.id !== extra.id) : [...prev, extra]));

  const prixUnitaire = produit.prix + selection.reduce((s, e) => s + e.prix, 0);
  const total = prixUnitaire * quantite;

  const ajouter = () => {
    if (!produit.disponible) return;
    const nomComplet = selection.length > 0 ? `${produit.nom} (${selection.map((s) => s.nom).join(', ')})` : produit.nom;
    addToCart(
      {
        ...produit,
        nom: nomComplet,
        prix: prixUnitaire,
        prixBase: produit.prix,
        extrasChoisis: selection.map((s) => ({ id: s.id, nom: s.nom, prix: s.prix })),
      },
      quantite,
    );
    confirmerAjout(quantite > 1 ? `${quantite} crêpes ajoutées` : 'Crêpe ajoutée');
    onClose();
  };

  // Partage d'une crêpe précise : le lien rouvre directement sa fiche.
  const partager = async () => {
    const lien = `${window.location.origin}/?produit=${produit.id}#carte`;
    const texte = `Celle-là me tente bien chez King Crêperie : ${produit.nom}, ${produit.prix.toLocaleString('fr-FR')} F.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: produit.nom, text: texte, url: lien });
        return;
      } catch {
        // partage annulé : rien à faire
        return;
      }
    }
    window.open(urlPartage(`${texte} ${lien}`), '_blank', 'noopener');
  };

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-kc-nuit/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-produit"
        drag="y"
        dragControls={tirer}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 650) onClose();
        }}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-md bg-kc-lait text-kc-encre rounded-t-[2rem] sm:rounded-[2rem] mt-28 max-h-[calc(100dvh-7rem)] flex flex-col"
      >
        {/* La crêpe qui déborde */}
        <div
          onPointerDown={saisir}
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-kc-nuit p-2.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)] touch-none"
        >
          <div className="relative w-full h-full rounded-full overflow-hidden">
            {produit.image_url && (
              <Image src={produit.image_url} alt="" fill unoptimized sizes="192px" className="object-cover" />
            )}
          </div>
        </div>

        {/* Poignée : tirer vers le bas pour fermer (mobile). */}
        <div
          onPointerDown={saisir}
          aria-hidden
          className="sm:hidden absolute top-0 inset-x-0 h-24 touch-none flex justify-center pt-2.5"
        >
          <span className="w-10 h-1.5 rounded-full bg-kc-encre/15" />
        </div>

        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 w-11 h-11 rounded-full bg-kc-encre/5 hover:bg-kc-encre/10 flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="overflow-y-auto overscroll-contain px-6 pt-28 pb-4">
          <h3 id="titre-produit" className="font-display text-3xl leading-tight text-center">
            {produit.nom}
          </h3>
          {produit.description && (
            <p className="mt-2 text-center text-base text-kc-encre/75 leading-relaxed">{produit.description}</p>
          )}
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => void partager()}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-kc-indigo px-3 py-2 rounded-full hover:bg-kc-indigo/5"
            >
              <Share2 className="w-4 h-4" /> Partager cette crêpe
            </button>
          </div>

          {extras.length > 0 && (
            <fieldset className="mt-7">
              <legend className="text-base font-semibold">
                Extras <span className="font-normal text-kc-encre/55">(facultatif)</span>
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {extras.map((extra) => {
                  const actif = selection.some((s) => s.id === extra.id);
                  return (
                    <button
                      key={extra.id}
                      type="button"
                      aria-pressed={actif}
                      onClick={() => basculer(extra)}
                      className={`inline-flex items-center gap-1.5 pl-3 pr-3.5 py-2 rounded-full text-sm font-medium border transition-colors ${
                        actif
                          ? 'bg-kc-indigo border-kc-indigo text-kc-beurre'
                          : 'bg-white border-kc-encre/15 text-kc-encre hover:border-kc-encre/40'
                      }`}
                    >
                      {actif ? <Check className="w-4 h-4" strokeWidth={3} /> : <Plus className="w-4 h-4" />}
                      {extra.nom}
                      <span className={`prix ${actif ? 'text-kc-beurre/80' : 'text-kc-encre/55'}`}>
                        +{extra.prix.toLocaleString('fr-FR')} F
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="mt-7 flex items-center justify-between">
            <span className="text-base font-semibold">Quantité</span>
            <div className="flex items-center gap-1 bg-white border border-kc-encre/10 rounded-full p-1">
              <button
                type="button"
                aria-label="Une de moins"
                onClick={() => setQuantite((q) => Math.max(1, q - 1))}
                className="w-11 h-11 rounded-full hover:bg-kc-encre/5 flex items-center justify-center"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center font-display text-xl" aria-live="polite">
                {quantite}
              </span>
              <button
                type="button"
                aria-label="Une de plus"
                onClick={() => setQuantite((q) => Math.min(20, q + 1))}
                className="w-11 h-11 rounded-full hover:bg-kc-encre/5 flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-kc-encre/10">
          <button
            type="button"
            onClick={ajouter}
            disabled={!produit.disponible}
            className="w-full bg-kc-bissap hover:bg-kc-bissap-fonce text-white font-semibold py-4 px-6 rounded-full flex items-center justify-between transition-colors disabled:opacity-50"
          >
            <span>{produit.disponible ? 'Ajouter au panier' : 'Indisponible'}</span>
            <span className="prix text-xl">{total.toLocaleString('fr-FR')} F</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
