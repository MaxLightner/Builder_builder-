import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {exportToOpenPlan} from '../studio/openplan-export.js';
import {reviewNativePlan,wallSignature} from '../studio/integration/native-check.js';
const data=JSON.parse(fs.readFileSync(new URL('../studio/solutions/A.json',import.meta.url),'utf8'));
const rooms=data.candidates[0].rooms;
const model=()=>{
  const p=exportToOpenPlan({site:{id:'A',name:'Test'},items:rooms});
  p.builderEvidence={
    siteId:'A',solver:'Google OR-Tools CP-SAT',status:'OPTIMAL',
    footprint:data.site.footprint,
    coordinates:{minX:Math.min(...rooms.map(r=>r.x)),maxY:Math.max(...rooms.map(r=>r.y+r.h))},
    wallBaseline:wallSignature(p.floors[0])
  };
  return p;
};
test('one native OpenPlan3D project is checked live; no separate halo model is consulted',()=>{
 const p=model();
 assert.equal(p.floors.length,1);
 const report=reviewNativePlan(p);
 assert.equal(report.errors,0);
 assert.equal(report.changed,false);
 assert.ok(report.messages.filter(i=>i.code==='DAYLIGHT_OPENING_MISSING').length>=3);
});
test('moving a real wall outside the shared building envelope is independently detected',()=>{
 const p=model();
 p.floors[0].walls[0].start.x=-3500;
 const issues=reviewNativePlan(p);
 assert.ok(issues.errors>0,JSON.stringify(issues));
 assert.ok(issues.messages.some(i=>i.code==='OUTSIDE_FOOTPRINT'));
 assert.ok(issues.messages.some(i=>i.code==='SOLVER_PROVENANCE_STALE'));
});
test('changing native door/window placement changes native model validation directly',()=>{
 const p=model();
 const b=p.floors[0].rooms.find(r=>r.details?.roomType==='bedroom');
 assert.ok(b);
 p.floors[0].doors=p.floors[0].doors.filter(d=>!b.walls.includes(d.wallId));
 assert.ok(reviewNativePlan(p).messages.some(i=>i.code==='DOOR_MISSING'&&i.roomId===b.id));
 p.floors[0].windows.push({id:'win-test',wallId:b.walls[0],position:.5,width:100,height:120,sillHeight:90,type:'standard'});
 assert.ok(!reviewNativePlan(p).messages.some(i=>i.code==='DAYLIGHT_OPENING_MISSING'&&i.roomId===b.id));
});
test('the single Studio entry is the native editor; old demo retained as archived code',()=>{
 const entry=fs.readFileSync(new URL('../studio/index.html',import.meta.url),'utf8');
 const legacy=fs.readFileSync(new URL('../studio/legacy.html',import.meta.url),'utf8');
 const panel=fs.readFileSync(new URL('../studio/integration/BuilderPanel.svelte',import.meta.url),'utf8');
 const patch=fs.readFileSync(new URL('../studio/integration/patch-openplan.mjs',import.meta.url),'utf8');
 assert.match(entry,/editor\/\?builder=1/);
 assert.match(legacy,/id="plan"/);
 assert.match(panel,/localStore\.saveCopy/);
 assert.match(panel,/loadProject\(saved\)/);
 assert.match(panel,/reviewNativePlan\(\$currentProject\)/);
 assert.match(patch,/<BuilderPanel \/>/);
});
