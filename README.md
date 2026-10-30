# Building Lab — Stage 0 + Stage 1 Rough Structure

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

## Construction-start line / رج شروع بنا (Stage 1 v0.4)

- Building placement is now **anchored to a selected construction-start line**. The user selects a plot boundary edge and an inward distance in metres. Every generated footprint must remain on the inward side of this line, and attempts with no buildable remainder produce no option rather than relocating the yard or building.
- The initial choice for each synthetic scenario is the northernmost plot edge, marked visibly as a **demo assumption**, not a real municipal building line. Checking *مطابق دستور نقشه* records only **user attestation**, not system verification. The municipal designation cannot be inferred from site geometry.
- All A/B/C variants use the **same selected line** and target the same 65% area cap; B/C optionally free a narrow side strip only if sufficient area remains. Thus their current geometry is a constrained visual experiment, not independent architectural design.
- A complex official build-to line may require explicit surveyed endpoints or a polyline rather than the current edge-plus-offset input. The prototype does not yet solve this or design constructible rough-in / سفت‌کاری, parking maneuver, structural layout or vertical access.

## Stage 1 v0.5 — structural concept, not a simple massing diagram

A deterministic experimental rough-structure model is attached to every Stage 1 design under `design.structure`. For every site/option, the viewer shows:

- Individual slab polygons at 0, 3.2, … metres, including parking ground, N *assumed* residential storeys, and roof (the initial scenario target is treated as residential floors above a parking ground).
- A permanent vertical column-grid proposal, simple beam connectivity and coordinated vertical shafts.
- Separate stairwell, lift-shaft, landing and service-shaft placeholder boxes.
- Parking stalls (2.5 × 5 m) adjacent to a nominal 5.5 m aisle, selected only when geometric footprint, fixed structural columns, core and a preliminary street-to-aisle line do not conflict.
- Per-scheme count of **preliminarily screened stalls**. A count of zero means this narrow solver found no candidate, **not** that a skilled architect could not fit vehicles. Vehicle turning/swept paths and municipal parking dimensions remain unvalidated.
- Ground / typical floors / roof viewer selection; toggles for slabs, columns/beams, core, and parking; area and count dashboard.
- Exported Design JSON contains columns with coordinates and sections, slabs and elevations, approximate beams, core polygons, parking bay polygons and count, and explicit incomplete-engineering validation flags.

**Not delivered:** engineered structural calculations, confirmed column/beam section sizes, actual stair flights and risers, lift technical dimensions, fire egress, ramps/basements, turning-envelope simulation, full-code compliance, architectural room walls or a construction-ready structural drawing. The three A/B/C strategies remain comparative *concept* schemes, not approved options. Never treat the number of cars as an official permit capacity.


## Design-check Studio v0.1 (independent research vertical slice, 2026-10-30)

- **[Open Studio on GitHub Pages](https://maxlightner.github.io/Builder_builder-/studio/)** (requires Pages main/root to have deployed).
- Source: [studio/](studio/) • [implementation and scope](studio/README.md) • [GitHub PR #1](https://github.com/MaxLightner/Builder_builder-/pull/1).
- Site geometry and Stage 1 footprint are reused from this repo. The new static Studio supports editable conceptual halos, geometric/contextual issue detection, local one-halo repair proposals, parking/ramp and commercial-frontage screening, project JSON, local persistence, and Undo/Redo.
- Genuine upstream MIT code reuse: a connected-wall resize core from OpenPlan3D under studio/vendor/ with attribution and tests. It is **not yet connected to the studio UI**.
- **Not a full architecture solver, code compliance engine, or completed floor-plan editor.** Do not silently replace, discard, or rewrite this vertical slice; develop by adapters, tests and preserved design-model versions.


## Real source integration — October 30, 2026

Building Studio is additive and versioned; the original Site/Stage 1 application remains available.

- [Editable spatial Studio](studio/): when supported, it displays genuine OR-Tools CP-SAT candidate layouts, not hardcoded room percentages.
- [Full OpenPlan3D editor](studio/editor/): a pinned, unmodified MIT source application built for static GitHub Pages; users can draw precise walls, doors and windows and see 2D/3D. Source is reproducibly fetched and built by [.github/workflows/vendor-openplan.yml](.github/workflows/vendor-openplan.yml), with upstream SHA and MIT attribution retained.
- [CP-SAT solver](studio/solver/generate.py): actual Google OR-Tools constraint solving. Generated results are checked before [publishing](studio/solutions/). Current frontend reads CI-computed examples because GitHub Pages cannot execute Python; it does NOT rerun CP-SAT interactively.
- [Bridge](studio/openplan-export.js): export current candidate as an importable OpenPlan3D project containing wall loops, deduplicated shared edges, suggested doors and room labels.

**Current proof:** site A, single-unit 2-bedroom rectangular floor only. Other multi-unit / irregular samples return explicit UNSUPPORTED. Geometry, use, daylight quality, structural safety, ramp and Iran building-code compliance still require additional models and verification. See [scope, licenses and limitations](studio/README.md).

**No reset:** keep the original app, Site data, previously saved Studio projects, dependency licenses, build scripts, generated outputs, source history and CI checks. Future editor customization should be maintained as reproducible upstream patches, not random edits to compiled bundles.
