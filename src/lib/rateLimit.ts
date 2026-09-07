// Rate limiting simple en mémoire, par IP, fenêtre glissante.
// Limite : se réinitialise à chaque cold start de la fonction
// serverless Vercel — acceptable pour dissuader le spam manuel
/// scripts basiques, pas une protection anti-DDoS à grande échelle.
// Pour une garantie plus forte à l'avenir : Upstash Redis + Vercel KV.

interface Entree {
  compteur: number;
  debutFenetre: number;
}

const compteurs = new Map<string, Entree>();

const FENETRE_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUETES_PAR_FENETRE = 5; // 5 commandes max / 10 min / IP

// Nettoyage périodique pour éviter une fuite mémoire sur un
// process serverless qui vivrait longtemps (rare mais possible).
function nettoyerEntreesExpirees() {
  const maintenant = Date.now();
  for (const [cle, entree] of compteurs.entries()) {
    if (maintenant - entree.debutFenetre > FENETRE_MS) {
      compteurs.delete(cle);
    }
  }
}

export function verifierRateLimit(identifiant: string): { autorise: boolean; reessayerDansMs?: number } {
  const maintenant = Date.now();

  if (compteurs.size > 1000) {
    nettoyerEntreesExpirees();
  }

  const entree = compteurs.get(identifiant);

  if (!entree || maintenant - entree.debutFenetre > FENETRE_MS) {
    compteurs.set(identifiant, { compteur: 1, debutFenetre: maintenant });
    return { autorise: true };
  }

  if (entree.compteur >= MAX_REQUETES_PAR_FENETRE) {
    const reessayerDansMs = FENETRE_MS - (maintenant - entree.debutFenetre);
    return { autorise: false, reessayerDansMs };
  }

  entree.compteur += 1;
  return { autorise: true };
}

// Extrait la meilleure IP disponible depuis les headers Vercel/proxy.
export function extraireIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'inconnu';
}
