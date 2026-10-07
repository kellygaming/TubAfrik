# TubAfrik

Les vidéos courtes de l'Afrique : un fil vertical façon TikTok, ouvert à tous les créateurs
(musique, humour, cuisine, sport, gaming…), pensé pour les réseaux mobiles africains.

- **Base** : publier, regarder, aimer, commenter, s'abonner, partager sur WhatsApp, signaler.
- **Un fil par personne** : le « Pour toi » (`tub_feed_v2`) pondère chaque vidéo par l'affinité
  de la personne avec sa catégorie (centres d'intérêt choisis à l'inscription, likes, vues,
  abonnements ; cookie `tub_int` pour les visiteurs), ajoute un hasard propre à la session,
  relègue le déjà-vu et évite d'enchaîner le même créateur ou la même catégorie.
- **Cadeaux & VIP** (première monétisation) : un fan offre 🌹 Rose, 💎 Diamant, 👑 Couronne ou
  🦁 Lion d'Afrique, payé en mobile money via Chariow. Il devient VIP du créateur (badge,
  commentaires en or placés en tête). Le TubAfrikain touche 80 %, retirable 3 jours après le
  don, sans minimum (`/gains`) ; les retraits se règlent à la main sur `/admin/retraits`.

## Architecture

| Brique | Rôle |
|---|---|
| **Next.js 16** (App Router) sur **Vercel** | Pages, API, appli installable (PWA) |
| **Supabase** (le même projet que Kelly Gaming) | Comptes Google, profils, likes, commentaires, abonnements |
| **Bunny Stream** | Stockage, encodage HLS (240p → 720p) et diffusion CDN des vidéos |

Le fichier vidéo ne passe jamais par nos serveurs : le navigateur l'envoie directement
à Bunny (protocole TUS, qui reprend l'envoi après une coupure réseau) avec une signature
calculée côté serveur.

```
src/
├── app/
│   ├── page.tsx                 Fil « Pour toi » / « Abonnements » + filtre par jeu
│   ├── v/[id]/                  Page d'une vidéo (aperçu WhatsApp)
│   ├── u/[username]/            Profil créateur
│   ├── publier/                 Mise en ligne
│   ├── connexion/ bienvenue/    Connexion Google + choix du pseudo
│   ├── profil/modifier/         Édition du profil
│   ├── admin/                   Modération des signalements, retraits
│   ├── gains/ merci/            Portefeuille du créateur, retour de paiement
│   └── api/                     Vidéos, webhook Bunny, cadeaux, Pulse Chariow, retraits
├── components/feed/             Lecteur HLS économe, fil vertical, panneaux
├── lib/                         Supabase, Bunny, jeux, formats
└── proxy.ts                     Rafraîchissement de session
supabase/migrations/             Schéma SQL (tables tub_*, RLS, compteurs, fil)
```

### Choix importants

- **Économie de data** : seule la vidéo à l'écran et la suivante se chargent ; la
  lecture démarre en basse qualité puis monte si le réseau suit ; un mode plafonné à
  360p s'active tout seul sur les connexions lentes.
- **Sécurité** : RLS activé sur toutes les tables `tub_*` dès la création. Les compteurs
  (likes, vues, abonnés) ne sont modifiables que par la base. Seul le serveur crée des vidéos.
- **Vues** : une par personne, par vidéo et par jour, après 3 secondes regardées. Les vues
  de comptes connectés sont marquées à part (`is_auth`) : ce sont elles qui compteront
  pour la monétisation.
- **Modération** : au-delà de 5 signalements, une vidéo est masquée automatiquement
  jusqu'à décision sur `/admin`.

## En ligne

- **Site** : https://tubafrik.vercel.app (projet Vercel `tubafrik`, région Paris `cdg1`, au plus près de l'Afrique de l'Ouest)
- **Base** : tables `tub_*` créées dans le projet Supabase `kelly-gaming` (migration `tubafrik_mvp`)

## Mise en route

### 1. Supabase

1. ✅ Fait : `supabase/migrations/0001_tubafrik_mvp.sql` est appliquée sur le projet Kelly Gaming.
   Rien n'est modifié dans les tables existantes : tout est préfixé `tub_`.
2. **Authentication → URL Configuration → Redirect URLs** : ajouter
   `https://<domaine-tubafrik>/auth/callback` (et `http://localhost:3000/auth/callback`
   pour le développement). Le fournisseur Google est déjà configuré pour Kelly Gaming.

### 2. Bunny Stream

1. Créer une **Video Library** « TubAfrik » sur bunny.net.
2. Dans **Encoding** : résolutions 240p, 360p, 480p, 720p (pas plus : la 1080p coûte
   cher à diffuser et se voit peu sur un téléphone).
3. Récupérer : *Library ID*, *API Key*, *CDN Hostname* (`vz-xxxx.b-cdn.net`).
4. **Webhook URL** : `https://<domaine-tubafrik>/api/bunny/webhook?secret=<BUNNY_WEBHOOK_SECRET>`.

### 3. Vercel

Importer le dépôt, puis renseigner les variables listées dans `.env.example`.

### Développement local

```bash
cp .env.example .env.local   # puis remplir
npm install
npm run dev
```

## Feuille de route

1. **Lancement** : version minimale + premiers créateurs invités.
2. **Codes créateurs** : chaque créateur touche une commission sur les recharges Kelly
   Gaming achetées avec son code. C'est la première source de revenus, sans annonceur.
3. **Cadeaux et pourboires** en mobile money (PayDunya / MoneyFusion déjà intégrés côté Kelly Gaming).
4. **Défis sponsorisés** par des marques.
5. **Publicité** et partage des revenus selon le temps de visionnage qualifié.
