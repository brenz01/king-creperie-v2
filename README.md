# 👑 King Crêperie V2

**Application web de commande en ligne et de suivi de commande en temps réel** pour une crêperie basée à Dakar, Sénégal (Les Almadies).

🔗 **Démo en ligne :** [king-creperie-v2.vercel.app](https://king-creperie-v2.vercel.app)

<!-- 🎥 VIDÉO DÉMO — à insérer ici -->
<!--
Exemple pour une vidéo hébergée (YouTube, Loom, etc.) :

[![Démo King Crêperie V2](https://VOTRE-THUMBNAIL.png)](https://VOTRE-LIEN-VIDEO)

Ou si le fichier vidéo est dans le repo (ex: /docs/demo.mp4), GitHub ne le lit pas
en inline — héberge-le plutôt sur YouTube/Loom/Streamable et mets le lien ci-dessus,
ou utilise un GIF court converti depuis la vidéo pour un aperçu direct dans le README.
-->

---

## ✨ Aperçu

King Crêperie V2 n'est pas qu'un site vitrine : c'est une application complète de bout en bout, pensée comme une vraie plateforme commerciale — commande en ligne, personnalisation des produits, suivi en temps réel, gestion de stock, tableau de bord administrateur avec historique d'audit, le tout bâti avec une attention particulière portée à la sécurité et à la fiabilité des transactions.

### Le menu et la personnalisation

<!-- 📸 CAPTURE — Page d'accueil (Hero) -->
<!-- 📸 CAPTURE — Grille du menu avec catégories -->
<!-- 📸 CAPTURE — Modale de personnalisation des extras -->

Chaque produit peut être personnalisé avec des extras (Nutella, banane fraîche, chantilly, etc.), dont le prix est **recalculé et validé côté serveur** à chaque étape — jamais fait confiance à ce qu'envoie le navigateur.

### Le panier et la commande

<!-- 📸 CAPTURE — Mini panier déroulant -->
<!-- 📸 CAPTURE — Tunnel de commande (zone de livraison en premier) -->
<!-- 📸 CAPTURE — Confirmation / redirection WhatsApp -->

Le tunnel de commande demande d'abord la zone de livraison, pour que le client voie le total réel (produits + frais de livraison) avant même de renseigner ses coordonnées — pensé pour réduire la friction et l'abandon de panier.

### Le suivi en temps réel

<!-- 📸 CAPTURE — Page de suivi avec stepper de progression -->
<!-- 📸 CAPTURE — Estimation de temps affichée -->

Suivi live du statut de la commande (reçue → en préparation → en livraison → livrée), avec estimation de temps restant, confettis et vibration à l'étape de livraison, et diffusion en temps réel via WebSocket — sans jamais exposer les données personnelles du client sur le canal public.

### Le tableau de bord administrateur

<!-- 📸 CAPTURE — Dashboard, onglet Commandes -->
<!-- 📸 CAPTURE — Dashboard, onglet Produits & Stock -->
<!-- 📸 CAPTURE — Dashboard, onglet Historique / Audit -->

Interface staff avec gestion des commandes en direct, gestion du stock produit par produit, et un historique d'audit qui trace chaque changement de statut (qui, quand, ancien → nouveau statut) — non modifiable a posteriori.

---

## 🏗️ Stack technique

| Couche | Technologies |
|---|---|
| **Frontend** | Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS v4, Framer Motion |
| **Backend** | Next.js API Routes, Supabase (PostgreSQL) |
| **Temps réel** | Supabase Realtime (Broadcast) |
| **Auth** | Supabase Auth |
| **Déploiement** | Vercel (CI/CD continu depuis `main`) |

---

## 🔐 Approche sécurité & fiabilité

Ce projet a fait l'objet d'un travail de sécurisation approfondi, au-delà d'un simple site vitrine connecté à une base de données. Sans entrer dans le détail des règles exactes (par souci de sécurité), les principes appliqués :

- **Row Level Security (RLS)** activée sur toutes les tables sensibles — les données client (nom, téléphone, adresse) ne sont jamais lisibles publiquement, y compris via un accès direct à l'API.
- **Aucun prix ni total n'est déterminé côté client.** Le navigateur envoie uniquement des identifiants produit et des quantités ; le serveur recharge les vrais prix depuis la base et recalcule tout avant d'enregistrer quoi que ce soit.
- **Transactions atomiques** pour la création de commande (commande + articles + décrément de stock) — soit tout est enregistré, soit rien ne l'est, jamais d'état intermédiaire incohérent.
- **Idempotence** : une commande envoyée deux fois (double-clic, retry réseau) ne crée jamais de doublon.
- **Rate limiting** sur les endpoints sensibles (création de commande, connexion admin) pour limiter les abus.
- **Historique d'audit infalsifiable** sur les changements de statut, écrit uniquement par déclencheur serveur.
- **Suivi public minimisé** : le canal temps réel accessible par un visiteur anonyme ne diffuse que le statut de sa commande, jamais les données personnelles associées.

---

## 🚀 Fonctionnalités

- Menu interactif avec catégories, badges (best-seller, végétarien, stock bas) et personnalisation d'extras
- Panier persistant avec mini panneau déroulant
- Tunnel de commande optimisé (zone de livraison en premier, total visible tôt)
- Génération automatique du message de commande formaté pour WhatsApp
- Suivi de commande en temps réel avec estimation de délai
- Gestion de stock optionnelle par produit (activable produit par produit)
- Tableau de bord administrateur : commandes en direct, gestion produits/stock, historique d'audit
- Design entièrement personnalisé (identité visuelle propre, pas de thème générique)

---

## 📦 Installation locale

```bash
git clone https://github.com/brenz01/king-creperie-v2.git
cd king-creperie-v2
pnpm install
```

Crée un fichier `.env.local` à la racine avec :

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_WHATSAPP_NUMBER=
NEXT_PUBLIC_SITE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` ne doit **jamais** être exposée côté client ni committée — variable serveur uniquement.

```bash
pnpm dev
```

---

## 📄 Licence

Projet personnel — tous droits réservés. Code partagé à titre de démonstration technique.

---

<p align="center">Développé avec Next.js, Supabase et beaucoup de tests en conditions réelles 🥞</p>
