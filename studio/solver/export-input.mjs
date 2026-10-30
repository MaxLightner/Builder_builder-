import fs from 'node:fs';
import {stageOneOptions} from '../../stage1.js';
import {facadeAnalysis} from '../engine.js';
const sites=JSON.parse(fs.readFileSync(new URL('../../data/scenarios.json',import.meta.url),'utf8'));
const output=sites.map(site=>{
 const footprint=stageOneOptions(site)[0]?.footprint||[];
 const b={x0:Math.min(...footprint.map(p=>p[0])),x1:Math.max(...footprint.map(p=>p[0])),
   y0:Math.min(...footprint.map(p=>p[1])),y1:Math.max(...footprint.map(p=>p[1]))};
 const edges=facadeAnalysis({footprint,site}).filter(e=>e.kind==='open'&&
    (Math.abs(e.a[0]-e.b[0])<1e-6||Math.abs(e.a[1]-e.b[1])<1e-6)).sort((a,b)=>b.length-a.length);
 const selected=edges[0],result={id:site.id,siteName:site.name,footprint,siteArea:site.polygon,
   targetUnitCount:site.target.unitsPerFloor};
 if(!selected) return {...result,unsupported:'No demonstrably open, axis-aligned frontage'};
 if(site.target.unitsPerFloor!==1)return {...result,unsupported:'Multi-unit floor not yet modeled; solver must not pretend one unit is the whole floor'};
 if(footprint.length!==4)return {...result,unsupported:'Non-rectangular floorplate requires polygon solver'};
 const u=[Math.round((selected.b[0]-selected.a[0])/selected.length),Math.round((selected.b[1]-selected.a[1])/selected.length)];
 const v=selected.normal.map(n=>-Math.round(n));
 const width=selected.length, depth=Math.abs(u[0])>0?b.y1-b.y0:b.x1-b.x0;
 return {...result,width,depth,origin:selected.a,tangent:u,inward:v,frontage:{kind:selected.kind,view:selected.hit?.edge?.view??'unknown',source:'Builder site edge; not legal daylight approval'}};
});
fs.mkdirSync('studio/solver',{recursive:true});
fs.writeFileSync('studio/solver/input.json',JSON.stringify(output,null,2));
console.log(output.map(x=>[x.id,x.unsupported||[x.width,x.depth]]));
