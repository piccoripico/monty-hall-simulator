# Simulateur de Monty Hall

[English](../README.md)

- [Simulateur](https://piccoripico.github.io/monty-hall-simulator/)

Un outil statique et multilingue pour expérimenter le problème de Monty Hall directement dans le navigateur. Il est prêt à être publié avec GitHub Pages.

## Qu’est-ce que le problème de Monty Hall ?

Le problème de Monty Hall est un puzzle de probabilité fondé sur un choix entre des portes fermées. Une porte cache un prix, les autres ne cachent rien. Après votre premier choix, Monty, qui connaît la porte gagnante, ouvre des portes perdantes tout en laissant fermées votre porte et une autre porte.

La question surprenante est de savoir s’il vaut mieux garder le premier choix ou changer pour l’autre porte fermée. Ce simulateur permet de répéter l’expérience, d’inspecter chaque essai généré et de comparer les résultats observés aux probabilités théoriques.

## Fonctionnalités

- Mode Play pour jouer manuellement en cliquant sur les portes.
- Mode Batch avec ne pas changer, changer, ou les deux stratégies, jusqu’à 100 000 essais par stratégie sélectionnée.
- Liste d’essais partagée avec colonne Mode et filtre All / Play / Batch.
- Export Excel des statistiques et de toutes les lignes d’essai.
- Complément théorique avec formules de probabilité conditionnelle et de Bayes rendues par KaTeX.
- Interface en anglais, français, espagnol, allemand, japonais, chinois simplifié, chinois traditionnel et coréen.

## Développement

```powershell
npm.cmd install
npm.cmd run verify
```

Scripts utiles :

- `npm.cmd test` : exécute les tests unitaires et i18n.
- `npm.cmd run build` : copie l’application statique dans `dist/`.
- `npm.cmd run test:e2e` : exécute les tests Playwright contre `dist/`.
- `npm.cmd start` : sert `dist/` sur <http://127.0.0.1:4174/>.

Si PowerShell bloque `npm`, utilisez `npm.cmd` comme ci-dessus.

## GitHub Pages

Le workflow `.github/workflows/pages.yml` construit, teste et téléverse `dist/` comme artifact Pages lors des pushs vers `main` ou d’un lancement manuel.

Après activation de GitHub Pages, l’URL attendue est :

```text
https://<OWNER>.github.io/monty-hall-simulator/
```
