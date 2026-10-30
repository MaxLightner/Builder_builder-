// Building Studio -> native OpenPlan3D validation adapter.
// This is a *limited actual-model checker*. It NEVER certifies compliance.
// Operates on the edited project data, not on stale precomputed solver rectangles.
export function wallSignature(floor){
  if(!floor?.walls)return '';
  return JSON.stringify([...floor.walls]
    .map(w=>[w.id,w.start.x,w.start.y,w.end.x,w.end.y,w.thickness,w.height])
    .sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
}
function pointWithin(poly,p){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    const cross=(p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]);
    if(Math.abs(cross)<1e-7&&p[0]>=Math.min(a[0],b[0])-1e-7&&p[0]<=Math.max(a[0],b[0])+1e-7&&
       p[1]>=Math.min(a[1],b[1])-1e-7&&p[1]<=Math.max(a[1],b[1])+1e-7)return true;
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export function reviewNativePlan(project){
  const result={messages:[],errors:0,warnings:0,source:'native edited OpenPlan3D model',changed:false};
  if(!project?.floors?.length)return result;
  const floor=project.floors.find(f=>f.id===project.activeFloorId)||project.floors[0];
  const builder=project.builderEvidence;
  if(!builder){
    result.messages.push({code:'NON_BUILDER_PROJECT',level:'review',text:'این نقشه دستی است؛ مدل سنجش معماری کامل برای آن فعال نشده.'});
  }else if(builder.wallBaseline && builder.wallBaseline!==wallSignature(floor)){
    result.changed=true;
    result.warnings++;
    result.messages.push({code:'SOLVER_PROVENANCE_STALE',level:'warning',text:'پس از ویرایش دیوارها، قیود Solver دوباره حل نشده‌اند؛ ارزیابی اولیه دیگر تأیید این هندسه نیست.'});
  }
  if(builder?.footprint?.length>=3 && builder?.coordinates){
    const {minX,maxY}=builder.coordinates;
    const actual=p=>[minX+p.x/100,maxY-p.y/100];
    const escaped=floor.walls.filter(w=>!pointWithin(builder.footprint,actual(w.start))||
      !pointWithin(builder.footprint,actual(w.end)));
    if(escaped.length){
      result.errors++;
      result.messages.push({code:'OUTSIDE_FOOTPRINT',level:'error',
        text:escaped.length+' دیوار از محدوده ساختمانی تعریف‌شده خارج شده است. این کنترل صرفاً هندسی است.'});
    }
  }
  const wallIds=new Set(floor.walls.map(w=>w.id));
  const windowsByWall=new Set((floor.windows||[]).map(w=>w.wallId));
  const doorsByWall=new Set((floor.doors||[]).map(d=>d.wallId));
  const rooms=floor.rooms||[];
  if(rooms.length===0 && floor.walls.length>0)
    result.messages.push({code:'NO_ROOM_DETECTION',level:'review',text:'از دیوارهای موجود اتاقی ثبت نشده؛ بررسی فضاها ممکن نیست.'});
  for(const room of rooms){
    const roomType=room.details?.roomType||room.name||'';
    const living=/^(bedroom|livingRoom)$/.test(roomType)||/خواب|پذیرایی/.test(room.name||'');
    if(!living)continue;
    const ids=(room.walls||[]).filter(id=>wallIds.has(id));
    if(ids.length===0){
      result.messages.push({code:'ROOM_TOPOLOGY_UNKNOWN',level:'review',roomId:room.id,text:room.name+': اتصال هندسی اتاق با دیوارها قابل تأیید نیست.'});
      continue;
    }
    if(!ids.some(id=>windowsByWall.has(id))){
      result.warnings++;
      result.messages.push({code:'DAYLIGHT_OPENING_MISSING',level:'warning',roomId:room.id,text:room.name+': روی دیوارهای ثبت‌شده پنجره‌ای وجود ندارد؛ امکان نورگیری باید بررسی شود.'});
    }
    if(!ids.some(id=>doorsByWall.has(id))){
      result.warnings++;
      result.messages.push({code:'DOOR_MISSING',level:'warning',roomId:room.id,text:room.name+': دری روی دیوارهای اتاق ثبت نشده است.'});
    }
  }
  if(rooms.some(r=>/core|پله|آسانسور/.test(r.name||'')) && (floor.stairs||[]).length===0){
    result.messages.push({code:'CORE_NOT_MODELED',level:'review',text:'Core فعلاً یک محدوده فضایی است؛ هندسه واقعی پله و آسانسور طراحی نشده.'});
  }
  result.messages.push({code:'DESIGN_UNVERIFIED',level:'review',text:'سازه، نورگیری قانونی، پارکینگ، رمپ و ضوابط شهرداری با این کنترل تأیید نمی‌شوند.'});
  return result;
}
