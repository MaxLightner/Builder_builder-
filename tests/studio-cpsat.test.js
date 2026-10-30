import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {facadeAnalysis} from '../studio/engine.js';
const base=new URL('../studio/solutions/',import.meta.url);
test('real CP-SAT layouts preserve geometry, external frontage and open unresolved checks',()=>{
 for(const id of ['A','B','C','D','E']){
  const file=new URL(id+'.json',base);
  assert.ok(fs.existsSync(file),id+' missing solver output');
  const d=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(d.engine,'Google OR-Tools CP-SAT');
  assert.equal(d.site_id,id);
  if(d.site.unsupported){
   assert.equal(d.candidates[0].status,'UNSUPPORTED');
   continue;
  }
  assert.equal(d.candidates.length,3);
  const facades=facadeAnalysis({footprint:d.site.footprint,site:{
    polygon:d.site.siteArea,edges:JSON.parse(fs.readFileSync(new URL('../data/scenarios.json',import.meta.url))).find(s=>s.id===id).edges
  }});
  for(const c of d.candidates){
    assert.ok(['OPTIMAL','FEASIBLE'].includes(c.status),id+': '+JSON.stringify(c));
    assert.equal(c.rooms.length,7);
    assert.ok(c.not_checked.includes('structure'));
    for(const r of c.rooms){
      assert.ok(r.w>0&&r.h>0);
      for(const q of c.rooms){
       if(q.id===r.id)continue;
       const w=Math.max(0,Math.min(q.x+q.w,r.x+r.w)-Math.max(q.x,r.x));
       const h=Math.max(0,Math.min(q.y+q.h,r.y+r.h)-Math.max(q.y,r.y));
       assert.ok(w*h<0.001,id+' overlap '+q.id+' / '+r.id);
      }
    }
    assert.ok(c.metrics.unassigned_m2>=-.1);
    const livingBeds=c.rooms.filter(r=>r.type==='living'||r.type==='bedroom');
    assert.equal(livingBeds.length,3);
    for(const r of livingBeds){
      assert.ok(facades.some(f=>f.kind==='open'&&
        (Math.abs(f.a[1]-f.b[1])<1e-6?
           Math.min(Math.abs(r.y-f.a[1]),Math.abs(r.y+r.h-f.a[1]))<.01:
           Math.min(Math.abs(r.x-f.a[0]),Math.abs(r.x+r.w-f.a[0]))<.01)),
           id+' '+r.id+' not on open frontage');
    }
  }
 }
});
