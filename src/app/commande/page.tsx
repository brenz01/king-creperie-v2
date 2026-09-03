'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Send, MapPin, Phone, User, Trash2, ArrowLeft, Clock } from 'lucide-react';
import Link from 'next/link';

const ZONES_LIVRAISON = [
  { id: 1, nom: 'Zone 1 (Almadies, Ngor, Ouakam)', prix: 1000 },
  { id: 2, nom: 'Zone 2 (Mermoz, Fann, Point E, Liberté 6)', prix: 1500 },
  { id: 3, nom: 'Zone 3 (Plateau, Yoff, Maristes, VDN)', prix: 2000 },
];

export default function CommandePage() {
  const { cart, totalAmount, updateQuantity, removeFromCart, clearCart } = useCart();
  const router = useRouter();

  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [adresse, setAdresse] = useState('');
  const [zoneIndex, setZoneIndex] = useState(0);
  const [creneau, setCreneau] = useState('Au plus vite');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fraisLivraison = ZONES_LIVRAISON[zoneIndex].prix;
  const totalGeneral = totalAmount + fraisLivraison;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Insertion de la commande dans Supabase
      const { data: commande, error: commandeError } = await supabase
        .from('commandes')
        .insert({
          client_nom: nom,
          client_telephone: telephone,
          adresse_livraison: `${adresse} (${ZONES_LIVRAISON[zoneIndex].nom})`,
          creneau_souhaite: creneau,
          total: totalGeneral,
          statut: 'recue',
        })
        .select()
        .single();

      if (commandeError) throw commandeError;

      // 2. Insertion des articles associés
      const itemsToInsert = cart.map((item) => ({
        commande_id: commande.id,
        produit_id: item.produit.id,
        nom_produit: item.produit.nom,
        quantite: item.quantite,
        prix_unitaire: item.produit.prix,
      }));

      const { error: itemsError } = await supabase
        .from('commande_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // 3. Generation du message WhatsApp
      const itemsListText = cart
        .map((item) => `• ${item.quantite}x ${item.produit.nom} (${(item.produit.prix * item.quantite).toLocaleString('fr-FR')} FCFA)`)
        .join('\n');

      const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '221778335781';
      const textWhatsApp = `👑 *NOUVELLE COMMANDE KING CRÊPERIE*\n\n` +
        `🆔 *N° Commande :* #${commande.id.slice(0, 8)}\n` +
        `👤 *Client :* ${nom}\n` +
        `📞 *Tel :* ${telephone}\n` +
        `📍 *Adresse :* ${adresse} (${ZONES_LIVRAISON[zoneIndex].nom})\n` +
        `⏰ *Créneau :* ${creneau}\n\n` +
        `📜 *DÉTAILS DU PANIER :*\n${itemsListText}\n\n` +
        `🚚 *Livraison :* ${fraisLivraison.toLocaleString('fr-FR')} FCFA\n` +
        `💰 *TOTAL À PAYER :* *${totalGeneral.toLocaleString('fr-FR')} FCFA*\n\n` +
        `🔗 *Suivi en direct :* ${window.location.origin}/suivi?id=${commande.id}`;

      const urlWhatsApp = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(textWhatsApp)}`;

      // 4. Nettoyage du panier et redirection
      clearCart();
      window.open(urlWhatsApp, '_blank');
      router.push(`/suivi?id=${commande.id}`);
    } catch (err: any) {
      console.error('Erreur commande:', err);
      setErrorMsg('Une erreur est survenue lors de la création de la commande.');
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen pt-32 pb-16 px-6 max-w-2xl mx-auto text-center flex flex-col items-center justify-center">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl w-full">
          <h1 className="text-2xl font-bold font-serif text-white mb-2">Votre panier est vide</h1>
          <p className="text-slate-400 mb-6">Ajoutez quelques crêpes depuis notre carte avant d'effectuer une commande.</p>
          <Link
            href="/#menu"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 rounded-full transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retourner au Menu</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 pb-16 px-6 max-w-5xl mx-auto">
      <Link href="/#menu" className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-400 text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Continuer mes achats</span>
      </Link>

      <h1 className="text-3xl md:text-4xl font-black font-serif text-white mb-8">
        Validation de la <span className="text-amber-400">Commande</span>
      </h1>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl mb-6 text-sm">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Formulaire Informations Client */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 bg-slate-900/90 border border-slate-800 p-6 md:p-8 rounded-3xl space-y-5">
          <h2 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-3">Informations de livraison</h2>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Nom & Prénom</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input
                type="text"
                required
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex: Babacar Diop"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Numéro Téléphone</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input
                type="tel"
                required
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="Ex: 77 000 00 00"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Zone de livraison</label>
            <select
              value={zoneIndex}
              onChange={(e) => setZoneIndex(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-amber-500"
            >
              {ZONES_LIVRAISON.map((z, idx) => (
                <option key={z.id} value={idx}>
                  {z.nom} (+{z.prix} FCFA)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Adresse Précise</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-3 text-slate-500 w-5 h-5" />
              <textarea
                required
                rows={2}
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                placeholder="Rue, Immeuble, Appt, Repère visuel..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Créneau Souhaité</label>
            <div className="relative">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input
                type="text"
                value={creneau}
                onChange={(e) => setCreneau(e.target.value)}
                placeholder="Ex: Au plus vite / 20h00"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
          >
            <Send className="w-5 h-5" />
            <span>{loading ? 'Traitement...' : 'Envoyer la commande via WhatsApp'}</span>
          </button>
        </form>

        {/* Récapitulatif du Panier */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 p-6 md:p-8 rounded-3xl h-fit">
          <h2 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-3">Récapitulatif</h2>

          <div className="space-y-4 max-h-80 overflow-y-auto pr-2 mb-6">
            {cart.map((item) => (
              <div key={item.produit.id} className="flex justify-between items-center border-b border-slate-800/60 pb-3">
                <div className="flex-1 pr-2">
                  <p className="font-bold text-slate-200 text-sm">{item.produit.nom}</p>
                  <p className="text-xs text-amber-400">{item.produit.prix.toLocaleString('fr-FR')} FCFA</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.produit.id, -1)}
                    className="bg-slate-800 text-white w-7 h-7 rounded-lg flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <span className="text-sm font-bold w-4 text-center">{item.quantite}</span>
                  <button
                    onClick={() => updateQuantity(item.produit.id, 1)}
                    className="bg-slate-800 text-white w-7 h-7 rounded-lg flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeFromCart(item.produit.id)}
                    className="text-red-400 hover:text-red-300 ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t border-slate-800 pt-4 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Sous-total</span>
              <span>{totalAmount.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Frais de livraison</span>
              <span>{fraisLivraison.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between text-lg font-black text-amber-400 border-t border-slate-800 pt-3">
              <span>Total Général</span>
              <span>{totalGeneral.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}