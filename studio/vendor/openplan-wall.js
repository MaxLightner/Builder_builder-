// Adapted (TypeScript -> browser/Node JavaScript; centimetres -> metres) from:
// https://github.com/laanlabs/openPlan3D/blob/main/src/lib/utils/wallEditing.ts
// Copyright (c) 2026 theLodgeStudio, MIT. See LICENSE.openplan3d in this directory.
// This utility is used for geometry test/next wall-editor integration; no architectural auto-design claim.
export const WALL_JOIN_TOLERANCE=.02; // metres
export const MIN_WALL_LENGTH=.01; // metres
export function wallLength(wall){
 if(!wall.curvePoint)return Math.hypot(wall.end.x-wall.start.x,wall.end.y-wall.start.y);
 let length=0,previous=wall.start;
 for(let i=1;i<=20;i++){
  const t=i/20,u=1-t,point={x:u*u*wall.start.x+2*u*t*wall.curvePoint.x+t*t*wall.end.x,
    y:u*u*wall.start.y+2*u*t*wall.curvePoint.y+t*t*wall.end.y};
  length+=Math.hypot(point.x-previous.x,point.y-previous.y);previous=point;
 }
 return length;
}
export function connectedWallEndpoints(walls,point,excludeWallId){
 const results=[];
 for(const wall of walls){
  if(wall.id===excludeWallId)continue;
  for(const endpoint of ['start','end']){
   if(Math.hypot(wall[endpoint].x-point.x,wall[endpoint].y-point.y)<WALL_JOIN_TOLERANCE)
    results.push({wallId:wall.id,endpoint});
  }
 }
 return results;
}
export function finitePoint(point){
 return !!point&&typeof point==='object'&&Number.isFinite(point.x)&&Number.isFinite(point.y);
}
export function planWallResize(walls,id,length,fixed='start'){
 if(!Number.isFinite(length)||length<MIN_WALL_LENGTH)throw Error('Wall length must be at least 1 cm');
 if(fixed!=='start'&&fixed!=='end')throw Error('Choose fixed wall endpoint');
 const wall=walls.find(w=>w.id===id);
 if(!wall)throw Error('Select a wall to resize');
 const currentLength=wallLength(wall);
 if(!Number.isFinite(currentLength)||currentLength<MIN_WALL_LENGTH)throw Error('Wall is too short to resize');
 const changes=new Map();
 if(Math.abs(length-currentLength)<1e-6)return changes;
 const moving=fixed==='start'?'end':'start',origin=wall[fixed],scale=length/currentLength;
 const transform=p=>({x:origin.x+(p.x-origin.x)*scale,y:origin.y+(p.y-origin.y)*scale});
 const target=transform(wall[moving]);
 changes.set(id,{[moving]:target,...(wall.curvePoint?{curvePoint:transform(wall.curvePoint)}:{})});
 for(const connection of connectedWallEndpoints(walls,wall[moving],id)){
  changes.set(connection.wallId,{...changes.get(connection.wallId),[connection.endpoint]:{...target}});
 }
 for(const [wallId,updates] of changes){
  const changed={...walls.find(w=>w.id===wallId),...updates};
  if(!finitePoint(changed.start)||!finitePoint(changed.end)||
    (changed.curvePoint&&!finitePoint(changed.curvePoint))||!Number.isFinite(wallLength(changed)))
    throw Error('Invalid wall coordinates');
  if(Math.hypot(changed.end.x-changed.start.x,changed.end.y-changed.start.y)<MIN_WALL_LENGTH)
    throw Error('Resize would collapse a joined wall');
 }
 return changes;
}