# Architecture

## Parcours d’une requête

TanStack Start assure le rendu des pages publiques et des pages authentifiées. Le fichier `src/server.ts` constitue le point d’entrée de production : il applique la protection contre les robots et, lorsqu’elle est activée, la restriction aux adresses IP suisses avant de transmettre la requête à l’application.

Les liens publics des passeports utilisent un identifiant aléatoire `public_id`, jamais l’identifiant interne du résident. Le chargeur public récupère uniquement le profil demandé et transforme les chemins des médias privés en URL signées à durée limitée.

Les fonctions serveur authentifiées utilisent le cookie HTTP-only `eh_session`. Les sessions sont enregistrées dans MariaDB sous forme d’empreintes SHA-256. Les administrateurs peuvent gérer les comptes et utiliser le cartooniser facultatif ; les accompagnants peuvent gérer le contenu des profils qui leur sont accessibles.

## Organisation principale

```text
src/routes/                 pages, URL et adaptateurs des routes API
src/components/backoffice/ gestion des profils et des comptes
src/components/passport/   passeport public et lecteurs multimédias
src/lib/                    modèles, validation et fonctions serveur
src/server/                 base, sessions, médias et traitements
database/                   schéma MariaDB de référence
scripts/                    scripts d’exploitation réutilisables
Cartooniser/                traitement vidéo Python isolé
```

## Stockage des données

MariaDB conserve les utilisateurs, les sessions et les passeports. Les médias importés sont enregistrés sous `MEDIA_ROOT`, en dehors du dossier web public. La base de données ne contient que leurs chemins relatifs. La route `/api/media` vérifie la signature de l’URL et prend en charge les requêtes HTTP par plages, indispensables à la lecture des vidéos sur téléphone.

Le dictionnaire et les listes du profil sont actuellement stockés dans des colonnes JSON. La colonne `section_order` contient aussi l’ordre des rubriques, les rubriques personnalisées et leurs icônes configurées depuis l’espace de gestion. Toute évolution de cette structure doit être reportée ensemble dans les types et les conversions de `src/lib/patients.ts` et `src/lib/patients.functions.ts`.

## Parcours d’un média

1. Le navigateur contrôle le type et la taille du fichier.
2. `/api/upload` répète ces contrôles et enregistre le fichier sous `MEDIA_ROOT`.
3. Seul le chemin relatif est enregistré avec le profil du résident.
4. Le serveur crée une URL signée temporaire lorsque le profil est chargé.
5. `/api/media` transmet le fichier et gère les requêtes par plages.

La cartoonisation est facultative. L’administrateur sélectionne une vidéo existante, le serveur Node.js lance `Cartooniser/cartoonise.py`, puis la vidéo MP4 transformée est enregistrée comme un nouveau média. Le chemin de la vidéo originale est conservé afin de pouvoir retirer le filtre avant l’enregistrement.

## Authentification et autorisations

Les mots de passe sont hachés avec bcrypt. Une connexion valide crée une session privée dans MariaDB et un cookie inaccessible au JavaScript du navigateur. Les fonctions serveur vérifient systématiquement la session et le rôle avant d’accéder aux données.

Un accompagnant ne peut consulter et modifier que les profils qui lui sont attribués. Les opérations d’administration des comptes et la cartoonisation restent réservées aux administrateurs.

## Modification de la base de données

`database/schema.sql` décrit une nouvelle installation complète. `scripts/init-db.mjs` applique les évolutions nécessaires à une base existante et doit pouvoir être exécuté plusieurs fois sans supprimer les données.

Une modification du schéma doit toujours être ajoutée dans ces deux fichiers. Les changements déployés doivent rester compatibles avec les données déjà présentes en production.

## Vérifications

Les tests Vitest et Testing Library se trouvent dans `src/test/`. Les tests du traitement Python sont placés dans `Cartooniser/tests/`.

La commande de validation complète du projet est :

```sh
npm run check
```

Elle exécute successivement ESLint, la vérification TypeScript, les tests automatisés et la compilation de production.
