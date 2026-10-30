import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createProject,issuesFor,updateItem,addItem,facadeAnalysis,rectangleInPolygon,suggestLocalRepair,frontageAllocation} from '../studio/engine.js';
const sites=JSON.parse(readFileSync(new URL('../data/scenarios.json',import.meta.url),'utf8'));
const site=sites.find(s=>s.id==='A');
const make=()=>createProject(site);
test('uses the shared existing Site JSON / Stage-1 footprint; no fake fixed coordinates',()=>{
 const p=make();
 assert.equal(p.site.id,'A');
 assert.ok(p.footprint.length>=3);
 assert.equal(p.items.filter(r=>r.type==='bedroom').length,2);
 assert.ok(facadeAnalysis(p).some(x=>x.kind==='open'));
});
test('bedroom moved deep into footprint loses potential facade access',()=>{
 const p=make(),bed=p.items.find(x=>x.type==='bedroom');
 const bad=updateItem(p,bed.id,{x:5.3,y:13.2});
 assert.ok(issuesFor(bad).some(x=>x.code==='DAYLIGHT_UNAVAILABLE'&&x.ids.includes(bed.id)));
});
test('overlap and outside footprint are flagged independent of UI',()=>{
 const p=make(),bed=p.items.find(x=>x.type==='bedroom'),living=p.items.find(x=>x.type==='living');
 let bad=updateItem(p,bed.id,{x:living.x,y:living.y});
 assert.ok(issuesFor(bad).some(x=>x.code==='OVERLAP'));
 bad=updateItem(p,bed.id,{x:-25,y:-15});
 assert.ok(issuesFor(bad).some(x=>x.code==='OUTSIDE'));
 assert.equal(rectangleInPolygon(bad.items.find(x=>x.id===bed.id),p.footprint),false);
});
test('balcony facing neighbor instead of view produces explicit warning/error',()=>{
 const p=addItem(make(),'balcony'),r=p.items.at(-1);
 const bad=updateItem(p,r.id,{x:4.6,y:17,w:2.2,h:2.0});
 assert.ok(issuesFor(bad).some(x=>x.code==='VIEW_UNAVAILABLE'&&x.ids.includes(r.id)));
});
test('deleting a load-path column is not silently accepted',()=>{
 const p=make();p.supports[0].deleted=true;
 assert.ok(issuesFor(p).some(x=>x.code==='LOAD_PATH'&&x.severity==='review'));
});
test('parking below entrance without a ramp is not accepted as complete',()=>{
 const p=make();p.parking.level=-1;
 assert.ok(issuesFor(p).some(x=>x.code==='RAMP_MISSING'));
 p.parking.hasRamp=true;
 assert.ok(!issuesFor(p).some(x=>x.code==='RAMP_MISSING'));
 assert.ok(issuesFor(p).some(x=>x.code==='RAMP_UNCHECKED'));
});
test('frontage allocation preserves measured street width',()=>{
 const p=make();p.commercial.enabled=true;p.commercial.vehicleEntrance=true;p.commercial.entryRatio=.35;
 const a=frontageAllocation(p);
 assert.ok(a);
 assert.ok(Math.abs(a.left+a.right+a.entry+a.vehicle-a.length)<.015);
});
test('a move can be evaluated without mutating original project',()=>{
 const p=make(),bed=p.items[0],old=JSON.stringify(p);
 const changed=updateItem(p,bed.id,{x:4,y:15});
 assert.notDeepEqual(changed,p);
 assert.equal(JSON.stringify(p),old);
 assert.ok(changed.items.find(x=>x.id===bed.id).x===4);
});
test('local suggestion preserves every other element and offers explicit result',()=>{
 const p=make(),bed=p.items[0],bad=updateItem(p,bed.id,{x:5.3,y:13.2});
 const candidate=suggestLocalRepair(bad,bed.id);
 assert.ok(candidate);
 assert.deepEqual(candidate.project.items.filter(r=>r.id!==bed.id),bad.items.filter(r=>r.id!==bed.id));
 assert.ok(candidate.to<=candidate.from, 'local repair must not worsen the global check score');
});
