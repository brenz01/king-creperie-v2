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

<img width="956" height="561" alt="Capture d&#39;écran 2026-09-17 010935" src="https://github.com/user-attachments/assets/eb28f082-4b12-4910-b0da-235c52a7be5c" />


Page d'accueil avec accroche et mise en avant de l'identité de la crêperie (localisation, promesse produit), avant l'entrée dans le menu.

<img width="959" height="563" alt="Capture d&#39;écran 2026-09-17 011014" src="https://github.com/user-attachments/assets/66b2eadc-bf08-467b-ba46-818b52641dfa" />


Grille de menu filtrable par catégorie (Toute la carte, Salées, Sucrées, Boissons, Formules), avec mini panier flottant qui affiche le total en direct sans quitter la page — évite l'aller-retour vers une page panier séparée.

<img width="949" height="530" alt="Capture d&#39;écran 2026-09-17 010948" src="https://github.com/user-attachments/assets/8c3cb77e-54e5-4815-a4a2-07e1327aa400" />


Modale de personnalisation : sélection d'extras (Nutella, banane fraîche, chantilly maison, Bueno/Kinder, éclats de spéculoos, double fromage), chacun avec son propre supplément de prix. Le total affiché sur le bouton "Ajouter au panier" se met à jour en direct à chaque sélection, mais reste **recalculé côté serveur** avant enregistrement final.

### Panier & tunnel de commande

<img width="959" height="556" alt="Capture d&#39;écran 2026-09-17 011029" src="https://github.com/user-attachments/assets/28d95dfd-3985-4151-bfcc-4829b9c77e26" />

<img width="536" height="277" alt="Capture d&#39;écran 2026-09-17 011037" src="https://github.com/user-attachments/assets/824a185b-34a9-4651-b766-c27b7f567945" />


Étape 1 du tunnel : sélection de la zone de livraison (Zone 1 Almadies/Ngor/Ouakam, Zone 2 Mermoz/Fann/Point E/Liberté 6, Zone 3 Plateau/Yoff/Maristes/VDN), chacune avec ses frais associés affichés directement dans le menu déroulant — le client connaît le coût exact avant de renseigner ses coordonnées.

<img width="959" height="552" alt="Capture d&#39;écran 2026-09-17 011057" src="https://github.com/user-attachments/assets/d63ca58d-00f1-40b2-b7b8-e56fb4ce32f8" />


Récapitulatif final avec sous-total, frais de livraison et total général, formulaire de coordonnées (nom, téléphone, adresse précise, créneau souhaité), et envoi de la commande formatée directement via WhatsApp — canal déjà maîtrisé par la clientèle locale, sans friction d'inscription.

### Suivi en temps réel

<img width="958" height="559" alt="Capture d&#39;écran 2026-09-17 011134" src="https://github.com/user-attachments/assets/5da63ba7-f068-4bff-a099-6f58aaefdb1d" />


Page de suivi accessible via lien unique (UUID de commande) : statut en direct (reçue → en préparation → en livraison → livrée) sous forme de stepper visuel, avec estimation de temps restant recalculée par le staff. Aucune donnée personnelle du client n'est exposée sur cette page publique — seul le statut est diffusé.

### Tableau de bord administrateur

<img width="959" height="565" alt="Capture d&#39;écran 2026-09-17 011152" src="https://github.com/user-attachments/assets/f8d036a1-8a98-47c1-a57e-00f70617db6c" />


Vue "Commandes" : liste des commandes en cours avec détail des articles, coordonnées client, zone de livraison et total, plus un sélecteur de statut permettant au staff de faire progresser chaque commande en un clic.

<img width="959" height="555" alt="Capture d&#39;écran 2026-09-17 011204" src="https://github.com/user-attachments/assets/fedd64c2-172e-4168-ab69-e170904942ec" />


Vue "Produits & Stock" : activation/désactivation de la disponibilité produit par produit, et gestion de stock optionnelle (compteur décrémenté automatiquement à chaque commande, alerte visuelle en cas de stock bas ou épuisé).

<img width="959" height="548" alt="Capture d&#39;écran 2026-09-17 011213" src="https://github.com/user-attachments/assets/8ca85c36-2e6d-4b44-b85a-b9abcf6eb0e2" />


Vue "Historique" : journal d'audit infalsifiable de chaque changement de statut, avec l'identité du membre du staff à l'origine du changement, l'ancien et le nouveau statut, et l'horodatage précis — traçabilité complète sans possibilité de modification a posteriori.

---

<p align="center">Développé avec Next.js, Supabase et beaucoup de tests en conditions réelles 🥞</p>
