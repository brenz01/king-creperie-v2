// Rate limiting simple en mémoire, par clé, fenêtre glissante.
// Limite : se réinitialise à chaque cold start de la fonction
// serverless Vercel — acceptable pour dissuader le spam manuel /
// scripts basiques, pas une protection anti-DDoS à grande échelle.
// Pour une garantie plus forte à l'avenir : Upstash Redis + Vercel KV.

interface Entree {
  compteur: number;
  debutFenetre: number;
}

const compteurs = new Map<string, Entree>();

const FENETRE_MS_DEFAUT = 10 * 60 * 1000; // 10 minutes
const MAX_REQUETES_DEFAUT = 5; // 5 requêtes max / fenêtre / clé

function nettoyerEntreesExpirees(fenetreMs: number) {
  const maintenant = Date.now();
  for (const [cle, entree] of compteurs.entries()) {
    if (maintenant - entree.debutFenetre > fenetreMs) {
      compteurs.delete(cle);
    }
  }
}

// Version générique, paramétrable — utilisée par toute route ayant
// besoin d'un seuil différent (ex: login plus strict que commandes).
export function verifierRateLimitPersonnalise(
  identifiant: string,
  maxRequetes: number = MAX_REQUETES_DEFAUT,
  fenetreMs: number = FENETRE_MS_DEFAUT
): { autorise: boolean; reessayerDansMs?: number } {
  const maintenant = Date.now();

  if (compteurs.size > 1000) {
    nettoyerEntreesExpirees(fenetreMs);
  }

  const entree = compteurs.get(identifiant);

  if (!entree || maintenant - entree.debutFenetre > fenetreMs) {
    compteurs.set(identifiant, { compteur: 1, debutFenetre: maintenant });
    return { autorise: true };
  }

  if (entree.compteur >= maxRequetes) {
    const reessayerDansMs = fenetreMs - (maintenant - entree.debutFenetre);
    return { autorise: false, reessayerDansMs };
  }

  entree.compteur += 1;
  return { autorise: true };
}

// Conservé pour compatibilité avec /api/commandes — équivaut à
// verifierRateLimitPersonnalise avec les seuils par défaut (5/10min).
export function verifierRateLimit(identifiant: string): { autorise: boolean; reessayerDansMs?: number } {
  return verifierRateLimitPersonnalise(identifiant, MAX_REQUETES_DEFAUT, FENETRE_MS_DEFAUT);
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