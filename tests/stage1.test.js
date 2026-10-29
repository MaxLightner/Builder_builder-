import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {area} from '../geometry.js';
import {stageOneOptions,stageOneSVG} from '../stage1.js';
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
