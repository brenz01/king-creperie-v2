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
//   POST /__panne              {"produits": true} : lecture des produits en
//                              erreur 503 (test de régénération ISR)
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

  // Historique pour le tableau de bord : livrées aujourd'hui et le même
  // jour la semaine dernière, une cliente qui revient (Awa : fidèle),
  // journal des statuts pour la vitesse du service.
  const audit = [];
  let numCmd = 0;
  const livree = (ageMin, nom, tel, total, items, etapes = [5, 18, 40], statut = 'livree') => {
    const idc = `c0000000-0000-4000-8000-${String(++numCmd).padStart(12, '0')}`;
    const t0 = Date.now() - ageMin * 60_000;
    staff.push({
      id: idc,
      created_at: new Date(t0).toISOString(),
      client_nom: nom,
      client_telephone: tel,
      adresse_livraison: 'Ngor, villa 4',
      creneau_souhaite: 'Dès que possible',
      total,
      statut,
      commande_items: items,
    });
    if (statut !== 'livree') return;
    ['en_preparation', 'en_livraison', 'livree'].forEach((s, i) =>
      audit.push({
        id: `d0000000-0000-4000-8000-${String(audit.length + 1).padStart(12, '0')}`,
        commande_id: idc,
        ancien_statut: i === 0 ? 'recue' : ['en_preparation', 'en_livraison'][i - 1],
        nouveau_statut: s,
        modifie_par_email: 'staff@exemple.sn',
        created_at: new Date(t0 + etapes[i] * 60_000).toISOString(),
      }),
    );
  };
  const SEMAINE = 7 * 24 * 60;
  livree(45, 'Fatou Sarr', '78 222 33 44', 4500, [ligne(7, 2), ligne(19, 1)], [4, 16, 38]);
  livree(95, 'Awa Ndiaye', '77 123 45 67', 3500, [ligne(7, 1), ligne(9, 1)], [6, 20, 44]);
  livree(150, 'Ibou Fall', '70 111 22 33', 6500, [ligne(3, 1), ligne(1, 1), ligne(14, 1)], [5, 22, 47]);
  livree(210, 'Khady Diallo', '76 444 55 66', 2000, [ligne(9, 1)], [8, 19, 41], 'annulee');
  livree(SEMAINE + 60, 'Awa Ndiaye', '+221 77 123 45 67', 4000, [ligne(7, 2)]);
  livree(SEMAINE + 120, 'Modou Sène', '77 999 88 77', 3000, [ligne(2, 1)]);
  livree(SEMAINE + 180, 'Fatou Sarr', '78 222 33 44', 5000, [ligne(4, 1), ligne(14, 1)]);
  livree(2 * SEMAINE, 'Awa Ndiaye', '771234567', 2500, [ligne(1, 1)]);

  etat = {
    produits,
    extras,
    staff,
    audit,
    commandes: new Map(),
    rpcLog: [],
    panneProduits: false,
    lecturesEnPanne: 0,
    photos: new Map(), // chemin dans le bucket « produits » → { type, octets }
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

function traiter(req, res, corps, octets) {
  const u = new URL(req.url, 'http://x');
  const json = () => (corps ? JSON.parse(corps) : {});
  const e = etat;

  // --- Pilotage -------------------------------------------------------
  if (u.pathname === '/__reset') {
    initialiser();
    return envoyer(res, 200, { ok: true });
  }
  if (u.pathname === '/__log')
    return envoyer(res, 200, { rpcLog: e.rpcLog, commandes: [...e.commandes.values()], lecturesEnPanne: e.lecturesEnPanne });
  if (u.pathname === '/__panne') {
    e.panneProduits = json().produits === true;
    return envoyer(res, 200, { panneProduits: e.panneProduits });
  }
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
  // --- Storage (bucket public « produits ») ---------------------------
  if (u.pathname.startsWith('/storage/v1/object/public/produits/')) {
    const ph = e.photos.get(decodeURIComponent(u.pathname.slice('/storage/v1/object/public/produits/'.length)));
    return ph ? envoyer(res, 200, ph.octets, ph.type) : envoyer(res, 404, { message: 'Object not found' });
  }
  if (u.pathname.startsWith('/storage/v1/object/produits/') && req.method === 'POST') {
    const chemin = decodeURIComponent(u.pathname.slice('/storage/v1/object/produits/'.length));
    if (!req.headers.authorization?.includes('.')) return envoyer(res, 403, { statusCode: '403', message: 'new row violates row-level security policy' });
    e.photos.set(chemin, { type: req.headers['content-type'] || 'application/octet-stream', octets });
    return envoyer(res, 200, { Key: `produits/${chemin}`, Id: chemin });
  }
  if (u.pathname === '/storage/v1/object/produits' && req.method === 'DELETE') {
    const supprimees = (json().prefixes ?? []).filter((c) => e.photos.delete(c));
    return envoyer(res, 200, supprimees.map((name) => ({ name })));
  }

  // --- Staff (RLS : une ligne seulement pour un membre du staff) ------
  if (u.pathname === '/rest/v1/staff') {
    const jeton = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    return envoyer(res, 200, jeton.split('.').length === 3 ? [{ user_id: 'u1' }] : []);
  }

  if (u.pathname === '/rest/v1/produits') {
    const CATEGORIES = ['salee', 'sucree', 'gaufre', 'boisson', 'autre'];
    const refuse = (p) =>
      (p.categorie !== undefined && !CATEGORIES.includes(p.categorie)) || (p.prix !== undefined && !(p.prix > 0));
    if (req.method === 'POST') {
      const lignes = [].concat(json());
      if (lignes.some(refuse)) return envoyer(res, 400, { code: '23514', message: 'new row for relation "produits" violates check constraint' });
      const ajoutes = lignes.map((l) => ({ id: crypto.randomUUID(), description: null, image_url: null, disponible: true, stock_gere: false, stock_quantite: null, ...l }));
      e.produits.push(...ajoutes);
      return envoyer(res, 201, ajoutes.map((p) => ({ id: p.id })));
    }
    if (req.method === 'DELETE') {
      const i = e.produits.findIndex((x) => x.id === filtreEq(u));
      if (i < 0) return envoyer(res, 200, []);
      const [p] = e.produits.splice(i, 1);
      // ON DELETE SET NULL : l'historique des commandes garde nom et prix.
      for (const c of e.commandes.values()) for (const it of c.commande_items ?? []) if (it.produit_id === p.id) it.produit_id = null;
      return envoyer(res, 200, [{ id: p.id }]);
    }
    if (req.method === 'PATCH' && refuse(json())) {
      return envoyer(res, 400, { code: '23514', message: 'new row for relation "produits" violates check constraint' });
    }
    if (req.method === 'PATCH') {
      const p = e.produits.find((x) => x.id === filtreEq(u));
      if (!p) return envoyer(res, 200, []);
      Object.assign(p, json());
      return envoyer(res, 200, [{ id: p.id }]);
    }
    if (e.panneProduits) {
      e.lecturesEnPanne++;
      return envoyer(res, 503, { code: 'PGRST000', message: 'panne simulée du catalogue' });
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
    const morceaux = [];
    req.on('data', (c) => morceaux.push(c));
    req.on('end', () => {
      try {
        const octets = Buffer.concat(morceaux);
        traiter(req, res, octets.toString('utf8'), octets);
      } catch (err) {
        envoyer(res, 500, { message: String(err) });
      }
    });
  })
  .listen(PORT, () => console.log(`Faux Supabase sur :${PORT}`));
