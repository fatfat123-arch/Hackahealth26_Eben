# Audit de sécurité

Dernière vérification : 11 octobre 2026.

## Périmètre

L’audit couvre le code applicatif, les routes publiques et authentifiées, les
sessions, les changements de rôle, les médias, le traitement vidéo, le schéma
MariaDB, les dépendances et la configuration HTTP. Les contrôles effectués sur
le site en production sont non destructifs : aucune charge, aucun brute force
et aucune modification de données réelles.

## Protections vérifiées

- sessions aléatoires stockées sous forme d’empreinte et cookie de production
  `Secure`, `HttpOnly`, `SameSite=Lax` et préfixé `__Host-` ;
- contrôle d’autorisation côté serveur et révocation des sessions après les
  changements sensibles ;
- protection CSRF et validation de l’origine des téléversements directs ;
- limitation persistante des tentatives de connexion par compte et adresse IP ;
- validation stricte des types, signatures et tailles des médias ;
- URL de médias temporaires signées et protection contre la traversée de chemin ;
- limitation du temps, de la taille et de la concurrence du cartooniser ;
- requêtes SQL paramétrées, validation des entrées et transaction pour les rôles ;
- en-têtes CSP, HSTS, anti-clickjacking, `nosniff` et absence de cache pour les
  données authentifiées ;
- absence de secret ou de clé privée dans les fichiers et l’historique Git ;
- aucune vulnérabilité connue signalée par `npm audit`.

## Validation reproductible

```bash
npm ci
npm audit
npm run check
```

La suite actuelle valide le lint, le typage, 83 tests automatisés et le build de
production. Les 13 tests d’intégration MariaDB sont volontairement ignorés sans
la base jetable décrite dans [GESTION_ROLES.md](GESTION_ROLES.md).

## Contrôles continus sur GitHub

Trois workflows indépendants protègent la branche principale :

- `CI` exécute séparément lint et typage, tests automatisés et build de
  production sur chaque pull request et chaque push vers `main` ;
- `Security` contrôle les dépendances de production et de développement,
  recherche les secrets dans tout l’historique Git et refuse les dépendances
  vulnérables introduites par une pull request ;
- `CodeQL` analyse le JavaScript et TypeScript avec les requêtes de sécurité et
  de qualité étendues.

Les audits de dépendances et CodeQL sont aussi planifiés chaque semaine. Les
actions utilisées sont épinglées à un commit complet, les permissions GitHub
sont minimales et Dependabot propose les mises à jour par groupes contrôlés.

## Vérification après déploiement

Le déploiement doit exécuter `npm run db:init` avant le redémarrage. Vérifier
ensuite sur `https://eh-passport.ch` la présence des nouveaux en-têtes, le cookie
`__Host-eh_session`, le refus cross-origin et les droits MariaDB du compte
d’exécution. Les contrôles externes réalisés avant ce déploiement correspondent
encore à l’ancienne version et ne valident donc pas les nouveaux correctifs.

Un audit réduit le risque sans constituer une garantie absolue. Il doit être
répété après toute modification importante de l’authentification, des rôles, des
téléversements ou de l’infrastructure.
