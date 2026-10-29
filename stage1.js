// Experimental Stage 1 geometry. Start-of-construction line is an INPUT, never inferred as municipal approval.
import {area,bounds,edgeFrame} from './geometry.js';
export const BASE_COVERAGE_PERCENT=65;
const round=n=>Math.round(n*10)/10;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const mul=(a,s)=>[a[0]*s,a[1]*s];
const plus=(a,b)=>[a[0]+b[0],a[1]+b[1]];
function clip(poly,n,cut,above){
  if(poly.length<3)return [];
  const inside=p=>above?dot(p,n)>=cut-1e-9:dot(p,n)<=cut+1e-9,out=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],ia=inside(a),ib=inside(b);
    if(ia)out.push(a);
    if(ia!==ib){const va=dot(a,n),vb=dot(b,n),t=(cut-va)/(vb-va);if(Number.isFinite(t))out.push(plus(a,mul([b[0]-a[0],b[1]-a[1]],t)))}
  }
  const clean=out.filter((p,i)=>i===0||Math.hypot(p[0]-out[i-1][0],p[1]-out[i-1][1])>1e-8);
  if(clean.length>2&&Math.hypot(clean[0][0]-clean.at(-1)[0],clean[0][1]-clean.at(-1)[1])<1e-8)clean.pop();
  return clean.length>2&&area(clean)>1e-8?clean:[];
}
function cutToArea(poly,direction,target){
  const dots=poly.map(p=>dot(p,direction)),min=Math.min(...dots),max=Math.max(...dots);
  let low=min,high=max;
  for(let i=0;i<55;i++){
    const cutAt=(low+high)/2;
    if(area(clip(poly,direction,cutAt,false))>target)high=cutAt;else low=cutAt;
  }
  return clip(poly,direction,(low+high)/2,false);
}
function inside(poly,x,y){
  // Boundary included using short tolerance to avoid rejecting boxes against clipped edges.
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],ab=[b[0]-a[0],b[1]-a[1]],ap=[x-a[0],y-a[1]];
    const cross=ab[0]*ap[1]-ab[1]*ap[0],projection=dot(ap,ab);
    if(Math.abs(cross)<1e-7&&projection>=-1e-7&&projection<=dot(ab,ab)+1e-7)return true;
  }
  let hit=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }
  return hit;
}
function rectIn(poly,w,h,position='NW',obstacle=[]){
  if(poly.length<3)return [];
  const b=bounds(poly),W=b.maxX-b.minX,H=b.maxY-b.minY;
  for(let factor=1;factor>=.48;factor-=.08){
    const width=Math.min(w,W*.65)*factor,height=Math.min(h,H*.65)*factor;
    const xs=position.includes('W')?[b.minX+.12,b.minX+W*.17,b.maxX-width-.12]:[b.maxX-width-.12,b.maxX-width-W*.17,b.minX+.12];
    const ys=position.includes('N')?[b.maxY-height-.12,b.maxY-height-H*.17,b.minY+.12]:[b.minY+.12,b.minY+H*.17,b.maxY-height-.12];
    for(const y of ys)for(const x of xs){
      const corners=[[x,y],[x+width,y],[x+width,y+height],[x,y+height]],c=bounds(corners);
      if(obstacle.length){const o=bounds(obstacle);if(c.minX<o.maxX+.25&&c.maxX>o.minX-.25&&c.minY<o.maxY+.25&&c.maxY>o.minY-.25)continue;}
      const samples=[...corners,...corners.map((p,i)=>[(p[0]+corners[(i+1)%4][0])/2,(p[1]+corners[(i+1)%4][1])/2])];
      if(samples.every(p=>inside(poly,...p)))return corners.map(p=>p.map(round));
    }
  }
  return [];
}
function center(p){return [p.reduce((s,q)=>s+q[0],0)/p.length,p.reduce((s,q)=>s+q[1],0)/p.length]}
function entrance(site,type){
 const i=site.edges.findIndex(e=>e.type==='street'&&(e.access===type||e.access==='both'));
 if(i<0)return null;
 const p=site.polygon;return [(p[i][0]+p[(i+1)%p.length][0])/2,(p[i][1]+p[(i+1)%p.length][1])/2];
}
export function proposedLine(site){
  // DEMO ONLY: northernmost boundary according to the site's declared compass. Never municipal data.
  const theta=site.north*Math.PI/180,north=[Math.sin(theta),Math.cos(theta)];
  let max=-Infinity,edgeIndex=0;
  site.polygon.forEach((p,i)=>{const q=site.polygon[(i+1)%site.polygon.length],m=[(p[0]+q[0])/2,(p[1]+q[1])/2],v=dot(m,north);
    if(v>max){max=v;edgeIndex=i}
  });
  return {edgeIndex,offsetM:0,source:'demo-assumption'};
}
export function normalizedLine(site,config={}){
  const l=config.buildingLine||site.buildingLine||proposedLine(site);
  const edgeIndex=Number(l.edgeIndex),offsetM=Number(l.offsetM??0);
  if(!Number.isInteger(edgeIndex)||edgeIndex<0||edgeIndex>=site.polygon.length||!Number.isFinite(offsetM)||offsetM<0||offsetM>1000)
    return null;
  const f=edgeFrame(site.polygon,edgeIndex),inward=mul(f.n,-1);
  const start=plus(f.a,mul(inward,offsetM)),end=plus(f.b,mul(inward,offsetM));
  return {edgeIndex,offsetM,source:l.source==='user-from-permit'?'user-from-permit':'demo-assumption',
    start,end,inward,tangent:[(f.b[0]-f.a[0])/f.l,(f.b[1]-f.a[1])/f.l]};
}
function createOption(site,index,config){
  const line=normalizedLine(site,config);
  if(!line)return null;
  const plot=site.polygon,plotArea=area(plot),originalTarget=(BASE_COVERAGE_PERCENT+(config.allowExcess?Math.max(0,Math.min(35,Number(config.extraPercent)||0)):0))/100*plotArea;
  const front=dot(line.start,line.inward);
  const behindLine=clip(plot,line.inward,front,true);
  const candidates=['ساختمان در عرض کامل رج بنا','آزادسازی نوار سمت راست','آزادسازی نوار سمت چپ'];
  if(behindLine.length<3||area(behindLine)<.1)return null;
  let usable=behindLine;
  if(index!==0){
    const tangent=line.tangent,coordinates=behindLine.map(p=>dot(p,tangent)),min=Math.min(...coordinates),max=Math.max(...coordinates),range=max-min;
    // Optional side-space only if target coverage is still achievable.
    for(const ratio of [.1,.06,.03]){
      const candidate=index===1?clip(behindLine,tangent,max-range*ratio,false):clip(behindLine,tangent,min+range*ratio,true);
      if(area(candidate)>=originalTarget-1e-6){usable=candidate;break}
    }
  }
  const allowedArea=area(usable),target=Math.min(originalTarget,allowedArea);
  const footprint=target>1e-8?cutToArea(usable,line.inward,target):[];
  if(!footprint.length)return null;
  const baseline=Math.min(plotArea*.65,area(behindLine));
  const baseFootprint=cutToArea(usable,line.inward,Math.min(baseline,area(usable)));
  const b=bounds(footprint),w=b.maxX-b.minX,h=b.maxY-b.minY;
  const core=rectIn(footprint,Math.max(2.5,Math.min(3.7,w*.23)),Math.max(3,Math.min(4.6,h*.25)),index===2?'NE':'NW');
  const parking=rectIn(footprint,Math.max(4.6,Math.min(7.3,w*.54)),Math.max(4.5,Math.min(5.5,h*.27)),index===1?'SW':'SE',core);
  const pedestrianEntrance=entrance(site,'pedestrian'),vehicleEntrance=entrance(site,'vehicle');
  const gross=area(footprint),excess=Math.max(0,gross-plotArea*.65);
  return {schemaVersion:'1.2',stage:1,id:'ABC'[index],siteId:site.id,name:candidates[index],
    note:'جانمایی مقید به خط شروع بنا؛ هر تغییر شکل فقط در پشت همین خط صورت می‌گیرد.',floors:site.target.floors,
    assumptions:{baseCoveragePercent:65,extraConstructionEnabled:!!config.allowExcess,extraCoveragePercentagePoints:config.allowExcess?Math.max(0,Math.min(35,Number(config.extraPercent)||0)):0,
      setbacksApplied:false,targetCoveragePercent:round(originalTarget/plotArea*100),buildingLine:line,
      legalStatus:line.source==='user-from-permit'?'line entered by user; not independently verified':'illustrative line, NOT sourced from municipality'},
    footprint,baseFootprint,yard:[],core,parking,pedestrianEntrance,vehicleEntrance,
    pedestrianRoute:pedestrianEntrance&&core.length?[pedestrianEntrance,center(core)]:[],
    driveway:vehicleEntrance&&parking.length?[vehicleEntrance,center(parking)]:[],
    areas:{site:round(plotArea),footprint:round(gross),coveragePercent:round(gross/plotArea*100),
      baseCoverage:round(area(baseFootprint)),excessFootprint:round(excess),unbuilt:round(plotArea-gross),
      yardShown:0,core:round(area(core)),parkingZone:round(area(parking))},
    warnings:[
      line.source==='demo-assumption'?'رج شروع بنا فرض نمایشی است؛ باید از دستور نقشه واقعی گرفته شود.':'رج بنا توسط کاربر وارد شده و اصالت آن بررسی نشده است.',
      '۶۵٪ سقف فرضی آزمایشی است؛ عقب‌نشینی و سایر ضوابط ملک بررسی نشده‌اند.',
      area(behindLine)+1e-6<originalTarget?'با این رج بنا رسیدن به سطح اشغال انتخابی ممکن نیست؛ اشغال کاهش یافت.':'',
      config.allowExcess?'ساخت مازاد صرفاً سناریوی فرضی است و جریمه/مجوز آن تضمین نشده است.':'',
      'حیاط، پارکینگ، پله و آسانسور هنوز طراحی و اعتبارسنجی عملکردی نشده‌اند.'
    ].filter(Boolean)
  };
}
export function stageOneOptions(site,config={}){return [0,1,2].map(i=>createOption(site,i,config)).filter(Boolean);}
export function stageOneSVG(d){
 if(!d)return '';
 const polygon=(p,fill,stroke,opacity=1)=>p?.length>2?'<polygon points="'+p.map(q=>q[0]+','+(-q[1])).join(' ')+'" fill="'+fill+'" fill-opacity="'+opacity+'" stroke="'+stroke+'" stroke-width=".18"/>':'';
 const line=(p,color,thickness=0.3)=>p?.length>1?'<polyline points="'+p.map(q=>q[0]+','+(-q[1])).join(' ')+'" stroke="'+color+'" stroke-width="'+thickness+'" fill="none"/>':'';
 const dotmark=(p,t,color)=>p?'<circle cx="'+p[0]+'" cy="'+(-p[1])+'" r=".55" fill="'+color+'"/><text x="'+p[0]+'" y="'+(-p[1]-1)+'" font-size="1.1" fill="'+color+'" text-anchor="middle">'+t+'</text>':'';
 const f=center(d.footprint),ln=d.assumptions.buildingLine;
 return '<g class="design-overlay">'+polygon(d.footprint,d.assumptions.extraConstructionEnabled?'#c76f44':'#dcae78','#9b642e',.82)+
   (d.assumptions.extraConstructionEnabled?polygon(d.baseFootprint,'#dcae78','#9b642e',.94):'')+
   polygon(d.parking,'#9579bf','#59447c',.85)+polygon(d.core,'#3b6274','#183944',.96)+
   line([ln.start,ln.end],'#bb2c4c',.55)+line(d.driveway,'#aa5e2d',.35)+line(d.pedestrianRoute,'#2a7aad',.35)+
   dotmark(d.vehicleEntrance,'V','#aa5e2d')+dotmark(d.pedestrianEntrance,'P','#2a7aad')+
   '<text x="'+f[0]+'" y="'+(-f[1])+'" font-size="1.3" fill="#352b23" text-anchor="middle">BUILDING</text></g>';
}
