# Déploiement sur Infomaniak

## Prérequis

- un site Node.js Infomaniak utilisant Node.js 22.12 ou une version plus récente ;
- une base MariaDB et un utilisateur dédié à l’application ;
- un dossier privé et accessible en écriture pour les médias ;
- les variables de production décrites dans `.env.example` ;
- les dépendances Python uniquement si la cartoonisation est activée.

## Configuration du gestionnaire Node.js

### Dossier source

```text
/srv/customer/sites/eh-passport.ch
```

### Commande de compilation

```sh
git pull --ff-only origin main && npm ci --no-audit --no-fund && npm run db:init && npm run build
```

Cette commande récupère la dernière version de `main`, installe exactement les dépendances déclarées, applique les mises à jour non destructives de la base de données et produit l’application de production.

### Commande de démarrage

```sh
npm start
```

Après une modification du code ou des variables d’environnement, lancez **Build** puis **Restart** dans le gestionnaire Node.js d’Infomaniak. Un `git pull` exécuté dans la console SSH met seulement les fichiers source à jour : il ne remplace pas automatiquement le processus Node.js déjà en cours d’exécution.

## Premier déploiement

1. Copiez `.env.example` vers `.env` sur le serveur.
2. Renseignez les accès à la base MariaDB de production.
3. Générez une valeur `MEDIA_SIGNING_SECRET` unique contenant au moins 24 caractères aléatoires.
4. Définissez `PUBLISHED_ORIGIN` avec le domaine HTTPS public, par exemple `https://eh-passport.ch`.
5. Créez le dossier `MEDIA_ROOT` en dehors du dossier web public et accordez à l’application Node.js le droit d’y écrire.
6. Exécutez la commande de compilation configurée dans le gestionnaire Node.js.
7. Dans une console SSH interactive, lancez `npm run db:create-admin` et saisissez l’adresse e-mail, le nom et le mot de passe temporaire du premier administrateur. Le mot de passe reste masqué et n’est pas enregistré dans l’historique du terminal.
8. Démarrez l’application.

## Variables indispensables

| Variable               | Utilisation                                                |
| ---------------------- | ---------------------------------------------------------- |
| `DB_HOST`              | serveur MariaDB                                            |
| `DB_PORT`              | port MariaDB, généralement `3306`                          |
| `DB_NAME`              | nom de la base de données                                  |
| `DB_USER`              | utilisateur dédié à l’application                          |
| `DB_PASSWORD`          | mot de passe de cet utilisateur                            |
| `MEDIA_ROOT`           | dossier privé des médias                                   |
| `MEDIA_SIGNING_SECRET` | signature des URL temporaires                              |
| `PUBLISHED_ORIGIN`     | origine HTTPS utilisée dans les QR codes et badges NFC     |
| `SWISS_IP_ONLY`        | `true` pour limiter les connexions aux adresses IP suisses |

Les variables `LOGIN_RATE_LIMIT_*` règlent la protection contre les tentatives répétées de connexion. Les variables `CARTOONISER_*` configurent le traitement vidéo facultatif.

## Vérifications après déploiement

Effectuez les contrôles suivants après chaque mise en production importante :

1. ouvrir `https://eh-passport.ch` ;
2. se connecter avec un compte de test ;
3. ouvrir un profil depuis l’espace de gestion ;
4. enregistrer une modification sans donnée personnelle réelle ;
5. ouvrir le passeport public avec son QR code ;
6. lire une image, un son et une vidéo depuis un téléphone, notamment un iPhone ;
7. vérifier l’ouverture du même passeport avec un badge NFC ;
8. confirmer qu’un profil archivé n’est plus visible publiquement.

## Cartoonisation vidéo

Suivez les instructions de `Cartooniser/USAGE.txt`, puis renseignez `CARTOONISER_PYTHON` avec le chemin de l’exécutable Python fonctionnel.

Le site reste utilisable lorsque le cartooniser n’est pas installé. Seul le filtre vidéo facultatif est alors indisponible.

## Mise à jour courante

Lorsque le dépôt GitHub contient une nouvelle version :

1. ouvrez le gestionnaire Node.js du site dans Infomaniak ;
2. lancez **Build** ;
3. attendez la fin de la compilation et vérifiez qu’elle ne contient aucune erreur ;
4. lancez **Restart** ;
5. contrôlez le site public et la connexion.

La commande de compilation récupère elle-même `main`. Il n’est donc pas nécessaire d’exécuter séparément `git pull` lorsque le gestionnaire Node.js utilise bien la commande indiquée plus haut.

## Retour à une version précédente

En cas de problème, utilisez Git pour sélectionner le dernier commit fonctionnel, relancez la compilation depuis le gestionnaire Node.js, puis redémarrez l’application.

Les mises à jour de la base doivent rester rétrocompatibles, car `npm run db:init` est volontairement non destructif et ne supprime jamais les données existantes.
