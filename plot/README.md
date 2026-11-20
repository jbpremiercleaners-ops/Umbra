# Plot

Notes, checklists, cards and a blueprint board, at any window size. Open it at
https://jbpremiercleaners-ops.github.io/Umbra/plot/ and install it from the browser (Settings → Install Plot, or the install button in
the address bar; on an iPhone, Share → Add to Home Screen).

Everything stays on the device: notes are kept in the browser's own storage (IndexedDB) and never sent anywhere. Settings → Back up
notes downloads a copy; Restore a back-up brings one back. It works offline once opened (`sw.js`).

Plain HTML, CSS and JavaScript, no build step: `index.html`, `plot.css`, `plot.js`. Bump `VERSION` in `plot.js` and `CACHE` in `sw.js`
together when changing anything, so open copies pick up the new version. `test/t_plot.py` (Playwright) checks it end to end.

Typeface: Space Grotesk (SIL Open Font License, `fonts/OFL.txt`).
