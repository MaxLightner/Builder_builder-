# Building Studio — real upstream editor + CP-SAT feasibility v0.2

**Status (2026-10-30): executable initial integration, NOT a completed architectural planning product.**

## What is genuinely reused

1. **Actual OpenPlan3D editor** (not a UI mock): the entire upstream SvelteKit app at pinned commit
   [98f9cb467e4045c6abc5d9880ada1f03dff50c68](https://github.com/laanlabs/openPlan3D/commit/98f9cb467e4045c6abc5d9880ada1f03dff50c68)
   is compiled to \`studio/editor/\` by \`.github/workflows/vendor-openplan.yml\`.
   Its original MIT license is kept in \`studio/editor/LICENSE.openplan3d\`.
   Editor supports real wall/door/window editing and 2D/3D.
2. **Google OR-Tools CP-SAT** (Apache 2.0): \`studio/solver/generate.py\` builds and solves actual
   hard constraints. \`.github/workflows/cpsat-layouts.yml\` publishes JSON only after
   independent geometry tests. The results are in \`studio/solutions/\`.
3. **Direct integration**: Studio loads the solver output, not hand-authored percentage-based positions.
   The \`studio/openplan-export.js\` bridge constructs a deduplicated wall/door graph in the
   format accepted by OpenPlan3D. Use **Download editable OpenPlan3D plan → Open editor → Import JSON**.

## Supported / unsupported

- **Supported initially:** reference land **A** only: one single-unit rectangular residential floor,
  2 bedrooms, living, kitchen, bath, core allowance and corridor; 3 hard-constrained CP-SAT alternatives.
  The site exposure comes from Builder's existing \`data/scenarios.json\` and \`stage1.js\`.
- **Not supported:** multi-unit floors B/C/E, polygonal D. The solver explicitly returns
  \`UNSUPPORTED\` rather than fabricating a result.
- This is **precomputed** at CI time; dragging an item does NOT rerun OR-Tools.
  The local single-halo repair is a separate limited heuristic and MUST NOT be presented as CP-SAT.
- CP-SAT hard constraints ensure no overlap, minimum example dimensions, three primary
  rooms on potentially open facade, common corridor contact, wet-zone adjacency and Core envelope.
  Those conditions are weaker than a real plan: real windows/doors, daylight, unit entrance,
  stairs/lift, ventilation, parking/ramp, structure, local regulations and overall design
  quality remain **unverified**. The exported wall/door layout is a proposal requiring review.
- Geometry is a 2-bedroom one-frontage template. Neither a universal generative architect nor an ML model.

## Preservation and reproducibility

- Original Builder Stage 0 and Stage 1 remain unchanged, as do its Site JSON records.
- Old saved Studio v0.1 percentage-layout projects are copied to browser-local
  \`building-studio.legacy.v1.<siteId>\` before first migration to CP-SAT. Saved Studio projects
  with a Solver provenance are preserved with Undo and downloadable JSON.
- The complete upstream editor is isolated in \`studio/editor\`, and new solver in
  \`studio/solver\`. Both have pinned inputs and documented license/provenance.
- Tests: \`npm test\`; CP-SAT CI generates JSON and runs \`tests/studio-cpsat.test.js\`.
  Upstream build separately tests the export using **its own** \`readProject\` validator.

## Running

- Static user-facing frontend: \`https://maxlightner.github.io/Builder_builder-/studio/\`.
- Full OpenPlan3D editor: \`https://maxlightner.github.io/Builder_builder-/studio/editor/\`.
- Rebuild real upstream editor: trigger \`vendor-openplan.yml\` at the documented pinned commit.
- Regenerate layouts: install \`ortools==9.14.6206\`, run
  \`node studio/solver/export-input.mjs\` then
  \`python studio/solver/generate.py studio/solver/input.json studio/solutions\`.
- For static testing: \`python -m http.server 8080\` at repository root.

**No change of algorithm is accepted merely because the UI looks better.**
Solution claims must be linked to the actual constraints and verified against geometry
and the native editor import check.

---

## Previous v0.1 work and limitations (kept for audit)

# Building Studio / Design Check v0.1

**Working experimental app**: ../studio/ when hosted from repository root (GitHub Pages: /Builder_builder-/studio/).

This is an **additive, independently versioned** sub-application. The existing Builder site, stage 1 viewer and data contracts are unchanged. This code must NOT be described as a finished building-design system.

## Real functionality already present
- Reuses existing Site JSON from data/scenarios.json and the Stage 1 footprint calculator from stage1.js. No independent duplicate of property geometry is stored in source.
- Generates a *deterministic preliminary* 2-bedroom, living, kitchen, circulation and stair/lift halo layout. It does **not** generate walls, door positions or constructible floor plans.
- SVG move/resize/add/delete of halos, with editable numerical coordinates. Drag previews update immediately; computed validation is shown after every edit.
- A geometry-driven issue engine: room/footprint containment, intersections, minimum dimension **heuristics**, facade context/ray toward street/open space vs immediate neighbor, balcony view, possible adjacency to corridor, simplified entrance/core relationship, deleted load-path column **review**, parking level/unknown or missing ramp, mixed commercial street-front allocation, missing code verification.
- Separate levels of certainty: **error (within simplified model), heuristic warning, requires engineer review**. Actual daylight, openings, fire, structures, turning, codes and commercial legality are not proven.
- User-controlled local search proposes moving only one selected halo. Changes are applied only after confirmation. No silent regeneration of the remaining layout.
- Undo/redo bounded to 40 edits, browser-local persistence, JSON download/import; previous main app is unaffected.
- Two explicit failure demos: bedroom away from a potentially open facade; balcony toward neighboring building.
- Commercial frontage slider divides street frontage (1-D only), not buildable shop plan. Parking level selector flags missing ramp; recording a ramp **never** claims geometric feasibility.

## Source reuse, ownership & licensing
- Existing Builder source: ../geometry.js, ../stage1.js, ../data/scenarios.json. This is reuse, not a rewrite of the existing site model.
- **OpenPlan3D**: studio/vendor/openplan-wall.js is an adapted JavaScript and metric-units port of the linked upstream src/lib/utils/wallEditing.ts, with permission notice retained in studio/vendor/LICENSE.openplan3d (MIT, copyright theLodgeStudio, 2026). This provides connected endpoint propagation for a future precision wall editor and has direct regression tests. It is not yet wired into the halo UI.
- The **SPOX** CP-SAT code and commercial solver code have **not** been copied or executed. The studio's local repair is a bounded enumerative search. Do not call it CP-SAT, ML or a full constraint solver.

## Files
- engine.js — pure architectural *hypothesis checking* and bounded local repair. No DOM.
- app.js — interaction, version history, persistence, file exchange, visual issue selection.
- index.html / styles.css — focused Persian UI; no external CDN or runtime server.
- vendor/openplan-wall.js / vendor/LICENSE.openplan3d — actual third-party geometry adaptation.
- ../tests/studio.test.js and ../tests/studio-vendor.test.js — Node regression tests.

## Run
From repository root:
\`\`\`sh
python -m http.server 8080
# Open http://localhost:8080/studio/
npm test
\`\`\`
Static hosting works. Opening via file:// cannot fetch the fixture JSON.

## Before further development
1. Verify in a real browser: pointer dragging, resize, mobile touch, save/import and GitHub Pages route.
2. Use a real survey/permit-derived footprint; the Stage 1 65% envelope is only a demo and not municipal approval.
3. Test actual architect workflow. This vertical slice proves editing and specific checks, **not plan quality or commercial value**.
4. Choose to port/extend OpenPlan3D editor properly only after validating its API/data contracts. Do not stitch two massive UI codebases together without a measured integration plan.
5. Next kernel question: verified circulation and door graph + facade openings with true geometric feasibility. Bring in local building requirements as versioned evidence, not unsourced binary assertions.
