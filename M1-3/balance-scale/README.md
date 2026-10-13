# ตาชั่งสมการ (Balance-Scale Equations)

A Thai-language, phone-first balance-scale app for Grade 7 (ม.1) lessons on solving one-variable linear equations with the properties of equality (สมบัติการเท่ากัน).

- Static files only: no build step, no dependencies, no backend, no analytics, no storage of any kind.
- Works offline after the first visit (service worker) when hosted over http(s).
- Teacher guide (Thai): [`teacher-guide.html`](teacher-guide.html), also linked in the app footer (“คู่มือครู”).

## Run locally

**Quickest:** double-click `index.html` (it opens from `file://`; everything works except offline caching, which browsers don't allow on `file://`).

**Local web server** (closer to how GitHub Pages serves it):

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. The service worker is skipped on `localhost` so your edits show up right away.

## Tests

The equation/scale logic lives in `js/model.js` (no DOM) and is tested with Node's built-in runner (Node 18+):

```bash
node --test
```

## Hosting

This app lives in the `Math-contents` repository at `M1-3/balance-scale/`, which GitHub Pages already serves from `main` / root:

<https://natthaphat-math.github.io/Math-contents/M1-3/balance-scale/>

Pushing to `main` publishes changes within a minute or two (see the **Actions** tab). It also has a card on the hub page (`index.html`); its thumbnail is generated automatically by the thumbnails workflow.

To host it in a repository of its own instead: put these files at the repository root, then **Settings → Pages → Build and deployment → Source: “Deploy from a branch”**, Branch **`main`**, folder **`/ (root)`** → **Save**. All paths are relative, so any sub-path works.

**Updating:** after changing any file, bump `CACHE` in `sw.js` (e.g. `balance-scale-v2`) so phones that already visited fetch the new version. Users get it on their next visit (the cached copy shows first, then refreshes in the background).

## URL options

Combine them with `&`, e.g. `?teacher=1&log=1&big=1`.

| Option | Effect |
|---|---|
| `?teacher=1` | Teacher mode: auto-step / auto-solve, reveal x, custom equations + shareable student link, “always show log” switch |
| `?log=1` | Show the step log from the start (whole-class discussion) |
| `?eq=2x+1=9` | Open a specific equation (`x + a = b`, `ax = b`, `ax + b = c`; x may be on either side) |
| `?predict=1` | Turn on “predict first” from the start |
| `?big=1` | Large text for projectors |

Teacher mode is a convenience switch, not access control: anyone who adds `?teacher=1` gets it. Give students the plain link.

## Files

```
index.html            app page
teacher-guide.html    Thai teacher guide
css/style.css         styles (system fonts only, no web fonts)
js/model.js           pure logic: parsing, weights, tilt, actions, validation, log lines, substitution check
js/app.js             UI: SVG scale, controls, dialogs, feedback
sw.js                 offline cache
manifest.webmanifest  “Add to Home Screen” metadata
tests/model.test.js   logic tests (node --test)
```
