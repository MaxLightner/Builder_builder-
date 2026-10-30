import test from 'node:test';
import assert from 'node:assert/strict';
import {planWallResize,wallLength,connectedWallEndpoints} from '../studio/vendor/openplan-wall.js';
test('OpenPlan3D-derived wall resize preserves neighboring joined endpoint',()=>{
 const walls=[
 {id:'a',start:{x:0,y:0},end:{x:4,y:0},thickness:.2},
 {id:'b',start:{x:4,y:0},end:{x:4,y:3},thickness:.2},
 {id:'c',start:{x:0,y:0},end:{x:0,y:3},thickness:.2}
 ];
 const changes=planWallResize(walls,'a',5,'start');
 assert.deepEqual(changes.get('a').end,{x:5,y:0});
 assert.deepEqual(changes.get('b').start,{x:5,y:0});
 assert.equal(changes.has('c'),false);
 assert.equal(wallLength(walls[0]),4);
 assert.equal(connectedWallEndpoints(walls,{x:4,y:0},'a').length,1);
 assert.deepEqual(walls[0].end,{x:4,y:0},'planner must not mutate source walls');
});
test('OpenPlan3D-derived wall resize rejects collapse atomically',()=>{
 const walls=[{id:'a',start:{x:0,y:0},end:{x:.1,y:0}},{id:'b',start:{x:.1,y:0},end:{x:.1,y:.1}}];
 assert.throws(()=>planWallResize(walls,'a',.001),/at least 1 cm/);
 assert.deepEqual(walls[1].start,{x:.1,y:0});
});
