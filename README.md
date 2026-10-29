# Building Lab — Stage 0 + Stage 1

محیط آزمایشی مرحله‌ای طراحی ساختمان، بدون API هوش مصنوعی و بدون Solver. رابط فارسی و راست‌به‌چپ، پنج سناریوی واقع‌نما، پلان SVG و مدل WebGL با Three.js و OrbitControls.

## Run

Serve this directory using any static HTTP server (opening `index.html` through `file://` does not support module loading/fetch). No dependency installation or build is needed. Three.js 0.170.0 and OrbitControls are vendored with their MIT license in `vendor/`.

```sh
python -m http.server 8080
npm test
```

Optional browser regression checks use an existing Playwright installation (`PLAYWRIGHT_MODULE` can point to its module path) and existing Chrome (`CHROME_PATH` can override its executable). Run `node tests/browser.cjs <base-url>`; no browser download is needed.

For GitHub Pages, select **Deploy from a branch → main → /(root)** under repository Settings → Pages. All paths are relative and support project Pages subpaths.

## What is implemented

- A: 10×20 m, 200 m², 3 floors, 1 unit/floor.
- B: 12×25 m, 300 m², 5 floors, 2 units/floor.
- C: corner site, 320 m², 4 floors, streets on two sides.
- D: irregular pentagon, 251 m², target range 4–5 floors (5 selected).
- E: 600 m², 6 floors, east-facing open space.
- Both views derive plot, street strips, neighbor masses, open spaces, dimensions and pedestrian/vehicle access markers from one Site JSON.
- Per-edge inspector: type, length, neighbor height/street width, view quality, privacy sensitivity and access.
- Rectangle generator and arbitrary simple polygon form. Concave and clockwise polygons are supported; intersections, zero-length edges and invalid values are rejected.
- New sites/edited copies persist in localStorage on this browser. Presets remain available. JSON downloads provide an independent copy. There is no server sync.
- Keyboard-accessible controls, responsive UI, on-demand rendering and a 2D fallback if WebGL is unavailable. 3D keyboard: arrows pan, +/- zoom; mouse/touch OrbitControls.
- Stage 1 is now selectable for all five presets and custom site polygons. It shows three deterministic, experimental massing options per site, 2D overlay and translucent 3D extrusions, including nominal yard, parking-zone and vertical-core placeholders, pedestrian/vehicle guide lines, approximate areas, and JSON design export. This is **not** a feasibility solver, parking maneuver checker, zoning-compliance check, approved architectural plan, or room layout. Stages 2–3 remain disabled.

## Coordinates and future data contract

`data/scenarios.json` is the fixture source. `schemaVersion: "1.0"`, `units: "m"`, `polygon: [[x,y], ...]` uses local Cartesian coordinates. Points are ordered around the boundary without repeating the first point. `edges[i]` always describes `polygon[i] → polygon[(i+1)%N]`. `north` is clockwise from the positive plan Y axis. Three.js uses `[x, elevation, -y]`, preserving metric scale.

Each edge contains `type: street|neighbor|open`, `height` (m), `streetWidth` (m), `view: good|medium|poor`, `privacy: low|medium|high`, and `access: none|pedestrian|vehicle|both`. Neighbor access is disallowed. Access markers are indicative, positioned along their edge; driveway width, gates and maneuvering are future work.

`target` describes intended floors and units, not a permission or a generated result. Stage 0 exports `design: null`; Stage 1 exports a `design` object using `stage1.js`, including footprint, yard, core, parking, preliminary access guides and an explicit warnings list. A future GLB exporter can export the scene through Three.js GLTFExporter using the documented coordinate mapping and metric units. GLB export is not implemented in this version.

Neighbor volumes use a fixed 8 m illustrative depth; open-space strips use 10 m depth. Adjacent strips may overlap at external corners; the model is a contextual diagram rather than a cadastral neighborhood reconstruction. Names and contexts are synthetic, with no location, legal setback or municipal code implied. View/privacy inputs are qualitative, not simulated evaluations.

## Files

`geometry.js`: polygon validation, areas, frames and context strips. `viewer.js`: SVG and 3D views. `app.js`: state, UI, storage and form. The viewer is independent of any future design engine. The application uses no paid service, account, AI endpoint or analytics.

## Stage 1 occupancy assumption (research only)

- Default site coverage is **65% of measured plot polygon area**, applied by geometric clipping to each of the three exploratory siting strategies. No setback rule is applied in this prototype.
- A per-site opt-in toggle labelled **پیشروی / ساخت مازاد** allows an additional 0–35 **percentage points** above 65%. The default on activation is +10 percentage points, i.e. 75% site coverage. This is not a claim of legal entitlement, fine payment eligibility, or approval; real municipal rules must be verified separately.
- Baseline and optional excess area, actual coverage, site area, and geometries are included in exported Design JSON. Site-specific toggle settings are stored only in browser localStorage.
- All parking, core, vehicle circulation and structural shapes remain **illustrative placeholders**; current area compliance checks do not make the candidate a valid building or parking plan.
