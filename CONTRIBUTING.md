# Contribuer au projet

## Méthode de travail

1. Récupérez la dernière version de la branche `main`.
2. Créez une branche courte dédiée à la modification.
3. Ne placez aucun secret ni aucune donnée réelle de résident dans Git.
4. Ajoutez ou adaptez les tests lorsque le comportement change.
5. Exécutez `npm run check`.
6. Ouvrez une pull request en décrivant le changement visible et son impact sur le déploiement.

## Conventions de code

- Utilisez TypeScript et l’alias `@/` pour les imports depuis `src/`.
- Placez le code réservé au serveur dans `src/server/` ou dans des fichiers `.server.ts`.
- Validez les données non fiables dans le navigateur et sur le serveur.
- Gardez des textes français clairs et respectueux dans l’interface.
- Préservez la navigation au clavier, le focus visible, les contrastes et de grandes zones tactiles.
- Utilisez `PassportView`, `DictionaryGrid` et `DictionaryMedia` pour le passeport public et l’aperçu.
- Reportez toute modification de base dans `database/schema.sql` et dans la migration idempotente de `scripts/init-db.mjs`.
- Ne modifiez pas `src/routeTree.gen.ts` : Vite le régénère depuis `src/routes/`.

## Avant de demander une relecture

```sh
npm run check
```

Vérifiez aussi le parcours modifié sur ordinateur et avec une taille d’écran d’iPhone. Testez les changements multimédias avec un vrai fichier de test envoyé dans l’application.

## Modifications sensibles pour la production

Signalez clairement les changements qui concernent :

- le schéma ou les migrations de la base de données ;
- les variables d’environnement ;
- l’authentification ou la confidentialité du passeport public ;
- les chemins ou formats des médias ;
- les dépendances Python de cartoonisation ;
- les commandes de compilation ou de démarrage Infomaniak.
