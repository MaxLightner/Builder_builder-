// Builder Studio -> OpenPlan3D web-project JSON (centimetres).
// Uses documented upstream readProject schema; no structural or regulatory approval.
// Each proposed halo becomes an enclosed editable wall loop; shared edges deduplicated.
function key(p){return Math.round(p.x*1000)+','+Math.round(p.y*1000)}
function vec(a,b){return {x:b.x-a.x,y:b.y-a.y}}
function at(a,b,t){return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}}
function onSegment(p,a,b){
 const d=vec(a,b),v=vec(a,p),den=d.x*d.x+d.y*d.y;
 if(den<1e-9)return false;
 const t=(v.x*d.x+v.y*d.y)/den;
 return t>=-1e-7&&t<=1+1e-7&&Math.abs(v.x*d.y-v.y*d.x)<1e-6;
}
function sKey(a,b){return [key(a),key(b)].sort().join('|')}
function outline(r){
 const x=r.x,y=r.y,w=r.w,h=r.h;
 return [
  [{x,y},{x:x+w,y}], [{x:x+w,y},{x:x+w,y:y+h}],
  [{x:x+w,y:y+h},{x,y:y+h}],[{x,y:y+h},{x,y}]
 ];
}
export function exportToOpenPlan(project){
 if(!Array.isArray(project?.items))throw Error('No spatial intents to export');
 const boxes=project.items.filter(r=>r.w>0&&r.h>0);
 if(!boxes.length)throw Error('No rooms to export');
 const all=boxes.flatMap(outline);
 const points=all.flatMap(s=>s);
 const unique=new Map(),perRoom=new Map();
 for(const room of boxes){
  const ids=[];
  for(const [a,b] of outline(room)){
   const d=vec(a,b),len2=d.x*d.x+d.y*d.y;
   const ts=[0,1,...points.filter(p=>onSegment(p,a,b)).map(p=>((p.x-a.x)*d.x+(p.y-a.y)*d.y)/len2)];
   ts.sort((x,y)=>x-y);
   for(let i=1;i<ts.length;i++){
    if(ts[i]-ts[i-1]<1e-6)continue;
    const p=at(a,b,ts[i-1]),q=at(a,b,ts[i]),id=sKey(p,q);
    if(!unique.has(id))unique.set(id,{p,q,id:'wall-'+(unique.size+1)});
    ids.push(unique.get(id).id);
   }
  }
  perRoom.set(room.id,[...new Set(ids)]);
 }
 const bb={minX:Math.min(...boxes.map(r=>r.x)),maxY:Math.max(...boxes.map(r=>r.y+r.h))};
 const toCm=p=>({x:Math.round((p.x-bb.minX)*10000)/100,
   y:Math.round((bb.maxY-p.y)*10000)/100});
 const walls=[...unique.values()].map(w=>({
   id:w.id,start:toCm(w.p),end:toCm(w.q),thickness:15,height:290,color:'#475569'
 }));
 const dictionary=new Map(walls.map(w=>[w.id,w]));
 const doors=[];
 const hall=boxes.find(r=>r.type==='corridor');
 if(hall){
  const hw=new Set(perRoom.get(hall.id));
  for(const room of boxes.filter(r=>r.id!==hall.id)){
   const common=perRoom.get(room.id).filter(id=>hw.has(id));
   const doorWall=common.map(id=>dictionary.get(id)).find(w=>
    Math.hypot(w.end.x-w.start.x,w.end.y-w.start.y)>=110);
   if(doorWall)doors.push({id:'door-'+room.id,wallId:doorWall.id,position:0.5,
     width:80,height:210,type:'single',swingDirection:'left',flipSide:false});
  }
 }
 const roomTypes={bedroom:'bedroom',living:'livingRoom',kitchen:'kitchen',
   bath:'bathroom',corridor:'hallway',core:'entryway'};
 const rooms=boxes.map(r=>({id:'space-'+r.id,name:r.label,area:r.w*r.h,
   walls:perRoom.get(r.id),roomType:'indoor',floorTexture:'light-oak',
   details:{roomType:roomTypes[r.type]||'hallway',note:'Generated conceptual geometry only. Architectural access, windows, regulations and structure NOT certified.'}}));
 const floor={id:'floor-0',name:'طرح مفهومی / طبقه مسکونی',level:0,
   walls,doors,windows:[],rooms,stairs:[],columns:[],furniture:[],
   guides:[],measurements:[],annotations:[],textAnnotations:[],groups:[]};
 return {id:'builder-'+(project.site?.id||'site'),name:'Builder · '+(project.site?.name||'پروژه'),
   description:'Import from Builder CP-SAT conceptual layout; no regulatory or structural approval. Room walls and doors are editable.',
   floors:[floor],activeFloorId:floor.id,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
}
