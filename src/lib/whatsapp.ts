// Construction du message WhatsApp, partagée entre le tunnel de
// commande (qui la prépare) et /suivi (qui affiche le bouton d'envoi).
const NUMERO_WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '221778335781';

export const CLE_WHATSAPP = (commandeId: string) => `king_creperie_wa_${commandeId}`;

export function urlWhatsApp(texte: string): string {
  return `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(texte)}`;
}

export function urlContactWhatsApp(): string {
  return `https://wa.me/${NUMERO_WHATSAPP}`;
}

// Partage vers n'importe quel contact (sans numéro destinataire).
export function urlPartage(texte: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texte)}`;
}
