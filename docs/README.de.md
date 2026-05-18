# Monty-Hall-Simulator

[English](../README.md)

Ein statisches, mehrsprachiges Experimentierwerkzeug für das Monty-Hall-Problem. Es läuft vollständig im Browser und kann mit GitHub Pages veröffentlicht werden.

## Was ist das Monty-Hall-Problem?

Das Monty-Hall-Problem ist ein Wahrscheinlichkeitsrätsel über die Wahl zwischen geschlossenen Türen. Hinter einer Tür befindet sich ein Preis, hinter den anderen nicht. Nach deiner ersten Wahl öffnet Monty, der die Preistür kennt, verlierende Türen und lässt deine Tür sowie eine weitere Tür geschlossen.

Die überraschende Frage ist, ob du bei deiner ersten Wahl bleiben oder zur anderen geschlossenen Tür wechseln solltest. Dieser Simulator wiederholt das Experiment viele Male, zeigt jeden erzeugten Versuch und vergleicht die beobachteten Ergebnisse mit den theoretischen Wahrscheinlichkeiten.

## Funktionen

- Drei Ausführungsmodi: nur bleiben, nur wechseln oder beide Strategien simulieren.
- Vollständige Versuchsliste mit Preistür, erster Wahl, von Monty gelassener Tür, endgültiger Wahl und Ergebnis.
- Konfigurierbare Türanzahl und bis zu 100.000 Versuche pro ausgewählter Strategie.
- Theoretische Ergänzung mit KaTeX-gerenderten Formeln zu bedingter Wahrscheinlichkeit und Bayes.
- Oberfläche auf Englisch, Französisch, Spanisch, Deutsch, Japanisch, vereinfachtem Chinesisch, traditionellem Chinesisch und Koreanisch.

## Entwicklung

```powershell
npm.cmd install
npm.cmd run verify
```

Nützliche Skripte:

- `npm.cmd test`: führt Unit- und i18n-Tests aus.
- `npm.cmd run build`: kopiert die statische App nach `dist/`.
- `npm.cmd run test:e2e`: führt Playwright-Tests gegen `dist/` aus.
- `npm.cmd start`: stellt `dist/` unter <http://127.0.0.1:4174/> bereit.

Wenn PowerShell `npm` blockiert, verwende wie oben gezeigt `npm.cmd`.

## GitHub Pages

Der Workflow `.github/workflows/pages.yml` baut, testet und lädt `dist/` als Pages-Artifact hoch, wenn nach `main` gepusht oder der Workflow manuell gestartet wird.

Nach dem Aktivieren von GitHub Pages hat die erwartete URL dieses Format:

```text
https://<OWNER>.github.io/monty-hall-simulator/
```
