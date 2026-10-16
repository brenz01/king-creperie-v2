'use client';

import React, { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import type { Produit } from '@/types';

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

interface CartContextType {
  cart: CartItem[];
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

  const value = useMemo<CartContextType>(
    () => ({
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      totalCount: cart.reduce((s, i) => s + i.quantite, 0),
      totalAmount: cart.reduce((s, i) => s + i.produit.prix * i.quantite, 0),
    }),
    [cart, addToCart, removeFromCart, updateQuantity, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart doit être utilisé dans CartProvider');
  return context;
}
