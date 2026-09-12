'use client';

import { useState, useRef } from 'react';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { Send, MapPin, Phone, User, Trash2, ArrowLeft, Clock, WifiOff, RefreshCw } from 'lucide-react';
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

type TypeErreur = 'reseau' | 'validation' | 'conflit' | 'serveur' | null;

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
  const [typeErreur, setTypeErreur] = useState<TypeErreur>(null);

  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());
  const envoiEnCoursRef = useRef(false);

  const fraisLivraison = ZONES_LIVRAISON[zoneIndex].prix;
  const totalGeneral = totalAmount + fraisLivraison;

  const envoyerCommande = async () => {
    if (cart.length === 0) return;
    if (envoiEnCoursRef.current) return;

    envoiEnCoursRef.current = true;
    setLoading(true);
    setErrorMsg('');
    setTypeErreur(null);

    try {
      const itemsPourServeur = cart.map((item) => ({
        produit_id: item.produit.id,
        quantite: item.quantite,
        extras_ids: (item.produit.extrasChoisis || []).map((e) => e.id),
      }));

      let reponse: Response;
      try {
        reponse = await fetch('/api/commandes', {
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
      } catch (erreurReseau) {
        console.error('Erreur réseau /api/commandes:', erreurReseau);
        setTypeErreur('reseau');
        setErrorMsg('Impossible de joindre le serveur. Vérifiez votre connexion internet.');
        envoiEnCoursRef.current = false;
        setLoading(false);
        return;
      }

      const data = await reponse.json();

      if (!reponse.ok) {
        console.error('ERREUR API COMMANDES:', data);
        const messageDetail = Array.isArray(data.details) ? data.details.join(' ') : data.error;

        if (reponse.status === 400) {
          setTypeErreur('validation');
        } else if (reponse.status === 409 || reponse.status === 429) {
          setTypeErreur('conflit');
        } else {
          setTypeErreur('serveur');
        }

        setErrorMsg(messageDetail || 'Une erreur est survenue lors de la création de la commande.');
        if (reponse.status >= 500) {
          envoiEnCoursRef.current = false;
        }
        setLoading(false);
        return;
      }

      const commande = data as ReponseCommande;

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
      console.error('Erreur commande inattendue:', err);
      setTypeErreur('serveur');
      setErrorMsg('Une erreur inattendue est survenue.');
      envoiEnCoursRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await envoyerCommande();
  };

  const handleReessayer = async () => {
    await envoyerCommande();
  };

  const peutReessayer = typeErreur === 'reseau' || typeErreur === 'serveur';

  if (cart.length === 0) {
    return (
      <div className="min-h-screen pt-32 pb-16 px-6 max-w-2xl mx-auto text-center flex flex-col items-center justify-center">
        <div className="bg-white border border-stone-200/80 shadow-sm p-8 rounded-2xl w-full">
          <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-2">Votre panier est vide</h1>
          <p className="text-stone-500 mb-6">Ajoutez quelques crêpes depuis notre carte avant d'effectuer une commande.</p>
          <Link
            href="/#menu"
            className="inline-flex items-center gap-2 bg-stone-900 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
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
      <Link href="/#menu" className="inline-flex items-center gap-2 text-stone-500 hover:text-amber-700 text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Continuer mes achats</span>
      </Link>

      <h1 className="font-serif text-3xl md:text-4xl font-semibold text-stone-900 mb-8">
        Validation de la <span className="italic text-amber-700">commande</span>
      </h1>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl mb-6 text-sm font-medium flex items-start gap-3">
          {typeErreur === 'reseau' && <WifiOff className="w-5 h-5 shrink-0 mt-0.5" />}
          <div className="flex-1">
            <p>{errorMsg}</p>
            {peutReessayer && (
              <button
                type="button"
                onClick={handleReessayer}
                disabled={loading}
                className="mt-3 inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{loading ? 'Nouvelle tentative...' : 'Réessayer'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form onSubmit={handleSubmit} className="lg:col-span-7 bg-white border border-stone-200/80 shadow-sm p-6 md:p-8 rounded-2xl space-y-5">
          <h2 className="font-serif text-xl font-semibold text-stone-900 mb-4 border-b border-stone-100 pb-3">Informations de livraison</h2>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Nom & Prénom</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
              <input
                type="text"
                required
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex: Babacar Diop"
                className="w-full bg-stone-50 border border-stone-200 rounded-lg py-3 pl-12 pr-4 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Numéro Téléphone</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
              <input
                type="tel"
                required
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="Ex: 77 000 00 00"
                className="w-full bg-stone-50 border border-stone-200 rounded-lg py-3 pl-12 pr-4 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Zone de livraison</label>
            <select
              value={zoneIndex}
              onChange={(e) => setZoneIndex(Number(e.target.value))}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg py-3 px-4 text-stone-900 focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 transition-all"
            >
              {ZONES_LIVRAISON.map((z, idx) => (
                <option key={z.id} value={idx}>
                  {z.nom} (+{z.prix} FCFA)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Adresse Précise</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-3 text-stone-400 w-5 h-5" />
              <textarea
                required
                rows={2}
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                placeholder="Rue, Immeuble, Appt, Repère visuel..."
                className="w-full bg-stone-50 border border-stone-200 rounded-lg py-3 pl-12 pr-4 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Créneau Souhaité</label>
            <div className="relative">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
              <input
                type="text"
                value={creneau}
                onChange={(e) => setCreneau(e.target.value)}
                placeholder="Ex: Au plus vite / 20h00"
                className="w-full bg-stone-50 border border-stone-200 rounded-lg py-3 pl-12 pr-4 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 bg-stone-900 hover:bg-amber-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.99] disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
            <span>{loading ? 'Traitement...' : 'Envoyer la commande via WhatsApp'}</span>
          </button>
        </form>

        <div className="lg:col-span-5 bg-white border border-stone-200/80 shadow-sm p-6 md:p-8 rounded-2xl h-fit">
          <h2 className="font-serif text-xl font-semibold text-stone-900 mb-4 border-b border-stone-100 pb-3">Récapitulatif</h2>

          <div className="space-y-4 max-h-80 overflow-y-auto pr-2 mb-6">
            {cart.map((item, index) => {
              const cleExtras = (item.produit.extrasChoisis || []).map((e) => e.id).sort().join(',');
              return (
                <div key={`${item.produit.id}-${cleExtras}-${index}`} className="flex justify-between items-center border-b border-stone-100 pb-3">
                  <div className="flex-1 pr-2">
                    <p className="font-semibold text-stone-900 text-sm">{item.produit.nom}</p>
                    <p className="text-xs text-amber-700 font-medium">{item.produit.prix.toLocaleString('fr-FR')} FCFA</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.produit.id, -1)}
                      className="bg-stone-100 hover:bg-stone-200 text-stone-800 w-7 h-7 rounded-md flex items-center justify-center font-bold transition-colors"
                    >
                      -
                    </button>
                    <span className="text-sm font-bold w-4 text-center text-stone-900">{item.quantite}</span>
                    <button
                      onClick={() => updateQuantity(item.produit.id, 1)}
                      className="bg-stone-100 hover:bg-stone-200 text-stone-800 w-7 h-7 rounded-md flex items-center justify-center font-bold transition-colors"
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
            <div className="flex justify-between text-lg font-serif font-semibold text-amber-700 border-t border-stone-100 pt-3">
              <span>Total Général</span>
              <span>{totalGeneral.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}