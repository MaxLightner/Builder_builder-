// Stage 1 experimental massing. All coordinates are local metres.
import {area,bounds} from './geometry.js';
const round = n => Math.round(n * 10) / 10;
function clipPolygon(poly,axis,cut,keepGreater) {
  const inside=p=>keepGreater?p[axis]>=cut-1e-8:p[axis]<=cut+1e-8;
  const out=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],ia=inside(a),ib=inside(b);
    if(ia)out.push(a);
    if(ia!==ib){const t=(cut-a[axis])/(b[axis]-a[axis]);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
  }
  const clean=out.filter((p,i)=>!i||Math.hypot(p[0]-out[i-1][0],p[1]-out[i-1][1])>1e-7);
  if(clean.length>2&&Math.hypot(clean[0][0]-clean.at(-1)[0],clean[0][1]-clean.at(-1)[1])<1e-7)clean.pop();
  return clean.length>=3&&area(clean)>.01?clean:[];
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
      // Check edges as well as corners; concave site polygons may contain external chords.
      const samples=[...corners,...corners.map((p,i)=>[(p[0]+corners[(i+1)%4][0])/2,(p[1]+corners[(i+1)%4][1])/2])];
      if(!samples.every(p=>contains(poly,p[0],p[1])))continue;
      if(obstacle?.length&&intersectsBox(corners,obstacle))continue;
      return corners.map(p=>p.map(round));
    }
  }
  return [];
}
function intersectsBox(a,b){
  const ba=bounds(a),bb=bounds(b);
  return ba.minX<bb.maxX+.25&&ba.maxX>bb.minX-.25&&ba.minY<bb.maxY+.25&&ba.maxY>bb.minY-.25;
}
function centroid(p){return [p.reduce((s,q)=>s+q[0],0)/p.length,p.reduce((s,q)=>s+q[1],0)/p.length];}
function accessPoint(site,type){
  const index=site.edges.findIndex(e=>e.type==='street'&&(e.access===type||e.access==='both'));
  if(index<0)return null;
  const a=site.polygon[index],b=site.polygon[(index+1)%site.polygon.length];
  return [(a[0]+b[0])/2,(a[1]+b[1])/2];
}
function variant(site,index){
  const p=site.polygon,b=bounds(p),w=b.maxX-b.minX,h=b.maxY-b.minY,base=area(p);
  const names=['حجم شمالی / حیاط ورودی','حجم شرقی / فضای باز جانبی','حجم میانی / عقب‌نشینی'];
  const notes=[
    'تمرکز حجم در عمق قطعه و آزادکردن جبهه ورودی برای حیاط و دسترسی.',
    'آزمون تغییر جهت استقرار، برای بررسی ارزش جبهه‌ها و طول دسترسی.',
    'آزمون عقب‌نشینی از دو جبهه و کاهش سطح اشغال به نفع فضای باز.'
  ];
  let footprint,frontY=b.minY+h*.32;
  if(index===0)footprint=clipPolygon(p,1,frontY,true);
  else if(index===1)footprint=clipPolygon(p,0,b.minX+w*.32,true);
  else{
    footprint=clipPolygon(p,1,b.minY+h*.18,true);
    footprint=clipPolygon(footprint,1,b.maxY-h*.12,false);
    footprint=clipPolygon(footprint,0,b.maxX-w*.10,false);
  }
  if(footprint.length<3||area(footprint)<base*.18)footprint=clipPolygon(p,1,b.minY+h*.35,true);
  const yard=index===0?clipPolygon(p,1,frontY,false):index===1?clipPolygon(p,0,b.minX+w*.32,false):clipPolygon(p,1,b.minY+h*.18,false);
  const core=box(footprint,Math.max(2.5,Math.min(3.7,w*.23)),Math.max(3,Math.min(4.6,h*.25)),index===1?'NE':'NW');
  const parking=box(footprint,Math.max(4.6,Math.min(7.3,w*.54)),Math.max(4.5,Math.min(5.5,h*.27)),index===1?'SW':'SE',core);
  const entry=accessPoint(site,'pedestrian'),vehicle=accessPoint(site,'vehicle');
  const cp=core.length?centroid(core):centroid(footprint),pp=parking.length?centroid(parking):centroid(footprint);
  return {
    schemaVersion:'1.0',stage:1,id:String.fromCharCode(65+index),name:names[index],
    note:notes[index],siteId:site.id,floors:site.target.floors,
    footprint, yard, core, parking, pedestrianEntrance:entry,vehicleEntrance:vehicle,
    pedestrianRoute:entry?[entry,cp]:[],driveway:vehicle&&parking.length?[vehicle,pp]:[],
    areas:{site:round(base),footprint:round(area(footprint)),unbuilt:round(Math.max(0,base-area(footprint))),yardShown:round(yard.length?area(yard):0),core:round(core.length?area(core):0),parkingZone:round(parking.length?area(parking):0)},
    warnings:[
      'جانمایی‌ها صرفاً نمونه اولیه هستند؛ سطح اشغال، عقب‌نشینی و تعداد طبقات با ضوابط کنترل نشده‌اند.',
      !parking.length?'پهنه پارکینگ مستطیلی در این گزینه جاگذاری نشد.':'ظرفیت و مانور واقعی پارکینگ هنوز محاسبه نشده است.',
      !core.length?'هسته عمودی در این گزینه جاگذاری نشد.':'راه‌پله، آسانسور و مسیر خروج هنوز طراحی و اعتبارسنجی نشده‌اند.'
    ]
  };
}
export function stageOneOptions(site){return [0,1,2].map(i=>variant(site,i));}
export function stageOneSVG(d){
  if(!d)return '';
  const polygon=(p,fill,stroke,opacity=1)=>p?.length>=3?'<polygon points="'+p.map(q=>q[0]+','+(-q[1])).join(' ')+'" fill="'+fill+'" fill-opacity="'+opacity+'" stroke="'+stroke+'" stroke-width=".2"/>':'';
  const path=(p,color)=>p?.length>1?'<polyline points="'+p.map(q=>q[0]+','+(-q[1])).join(' ')+'" stroke="'+color+'" stroke-width=".45" stroke-dasharray="1 .65" fill="none"/>':'';
  const circle=(p,color,t)=>p?'<circle cx="'+p[0]+'" cy="'+(-p[1])+'" r=".6" fill="'+color+'"/><text x="'+p[0]+'" y="'+(-p[1]-.9)+'" font-size="1.2" fill="'+color+'" text-anchor="middle">'+t+'</text>':'';
  const f=centroid(d.footprint);
  return '<g class="design-overlay">'+polygon(d.yard,'#83c5a6','#527c65',.78)+polygon(d.footprint,'#dcae78','#9b642e',.78)+polygon(d.parking,'#9579bf','#59447c',.85)+polygon(d.core,'#3b6274','#183944',.96)+path(d.driveway,'#aa5e2d')+path(d.pedestrianRoute,'#2a7aad')+circle(d.vehicleEntrance,'#aa5e2d','V')+circle(d.pedestrianEntrance,'#2a7aad','P')+'<text x="'+f[0]+'" y="'+(-f[1])+'" font-size="1.4" fill="#3d2919" text-anchor="middle">BUILDING</text></g>';
}
