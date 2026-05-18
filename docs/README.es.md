# Simulador de Monty Hall

[English](../README.md)

- [Simulador](https://piccoripico.github.io/monty-hall-simulator/)

Una herramienta estática y multilingüe para experimentar el problema de Monty Hall en el navegador. Está lista para publicarse con GitHub Pages.

## ¿Qué es el problema de Monty Hall?

El problema de Monty Hall es un acertijo de probabilidad sobre elegir entre puertas cerradas. Una puerta oculta un premio y las demás no. Después de tu primera elección, Monty, que sabe dónde está el premio, abre puertas perdedoras y deja cerradas tu puerta y otra puerta.

La pregunta sorprendente es si conviene mantener la primera elección o cambiar a la otra puerta cerrada. Este simulador permite repetir el experimento muchas veces, revisar cada ensayo generado y comparar los resultados observados con las probabilidades teóricas.

## Funciones

- Tres modos de ejecución: no cambiar, cambiar, o simular ambas estrategias.
- Lista completa de ensayos con la puerta del premio, primera elección, puerta que dejó Monty, elección final y resultado.
- Número de puertas configurable y hasta 100.000 ensayos por estrategia seleccionada.
- Complemento teórico con fórmulas de probabilidad condicional y Bayes renderizadas con KaTeX.
- Interfaz en inglés, francés, español, alemán, japonés, chino simplificado, chino tradicional y coreano.

## Desarrollo

```powershell
npm.cmd install
npm.cmd run verify
```

Scripts útiles:

- `npm.cmd test`: ejecuta pruebas unitarias e i18n.
- `npm.cmd run build`: copia la aplicación estática a `dist/`.
- `npm.cmd run test:e2e`: ejecuta pruebas Playwright contra `dist/`.
- `npm.cmd start`: sirve `dist/` en <http://127.0.0.1:4174/>.

Si PowerShell bloquea `npm`, usa `npm.cmd` como se muestra arriba.

## GitHub Pages

El workflow `.github/workflows/pages.yml` compila, prueba y sube `dist/` como artifact de Pages al hacer push a `main` o al ejecutarlo manualmente.

Después de habilitar GitHub Pages, el formato de URL esperado es:

```text
https://<OWNER>.github.io/monty-hall-simulator/
```
