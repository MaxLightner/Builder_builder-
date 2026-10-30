// Design-check laboratory v0.1: actual geometry/constraint checks, not a certified architect.
// Reuses this repository's Site Model and Stage-1 footprint. No external AI service.
import { area, bounds } from '../geometry.js';
import { stageOneOptions } from '../stage1.js';
const round = v => Math.round(v * 100) / 100;
const C = (x,y,w,h) => ({ x:round(x), y:round(y), w:round(w), h:round(h) });
const requiredFacade = new Set(['bedroom','living','balcony']);
const minDimensions = {bedroom:2.4, living:2.8, kitchen:1.8, core:2.1, corridor:1, balcony:0.9};
export const categories = {bedroom:'خواب',living:'پذیرایی',kitchen:'آشپزخانه',core:'پله و آسانسور',corridor:'دسترسی',balcony:'تراس',shop:'مغازه'};
function signed(poly) { return poly.reduce((s,p,i) => {const q=poly[(i+1)%poly.length];return s+p[0]*q[1]-q[0]*p[1]},0); }
function cross(a,b) { return a[0]*b[1]-a[1]*b[0]; }
function pointInside(poly,p) {
  let hit=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if(Math.abs(cross([b[0]-a[0],b[1]-a[1]],[p[0]-a[0],p[1]-a[1]]))<1e-7 &&
       p[0]>=Math.min(a[0],b[0])-1e-7 && p[0]<=Math.max(a[0],b[0])+1e-7 &&
       p[1]>=Math.min(a[1],b[1])-1e-7 && p[1]<=Math.max(a[1],b[1])+1e-7)return true;
    if((a[1]>p[1]) !== (b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }
  return hit;
}
export function rectangleInPolygon(r,polygon){
  const corners=[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]];
  if(!corners.every(p=>pointInside(polygon,p)))return false;
  // Check polygon boundary crossing interior of rectangle, not just corners.
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    for(let j=0;j<4;j++){
      const c=corners[j],d=corners[(j+1)%4],u=[b[0]-a[0],b[1]-a[1]],v=[d[0]-c[0],d[1]-c[1]],den=cross(u,v);
      if(Math.abs(den)<1e-9)continue;
      const diff=[c[0]-a[0],c[1]-a[1]],t=cross(diff,v)/den,s=cross(diff,u)/den;
      if(t>1e-6&&t<1-1e-6&&s>1e-6&&s<1-1e-6)return false;
    }
  }
  return true;
}
function hitSiteEdge(origin,normal,site){
  let best=null;
  for(let i=0;i<site.polygon.length;i++){
    const a=site.polygon[i],b=site.polygon[(i+1)%site.polygon.length],seg=[b[0]-a[0],b[1]-a[1]],den=cross(normal,seg);
    if(Math.abs(den)<1e-9)continue;
    const diff=[a[0]-origin[0],a[1]-origin[1]],t=cross(diff,seg)/den,u=cross(diff,normal)/den;
    if(t>=-1e-6&&u>=-1e-6&&u<=1+1e-6&&(!best||t<best.distance))best={index:i,distance:Math.max(0,t),edge:site.edges[i]};
  }
  return best;
}
export function facadeAnalysis(project){
  const f=project.footprint,ccw=signed(f)>0;
  return f.map((p,i)=>{
    const q=f[(i+1)%f.length],dx=q[0]-p[0],dy=q[1]-p[1],len=Math.hypot(dx,dy),n=ccw?[dy/len,-dx/len]:[-dy/len,dx/len];
    const hit=hitSiteEdge([(p[0]+q[0])/2,(p[1]+q[1])/2],n,project.site);
    let kind='unknown',label='اطلاعات ناکافی';
    if(hit){
      if(hit.edge.type==='street'||hit.edge.type==='open') {kind=hit.edge.view==='poor'?'limited':'open';label=hit.edge.type==='street'?'جبهه خیابان / حیاط':'فضای باز';}
      else if(hit.distance>=4) {kind='potential';label='عقب‌نشینی از همسایه؛ نیازمند بررسی';}
      else {kind='blocked';label='همسایه در فاصله '+round(hit.distance)+' متر';}
    }
    return {a:p,b:q,normal:n,length:len,kind,label,hit};
  });
}
function faceContact(rect,facade,tol=1.05){
  if(Math.abs(facade.b[0]-facade.a[0])>0.2&&Math.abs(facade.b[1]-facade.a[1])>0.2)return false; // curved/diagonal facades not evaluated in v0.1
  const a=facade.a,b=facade.b,dx=b[0]-a[0],dy=b[1]-a[1];
  if(Math.abs(dx)>=Math.abs(dy)){
    const y=a[1],distance=Math.min(Math.abs(rect.y-y),Math.abs(rect.y+rect.h-y)),
      shared=Math.min(rect.x+rect.w,Math.max(a[0],b[0]))-Math.max(rect.x,Math.min(a[0],b[0]));
    return distance<=tol&&shared>=0.9;
  }
  const x=a[0],distance=Math.min(Math.abs(rect.x-x),Math.abs(rect.x+rect.w-x)),
    shared=Math.min(rect.y+rect.h,Math.max(a[1],b[1]))-Math.max(rect.y,Math.min(a[1],b[1]));
  return distance<=tol&&shared>=0.9;
}
function intersectionArea(a,b){return Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));}
function linked(a,b,threshold=0.7){
  const xOverlap=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);
  const yOverlap=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
  const xGap=Math.max(0,b.x-(a.x+a.w),a.x-(b.x+b.w));
  const yGap=Math.max(0,b.y-(a.y+a.h),a.y-(b.y+b.h));
  return (xGap<=threshold&&yOverlap>=0.9)||(yGap<=threshold&&xOverlap>=0.9);
}
export function createProject(site){
  const option=stageOneOptions(site)[0];
  if(!option)throw Error('محدوده ساخت قابل استخراج نیست');
  const footprint=option.footprint,b=bounds(footprint),W=b.maxX-b.minX,H=b.maxY-b.minY;
  const id=()=>'r'+Math.random().toString(36).slice(2,10);
  const items=[
    {id:id(),type:'bedroom',label:'خواب ۱',...C(b.minX+W*.04,b.minY+H*.05,W*.32,H*.29)},
    {id:id(),type:'bedroom',label:'خواب ۲',...C(b.minX+W*.52,b.minY+H*.05,W*.32,H*.29)},
    {id:id(),type:'living',label:'پذیرایی',...C(b.minX+W*.52,b.minY+H*.40,W*.44,H*.35)},
    {id:id(),type:'kitchen',label:'آشپزخانه',...C(b.minX+W*.04,b.minY+H*.40,W*.32,H*.28)},
    {id:id(),type:'core',label:'پله / آسانسور',...C(b.minX+W*.04,b.minY+H*.74,W*.32,H*.22)},
    {id:id(),type:'corridor',label:'راهرو',...C(b.minX+W*.39,b.minY+H*.03,W*.11,H*.92)}
  ];
  return {version:1,site:structuredClone(site),footprint:structuredClone(footprint),items,
    entrance:{x:round(b.minX+W*.44),y:round(b.minY),kind:'residential'},
    commercial:{enabled:false,entryRatio:0.5,vehicleEntrance:true},parking:{level:0,hasRamp:false},
    supports:[{id:'s1',x:round(b.minX+W*.1),y:round(b.minY+H*.84),deleted:false,carriesUpperLevels:true}],
    assumptions:{coverage:'demo 65%',buildingLine:'stage1 demo; not verified'},stage:'intent'};
}
export function issuesFor(project){
  const issues=[],items=project.items||[],facades=facadeAnalysis(project);
  const report=(severity,code,ids,message)=>issues.push({severity,code,ids,message});
  const core=items.find(r=>r.type==='core'),hall=items.find(r=>r.type==='corridor');
  if(facades.some(f=>Math.abs(f.b[0]-f.a[0])>0.2&&Math.abs(f.b[1]-f.a[1])>0.2))report('review','DIAGONAL_FACADE',[],'ارزیابی تماس با جبهه مایل هنوز در این نسخه پیاده‌سازی نشده است.');
  for(const r of items){
    if(!rectangleInPolygon(r,project.footprint))report('error','OUTSIDE',[r.id],r.label+' از محدوده ساختمان خارج شده است.');
    const min=minDimensions[r.type];
    if(min&&Math.min(r.w,r.h)<min)report('warning','DIMENSION',[r.id],r.label+' عرض مفید پیشنهادی کافی ندارد (آستانه پژوهشی).');
    if(r.type==='bedroom'&&r.w*r.h<8)report('warning','AREA',[r.id],r.label+' مساحت کمی دارد (معیار پژوهشی، نه حکم قانونی).');
    if(requiredFacade.has(r.type)){
      const touched=facades.filter(f=>faceContact(r,f));
      if(!touched.some(f=>f.kind==='open')){
        if(touched.some(f=>f.kind==='potential'))report('warning','FACADE_UNVERIFIED',[r.id],r.label+' فقط به جبهه نورگیری احتمالی می‌رسد؛ پنجره/موانع بررسی نشده‌اند.');
        else report('error',r.type==='balcony'?'VIEW_UNAVAILABLE':'DAYLIGHT_UNAVAILABLE',[r.id],r.label+' به جبهه باز مناسب در مدل فعلی دسترسی ندارد.');
      }
      if(r.type==='balcony'){
        const living=items.find(q=>q.type==='living');
        if(living && r.w*r.h>living.w*living.h*.45)report('warning','BALCONY_RATIO',[r.id],'تراس نسبت به پذیرایی بزرگ است (هشدار کیفی).');
      }
    }
  }
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
    if(intersectionArea(items[i],items[j])>0.035)report('error','OVERLAP',[items[i].id,items[j].id],items[i].label+' با '+items[j].label+' تداخل دارد.');
  }
  if(!hall)report('error','NO_CORRIDOR',[],'هاله راهرو تعریف نشده است.');
  else{
    if(project.entrance && !linked({...project.entrance,w:.1,h:.1},hall,1.2))report('warning','ENTRY_DISCONNECTED',[hall.id],'ورودی به محور راهرو نزدیک نیست؛ مسیر واقعی باید طراحی شود.');
    for(const r of items){
      if(r.type==='bedroom'&& !linked(r,hall))report('warning','ACCESS_UNCERTAIN',[r.id],'دسترسی '+r.label+' از راهرو قابل استنتاج نیست؛ مسیر و در باید بررسی شوند.');
    }
  }
  if(core && hall && !linked(core,hall))report('warning','CORE_DISCONNECTED',[core.id],'اتصال Core به راهرو نامشخص است.');
  for(const s of project.supports||[])if(s.deleted&&s.carriesUpperLevels)report('review','LOAD_PATH',[s.id],'ستون باربر در مدل حذف شده؛ مسیر انتقال بار و طراحی جایگزین محاسبه نشده است.');
  if(project.parking?.level!==0){
    if(!project.parking.hasRamp)report('error','RAMP_MISSING',[],'پارکینگ در تراز متفاوت از معبر است اما ارتباط سواره تعریف نشده.');
    else report('review','RAMP_UNCHECKED',[],'رمپ ثبت شده اما شیب، طول، شعاع گردش و ارتفاع مفید هنوز محاسبه نشده‌اند.');
  }
  if(project.commercial?.enabled){
    const front=frontageAllocation(project);
    if(front && [front.left,front.right].some(w=>w>0&&w<2.2))report('warning','NARROW_SHOP',[],'تقسیم پیشنهادی بر خیابان، عرض بسیار کمی برای یکی از مغازه‌ها گذاشته است (معیار آزمایشی).');
    report('review','MIXED_USE_UNCHECKED',[],'تفکیک ورودی تجاری/مسکونی و تأمین خروج/پارکینگ هنوز بررسی تخصصی نشده‌اند.');
  }
  report('review','REGULATIONS_UNCHECKED',[],'ضوابط محلی، نورگیری قانونی و سازه تأیید نشده‌اند؛ مدل فعلاً مفهومی است.');
  return issues;
}
export function score(project){
 const issues=issuesFor(project);
 return issues.reduce((s,i)=>s+(i.severity==='error'?100:i.severity==='warning'?20:0),0);
}
// Small, deterministic local search. The selected halo remains movable by the architect.
// Never silently changes other rooms, a design program, or the footprint.
export function suggestLocalRepair(project,id){
 const original=project.items.find(i=>i.id===id);
 if(!original) return null;
 const b=bounds(project.footprint),initial=score(project);
 const base=structuredClone(project),index=base.items.findIndex(r=>r.id===id);
 let best=null,bestCost=Infinity;
 for(let y=b.minY+.15;y<=b.maxY-original.h+.001;y+=.35){
   for(let x=b.minX+.15;x<=b.maxX-original.w+.001;x+=.35){
     base.items[index]={...original,x:round(x),y:round(y)};
     const candidateIssues=issuesFor(base);
     const local=candidateIssues.filter(i=>i.ids.includes(id));
     const cost=local.reduce((s,i)=>s+(i.severity==='error'?100:i.severity==='warning'?20:0),0)+Math.hypot(x-original.x,y-original.y)*.3;
     if(cost<bestCost){bestCost=cost;best={...base.items[index]};}
   }
 }
 if(!best)return null;
 const next=structuredClone(project);next.items[next.items.findIndex(i=>i.id===id)]=best;
 return {project:next,from:initial,to:score(next),changed:bestCost<Infinity && (best.x!==original.x||best.y!==original.y)};
}
export function updateItem(project,id,change){
 const next=structuredClone(project),ix=next.items.findIndex(r=>r.id===id);
 if(ix<0)return project;
 const current=next.items[ix];next.items[ix]={...current,...change};
 return next;
}
export function deleteItem(project,id){const next=structuredClone(project);next.items=next.items.filter(r=>r.id!==id);return next;}
export function addItem(project,type){
 const next=structuredClone(project),b=bounds(next.footprint),counter=next.items.filter(r=>r.type===type).length+1;
 next.items.push({id:'r'+Math.random().toString(36).slice(2,10),type,label:(categories[type]||type)+' '+counter,...C(b.minX+.5,b.minY+.5,3,3)});
 return next;
}


// Frontage is a one-dimensional shared resource, not a decorative doorway.
// Deliberately separate from room geometry until legal build-to line is provided.
export function frontageAllocation(project){
 const candidates=project.site.edges.map((e,i)=>({e,i})).filter(o=>o.e.type==='street');
 if(!candidates.length)return null;
 const best=candidates.sort((a,b)=>{
   const a0=project.site.polygon[a.i],a1=project.site.polygon[(a.i+1)%project.site.polygon.length];
   const b0=project.site.polygon[b.i],b1=project.site.polygon[(b.i+1)%project.site.polygon.length];
   return Math.hypot(b1[0]-b0[0],b1[1]-b0[1])-Math.hypot(a1[0]-a0[0],a1[1]-a0[1]);
 })[0];
 const a=project.site.polygon[best.i],b=project.site.polygon[(best.i+1)%project.site.polygon.length];
 const length=Math.hypot(b[0]-a[0],b[1]-a[1]),entry=1.6,vehicle=project.commercial.vehicleEntrance?2.8:0;
 const free=Math.max(0,length-entry-vehicle),left=Math.max(0,Math.min(free,(length-entry-vehicle)*project.commercial.entryRatio));
 return {length:round(length),entry,vehicle,left:round(left),right:round(Math.max(0,free-left)),edgeIndex:best.i};
}
