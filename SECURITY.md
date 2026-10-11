# Sécurité

## Version prise en charge

La branche `main` est la seule version activement maintenue.

## Signaler une vulnérabilité

Ne publiez pas de vulnérabilité, de secret, de donnée patient ou de procédure
d’exploitation dans une issue publique. Utilisez le formulaire privé GitHub :

<https://github.com/fatfat123-arch/Hackahealth26_Eben/security/advisories/new>

Le signalement doit indiquer la zone concernée, l’impact observé et les étapes
minimales permettant de reproduire le problème sans donnée réelle. N’effectuez
aucun test destructif, brute force, déni de service ou accès à un passeport qui
ne vous a pas été confié.

## Secrets compromis

Un secret exposé doit être révoqué et remplacé immédiatement. Le retirer d’un
commit ne suffit pas, car il peut rester présent dans l’historique Git et les
journaux d’exécution.
