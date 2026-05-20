# Monty Hall Simulator

A static, multilingual experiment tool for the Monty Hall problem. It runs entirely in the browser and is ready to publish with GitHub Pages.

![Monty Hall Simulator screenshot](docs/assets/screenshot.png)

- Live site: [Simulator](https://piccoripico.github.io/monty-hall-simulator/)

## Multilingual Documents

- [日本語](docs/README.ja.md)
- [Français](docs/README.fr.md)
- [Español](docs/README.es.md)
- [Deutsch](docs/README.de.md)
- [简体中文](docs/README.zh-Hans.md)
- [繁體中文](docs/README.zh-Hant.md)
- [한국어](docs/README.ko.md)

## What is the Monty Hall problem?

The Monty Hall problem is a probability puzzle about choosing between closed doors. One door hides a prize, and the others do not. After you make your first choice, Monty, who knows where the prize is, opens losing doors while leaving your chosen door and one other door closed.

The surprising question is whether you should stay with your first choice or switch to the remaining closed door. This simulator lets you run that experiment many times, inspect every generated trial, and compare the observed results with the theoretical probabilities.

## Features

- Play mode for clicking doors through a manual Monty Hall game.
- Door count can be selected from 3 to 1,000.
- Batch mode with stay only, switch only, or both strategies, up to 100,000 trials per selected strategy.
- Shared trial list with a Mode column and linked All / Play / Batch filtering.
- Excel export for summary statistics and all trial rows.
- Supplemental theory with KaTeX-rendered conditional-probability and Bayes formulas.
- UI languages: English, French, Spanish, German, Japanese, Simplified Chinese, Traditional Chinese, and Korean.

## Development

```powershell
npm.cmd install
npm.cmd run verify
```

Useful scripts:

- `npm.cmd test`: run unit and i18n tests.
- `npm.cmd run build`: copy the static app into `dist/`.
- `npm.cmd run test:e2e`: run Playwright smoke tests against `dist/`.
- `npm.cmd start`: serve `dist/` at <http://127.0.0.1:4174/>.

If PowerShell blocks `npm`, use `npm.cmd` as shown above.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` builds, tests, and uploads `dist/` as a Pages artifact on pushes to `main` or manual workflow dispatch.

After enabling GitHub Pages for the repository, the expected URL format is:

```text
https://<OWNER>.github.io/monty-hall-simulator/
```
