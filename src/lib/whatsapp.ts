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

// Numéro de la crêperie, lisible et copiable (secours si WhatsApp ne
// s'ouvre pas) : « +221 77 833 57 81 ».
export function numeroCreperieAffiche(): string {
  const n = NUMERO_WHATSAPP.replace(/\D/g, '');
  const local = n.startsWith('221') ? n.slice(3) : n;
  const m = local.match(/^(\d{2})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+221 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : `+${n}`;
}
