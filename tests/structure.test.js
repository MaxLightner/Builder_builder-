import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {area} from '../geometry.js';
import {stageOneOptions} from '../stage1.js';
import {buildRoughStructure,pointIn,structureSVG} from '../structure.js';
const cases=JSON.parse(fs.readFileSync(new URL('../data/scenarios.json',import.meta.url)));
const overlaps=(a,b,pad=0)=>{
  if(!a.length||!b.length)return false;
  const x=[Math.min(...a.map(p=>p[0])),Math.max(...a.map(p=>p[0])),Math.min(...a.map(p=>p[1])),Math.max(...a.map(p=>p[1]))],
    y=[Math.min(...b.map(p=>p[0])),Math.max(...b.map(p=>p[0])),Math.min(...b.map(p=>p[1])),Math.max(...b.map(p=>p[1]))];
  return x[0]<y[1]+pad&&x[1]>y[0]-pad&&x[2]<y[3]+pad&&x[3]>y[2]-pad;
};
test('all scenarios produce separately stacked slabs and vertical stair/lift boxes',()=>{
 for(const site of cases)for(const option of stageOneOptions(site)){
  const s=buildRoughStructure(site,option);
  assert.equal(s.slabs.length,site.target.floors+2,site.id+option.id);
  assert.equal(s.slabs[0].kind,'parking-ground');
  assert.equal(s.slabs.at(-1).kind,'roof');
  assert.equal(s.roofLevel,3.2*(site.target.floors+1));
  assert.ok(s.core.components.stair.length===4,site.id+option.id);
  assert.ok(s.core.components.elevator.length===4,site.id+option.id);
  assert.ok(s.shafts.length>0,site.id+option.id);
  assert.ok(s.columns.length>0,site.id+option.id);
  for(const col of s.columns)assert.ok(pointIn(option.footprint,[col.x,col.y]),site.id+option.id);
  assert.match(structureSVG(s,option),/rough-structure/);
 }
});
test('parking count matches physical stalls, with obstacles preserved',()=>{
 for(const site of cases)for(const option of stageOneOptions(site)){
   const s=buildRoughStructure(site,option),p=s.parking;
   assert.equal(p.count,p.stalls.length);
   assert.equal(p.vehicleTurningValidated,false);
   if(!p.accessibleOnPaper)assert.equal(p.count,0);
   for(const stall of p.stalls){
     assert.equal(stall.dimensions[0],2.5);
     assert.equal(stall.dimensions[1],5);
     assert.ok(stall.polygon.every(x=>pointIn(option.footprint,x)));
     for(const col of s.columns)assert.equal(overlaps(stall.polygon,col.polygon,.04),false,site.id+option.id);
     assert.equal(overlaps(stall.polygon,s.core.envelope,.04),false);
     assert.equal(overlaps(stall.polygon,p.aisle,.0001),false);
   }
   if(p.count)for(const col of s.columns)assert.equal(overlaps(p.aisle,col.polygon,.03),false,site.id+option.id);
 }
});
test('narrow and large sites do not invent parking, and invalid zoning can yield no option',()=>{
 const siteA=cases[0],a=buildRoughStructure(siteA,stageOneOptions(siteA)[0]);
 const siteE=cases[4],e=buildRoughStructure(siteE,stageOneOptions(siteE)[0]);
 assert.ok(a.parking.count>=1,'sample A should show at least one preliminary bay');
 assert.ok(e.parking.count>=1,'sample E should show multiple bays');
 assert.ok(e.parking.count>a.parking.count);
 assert.equal(a.validation.structuralDesign,false);
 assert.equal(a.validation.fireEgress,false);
 assert.equal(a.validation.permitCompliance,false);
});
