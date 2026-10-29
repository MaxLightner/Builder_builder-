import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {area} from '../geometry.js';
import {stageOneOptions,stageOneSVG,proposedLine} from '../stage1.js';
const scenarios=JSON.parse(fs.readFileSync(new URL('../data/scenarios.json',import.meta.url)));
test('all five cases produce three finite massing candidates',()=>{
  for(const site of scenarios){
    const list=stageOneOptions(site);
    assert.equal(list.length,3,site.id);
    assert.deepEqual(list.map(o=>o.id),['A','B','C']);
    for(const o of list){
      assert.ok(o.footprint.length>=3,site.id+o.id);
      assert.ok(area(o.footprint)>0&&area(o.footprint)<=area(site.polygon),site.id+o.id);
      assert.ok(o.areas.unbuilt>=0,site.id+o.id);
      assert.ok(o.areas.site>=o.areas.footprint,site.id+o.id);
      assert.equal(o.floors,site.target.floors);
      for(const poly of [o.footprint,o.yard,o.core,o.parking])for(const point of poly)assert.ok(point.every(Number.isFinite),site.id+o.id);
      assert.match(stageOneSVG(o),/design-overlay/);
      assert.ok(o.warnings.length>0);
    }
  }
});

test('65% base coverage, and explicit optional overbuild, are consistent on all five sites',()=>{
  for(const site of scenarios){
    for(const extraPercent of [0,5,10,20,35]){
      for(const option of stageOneOptions(site,{allowExcess:extraPercent>0,extraPercent})){
        const expected=65+extraPercent;
        const actual=area(option.footprint)/area(site.polygon)*100;
        assert.ok(Math.abs(actual-expected)<.01,site.id+option.id+': '+actual+' vs '+expected);
        assert.equal(option.assumptions.setbacksApplied,false);
        assert.equal(option.assumptions.baseCoveragePercent,65);
        assert.ok(Math.abs(option.areas.excessFootprint-area(site.polygon)*extraPercent/100)<.11);
        assert.ok(option.areas.unbuilt>=0);
        assert.ok(option.areas.coveragePercent<=100);
      }
    }
  }
});
test('overbuild remains optional, never treated as authorized',()=>{
  for(const site of scenarios){
    const base=stageOneOptions(site)[0];
    const extra=stageOneOptions(site,{allowExcess:true,extraPercent:10})[0];
    assert.equal(base.assumptions.targetCoveragePercent,65);
    assert.equal(extra.assumptions.targetCoveragePercent,75);
    assert.match(extra.assumptions.legalStatus,/not assessed/);
    assert.ok(extra.areas.excessFootprint>0);
    assert.equal(base.areas.excessFootprint,0);
  }
});

test('construction line constrains all massing to its inward side',()=>{
  for(const site of scenarios){
    const chosen=proposedLine(site);
    for(const i of [chosen.edgeIndex,0]){
      const config={buildingLine:{edgeIndex:i,offsetM:2,source:'demo-assumption'}};
      const options=stageOneOptions(site,config);
      assert.ok(options.length>0,site.id);
      for(const option of options){
        const l=option.assumptions.buildingLine;
        const origin=l.start[0]*l.inward[0]+l.start[1]*l.inward[1];
        for(const p of option.footprint){
          assert.ok(p[0]*l.inward[0]+p[1]*l.inward[1]>=origin-1e-6,site.id+option.id);
        }
        assert.equal(l.edgeIndex,i);
        assert.equal(l.offsetM,2);
        assert.equal(option.assumptions.legalStatus,'illustrative line, NOT sourced from municipality');
      }
    }
    assert.equal(stageOneOptions(site,{buildingLine:{edgeIndex:999,offsetM:0}}).length,0);
  }
});
test('impossible offset never silently shifts construction elsewhere',()=>{
  const site=scenarios[0];
  assert.deepEqual(stageOneOptions(site,{buildingLine:{edgeIndex:2,offsetM:100}}),[]);
});
