// =====================================================================
// Faux Supabase (PostgREST minimal) pour les tests de bout en bout.
// Aucune donnée réelle : catalogue, commandes et boutique sont en mémoire
// et remis à zéro par POST /__reset avant chaque test.
//
// Routes de pilotage (tests uniquement) :
//   POST /__reset              état initial
//   GET  /__log                appels RPC reçus + commandes créées
//   POST /__statut/:id/:statut change le statut d'une commande client
//   POST /__boutique           modifie horaires / pause
// =====================================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.MOCK_PORT ?? 54321);
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMAGE = fs.readFileSync(path.join(RACINE, 'public/icons/icon-192.png'));

const TOUJOURS = { ouvre: '00:00', ferme: '24:00' };
const tousLesJours = (plages) => Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((j) => [String(j), plages]));

let etat;

function initialiser() {
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const img = `http://127.0.0.1:${PORT}/img/crepe.png`;
  const P = (nom, prix, categorie, description, extra = {}) => ({
    id: id(),
    nom,
    prix,
    categorie,
    image_url: img,
    description,
    disponible: true,
    stock_gere: false,
    stock_quantite: null,
    ...extra,
  });
  // L'ordre fixe les identifiants (…001 à …020) utilisés par les tests.
  const produits = [
    P('Crêpe Jambon Fromage', 2000, 'salee', 'Jambon, emmental fondu'),
    P('Crêpe Jambon Fromage Œuf', 2500, 'salee', 'La complète'),
    P('Crêpe Poulet Fromage', 3000, 'salee', 'Poulet grillé, fromage'),
    P('Crêpe Poulet Béchamel', 3500, 'salee', 'Poulet, béchamel maison'),
    P('Crêpe Fruit de Mer', 3500, 'salee', 'Crevettes, calamars, sauce crème'),
    P('Crêpe Viande Hachée (Fromage)', 3500, 'salee', 'Bœuf haché épicé, fromage', { stock_gere: true, stock_quantite: 2 }),
    P('Crêpe Poulet Viande Hachée', 4000, 'salee', 'Pour les grosses faims'),
    P('Crêpe Nutella', 1500, 'sucree', 'Le classique'),
    P('Crêpe Beurre Sucre', 1500, 'sucree', 'Beurre demi-sel, sucre'),
    P('Crêpe Nutella Bananes', 2000, 'sucree', 'Nutella, banane fraîche'),
    P('Crêpe Nutella Kinder', 2000, 'sucree', 'Nutella, morceaux de Kinder'),
    P('Crêpe Spéculos', 2000, 'sucree', 'Pâte de spéculos'),
    P('Crêpe El Mordjene Oréo', 3000, 'sucree', 'El Mordjene, Oréo concassés'),
    P('Crêpe aux Trois Chocolats', 3000, 'sucree', 'Noir, lait, blanc', {
      disponible: false,
      stock_gere: true,
      stock_quantite: 0,
    }),
    P('Jus de Bissap', 1000, 'boisson', "Infusion d'hibiscus faite maison"),
    P('Jus de Bouye', 1000, 'boisson', 'Jus de pain de singe fait maison'),
    P('Jus de Gingembre', 1000, 'boisson', 'Gingembre frais, citron'),
    P('Jus de Ditakh', 1500, 'boisson', 'Jus naturel de Ditakh'),
    P('Coca-Cola', 800, 'boisson', 'Canette 33 cl'),
    P('Eau minérale', 500, 'boisson', '50 cl'),
  ];
  const extras = [
    { id: 'nutella', nom: 'Extra Nutella', prix: 500, actif: true },
    { id: 'banane', nom: 'Banane fraîche', prix: 300, actif: true },
    { id: 'chantilly', nom: 'Chantilly maison', prix: 400, actif: true },
    { id: 'fromage', nom: 'Double fromage', prix: 500, actif: true },
  ];

  // Commandes vues par l'espace staff.
  const ilYa = (m) => new Date(Date.now() - m * 60_000).toISOString();
  const ligne = (i, q, ex = []) => ({
    id: id(),
    produit_id: produits[i].id,
    nom_produit: produits[i].nom,
    quantite: q,
    prix_unitaire: produits[i].prix,
    extras: ex,
  });
  const staff = [
    {
      id: 'a1b2c3d4-0000-4000-8000-000000000001',
      created_at: ilYa(2),
      client_nom: 'Awa Ndiaye',
      client_telephone: '77 123 45 67',
      adresse_livraison: 'Mermoz, Villa 12, rue MZ-40. Repère : en face de la boulangerie',
      creneau_souhaite: 'Dès que possible',
      total: 7300,
      statut: 'recue',
      commande_items: [ligne(1, 2, [{ id: 'fromage', nom: 'Double fromage', prix: 500 }]), ligne(14, 2)],
    },
    {
      id: 'b2c3d4e5-0000-4000-8000-000000000002',
      created_at: ilYa(14),
      client_nom: 'Moussa Diop',
      client_telephone: '+221 76 555 11 22',
      adresse_livraison: 'Almadies, Résidence Les Filaos, appt 3B',
      creneau_souhaite: 'Vers 20 h',
      total: 6000,
      statut: 'en_preparation',
      commande_items: [ligne(4, 1), ligne(9, 1, [{ id: 'chantilly', nom: 'Chantilly maison', prix: 400 }]), ligne(15, 1)],
    },
  ];

  etat = {
    produits,
    extras,
    staff,
    audit: [],
    commandes: new Map(),
    rpcLog: [],
    boutique: { horaires: tousLesJours([TOUJOURS]), fermeture_exceptionnelle: false, message_fermeture: null },
  };
}
initialiser();

const envoyer = (res, code, body, type = 'application/json') => {
  res.writeHead(code, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
};

const filtreIn = (u) => {
  const v = u.searchParams.get('id');
  return v?.startsWith('in.(')
    ? v
        .slice(4, -1)
        .split(',')
        .map((x) => x.replace(/"/g, ''))
    : null;
};
const filtreEq = (u) => (u.searchParams.get('id') || '').replace(/^eq\./, '');

function traiter(req, res, corps) {
  const u = new URL(req.url, 'http://x');
  const json = () => (corps ? JSON.parse(corps) : {});
  const e = etat;

  // --- Pilotage -------------------------------------------------------
  if (u.pathname === '/__reset') {
    initialiser();
    return envoyer(res, 200, { ok: true });
  }
  if (u.pathname === '/__log') return envoyer(res, 200, { rpcLog: e.rpcLog, commandes: [...e.commandes.values()] });
  if (u.pathname.startsWith('/__statut/')) {
    const [, , cid, st] = u.pathname.split('/');
    const c = e.commandes.get(cid);
    if (c) Object.assign(c, { statut: st, updated_at: new Date().toISOString() });
    return envoyer(res, 200, c ?? {});
  }
  if (u.pathname === '/__boutique') {
    e.boutique = { ...e.boutique, ...json() };
    return envoyer(res, 200, e.boutique);
  }
  if (u.pathname.startsWith('/img/')) return envoyer(res, 200, IMAGE, 'image/png');

  // --- PostgREST ------------------------------------------------------
  if (u.pathname === '/rest/v1/produits') {
    if (req.method === 'PATCH') {
      const p = e.produits.find((x) => x.id === filtreEq(u));
      if (!p) return envoyer(res, 200, []);
      Object.assign(p, json());
      return envoyer(res, 200, [{ id: p.id }]);
    }
    const ids = filtreIn(u);
    return envoyer(res, 200, ids ? e.produits.filter((p) => ids.includes(p.id)) : e.produits);
  }
  if (u.pathname === '/rest/v1/extras') {
    const ids = filtreIn(u);
    return envoyer(
      res,
      200,
      ids ? e.extras.filter((x) => ids.includes(x.id)) : e.extras.map((x) => ({ id: x.id, nom: x.nom, prix: x.prix })),
    );
  }
  if (u.pathname === '/rest/v1/boutique') {
    if (req.method === 'PATCH') {
      e.boutique = { ...e.boutique, ...json() };
      return envoyer(res, 200, [e.boutique]);
    }
    const objet = (req.headers.accept || '').includes('vnd.pgrst.object');
    return envoyer(res, 200, objet ? e.boutique : [e.boutique]);
  }
  if (u.pathname === '/rest/v1/commandes') {
    if (req.method === 'PATCH') {
      const c = e.staff.find((x) => x.id === filtreEq(u));
      if (c) {
        const ancien = c.statut;
        Object.assign(c, json());
        e.audit.unshift({
          id: crypto.randomUUID(),
          commande_id: c.id,
          ancien_statut: ancien,
          nouveau_statut: c.statut,
          modifie_par_email: 'staff@exemple.sn',
          created_at: new Date().toISOString(),
        });
      }
      return envoyer(res, 204, '', 'text/plain');
    }
    return envoyer(
      res,
      200,
      [...e.staff].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    );
  }
  if (u.pathname === '/rest/v1/commandes_audit_log') return envoyer(res, 200, e.audit);

  // --- RPC ------------------------------------------------------------
  if (u.pathname === '/rest/v1/rpc/creer_commande_complete') {
    const p = json();
    e.rpcLog.push(p);
    const existante = [...e.commandes.values()].find((c) => c.idem && c.idem === p.p_idempotency_key);
    if (existante) return envoyer(res, 200, [{ ...existante, deja_existante: true }]);
    const maintenant = new Date().toISOString();
    const c = {
      id: crypto.randomUUID(),
      statut: 'recue',
      created_at: maintenant,
      updated_at: maintenant,
      idem: p.p_idempotency_key,
      adresse: p.p_adresse_livraison,
      total: p.p_total,
    };
    e.commandes.set(c.id, c);
    return envoyer(res, 200, [c]);
  }
  if (u.pathname === '/rest/v1/rpc/suivi_commande') {
    const c = e.commandes.get(json().p_id);
    return c
      ? envoyer(res, 200, { id: c.id, statut: c.statut, created_at: c.created_at, updated_at: c.updated_at })
      : envoyer(res, 406, { code: 'PGRST116', message: 'no rows' });
  }

  envoyer(res, 404, { message: `non simulé : ${req.method} ${u.pathname}` });
}

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') return envoyer(res, 204, {});
    let corps = '';
    req.on('data', (c) => (corps += c));
    req.on('end', () => {
      try {
        traiter(req, res, corps);
      } catch (err) {
        envoyer(res, 500, { message: String(err) });
      }
    });
  })
  .listen(PORT, () => console.log(`Faux Supabase sur :${PORT}`));
