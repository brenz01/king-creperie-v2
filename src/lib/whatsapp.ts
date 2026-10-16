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

// Lien WhatsApp vers le numéro d'un client (format sénégalais à 9
// chiffres complété avec l'indicatif 221).
export function urlWhatsAppClient(telephone: string, texte?: string): string {
  const chiffres = telephone.replace(/\D/g, '');
  const numero = chiffres.length === 9 ? `221${chiffres}` : chiffres.replace(/^00/, '');
  return `https://wa.me/${numero}${texte ? `?text=${encodeURIComponent(texte)}` : ''}`;
}
