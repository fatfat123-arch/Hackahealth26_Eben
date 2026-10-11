<div align="center">
  <img src="src/assets/mascotte-salut.png" alt="Mascotte EH Passport" width="150">

# EH Passport

**Le passeport de communication numérique qui aide chacun à être compris.**

Accessible instantanément par **QR code** ou **badge NFC**, sur téléphone comme sur ordinateur.

[Découvrir le site](https://eh-passport.ch) · [Architecture](docs/ARCHITECTURE.md) · [Déploiement](docs/DEPLOIEMENT.md)
</div>

---

## L’idée

Certaines personnes communiquent autrement que par la parole. Lorsqu’elles rencontrent un nouveau professionnel, un remplaçant ou un intervenant extérieur, leurs habitudes, leurs besoins et leurs moyens d’expression ne sont pas toujours connus.

EH Passport transforme ces informations essentielles en un profil clair, visuel et immédiatement accessible. Un scan du QR code ou du badge NFC ouvre le passeport du résident, sans application à installer.

| Le besoin                                      | La réponse EH Passport                                      |
| ---------------------------------------------- | ----------------------------------------------------------- |
| Comprendre rapidement une personne             | Un profil synthétique centré sur ses modes de communication |
| Montrer un geste ou une expression personnelle | Un dictionnaire illustré avec images, sons, GIF et vidéos   |
| Accéder à l’information en situation réelle    | Un même lien ouvert par QR code ou badge NFC                |
| Respecter chaque parcours individuel           | Des rubriques entièrement modulables depuis l’interface     |
| Garder la maîtrise des données                 | Un hébergement privé administré par l’établissement         |

## Une expérience pensée pour le terrain

1. Un professionnel autorisé crée le profil du résident.
2. Il compose librement les rubriques, leur ordre, leur contenu et leurs icônes.
3. Il enrichit le dictionnaire avec des photos, des vidéos en boucle ou des sons.
4. Le site génère le support QR/NFC associé au passeport.
5. Un accompagnant scanne le badge et découvre uniquement les informations utiles, dans une interface accessible et adaptée au téléphone.

La date de naissance reste dans l’espace de gestion ; le passeport public affiche uniquement l’âge. Un profil archivé devient immédiatement inaccessible depuis son QR code et son badge NFC.

## Fonctionnalités

### Pour les résidents et les accompagnants

- passeport public rapide, lisible et adapté aux écrans mobiles ;
- dictionnaire multimédia avec lecture automatique des vidéos en boucle ;
- contenus structurés en bulles ou en mots-clés selon la rubrique ;
- accès sans installation par QR code et technologie NFC ;
- affichage de l’âge sans exposer la date de naissance.

### Pour l’équipe Eben-Hézer

- comptes administrateurs et accompagnants avec droits distincts ;
- création, réorganisation et suppression complète des rubriques ;
- ajout de rubriques et d’icônes personnalisées sans modifier le code ;
- import d’images, de GIF, de vidéos et de fichiers audio ;
- filtre vidéo « dessin animé » facultatif et réversible ;
- génération des profils et badges au format PDF ;
- archivage des profils et renouvellement des liens publics ;
- médias privés distribués par des liens signés temporaires.

## Identité du projet

EH Passport a été conçu pour la **Fondation Eben-Hézer** dans le cadre de **HackaHealth 2026**. Le projet reprend une approche de co-conception : partir des usages réels, réduire les obstacles et laisser aux équipes de terrain la liberté d’adapter chaque passeport.

<p align="center">
  <a href="https://www.hackahealth.ch/">
    <img src="docs/assets/hackahealth-logo.webp" alt="Logo HackaHealth" width="120">
  </a>
  <br>
  <sub>Projet développé dans le cadre de HackaHealth — Make your abilities matter.</sub>
</p>

## Architecture en un coup d’œil

```text
QR code / badge NFC
        │
        ▼
Passeport public ──────── médias privés par URL signée
        │
        ▼
Application Node.js / TanStack Start
        │
        ├── MariaDB : profils, comptes et sessions
        ├── stockage privé : images, sons et vidéos
        └── Python : cartoonisation vidéo facultative
```

| Couche                      | Technologies                                           |
| --------------------------- | ------------------------------------------------------ |
| Interface et serveur web    | React 19, TanStack Start, TypeScript, Vite             |
| Données                     | MariaDB                                                |
| Authentification            | Sessions privées, mots de passe hachés avec bcrypt     |
| Médias                      | Stockage privé, URL signées et lecture HTTP par plages |
| Traitement vidéo facultatif | Python, TensorFlow Lite, OpenCV, PyAV et FFmpeg        |
| Hébergement actuel          | Infomaniak Node.js                                     |

Les choix techniques et les flux de données sont détaillés dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Prise en main pour l’équipe technique

### Prérequis

- Node.js 22.12 ou une version plus récente ;
- une base MariaDB ;
- npm ;
- Python uniquement si le filtre vidéo doit être activé.

### Installation locale

```sh
git clone git@github.com:fatfat123-arch/Hackahealth26_Eben.git
cd Hackahealth26_Eben
npm ci
cp .env.example .env
```

Renseignez la connexion MariaDB dans `.env`, puis préparez l’application :

```sh
npm run db:init
npm run db:create-admin
npm run dev
```

L’application locale est disponible sur [http://localhost:8080](http://localhost:8080). `db:create-admin` demande les informations du premier administrateur de manière interactive et masque le mot de passe pendant la saisie.

### Commandes utiles

| Commande                  | Utilisation                                                 |
| ------------------------- | ----------------------------------------------------------- |
| `npm run dev`             | lancer le serveur de développement                          |
| `npm run check`           | contrôler le code, les types, les tests et le build         |
| `npm test`                | exécuter les tests automatisés                              |
| `npm run db:init`         | créer ou mettre à jour le schéma sans supprimer les données |
| `npm run db:create-admin` | créer ou réinitialiser un administrateur                    |
| `npm run build`           | produire la version de production                           |
| `npm start`               | lancer la version compilée                                  |

## Repères dans le dépôt

| Emplacement                  | Responsabilité                                   |
| ---------------------------- | ------------------------------------------------ |
| `src/routes/`                | pages, routes publiques et API                   |
| `src/components/backoffice/` | espace de gestion des profils et des comptes     |
| `src/components/passport/`   | passeport public et lecteurs multimédias         |
| `src/lib/`                   | modèles, validation et logique métier            |
| `src/server/`                | base de données, sessions, médias et traitements |
| `database/`                  | schéma MariaDB de référence                      |
| `scripts/`                   | initialisation et opérations répétables          |
| `Cartooniser/`               | traitement vidéo Python isolé                    |
| `src/test/`                  | tests automatisés                                |

Le fichier `src/routeTree.gen.ts` est généré automatiquement par TanStack Start et ne doit pas être modifié à la main.

## Configuration et déploiement

Le fichier `.env.example` documente les paramètres requis : accès MariaDB, répertoire privé des médias, secret de signature, domaine public et configuration facultative du cartooniser.

La procédure complète pour Infomaniak — commande de build, démarrage, initialisation et retour arrière — se trouve dans [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md).

## Protection des données

Les données des résidents, les médias, les mots de passe et le fichier `.env` ne doivent jamais être ajoutés à Git. En production, les médias sont conservés hors du dossier public et ne sont transmis qu’après validation d’une URL signée à durée limitée.

Avant toute démonstration, utilisez exclusivement des profils fictifs et vérifiez qu’aucune donnée personnelle ni aucun identifiant technique n’apparaît à l’écran.
