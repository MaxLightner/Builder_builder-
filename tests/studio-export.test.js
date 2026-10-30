import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {exportToOpenPlan} from '../studio/openplan-export.js';
test('actual CP-SAT rooms export to consistent shared-wall OpenPlan3D document',()=>{
 const d=JSON.parse(fs.readFileSync(new URL('../studio/solutions/A.json',import.meta.url),'utf8'));
 const solved=d.candidates[0];assert.equal(solved.status,'OPTIMAL');
 const doc=exportToOpenPlan({site:{id:'A',name:'آزمایشی'},items:solved.rooms});
 assert.equal(doc.floors.length,1);
 const f=doc.floors[0];
 assert.ok(f.walls.length>15);
 assert.ok(f.doors.length>=5,'all six rooms should reach continuous circulation by shared wall');
 assert.equal(f.rooms.length,7);
 assert.equal(new Set(f.walls.map(w=>w.id)).size,f.walls.length);
 const wallIds=new Set(f.walls.map(w=>w.id));
 for(const door of f.doors){
  assert.ok(wallIds.has(door.wallId),door.id+' without wall');
  assert.ok(door.position>=0&&door.position<=1);
  assert.ok(door.width>0);
 }
 for(const room of f.rooms){
  assert.ok(room.walls.length>=4,room.id);
  assert.ok(room.walls.every(id=>wallIds.has(id)),room.id+' with missing wall');
 }
 const edgeKeys=f.walls.map(w=>
  [JSON.stringify(w.start),JSON.stringify(w.end)].sort().join('|'));
 assert.equal(new Set(edgeKeys).size,edgeKeys.length,'duplicate coincident wall segments');
});
test('export never fabricates floor geometry when nothing is solved',()=>{
 assert.throws(()=>exportToOpenPlan({items:[]}),/No rooms/);
});
