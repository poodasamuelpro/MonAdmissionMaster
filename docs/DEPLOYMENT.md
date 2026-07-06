# Guide de déploiement — MonAdmissionMaster

## Architecture

Un seul Worker Cloudflare (`monadmissionmaster.izicardouaga.workers.dev`) contenant deux modules internes indépendants :
- **ENCG** : surveille les 13 ENCG du Maroc
- **Universités** : surveille les FSJES des universités publiques

## Logique de cron différenciée

| Jour (epochDay % 5) | Action |
|---|---|
| 0 | ENCG |
| 1 | — (repos) |
| 2 | Universités |
| 3 | — (repos) |
| 4 | — (repos) |

**Garanties :**
- Jamais les deux le même jour
- Minimum 2 jours d'écart
- Chaque module attend 5 jours entre deux exécutions
- L'échec d'un module n'affecte jamais l'autre (try/catch isolé)

## Étape 1 — Créer le KV Namespace

```bash
cd MonAdmissionMaster

# Créer le KV namespace de déduplication
npx wrangler kv namespace create DEDUPE_KV

# Copier l'id retourné dans wrangler.toml
# Exemple : id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

## Étape 2 — Configurer les secrets

**⚠ JAMAIS de secrets dans wrangler.toml ou dans le code.**

```bash
# Fournisseur email (Resend — recommandé)
npx wrangler secret put RESEND_API_KEY
# → Saisir la clé Resend quand demandé (re_xxxxxxxxxxxxx)

# OU Brevo
npx wrangler secret put BREVO_API_KEY
# → Saisir la clé Brevo quand demandé

# Protection du déclenchement manuel (optionnel mais recommandé)
npx wrangler secret put TRIGGER_SECRET
# → Saisir un mot de passe fort
```

## Étape 3 — Mettre à jour wrangler.toml

Remplacer `YOUR_KV_NAMESPACE_ID` par l'ID obtenu à l'étape 1.

Configurer les variables dans `[vars]` :
- `ALERT_EMAIL_TO` : votre adresse email
- `ALERT_EMAIL_FROM` : adresse vérifiée sur Resend/Brevo
- `EMAIL_PROVIDER` : `"resend"` ou `"brevo"`

## Étape 4 — Déployer

```bash
npx wrangler deploy
```

## Étape 5 — Vérifier

```bash
# Test de santé
curl https://monadmissionmaster.izicardouaga.workers.dev/health

# Déclenchement manuel ENCG (avec secret)
curl "https://monadmissionmaster.izicardouaga.workers.dev/trigger?module=encg&secret=VOTRE_SECRET"

# Déclenchement manuel Universités
curl "https://monadmissionmaster.izicardouaga.workers.dev/trigger?module=universites&secret=VOTRE_SECRET"

# Test complet (les deux modules)
curl "https://monadmissionmaster.izicardouaga.workers.dev/trigger?module=both&secret=VOTRE_SECRET"
```

## Étape 6 — Configurer Resend (tier gratuit : 100 emails/jour)

1. Créer un compte sur [resend.com](https://resend.com)
2. Vérifier votre domaine ou utiliser l'adresse `onboarding@resend.dev` (test uniquement)
3. Créer une clé API dans le dashboard
4. `npx wrangler secret put RESEND_API_KEY`

## Étape 7 — GitHub Secrets (CI/CD optionnel)

Pour un déploiement automatique via GitHub Actions :

```
CLOUDFLARE_API_TOKEN=xxx
CLOUDFLARE_ACCOUNT_ID=xxx
```

**⚠ Ces secrets ne doivent jamais apparaître dans le code.**

## Variables d'environnement summary

| Variable | Type | Valeur exemple |
|---|---|---|
| `EMAIL_PROVIDER` | var | `"resend"` |
| `ALERT_EMAIL_TO` | var | `"vous@gmail.com"` |
| `ALERT_EMAIL_FROM` | var | `"alertes@domaine.com"` |
| `DRY_RUN` | var | `"false"` |
| `MIN_CONFIDENCE_SCORE` | var | `"60"` |
| `RESEND_API_KEY` | **secret** | `re_xxx...` |
| `BREVO_API_KEY` | **secret** | `xkeysib-xxx...` |
| `TRIGGER_SECRET` | **secret** | (mot de passe fort) |

## Routes HTTP disponibles

| Route | Description |
|---|---|
| `GET /` ou `/health` | État du Worker, prochains runs |
| `GET /trigger?module=encg&secret=XXX` | Déclenche ENCG manuellement |
| `GET /trigger?module=universites&secret=XXX` | Déclenche Universités manuellement |
| `GET /trigger?module=both&secret=XXX` | Déclenche les deux |
| `GET /trigger?module=auto&secret=XXX` | Applique la logique du jour |

## Avertissement légal scraping

⚠ **À lire avant mise en production** :

- Le scraping de **groupes/pages Facebook** est **strictement interdit** par les CGU Meta et peut engager la responsabilité civile/pénale selon le droit marocain (Loi n° 09-08 sur la protection des données personnelles).
- Ce projet scrape **exclusivement des sites officiels publics** (universités, ministère) — ce qui est généralement toléré à des fins de veille non-commerciale.
- Vérifier le fichier `robots.txt` de chaque site avant de modifier les sources.
- En cas de doute, contacter directement les établissements.
