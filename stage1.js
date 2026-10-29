// Stage 1 — exploratory siting with an explicit site-coverage assumption.
// Not a zoning, fire, structural or parking-compliance solver.
import {area,bounds,edgeFrame} from './geometry.js';
export const BASE_COVERAGE_PERCENT = 65;
const round=n=>Math.round(n*10)/10;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
function clipHalfplane(poly,normal,cut,keepAbove){
  if(poly.length<3)return [];
  const inside=p=>keepAbove?dot(p,normal)>=cut-1e-9:dot(p,normal)<=cut+1e-9;
  const out=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],ia=inside(a),ib=inside(b);
    if(ia)out.push(a);
    if(ia!==ib){
      const va=dot(a,normal),vb=dot(b,normal),t=(cut-va)/(vb-va);
      if(Number.isFinite(t))out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
    }
  }
  const clean=out.filter((p,i)=>i===0||Math.hypot(p[0]-out[i-1][0],p[1]-out[i-1][1])>1e-8);
  if(clean.length>2&&Math.hypot(clean[0][0]-clean.at(-1)[0],clean[0][1]-clean.at(-1)[1])<1e-8)clean.pop();
  return clean.length>=3&&area(clean)>1e-7?clean:[];
}
function cutForArea(poly,normal,keepAbove,fraction){
  const bounds=poly.map(p=>dot(p,normal)),min=Math.min(...bounds),max=Math.max(...bounds),required=area(poly)*fraction;
  let lo=min,hi=max;
  for(let i=0;i<56;i++){
    const mid=(lo+hi)/2,actual=area(clipHalfplane(poly,normal,mid,keepAbove));
    if(keepAbove){
      if(actual>required)lo=mid;else hi=mid;
    }else{
      if(actual>required)hi=mid;else lo=mid;
    }
  }
  const cut=(lo+hi)/2;
  return {shape:clipHalfplane(poly,normal,cut,keepAbove),cut};
}
function contains(p,x,y){
  let hit=false;
  for(let i=0,j=p.length-1;i<p.length;j=i++){
    const a=p[i],b=p[j];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }
  return hit;
}
function box(poly,w,h,place='NW',obstacle=null){
  if(poly.length<3)return [];
  const b=bounds(poly),width=b.maxX-b.minX,depth=b.maxY-b.minY;
  w=Math.min(w,width*.65);h=Math.min(h,depth*.65);
  for(let scale=1;scale>=.48;scale-=.08){
    const W=w*scale,H=h*scale;
    const xs=place.includes('W')?[b.minX+.15,b.minX+width*.15,b.maxX-W-.2]:[b.maxX-W-.15,b.maxX-W-width*.15,b.minX+.2];
    const ys=place.includes('N')?[b.maxY-H-.15,b.maxY-H-depth*.15,b.minY+.2]:[b.minY+.15,b.minY+depth*.15,b.maxY-H-.2];
    for(const y of ys)for(const x of xs){
      const corners=[[x,y],[x+W,y],[x+W,y+H],[x,y+H]];
      const samples=[...corners,...corners.map((p,i)=>[(p[0]+corners[(i+1)%4][0])/2,(p[1]+corners[(i+1)%4][1])/2])];
      if(!samples.every(p=>contains(poly,p[0],p[1])))continue;
      if(obstacle?.length&&intersectsBox(corners,obstacle))continue;
      return corners.map(p=>p.map(round));
    }
  }
  return [];
}
function intersectsBox(a,b){
  const x=bounds(a),y=bounds(b);
  return x.minX<y.maxX+.25&&x.maxX>y.minX-.25&&x.minY<y.maxY+.25&&x.maxY>y.minY-.25;
}
function centroid(p){return [p.reduce((s,q)=>s+q[0],0)/p.length,p.reduce((s,q)=>s+q[1],0)/p.length];}
function accessPoint(site,type){
  const i=site.edges.findIndex(e=>e.type==='street'&&(e.access===type||e.access==='both'));
  if(i<0)return null;
  const a=site.polygon[i],b=site.polygon[(i+1)%site.polygon.length];
  return [(a[0]+b[0])/2,(a[1]+b[1])/2];
}
function variant(site,index,settings){
  const p=site.polygon,b=bounds(p),w=b.maxX-b.minX,h=b.maxY-b.minY,base=area(p);
  const front=site.edges.findIndex(e=>e.type==='street');
  const side=front>=0?front:0,frame=edgeFrame(p,side);
  const normal=frame.n,tangent=[(frame.b[0]-frame.a[0])/frame.l,(frame.b[1]-frame.a[1])/frame.l];
  const names=['حیاط سمت گذر / ساختمان در عمق','ساختمان سمت گذر / حیاط عقب','حیاط جانبی / ساختمان در کنار'];
  const notes=[
    'جبهه ورودی به فضای باز اختصاص می‌یابد؛ حجم در عمق زمین متمرکز می‌شود.',
    'حجم نزدیک جبهه گذر می‌نشیند و فضای باز به پشت منتقل می‌شود.',
    'حجم و فضای باز در عرض زمین تقسیم می‌شوند؛ اولویت جانبی با کیفیت جبهه‌ها مقایسه می‌شود.'
  ];
  let direction=normal,keepAbove=index===1;
  if(index===2){
    direction=tangent;
    const quality={good:3,medium:1,poor:-2};
    const sidePreference=site.edges.reduce((score,e,i)=>{
      const f=edgeFrame(p,i);
      const weight=(quality[e.view]||0)+(e.type==='open'?2:0)-(e.privacy==='high'?1:0);
      return score+weight*dot(f.n,tangent)*f.l;
    },0);
    // Keep building away from the better side, reserving that side as open space.
    keepAbove=sidePreference<0;
  }
  const extra=Number.isFinite(settings.extraPercent)?Math.max(0,Math.min(35,settings.extraPercent)):10;
  const targetPercent=BASE_COVERAGE_PERCENT+(settings.allowExcess?extra:0);
  const baseSplit=cutForArea(p,direction,keepAbove,BASE_COVERAGE_PERCENT/100);
  const split=cutForArea(p,direction,keepAbove,targetPercent/100);
  const footprint=split.shape;
  const yard=clipHalfplane(p,direction,split.cut,!keepAbove);
  const core=box(footprint,Math.max(2.5,Math.min(3.7,w*.23)),Math.max(3,Math.min(4.6,h*.25)),index===1?'NE':'NW');
  const parking=box(footprint,Math.max(4.6,Math.min(7.3,w*.54)),Math.max(4.5,Math.min(5.5,h*.27)),index===1?'SW':'SE',core);
  const pedestrianEntrance=accessPoint(site,'pedestrian'),vehicleEntrance=accessPoint(site,'vehicle');
  const cp=core.length?centroid(core):centroid(footprint),pp=parking.length?centroid(parking):centroid(footprint);
  const footprintArea=area(footprint),baseArea=area(baseSplit.shape),aboveBase=Math.max(0,footprintArea-base*.65);
  return {
    schemaVersion:'1.1',stage:1,id:String.fromCharCode(65+index),siteId:site.id,name:names[index],note:notes[index],floors:site.target.floors,
    assumptions:{baseCoveragePercent:65,extraConstructionEnabled:!!settings.allowExcess,extraCoveragePercentagePoints:settings.allowExcess?extra:0,targetCoveragePercent:targetPercent,setbacksApplied:false,legalStatus:'not assessed; excess construction is not an approval'},
    footprint,baseFootprint:baseSplit.shape,yard,core,parking,pedestrianEntrance,vehicleEntrance,
    pedestrianRoute:pedestrianEntrance?[pedestrianEntrance,cp]:[],driveway:vehicleEntrance&&parking.length?[vehicleEntrance,pp]:[],
    areas:{site:round(base),footprint:round(footprintArea),coveragePercent:round(footprintArea/base*100),baseCoverage:round(baseArea),
      excessFootprint:round(aboveBase),unbuilt:round(Math.max(0,base-footprintArea)),
      yardShown:round(area(yard)),core:round(area(core)),parkingZone:round(area(parking))},
    warnings:[
      settings.allowExcess?'سطح مازاد فقط برای مقایسه سناریو است؛ پرداخت جریمه یا امکان اخذ مجوز برای آن فرض نشده است.':'۶۵٪ صرفاً فرض اولیه پروژه است؛ ضوابط واقعی زمین بررسی نشده‌اند.',
      'عقب‌نشینی در این محاسبه اعمال نشده است.',
      !parking.length?'پهنه پارکینگ اولیه جاگذاری نشد.':'ظرفیت، مانور و مسیر واقعی پارکینگ هنوز تأیید نشده‌اند.',
      !core.length?'هسته عمودی اولیه جاگذاری نشد.':'پله، آسانسور و خروج ایمن هنوز طراحی نشده‌اند.'
    ]
  };
}
export function stageOneOptions(site,settings={}){return [0,1,2].map(i=>variant(site,i,settings));}
export function stageOneSVG(d){
  if(!d)return '';
  const polygon=(p,fill,stroke,opacity=1,extra='')=>p?.length>=3?'<polygon points="'+p.map(q=>q[0]+','+(-q[1])).join(' ')+'" fill="'+fill+'" fill-opacity="'+opacity+'" stroke="'+stroke+'" stroke-width=".2" '+extra+'/>':'';
  const path=(p,color)=>p?.length>1?'<polyline points="'+p.map(q=>q[0]+','+(-q[1])).join(' ')+'" stroke="'+color+'" stroke-width=".45" stroke-dasharray="1 .65" fill="none"/>':'';
  const circle=(p,color,t)=>p?'<circle cx="'+p[0]+'" cy="'+(-p[1])+'" r=".6" fill="'+color+'"/><text x="'+p[0]+'" y="'+(-p[1]-.9)+'" font-size="1.2" fill="'+color+'" text-anchor="middle">'+t+'</text>':'';
  const f=centroid(d.footprint);
  return '<g class="design-overlay">'+polygon(d.yard,'#83c5a6','#527c65',.78)+polygon(d.footprint,d.assumptions.extraConstructionEnabled?'#c76f44':'#dcae78','#9b642e',.82)+
    (d.assumptions.extraConstructionEnabled?polygon(d.baseFootprint,'#dcae78','#946b44',1):'')+
    polygon(d.parking,'#9579bf','#59447c',.85)+polygon(d.core,'#3b6274','#183944',.96)+path(d.driveway,'#aa5e2d')+path(d.pedestrianRoute,'#2a7aad')+
    circle(d.vehicleEntrance,'#aa5e2d','V')+circle(d.pedestrianEntrance,'#2a7aad','P')+
    '<text x="'+f[0]+'" y="'+(-f[1])+'" font-size="1.4" fill="#3d2919" text-anchor="middle">BUILDING</text></g>';
}
