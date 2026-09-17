# 👑 King Crêperie V2

**Application web de commande en ligne et de suivi de commande en temps réel** pour une crêperie basée à Dakar, Sénégal.

🔗 **Démo en ligne :** [king-creperie-v2.vercel.app](https://king-creperie-v2.vercel.app)

---

## ✨ Aperçu

King Crêperie V2 n'est pas qu'un site vitrine : c'est une application complète de bout en bout, pensée comme une vraie plateforme commerciale — commande en ligne, personnalisation des produits, suivi en temps réel, gestion de stock, tableau de bord administrateur avec historique d'audit, le tout bâti avec une attention particulière portée à la sécurité et à la fiabilité des transactions.

### Le menu et la personnalisation

Chaque produit peut être personnalisé avec des extras (Nutella, banane fraîche, chantilly, etc.), dont le prix est **recalculé et validé côté serveur** à chaque étape — jamais fait confiance à ce qu'envoie le navigateur.

### Le panier et la commande

Le tunnel de commande demande d'abord la zone de livraison, pour que le client voie le total réel (produits + frais de livraison) avant même de renseigner ses coordonnées — pensé pour réduire la friction et l'abandon de panier.

### Le suivi en temps réel

Suivi live du statut de la commande (reçue → en préparation → en livraison → livrée), avec estimation de temps restant, confettis et vibration à l'étape de livraison, et diffusion en temps réel via WebSocket — sans jamais exposer les données personnelles du client sur le canal public.

### Le tableau de bord administrateur

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

## 🎥 Démo vidéo

https://github.com/user-attachments/assets/COLLE-ICI-LID-APRES-UPLOAD

*Parcours complet : navigation dans le menu, personnalisation d'une crêpe, ajout au panier, tunnel de commande, et suivi en temps réel côté client.*

---

## 📸 Captures d'écran

### Accueil & menu

<img src="/screenshots/01-accueil-hero.png" width="800" alt="Page d'accueil">

Page d'accueil avec accroche et mise en avant de l'identité de la crêperie (localisation, promesse produit), avant l'entrée dans le menu.

<img src="/screenshots/02-menu-categories.png" width="800" alt="Menu avec catégories et panier flottant">

Grille de menu filtrable par catégorie (Toute la carte, Salées, Sucrées, Boissons, Formules), avec mini panier flottant qui affiche le total en direct sans quitter la page — évite l'aller-retour vers une page panier séparée.

<img src="/screenshots/03-modale-extras.png" width="500" alt="Personnalisation des extras">

Modale de personnalisation : sélection d'extras (Nutella, banane fraîche, chantilly maison, Bueno/Kinder, éclats de spéculoos, double fromage), chacun avec son propre supplément de prix. Le total affiché sur le bouton "Ajouter au panier" se met à jour en direct à chaque sélection, mais reste **recalculé côté serveur** avant enregistrement final.

### Panier & tunnel de commande

<img src="/screenshots/04-checkout-zones.png" width="800" alt="Tunnel de commande — sélection de la zone de livraison">

Étape 1 du tunnel : sélection de la zone de livraison (Zone 1 Almadies/Ngor/Ouakam, Zone 2 Mermoz/Fann/Point E/Liberté 6, Zone 3 Plateau/Yoff/Maristes/VDN), chacune avec ses frais associés affichés directement dans le menu déroulant — le client connaît le coût exact avant de renseigner ses coordonnées.

<img src="/screenshots/05-checkout-whatsapp.png" width="800" alt="Récapitulatif final et envoi via WhatsApp">

Récapitulatif final avec sous-total, frais de livraison et total général, formulaire de coordonnées (nom, téléphone, adresse précise, créneau souhaité), et envoi de la commande formatée directement via WhatsApp — canal déjà maîtrisé par la clientèle locale, sans friction d'inscription.

### Suivi en temps réel

<img src="/screenshots/06-suivi-commande.png" width="800" alt="Suivi de commande en temps réel avec estimation">

Page de suivi accessible via lien unique (UUID de commande) : statut en direct (reçue → en préparation → en livraison → livrée) sous forme de stepper visuel, avec estimation de temps restant recalculée par le staff. Aucune donnée personnelle du client n'est exposée sur cette page publique — seul le statut est diffusé.

### Tableau de bord administrateur

<img src="/screenshots/07-dashboard-commandes.png" width="800" alt="Dashboard — gestion des commandes en direct">

Vue "Commandes" : liste des commandes en cours avec détail des articles, coordonnées client, zone de livraison et total, plus un sélecteur de statut permettant au staff de faire progresser chaque commande en un clic.

<img src="/screenshots/08-dashboard-stock.png" width="800" alt="Dashboard — gestion produits et stock">

Vue "Produits & Stock" : activation/désactivation de la disponibilité produit par produit, et gestion de stock optionnelle (compteur décrémenté automatiquement à chaque commande, alerte visuelle en cas de stock bas ou épuisé).

<img src="/screenshots/09-dashboard-historique.png" width="800" alt="Dashboard — historique d'audit">

Vue "Historique" : journal d'audit infalsifiable de chaque changement de statut, avec l'identité du membre du staff à l'origine du changement, l'ancien et le nouveau statut, et l'horodatage précis — traçabilité complète sans possibilité de modification a posteriori.

---

<p align="center">Développé avec Next.js, Supabase et beaucoup de tests en conditions réelles 🥞</p>
