'use client';

import { useState, useRef } from 'react';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { Send, MapPin, Phone, User, Trash2, ArrowLeft, Clock } from 'lucide-react';
import Link from 'next/link';

const ZONES_LIVRAISON = [
  { id: 1, nom: 'Zone 1 (Almadies, Ngor, Ouakam)', prix: 1000 },
  { id: 2, nom: 'Zone 2 (Mermoz, Fann, Point E, Liberté 6)', prix: 1500 },
  { id: 3, nom: 'Zone 3 (Plateau, Yoff, Maristes, VDN)', prix: 2000 },
];

interface ItemServeur {
  produit_id: string;
  nom_produit: string;
  quantite: number;
  prix_unitaire: number;
  extras: Array<{ id: string; nom: string; prix: number }>;
}

interface ReponseCommande {
  id: string;
  statut: string;
  created_at: string;
  deja_existante: boolean;
  sous_total: number;
  frais_livraison: number;
  total: number;
  zone_nom: string;
  items: ItemServeur[];
}

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

  // Générée une seule fois au montage du composant — reste stable
  // même en cas de double-clic, garantissant que les deux tentatives
  // envoient la même clé et que le serveur détecte le doublon.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  // Empêche tout envoi concurrent, en plus du state loading —
  // filet de sécurité supplémentaire contre les double-clics
  // qui pourraient survenir avant que le re-render (loading=true)
  // ne désactive visuellement le bouton.
  const envoiEnCoursRef = useRef(false);

  const fraisLivraison = ZONES_LIVRAISON[zoneIndex].prix;
  const totalGeneral = totalAmount + fraisLivraison; // affichage indicatif uniquement — le vrai total vient du serveur

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (envoiEnCoursRef.current) return; // ignore les clics pendant qu'une requête est déjà en vol

    envoiEnCoursRef.current = true;
    setLoading(true);
    setErrorMsg('');

    try {
      // On n'envoie que des IDs et quantités — jamais de prix.
      // Le serveur recharge tout depuis la base et recalcule.
      const itemsPourServeur = cart.map((item) => ({
        produit_id: item.produit.id,
        quantite: item.quantite,
        extras_ids: (item.produit.extrasChoisis || []).map((e) => e.id),
      }));

      const reponse = await fetch('/api/commandes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_nom: nom,
          client_telephone: telephone,
          adresse_precise: adresse,
          zone_id: ZONES_LIVRAISON[zoneIndex].id,
          creneau_souhaite: creneau,
          items: itemsPourServeur,
          idempotency_key: idempotencyKeyRef.current,
        }),
      });

      const data = await reponse.json();

      if (!reponse.ok) {
        console.error('ERREUR API COMMANDES:', data);
        const messageDetail = Array.isArray(data.details) ? data.details.join(' ') : data.error;
        throw new Error(messageDetail || 'Erreur lors de la création de la commande.');
      }

      const commande = data as ReponseCommande;

      // Génération du message WhatsApp avec les VRAIES données
      // renvoyées par le serveur, jamais celles calculées côté client.
      const itemsListText = commande.items
        .map((item) => `• ${item.quantite}x ${item.nom_produit} (${(item.prix_unitaire * item.quantite).toLocaleString('fr-FR')} FCFA)`)
        .join('\n');

      const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '221778335781';
      const textWhatsApp = `👑 *NOUVELLE COMMANDE KING CRÊPERIE*\n\n` +
        `🆔 *N° Commande :* #${commande.id.slice(0, 8)}\n` +
        `👤 *Client :* ${nom}\n` +
        `📞 *Tel :* ${telephone}\n` +
        `📍 *Adresse :* ${adresse} (${commande.zone_nom})\n` +
        `⏰ *Créneau :* ${creneau}\n\n` +
        `📜 *DÉTAILS DU PANIER :*\n${itemsListText}\n\n` +
        `🚚 *Livraison :* ${commande.frais_livraison.toLocaleString('fr-FR')} FCFA\n` +
        `💰 *TOTAL À PAYER :* *${commande.total.toLocaleString('fr-FR')} FCFA*\n\n` +
        `🔗 *Suivi en direct :* ${window.location.origin}/suivi?id=${commande.id}`;

      const urlWhatsApp = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(textWhatsApp)}`;

      clearCart();
      window.open(urlWhatsApp, '_blank');
      router.push(`/suivi?id=${commande.id}`);
    } catch (err: any) {
      console.error('Erreur commande:', err);
      setErrorMsg(err.message || 'Une erreur est survenue lors de la création de la commande.');
      // En cas d'échec, on autorise un nouvel essai avec la MÊME clé
      // (la requête n'a probablement pas abouti côté serveur, donc
      // pas de risque de doublon en réessayant).
      envoiEnCoursRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen pt-32 pb-16 px-6 max-w-2xl mx-auto text-center flex flex-col items-center justify-center">
        <div className="bg-white border border-stone-200/80 shadow-sm p-8 rounded-3xl w-full">
          <h1 className="text-2xl font-bold font-serif text-stone-900 mb-2">Votre panier est vide</h1>
          <p className="text-stone-500 mb-6">Ajoutez quelques crêpes depuis notre carte avant d'effectuer une commande.</p>
          <Link
            href="/#menu"
            className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-full transition-all shadow-md shadow-amber-600/20"
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
      <Link href="/#menu" className="inline-flex items-center gap-2 text-stone-500 hover:text-amber-600 text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Continuer mes achats</span>
      </Link>

      <h1 className="text-3xl md:text-4xl font-black font-serif text-stone-900 mb-8">
        Validation de la <span className="text-amber-600">Commande</span>
      </h1>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl mb-6 text-sm font-medium">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form onSubmit={handleSubmit} className="lg:col-span-7 bg-white border border-stone-200/80 shadow-sm p-6 md:p-8 rounded-3xl space-y-5">
          <h2 className="text-xl font-bold text-stone-900 mb-4 border-b border-stone-100 pb-3">Informations de livraison</h2>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Nom & Prénom</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
              <input
                type="text"
                required
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex: Babacar Diop"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl py-3 pl-12 pr-4 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Numéro Téléphone</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
              <input
                type="tel"
                required
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="Ex: 77 000 00 00"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl py-3 pl-12 pr-4 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Zone de livraison</label>
            <select
              value={zoneIndex}
              onChange={(e) => setZoneIndex(Number(e.target.value))}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl py-3 px-4 text-stone-900 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 transition-all"
            >
              {ZONES_LIVRAISON.map((z, idx) => (
                <option key={z.id} value={idx}>
                  {z.nom} (+{z.prix} FCFA)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Adresse Précise</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-3 text-stone-400 w-5 h-5" />
              <textarea
                required
                rows={2}
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                placeholder="Rue, Immeuble, Appt, Repère visuel..."
                className="w-full bg-stone-50 border border-stone-200 rounded-xl py-3 pl-12 pr-4 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Créneau Souhaité</label>
            <div className="relative">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
              <input
                type="text"
                value={creneau}
                onChange={(e) => setCreneau(e.target.value)}
                placeholder="Ex: Au plus vite / 20h00"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl py-3 pl-12 pr-4 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
            <span>{loading ? 'Traitement...' : 'Envoyer la commande via WhatsApp'}</span>
          </button>
        </form>

        <div className="lg:col-span-5 bg-white border border-stone-200/80 shadow-sm p-6 md:p-8 rounded-3xl h-fit">
          <h2 className="text-xl font-bold text-stone-900 mb-4 border-b border-stone-100 pb-3">Récapitulatif</h2>

          <div className="space-y-4 max-h-80 overflow-y-auto pr-2 mb-6">
            {cart.map((item, index) => {
              const cleExtras = (item.produit.extrasChoisis || []).map((e) => e.id).sort().join(',');
              return (
                <div key={`${item.produit.id}-${cleExtras}-${index}`} className="flex justify-between items-center border-b border-stone-100 pb-3">
                  <div className="flex-1 pr-2">
                    <p className="font-bold text-stone-900 text-sm">{item.produit.nom}</p>
                    <p className="text-xs text-amber-600 font-medium">{item.produit.prix.toLocaleString('fr-FR')} FCFA</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.produit.id, -1)}
                      className="bg-stone-100 hover:bg-stone-200 text-stone-800 w-7 h-7 rounded-lg flex items-center justify-center font-bold transition-colors"
                    >
                      -
                    </button>
                    <span className="text-sm font-bold w-4 text-center text-stone-900">{item.quantite}</span>
                    <button
                      onClick={() => updateQuantity(item.produit.id, 1)}
                      className="bg-stone-100 hover:bg-stone-200 text-stone-800 w-7 h-7 rounded-lg flex items-center justify-center font-bold transition-colors"
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeFromCart(item.produit.id)}
                      className="text-rose-500 hover:text-rose-600 ml-2 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2 border-t border-stone-100 pt-4 text-sm">
            <div className="flex justify-between text-stone-500">
              <span>Sous-total</span>
              <span className="font-medium text-stone-800">{totalAmount.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Frais de livraison</span>
              <span className="font-medium text-stone-800">{fraisLivraison.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between text-lg font-black text-amber-600 border-t border-stone-100 pt-3">
              <span>Total Général</span>
              <span>{totalGeneral.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}