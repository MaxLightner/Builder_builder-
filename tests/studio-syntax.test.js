import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
test('new studio files and all referenced browser entry modules parse',()=>{
 for(const f of ['studio/app.js','studio/engine.js','studio/vendor/openplan-wall.js','studio/integration/native-check.js','studio/integration/patch-openplan.mjs']){
  const name=fileURLToPath(new URL(f,root));
  const r=spawnSync(process.execPath,['--check',name],{encoding:'utf8'});
  assert.equal(r.status,0,f+': '+r.stderr);
 }
 const html=readFileSync(new URL('studio/index.html',root),'utf8');
 assert.match(html,/editor\/\?builder=1/);
 const legacy=readFileSync(new URL('studio/legacy.html',root),'utf8');
 assert.match(legacy,/<script type="module" src="\.\/app.js"/);
 assert.match(legacy,/id="plan"/);
 assert.match(legacy,/id="issues"/);
});
