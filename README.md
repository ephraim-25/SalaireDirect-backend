# SalaireDirect — API (NestJS)

API de paie pour la RD Congo (IPR, CNSS), hébergée sur Render. Base de données et authentification : Supabase.

## Démarrage

```bash
npm install
cp .env.example .env   # puis renseignez vos valeurs
npm run start:dev
```

Le serveur **refuse de démarrer** si `SUPABASE_URL` ou `SUPABASE_ANON_KEY` manquent.

## Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Obligatoires. La clé `anon` est utilisée avec le jeton de l'utilisateur : les règles RLS s'appliquent. |
| `SUPABASE_SERVICE_ROLE_KEY` | Secrète (serveur uniquement). Sert à créer l'entreprise d'un nouveau compte à sa première connexion. |
| `CORS_ORIGIN` | Origines autorisées, séparées par des virgules (URL du frontend Vercel). |
| `PORT` | Fourni par Render. |

## Sécurité

- **Toute route exige un jeton Supabase valide** (`Authorization: Bearer <access_token>`), sauf `GET /api/v1/health`.
- L'entreprise de l'utilisateur est déterminée **par le serveur** (table `company_users`), jamais par le client. Chaque requête est filtrée par entreprise, en plus de la RLS Supabase.
- Les bulletins sont **recalculés par le serveur** : les montants envoyés par le navigateur ne sont pas enregistrés. Une paie clôturée ne peut plus être modifiée.
- Inscription, connexion et réinitialisation du mot de passe passent directement par Supabase Auth (frontend). Le backend vérifie seulement le jeton.
- Limitation de débit (120 requêtes/min/IP) et en-têtes de sécurité (`helmet`).

## Routes principales (préfixe `/api/v1`)

`GET /health` · `GET /auth/me` · `GET|POST|PUT|DELETE /employees` · `GET /payrolls` ·
`POST /payrolls/calculate` · `POST /payrolls/save-month` · `GET|POST|DELETE /payrolls/variables` ·
`GET /pdf/payslip/:id` · `GET /pdf/payroll-summary/:id`

## Tests

```bash
npm test          # moteur de calcul, guard d'authentification
npm run test:e2e  # sécurité des routes
```
