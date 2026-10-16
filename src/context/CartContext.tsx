'use client';

import React, { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import type { Produit } from '@/types';
import type { Extra } from '@/lib/extras';

export interface CartItem {
  produit: Produit;
  quantite: number;
}

// Identité d'une ligne = produit + extras choisis (triés). Deux mêmes
// crêpes avec des extras différents sont deux lignes distinctes, et
// +/−/supprimer agissent sur LA ligne, pas sur toutes les lignes du produit.
export function cleLigne(produit: Produit): string {
  const extras = (produit.extrasChoisis ?? []).map((e) => e.id).sort().join(',');
  return `${produit.id}|${extras}`;
}

// ---------------------------------------------------------------
// Store externe adossé à localStorage, lu via useSyncExternalStore :
// pas de setState dans un effet, pas d'écrasement du panier au montage
// (bug StrictMode de l'ancienne version), synchro entre onglets.
// ---------------------------------------------------------------
const CLE_STORAGE = 'king_creperie_cart';
const PANIER_VIDE: CartItem[] = [];
let cache: CartItem[] | null = null;
const abonnes = new Set<() => void>();

function lire(): CartItem[] {
  if (cache !== null) return cache;
  try {
    const brut = localStorage.getItem(CLE_STORAGE);
    const parse: unknown = brut ? JSON.parse(brut) : [];
    cache = Array.isArray(parse)
      ? parse.filter(
          (i): i is CartItem =>
            !!i && typeof i === 'object' && typeof i.quantite === 'number' && typeof i.produit?.id === 'string'
        )
      : [];
  } catch {
    cache = [];
  }
  return cache;
}

function ecrire(suivant: CartItem[]) {
  cache = suivant;
  try {
    localStorage.setItem(CLE_STORAGE, JSON.stringify(suivant));
  } catch {
    // stockage indisponible (navigation privée stricte) : panier en mémoire
  }
  abonnes.forEach((f) => f());
}

function sAbonner(f: () => void) {
  abonnes.add(f);
  const surStorage = (e: StorageEvent) => {
    if (e.key === CLE_STORAGE) {
      cache = null;
      f();
    }
  };
  window.addEventListener('storage', surStorage);
  return () => {
    abonnes.delete(f);
    window.removeEventListener('storage', surStorage);
  };
}

// Résultat d'une resynchronisation du panier avec le catalogue réel.
export interface ChangementsPanier {
  retires: string[]; // produits (ou extras) qui ne sont plus disponibles
  prixModifies: string[]; // lignes dont le prix a changé depuis l'ajout
}

// Recalcule chaque ligne à partir du catalogue frais : le panier est
// stocké dans localStorage avec les prix du moment de l'ajout, qui
// peuvent avoir changé (ou le produit être épuisé) depuis. Sans ça, le
// client voit un total différent de celui que le serveur facture.
export function reconcilierPanier(
  panier: CartItem[],
  produits: Produit[],
  extras: readonly Extra[]
): { panier: CartItem[]; changements: ChangementsPanier } {
  const produitsMap = new Map(produits.map((p) => [p.id, p]));
  const extrasMap = new Map(extras.map((e) => [e.id, e]));
  const retires: string[] = [];
  const prixModifies: string[] = [];
  const suivant: CartItem[] = [];

  for (const item of panier) {
    const frais = produitsMap.get(item.produit.id);
    const epuise = !frais || !frais.disponible || (frais.stock_gere === true && frais.stock_quantite === 0);
    if (epuise) {
      retires.push(item.produit.nom);
      continue;
    }
    const choisis = item.produit.extrasChoisis ?? [];
    const extrasFrais = choisis.map((e) => extrasMap.get(e.id));
    if (extrasFrais.some((e) => !e)) {
      retires.push(item.produit.nom);
      continue;
    }
    const liste = extrasFrais as Extra[];
    const prix = frais.prix + liste.reduce((s, e) => s + e.prix, 0);
    const nom = liste.length > 0 ? `${frais.nom} (${liste.map((e) => e.nom).join(', ')})` : frais.nom;
    if (prix !== item.produit.prix) prixModifies.push(nom);
    suivant.push({
      ...item,
      produit: {
        ...frais,
        nom,
        prix,
        prixBase: frais.prix,
        extrasChoisis: liste.length > 0 ? liste.map((e) => ({ id: e.id, nom: e.nom, prix: e.prix })) : undefined,
      },
    });
  }
  return { panier: suivant, changements: { retires, prixModifies } };
}

interface CartContextType {
  cart: CartItem[];
  synchroniser: (produits: Produit[], extras: readonly Extra[]) => ChangementsPanier;
  addToCart: (produit: Produit, quantite?: number) => void;
  removeFromCart: (cle: string) => void;
  updateQuantity: (cle: string, delta: number) => void;
  clearCart: () => void;
  totalCount: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const cart = useSyncExternalStore(sAbonner, lire, () => PANIER_VIDE);

  const addToCart = useCallback((produit: Produit, quantite = 1) => {
    const cle = cleLigne(produit);
    const actuel = lire();
    const existant = actuel.find((i) => cleLigne(i.produit) === cle);
    ecrire(
      existant
        ? actuel.map((i) => (i === existant ? { ...i, quantite: Math.min(20, i.quantite + quantite) } : i))
        : [...actuel, { produit, quantite: Math.min(20, quantite) }]
    );
  }, []);

  const removeFromCart = useCallback((cle: string) => {
    ecrire(lire().filter((i) => cleLigne(i.produit) !== cle));
  }, []);

  const updateQuantity = useCallback((cle: string, delta: number) => {
    ecrire(
      lire()
        .map((i) => (cleLigne(i.produit) === cle ? { ...i, quantite: Math.min(20, i.quantite + delta) } : i))
        .filter((i) => i.quantite > 0)
    );
  }, []);

  const clearCart = useCallback(() => ecrire([]), []);

  const synchroniser = useCallback((produits: Produit[], extras: readonly Extra[]) => {
    const actuel = lire();
    const { panier, changements } = reconcilierPanier(actuel, produits, extras);
    const modifie =
      changements.retires.length > 0 ||
      panier.some((l, i) => l.produit.prix !== actuel[i]?.produit.prix || l.produit.nom !== actuel[i]?.produit.nom);
    if (modifie) ecrire(panier);
    return changements;
  }, []);

  const value = useMemo<CartContextType>(
    () => ({
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      synchroniser,
      totalCount: cart.reduce((s, i) => s + i.quantite, 0),
      totalAmount: cart.reduce((s, i) => s + i.produit.prix * i.quantite, 0),
    }),
    [cart, addToCart, removeFromCart, updateQuantity, clearCart, synchroniser]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart doit être utilisé dans CartProvider');
  return context;
}
