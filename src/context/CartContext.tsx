'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Produit } from '@/types';

export interface CartItem {
  produit: Produit;
  quantite: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (produit: Produit) => void;
  removeFromCart: (produitId: string) => void;
  updateQuantity: (produitId: string, delta: number) => void;
  clearCart: () => void;
  totalCount: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('king_creperie_cart');
    if (saved) {
      try {
        setCart(JSON.parse(saved));
      } catch (e) {
        console.error('Erreur lecture panier:', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('king_creperie_cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (produit: Produit) => {
  setCart((prev) => {
    // La clé d'unicité inclut maintenant les extras : deux mêmes
    // crêpes avec des extras différents sont deux lignes distinctes.
    const cleExtras = (produit.extrasChoisis || [])
      .map((e) => e.id)
      .sort()
      .join(',');

    const existing = prev.find(
      (item) =>
        item.produit.id === produit.id &&
        (item.produit.extrasChoisis || []).map((e) => e.id).sort().join(',') === cleExtras
    );

    if (existing) {
      return prev.map((item) =>
        item === existing
          ? { ...item, quantite: item.quantite + 1 }
          : item
      );
    }
    return [...prev, { produit, quantite: 1 }];
  });
};

  const removeFromCart = (produitId: string) => {
    setCart((prev) => prev.filter((item) => item.produit.id !== produitId));
  };

  const updateQuantity = (produitId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.produit.id === produitId) {
            const newQty = item.quantite + delta;
            return newQty > 0 ? { ...item, quantite: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const clearCart = () => setCart([]);

  const totalCount = cart.reduce((sum, item) => sum + item.quantite, 0);
  const totalAmount = cart.reduce(
    (sum, item) => sum + item.produit.prix * item.quantite,
    0
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalCount,
        totalAmount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart doit être utilisé dans CartProvider');
  return context;
}