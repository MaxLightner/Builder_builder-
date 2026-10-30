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
