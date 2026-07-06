# 🎓 MonAdmissionMaster

**Veille automatisée pour les admissions en Master Finance au Maroc.**

MonAdmissionMaster est une solution basée sur **Cloudflare Workers** qui surveille en temps réel les sites officiels des **ENCG** (Écoles Nationales de Commerce et de Gestion) et des **Universités publiques** marocaines pour détecter l'ouverture des candidatures en Master.

---

## 🚀 Fonctionnalités Clés

- 🕵️ **Scraping Intelligent** : Surveillance de 16 sources ENCG et 22 sources Universitaires/FSJES.
- 🤖 **Scoring de Confiance** : Algorithme anti-faux-positifs (0-100) pour garantir la pertinence des alertes.
- 📧 **Notifications Immédiates** : Alertes par email via Resend ou Brevo dès qu'une nouvelle annonce est détectée.
- ⏰ **Logique Cron Optimisée** : Planification différenciée pour éviter la surcharge (Cycle de 5 jours : ENCG à J0, Universités à J2).
- 🗄️ **Déduplication KV** : Utilisation de Cloudflare KV pour ne jamais envoyer deux fois la même alerte.
- 🛠️ **Mode Dry Run** : Possibilité de tester le système sans envoyer d'emails réels.

---

## 📂 Structure du Projet

```text
MonAdmissionMaster/
├── src/
│   ├── index.ts               # Point d'entrée (Cron + API HTTP)
│   ├── modules/               # Logique spécifique (ENCG, Universités)
│   ├── shared/                # Utilitaires (Scraper, Mailer, Filter, Dedupe)
│   ├── sources/               # Liste des URLs et sélecteurs officiels
│   └── test-dry.ts            # Script de test sans effets de bord
├── docs/                      # Documentation détaillée de déploiement
├── wrangler.toml              # Configuration Cloudflare Workers
└── RAPPORT.md                 # Rapport de recherche des sources
```

---

## 🛠️ Installation et Déploiement

### 1. Prérequis
- Un compte [Cloudflare](https://dash.cloudflare.com/)
- Un compte [Resend](https://resend.com/) ou [Brevo](https://www.brevo.com/) pour les emails.

### 2. Configuration locale
```bash
git clone https://github.com/poodasamuelpro/MonAdmissionMaster.git
cd MonAdmissionMaster
npm install
```

### 3. Création des ressources Cloudflare
Créez l'espace de stockage KV pour la déduplication :
```bash
npx wrangler kv namespace create DEDUPE_KV
```
Copiez l'ID obtenu dans votre fichier `wrangler.toml`.

### 4. Configuration des Secrets
Ajoutez vos clés API de manière sécurisée :
```bash
npx wrangler secret put RESEND_API_KEY
# OU
npx wrangler secret put BREVO_API_KEY
```

### 5. Déploiement
```bash
npx wrangler deploy
```

---

## 🧪 Tests
Pour vérifier le bon fonctionnement sans envoyer d'emails :
```bash
npm run test:dry
```

---

## 📄 Licence
Ce projet est destiné à un usage personnel pour faciliter l'accès aux informations d'admission.
