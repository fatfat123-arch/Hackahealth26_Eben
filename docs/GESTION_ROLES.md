# Gestion des droits administrateur

La règle retenue est simple : chaque administrateur actif peut promouvoir ou
rétrograder un autre compte actif. Aucun troisième rôle ni permission spéciale
n'est ajouté. Son propre rôle ne peut jamais être modifié depuis l'application.

## Interface et authentification

Le contrôle « Droits administrateur » figure dans la liste et la fiche des
utilisateurs, sauf pour soi-même et les comptes archivés. Il ouvre un dialogue
de confirmation, puis demande le mot de passe actuel de l'administrateur.
L'état affiché reste celui enregistré jusqu'au succès de l'opération. Le serveur
vérifie le mot de passe avec bcrypt pour **chaque changement**, sans enregistrer
ce mot de passe ni une preuve réutilisable dans le navigateur. Cinq erreurs en
quinze minutes bloquent temporairement les changements de rôles de ce compte.
Ce compteur est conservé dans MariaDB et partagé entre les processus.

Les nouveaux comptes sont toujours accompagnants. Leur promotion utilise le
même contrôle, avec confirmation et audit. Les schémas stricts des opérations
de création et de modification de profil rejettent les champs supplémentaires,
dont `role`, `isAdmin`, les empreintes de mots de passe et tout acteur inventé.
Le script `db:create-admin` est désormais réservé au premier administrateur :
il refuse de remplacer un compte existant ou de créer un administrateur lorsque
l'application possède déjà un administrateur actif.

L'opération POST `changeCaregiverRole` utilise la session HttpOnly existante et
la protection CSRF existante de TanStack Start. Le client ne fournit ni acteur,
ni privilège, ni date, ni identifiant de journal. Le rôle attendu est seulement
une précondition permettant de rejeter un écran devenu périmé.

## Transaction et journal

`change_user_role` est une procédure MariaDB `SQL SECURITY DEFINER`. Elle ouvre
une transaction InnoDB, prend le verrou `account_security_lock`, retrouve
l'acteur grâce à l'empreinte de la session issue du cookie, puis vérifie à nouveau
sa session, son rôle actuel et l'empreinte de mot de passe vérifiée par le serveur.
Le compte cible doit être actif et son rôle doit correspondre à la précondition.

Le changement, l'enregistrement `security_audit` et la suppression de toutes
les sessions du compte cible sont effectués dans la même transaction. Une erreur
d'audit annule le changement. Les opérations d'archivage et de suppression
d'utilisateurs prennent le même verrou et revérifient l'acteur ; deux opérations
concurrentes ne peuvent pas retirer les derniers administrateurs. Les mises à
jour ordinaires et les réinitialisations de mots de passe revérifient aussi leur
acteur à l'intérieur de ce verrou.

Chaque succès contient : acteur, cible, ancien rôle, nouveau rôle, date MariaDB,
`ROLE_PROMOTED` ou `ROLE_DEMOTED`, identifiant de requête généré sur le serveur,
résultat, et métadonnées disponibles. Les refus authentifiés parvenus à cette
opération enregistrent aussi une tentative avec un code fixe et un ancien rôle
inconnu (`NULL`) ; les requêtes rejetées avant l'opération (session absente,
CSRF ou données malformées) ne créent pas de changement ni d'audit de rôle. Les mots de
passe, cookies, empreintes de session et données patient ne sont jamais inscrits.
L'IP est la valeur validée par le mécanisme existant du proxy ; elle ne sert pas
à autoriser l'action. Le proxy doit supprimer/remplacer les en-têtes transmis
par le client. L'agent utilisateur est une métadonnée non fiable, limitée à 512
caractères et débarrassée des caractères de contrôle.

Il n'y a aucun endpoint d'édition ou de suppression des journaux. Des triggers
MariaDB refusent aussi leur modification et leur suppression. L'absence de clés
étrangères sur les identifiants historiques évite qu'une suppression de compte
efface son historique. Aucun service externe de journalisation n'existe dans
l'architecture actuelle.

## Sessions et données patient

Toutes les sessions de la cible sont révoquées lors d'une promotion comme d'une
rétrogradation. La personne doit se reconnecter avec son mot de passe inchangé.
Le mécanisme existant relit `users.role` depuis MariaDB à chaque requête protégée ;
aucun rôle n'est stocké dans un JWT ou dans le cookie. Les actions administrateur
avec une ancienne session sont donc rejetées. Les données déjà chargées dans
un onglet ne sont pas effacées à distance ; une requête commencée avant le commit
peut finir, mais les nouvelles requêtes ne récupèrent pas les anciens droits.

Un changement de rôle conserve les informations du compte, son mot de passe,
les profils patient et `patients.created_by`. Ce dernier est un lien de création, et non une
table d'affectations : l'accès collectif des professionnels aux patients reste
celui de l'application existante.

## Déploiement : séparation des droits MariaDB

**À réaliser avec l'exploitant de la base avant d'utiliser cette fonctionnalité.**
Les permissions du serveur de production n'ont pas été consultées ou modifiées.
La procédure doit être installée par un compte de migration conservé comme
`DEFINER`, disposant des privilèges requis. `DB_MIGRATION_USER` et
`DB_MIGRATION_PASSWORD` permettent à `npm run db:init` et `db:create-admin`
d'utiliser ce compte distinct. Ce sont des secrets serveur ; ne jamais utiliser
de variables `VITE_*`. En leur absence, les scripts conservent le compte existant,
mais cela ne constitue pas une séparation sûre des privilèges en production.

`db:init` applique `database/role-management.sql`, sans changer les rôles ou les
comptes existants. L'hébergeur doit autoriser les procédures `SQL SECURITY DEFINER`
et les triggers. S'ils sont indisponibles, le changement de rôle échoue ; aucun
repli sur un UPDATE non protégé n'est prévu.

Utiliser un **compte d'exécution distinct sans privilèges globaux ou de base**.
Les permissions s'additionnent : ajouter des GRANT par colonne ne restreint pas
un compte possédant déjà `ALL` ou `UPDATE` sur la base. Vérifier `SHOW GRANTS` et
faire retirer les anciens droits larges par l'exploitant, sans supprimer les
droits nécessaires aux autres fonctions.

Exemple à adapter au vrai nom de base et au vrai compte/host MariaDB :

```sql
GRANT SELECT ON eh_passport.users TO 'eh_passport_app'@'localhost';
GRANT INSERT (id,email,full_name,password_hash),
      UPDATE (full_name,email,password_hash,archived_at), DELETE
      ON eh_passport.users TO 'eh_passport_app'@'localhost';
GRANT SELECT,INSERT,DELETE ON eh_passport.sessions TO 'eh_passport_app'@'localhost';
GRANT SELECT,INSERT,UPDATE,DELETE ON eh_passport.login_rate_limits TO 'eh_passport_app'@'localhost';
GRANT SELECT,INSERT,UPDATE,DELETE ON eh_passport.patients TO 'eh_passport_app'@'localhost';
GRANT SELECT,UPDATE ON eh_passport.account_security_lock TO 'eh_passport_app'@'localhost';
GRANT SELECT,INSERT,UPDATE ON eh_passport.role_reauthentication TO 'eh_passport_app'@'localhost';
GRANT INSERT ON eh_passport.security_audit TO 'eh_passport_app'@'localhost';
GRANT EXECUTE ON PROCEDURE eh_passport.change_user_role TO 'eh_passport_app'@'localhost';
```

Le compte d'exécution ne doit avoir ni INSERT/UPDATE sur `users.role`, ni
UPDATE/DELETE/DROP/ALTER/TRIGGER/CREATE sur le journal. Ne pas lui donner
`GRANT OPTION`, `CREATE ROUTINE`, `ALTER ROUTINE` ou de privilèges permettant
de remplacer la procédure. Le compte de migration/DEFINER reste sous contrôle
de l'exploitant et ne doit jamais être supprimé tant que la procédure l'utilise.

Cela empêche l'identité d'exécution de modifier un rôle par SQL direct et de
modifier, supprimer ou tronquer l'audit. L'application utilise uniquement la
procédure pour les changements de rôle. Un administrateur de la base disposant
de DDL peut toujours altérer la procédure ou supprimer des journaux : les
triggers ne rendent pas le système inviolable face à cet exploitant. Le compte
d'exécution reste un secret privilégié capable d'insérer des sessions et des
journaux ; il n'est pas une protection contre un serveur Node compromis. Un
service de journalisation séparé serait nécessaire pour cette résistance accrue.

Références : [privilèges MariaDB et GRANT par colonne](https://mariadb.com/docs/server/reference/sql-statements/account-management-sql-statements/grant),
[privilèges des procédures](https://mariadb.com/docs/server/server-usage/stored-routines/stored-functions/stored-routine-privileges),
[verrous transactionnels FOR UPDATE](https://mariadb.com/docs/server/reference/sql-statements/data-manipulation/selecting-data/for-update).

## Validation reproductible

`npm test` exécute les tests de validation d'entrée et du composant, sans base.
Les tests MariaDB s'activent avec `ROLE_TEST_DB=1`. Ils utilisent exclusivement
`127.0.0.1`, le port `ROLE_TEST_DB_PORT` (33307 par défaut, port 3306 interdit)
et la base **jetable** `eh_roles_test`. Ils effacent ses fixtures : ne jamais
diriger ce serveur de test vers une base contenant de vraies données.

```powershell
$env:ROLE_TEST_DB='1'
$env:ROLE_TEST_DB_PORT='33307'
npm test -- src/test/user-roles.database.test.ts
```

Les tests utilisent un compte root local de test (mot de passe facultatif via
`ROLE_TEST_DB_ROOT_PASSWORD`), créent des comptes fictifs et attribuent au compte
d'exécution les seuls GRANT ci-dessus. Ils couvrent promotion, rétrogradation,
réauthentification, refus, concurrence, rollback sur erreur d'audit, sessions
révoquées, absence de pertes de données et refus des UPDATE/DELETE/TRUNCATE/DROP
sur le journal. Le mot de passe de la fixture est fictif ; la production conserve
le hachage bcrypt existant à 12 tours.
