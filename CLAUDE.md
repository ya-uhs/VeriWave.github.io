# VeriWave Development Guide

Single-page web app — no build step, no bundler. Edit and open `index.html` directly in a browser.

## Files

- `index.html` — markup only, no inline scripts or styles
- `style.css` — all styling via CSS custom properties (see `:root` for theme vars)
- `script.js` — all logic in one IIFE; state in `signals[]` and `state` object

## Architecture

- `signals[]` — source of truth for all signal data
- `state` — zoom, scroll, drawing state
- `renderSignalList()` — rebuilds sidebar DOM from `signals[]`
- `setupCanvas()` — resizes canvases, calls `initializeWaves()` + `redrawAll()`
- `redrawAll()` — draws grid, waveforms, time axis

## Themes

Three themes via `body` class: `` (dark, default), `theme-light`, `theme-retro`.
Canvas colors must be set manually in draw functions — check `isDark`/`isLight` flags.

## Live demo

https://ya-uhs.github.io/VeriWave.github.io/
