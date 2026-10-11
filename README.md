# EH Passport

EH Passport permet de créer des passeports de communication pour des personnes ayant des difficultés à communiquer. Le passeport public d’un résident s’ouvre avec un QR code ou un badge NFC. Les professionnels autorisés gèrent les profils, les médias et les comptes accompagnants depuis un espace privé.

L’interface est en français. Elle est conçue pour les téléphones, l’accessibilité et une utilisation dans les établissements médico-sociaux.

## Fonctionnalités principales

- passeports publics accessibles par des liens non indexés et renouvelables ;
- accès par QR code et badge NFC ;
- comptes administrateurs et accompagnants ;
- dictionnaire avec images, GIF, fichiers audio et vidéos en boucle ;
- sections configurables depuis l’interface, avec ajout, masquage, ordre et choix d’icône ;
- filtre de cartoonisation vidéo facultatif pour les administrateurs ;
- téléchargement des profils et badges au format PDF ;
- archivage des profils et des comptes ;
- médias privés accessibles par des URL signées temporaires ;
- restriction facultative aux adresses IP suisses.

## Technologies

- Node.js 22.12+
- TanStack Start, React, TypeScript and Vite
- MariaDB
- stockage local et privé des médias pour le déploiement actuel
- traitement facultatif des vidéos avec Python, TensorFlow Lite, OpenCV et PyAV

## Lancer le projet en local

Node.js 22.12 ou une version plus récente ainsi qu’une base MariaDB sont nécessaires.

```sh
git clone git@github.com:fatfat123-arch/Hackahealth26_Eben.git
cd Hackahealth26_Eben
npm ci
cp .env.example .env
```

Renseignez les accès à votre base locale dans `.env`, puis initialisez la base et le premier compte administrateur :

```sh
npm run db:init
npm run db:create-admin
npm run dev
```

`db:create-admin` demande l’adresse e-mail, le nom et le mot de passe temporaire de l’administrateur. Le mot de passe reste masqué pendant la saisie.

Ouvrez [http://localhost:8080](http://localhost:8080), puis utilisez un compte et un profil de test créés dans votre base locale.

Ne publiez jamais `.env`, les accès à la base de données, les médias des résidents ou les fichiers générés.

## Où effectuer les modifications

| Partie                                      | Emplacement                  |
| ------------------------------------------- | ---------------------------- |
| Pages et URL                                | `src/routes/`                |
| Composants de l’espace privé                | `src/components/backoffice/` |
| Passeport public et lecteurs multimédias    | `src/components/passport/`   |
| Règles métier partagées                     | `src/lib/`                   |
| Authentification, base et services médias   | `src/server/`                |
| Schéma de la base de données                | `database/schema.sql`        |
| Mises à jour sûres du schéma                | `scripts/init-db.mjs`        |
| Styles globaux                              | `src/styles.css`             |
| Images, mascottes, polices et tutoriels     | `src/assets/`                |
| Tests automatisés                           | `src/test/`                  |
| Cartoonisation Python                       | `Cartooniser/`               |
| Modèle de configuration de production       | `.env.example`               |

TanStack Start utilise un routage basé sur les fichiers. `src/routeTree.gen.ts` est généré automatiquement et ne doit pas être modifié manuellement. Consultez `src/routes/README.md` pour les conventions de nommage.

## Commandes

```sh
npm run dev              # serveur de développement sur le port 8080
npm run typecheck        # vérification TypeScript
npm test                 # tous les tests
npm run lint             # ESLint
npm run build            # compilation de production
npm run check            # lint, types, tests et compilation
npm run db:init          # création ou mise à jour sûre du schéma
npm run db:create-admin  # création/réinitialisation d’un administrateur
npm run ip-ranges:update # actualisation des plages IP suisses depuis RIPE NCC
npm start                # lancement de l’application compilée
```

Exécutez `npm run check` avant chaque envoi ou déploiement.

## Configuration

Copiez `.env.example` vers `.env`. Les réglages principaux sont :

| Variable                                                  | Rôle                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | connexion MariaDB                                            |
| `MEDIA_ROOT`                                              | dossier privé contenant les fichiers envoyés                 |
| `MEDIA_SIGNING_SECRET`                                    | secret des URL temporaires, 24 caractères minimum            |
| `PUBLISHED_ORIGIN`                                        | domaine public utilisé dans les liens QR et NFC               |
| `SWISS_IP_ONLY`                                           | `true` pour limiter l’accès aux plages IP suisses             |
| `LOGIN_RATE_LIMIT_*`                                      | protection contre les tentatives répétées de connexion       |
| `CARTOONISER_*`                                           | exécutable Python, taille maximale et délai de traitement     |

Plus de détails sont disponibles dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) et [CONTRIBUTING.md](CONTRIBUTING.md).

## Données et confidentialité

Les données réelles des résidents doivent rester dans MariaDB et dans le dossier privé des médias, jamais dans Git. Le passeport public affiche l’âge calculé, et non la date de naissance complète.

## Cartoonisation

Le site fonctionne sans ce filtre facultatif. Pour l’activer, installez les dépendances Python et configurez `CARTOONISER_PYTHON`. Les instructions complètes se trouvent dans [Cartooniser/USAGE.txt](Cartooniser/USAGE.txt).

## Vidéo de démonstration

La démonstration sera fournie sous forme de vidéo dans ce dépôt. Avant de la publier, vérifiez qu’elle ne contient aucune donnée réelle de résident ni aucun identifiant confidentiel.
