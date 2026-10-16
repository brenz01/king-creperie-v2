// Rate limiting en mémoire, fenêtre fixe, par clé.
//
// Limites assumées : les compteurs vivent dans l'instance serverless
// (pas de partage entre instances Vercel, remise à zéro au cold start).
// Suffisant contre le spam manuel / scripts basiques ; pour une
// garantie globale, migrer vers Upstash Redis (même interface).

interface Entree {
  compteur: number;
  debutFenetre: number;
}

const compteurs = new Map<string, Entree>();

function nettoyer(maintenant: number) {
  for (const [cle, entree] of compteurs) {
    // Fenêtre max utilisée dans l'app : 15 min.
    if (maintenant - entree.debutFenetre > 15 * 60 * 1000) compteurs.delete(cle);
  }
}

export interface ResultatRateLimit {
  autorise: boolean;
  reessayerDansMs?: number;
}

export function verifierRateLimit(
  identifiant: string,
  maxRequetes: number,
  fenetreMs: number
): ResultatRateLimit {
  const maintenant = Date.now();
  if (compteurs.size > 5000) nettoyer(maintenant);

  const entree = compteurs.get(identifiant);
  if (!entree || maintenant - entree.debutFenetre > fenetreMs) {
    compteurs.set(identifiant, { compteur: 1, debutFenetre: maintenant });
    return { autorise: true };
  }
  if (entree.compteur >= maxRequetes) {
    return { autorise: false, reessayerDansMs: fenetreMs - (maintenant - entree.debutFenetre) };
  }
  entree.compteur += 1;
  return { autorise: true };
}

// Sur Vercel, x-forwarded-for est réécrit par l'edge (non falsifiable
// par le client). Ailleurs (dev local), la valeur n'est qu'indicative.
export function extraireIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'inconnu';
}

export function minutesRestantes(ms: number | undefined): number {
  return Math.max(1, Math.ceil((ms ?? 0) / 60000));
}
