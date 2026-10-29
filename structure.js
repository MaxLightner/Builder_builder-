// Concept structural layout engine (metric). NOT structural engineering or certified parking.
// Geometry is deterministic, reproducible and grounded in the selected Stage 1 footprint.
import {area,bounds} from './geometry.js';
const R=n=>Math.round(n*100)/100;
const polyRect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
export function pointIn(poly,p){
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];
    if(Math.abs(cross(a,b,p))<1e-7&&p[0]>=Math.min(a[0],b[0])-1e-7&&p[0]<=Math.max(a[0],b[0])+1e-7&&p[1]>=Math.min(a[1],b[1])-1e-7&&p[1]<=Math.max(a[1],b[1])+1e-7)return true;
  }
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
function within(poly,rect){
  // all corners, edge midpoints and 1/4, 3/4 points; also catches most concave cutouts.
  return rect.every((v,i)=>[0,.25,.5,.75].every(t=>{
    const w=rect[(i+1)%rect.length];return pointIn(poly,[v[0]+(w[0]-v[0])*t,v[1]+(w[1]-v[1])*t]);
  }));
}
const overlaps=(a,b,pad=0)=>{
  if(!a?.length||!b?.length)return false;
  const x=bounds(a),y=bounds(b);
  return x.minX<y.maxX+pad&&x.maxX>y.minX-pad&&x.minY<y.maxY+pad&&x.maxY>y.minY-pad;
};
function center(p){return p.reduce((s,v)=>[s[0]+v[0]/p.length,s[1]+v[1]/p.length],[0,0]);}
function entrance(site,type){
  const i=site.edges.findIndex(e=>e.type==='street'&&(e.access===type||e.access==='both'));
  if(i<0)return null;
  const p=site.polygon,t=type==='vehicle'?.36:.64,a=p[i],b=p[(i+1)%p.length];
  return [a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t];
}
function sampleRoute(poly,route){
  if(route.length<2)return false;
  for(let i=1;i<route.length;i++){
    const a=route[i-1],b=route[i];
    for(let t=0;t<=1.001;t+=.1)if(!pointIn(poly,[a[0]+(b[0]-a[0])*Math.min(t,1),a[1]+(b[1]-a[1])*Math.min(t,1)]))return false;
  }
  return true;
}
function placeCore(footprint,index){
  const b=bounds(footprint),w=b.maxX-b.minX,h=b.maxY-b.minY;
  const configurations=[
    {name:'هسته گوشه غربی',side:'NW'},
    {name:'هسته گوشه شرقی',side:'NE'},
    {name:'هسته عقب ـ جابه‌جا',side:'SW'}
  ];
  // Stair box 2.6×4.8 m + lift 2×2.2 + waiting 2×2.3 + shaft 0.9×1.1.
  const cw=4.95,ch=5.1,order=index===0?['NW','SW','NE','SE']:index===1?['NE','SE','NW','SW']:['SW','NW','SE','NE'];
  for(const scale of [1,.94,.88]){
    const width=cw*scale,depth=ch*scale;
    if(w<width+.15||h<depth+.15)continue;
    for(const side of order){
      const x=side.includes('W')?b.minX+.18:b.maxX-width-.18;
      const y=side.includes('N')?b.maxY-depth-.18:b.minY+.18;
      const envelope=polyRect(x,y,width,depth);
      if(!within(footprint,envelope))continue;
      const stair=polyRect(x,y,2.65*scale,4.75*scale);
      const elevator=polyRect(x+2.85*scale,y+2.65*scale,1.92*scale,2.05*scale);
      const landing=polyRect(x+2.85*scale,y+1.32*scale,1.92*scale,1.30*scale);
      const shaft=polyRect(x+3.87*scale,y+.12*scale,.9*scale,1.1*scale);
      const components={stair,elevator,landing,shaft};
      if(Object.values(components).every(p=>within(footprint,p)))
        return {valid:true,name:configurations[index].name,envelope,components,stairwell:{width:R(2.65*scale),length:R(4.75*scale)},elevator:{width:R(1.92*scale),depth:R(2.05*scale)}};
    }
  }
  return {valid:false,name:'هسته جانمایی نشده',envelope:[],components:{stair:[],elevator:[],landing:[],shaft:[]}};
}
function parkingCandidates(footprint,core,columns,plot,gate){
  const b=bounds(footprint),w=b.maxX-b.minX,h=b.maxY-b.minY;
  const cores=[core.envelope].filter(p=>p.length);
  const physicalObstacles=[...cores,...columns.map(c=>c.polygon)];
  const candidates=[];
  for(const horizontal of [true,false]){
    const axisLength=horizontal?w:h,depth=horizontal?h:w;
    if(axisLength<5.2||depth<10.4)continue;
    const aisleWidth=5.5,stallDepth=5,stallWidth=2.5;
    // Aisle can be close to either end or in the middle. Every counted stall is fully inside ground footprint.
    const offsets=[.55,.65,.85,1.1,Math.max(.55,depth-aisleWidth-stallDepth-.25),Math.max(.55,(depth-aisleWidth)/2)];
    for(const offset of offsets){
      const a=horizontal?
        polyRect(b.minX+.2,b.minY+offset,w-.4,aisleWidth):
        polyRect(b.minX+offset,b.minY+.2,aisleWidth,h-.4);
      if(!within(footprint,a)||physicalObstacles.some(c=>overlaps(a,c,.03)))continue;
      for(const shift of [.22,.36,.5,.7,.88]){
        const stalls=[];
        for(const side of [-1,1]){
          const row=horizontal?
            side===1?b.minY+offset+aisleWidth:b.minY+offset-stallDepth:
            side===1?b.minX+offset+aisleWidth:b.minX+offset-stallDepth;
          const count=Math.floor((axisLength-shift-.2)/stallWidth);
          for(let i=0;i<count;i++){
            const axis=horizontal?b.minX+shift+i*stallWidth:b.minY+shift+i*stallWidth;
            const p=horizontal?polyRect(axis,row,stallWidth,stallDepth):polyRect(row,axis,stallDepth,stallWidth);
            if(!within(footprint,p)||physicalObstacles.some(c=>overlaps(p,c,.04))||stalls.some(c=>overlaps(p,c.polygon,.02)))continue;
            stalls.push({id:'P'+(stalls.length+1),polygon:p,kind:'perpendicular-90',dimensions:[2.5,5],independent:true,orientation:horizontal?'N-S':'E-W'});
          }
        }
        if(!stalls.length)continue;
        const ab=bounds(a);
        const target=gate?[
          Math.max(ab.minX+.4,Math.min(ab.maxX-.4,gate[0])),
          Math.max(ab.minY+.4,Math.min(ab.maxY-.4,gate[1]))
        ]:center(a);
        const entry=gate||null;
        const corridor=entry?[entry,target]:[];
        const collisionOnPath=physicalObstacles.some(ob=>{
          const r=bounds(ob);
          for(const [start,end] of corridor.length>=2?[[corridor[0],corridor[1]]]:[]){
            for(let t=0;t<=1.0001;t+=.035){
              const x=start[0]+(end[0]-start[0])*t,y=start[1]+(end[1]-start[1])*t;
              if(x>r.minX-.14&&x<r.maxX+.14&&y>r.minY-.14&&y<r.maxY+.14)return true;
            }
          }
          return false;
        });
        const connects=!!entry&&sampleRoute(plot,corridor)&&!collisionOnPath;
        const score=(connects?1000:0)+stalls.length*20-(horizontal?0:1);
        candidates.push({score,aisle:a,stalls,driveway:corridor,connectionPlausible:connects,aisleClearWidth:aisleWidth});
      }
    }
  }
  candidates.sort((a,b)=>b.score-a.score);
  return candidates[0]||{score:0,aisle:[],stalls:[],driveway:[],connectionPlausible:false,aisleClearWidth:0};
}
function addColumns(footprint,core,phase=0){
  const b=bounds(footprint),W=b.maxX-b.minX,H=b.maxY-b.minY;
  const countX=Math.max(1,Math.ceil((W-.65)/6.5)),countY=Math.max(1,Math.ceil((H-.65)/8));
  const stepX=(W-.65)/countX,stepY=(H-.65)/countY;
  const out=[],rejected=[],section=.38,collision=[core.envelope].filter(p=>p?.length);
  for(let j=0;j<=countY;j++)for(let i=0;i<=countX;i++){
    const x=b.minX+.325+i*stepX,y=b.minY+.325+j*stepY;
    const p=polyRect(x-section/2,y-section/2,section,section);
    if(!within(footprint,p))continue;
    const blocked=collision.some(q=>overlaps(p,q,.08));
    if(blocked){rejected.push({x:R(x),y:R(y)});continue}
    out.push({id:'C'+(out.length+1),x:R(x),y:R(y),width:section,depth:section,polygon:p,levelStart:0});
  }
  return {columns:out,omitted:rejected,grid:{intervalX:R(stepX),intervalY:R(stepY),rowCount:countY+1,columnCount:countX+1}};
}
function beams(columns,footprint){
  const out=[];
  for(let i=0;i<columns.length;i++)for(let j=i+1;j<columns.length;j++){
    const a=columns[i],b=columns[j],sameX=Math.abs(a.x-b.x)<.15,sameY=Math.abs(a.y-b.y)<.15;
    if(!sameX&&!sameY)continue;
    if(Math.hypot(a.x-b.x,a.y-b.y)>9)continue;
    if(columns.some((c,k)=>k!==i&&k!==j&&(sameX?Math.abs(c.x-a.x)<.15&&c.y>Math.min(a.y,b.y)&&c.y<Math.max(a.y,b.y):Math.abs(c.y-a.y)<.15&&c.x>Math.min(a.x,b.x)&&c.x<Math.max(a.x,b.x))))continue;
    if(!sampleRoute(footprint,[[a.x,a.y],[b.x,b.y]]))continue;
    out.push({from:[a.x,a.y],to:[b.x,b.y],width:.26,depth:.42});
  }
  return out;
}
export function buildRoughStructure(site,design){
  const footprint=design.footprint,levels=site.target.floors,levelHeight=3.2;
  const core=placeCore(footprint,'ABC'.indexOf(design.id));
  const structural=addColumns(footprint,core);
  // The load-path column grid is established BEFORE parking. Never delete columns to increase parking count.
  const parking=parkingCandidates(footprint,core,structural.columns,site.polygon,entrance(site,'vehicle'));
  const slabCount=levels+2;// ground (parking) + N typical floors + roof.
  const slabs=Array.from({length:slabCount},(_,i)=>({
    id:i===0?'GROUND':i===slabCount-1?'ROOF':'F'+i,
    floor:i,kind:i===0?'parking-ground':i===slabCount-1?'roof':'residential-floor',
    z:R(i*levelHeight),thickness:.25,polygon:footprint
  }));
  const counted=parking.connectionPlausible?parking.stalls:[];
  const warnings=[
    'این مدل، پیش‌طرح هندسی سفت‌کاری است؛ طراحی سازه و کنترل مقررات ندارد.',
    'اتصال مسیر خودرو و عرض راهرو فقط هندسی است؛ شعاع گردش و مسیر حرکت خودرو شبیه‌سازی نشده است.',
    'ستون‌گذاری اولیه مستقل از پارکینگ تولید شده است؛ نقاط حذف‌شده در هسته نیاز به بازطراحی سازه دارند.',
    !core.valid?'هسته پله/آسانسور در سطح فعلی جا نگرفت؛ این گزینه قابل تأیید نیست.':'ابعاد و تعداد پله، آسانسور، خروج اضطراری و ضوابط آتش هنوز کنترل نشده‌اند.',
    !parking.connectionPlausible?'اتصال مستقیم قابل قبول از خیابان به راهروی پارکینگ پیدا نشد؛ ظرفیت تأییدنشده است.':'',
    !counted.length?'در این گزینه جای پارک قابل شمارش با بررسی هندسی اولیه ثبت نشد.':'',
    structural.grid.intervalX>7||structural.grid.intervalY>7?'برخی دهانه‌ها از بازه معمول آزمایشی بزرگ‌ترند.':''
  ].filter(Boolean);
  return {
    schemaVersion:'2.0',units:'m',coordinateSystem:'x,y plot; z elevation',
    stage:1,siteId:site.id,optionId:design.id,
    floorHeight:levelHeight,groundUse:'parking',residentialFloors:levels,roofLevel:R((slabCount-1)*levelHeight),
    slabs,columns:structural.columns,grid:structural.grid,omittedGridPoints:structural.omitted,
    beams:beams(structural.columns,footprint),core,parking:{
      ...parking,stalls:counted,uncountedCandidates:parking.connectionPlausible?[]:parking.stalls,
      count:counted.length,accessibleOnPaper:parking.connectionPlausible,kind:'90-degree stalls, indicative only',
      vehicleTurningValidated:false,ramps:[],basementLevels:0
    },
    shafts:core.components.shaft.length?[{id:'MEP-1',polygon:core.components.shaft}]:[],
    statistics:{grossFootprint:R(area(footprint)),siteArea:R(area(site.polygon)),parkingStalls:counted.length,
      parkingUnverified:!parking.connectionPlausible,residentialFloors:levels,slabCount,
      columnCount:structural.columns.length,beamCount:beams(structural.columns,footprint).length,
      corePlanned:core.valid,gridSpans:[structural.grid.intervalX,structural.grid.intervalY]},
    validation:{level:'geometric-concept-only',structuralDesign:false,parkingTurning:false,permitCompliance:false,fireEgress:false},
    warnings
  };
}
export function structureSVG(s,design,selectedFloor='all'){
  if(!s)return '';
  const points=p=>p?.map(v=>v[0]+','+(-v[1])).join(' ')||'';
  const polygon=(p,fill,stroke,width=.12,opacity=1)=>p?.length>2?'<polygon points="'+points(p)+'" fill="'+fill+'" fill-opacity="'+opacity+'" stroke="'+stroke+'" stroke-width="'+width+'"/>':'';
  const txt=(p,t,size=1)=>'<text x="'+p[0]+'" y="'+(-p[1])+'" font-size="'+size+'" text-anchor="middle" fill="#172f3c" style="paint-order:stroke;stroke:#ffffff;stroke-width:.22">'+t+'</text>';
  let html='<g class="rough-structure">';
  html+=polygon(design.footprint,'#d9e5e8','#476574',.28,.52);
  const line=design.assumptions.buildingLine;
  if(line)html+='<polyline points="'+points([line.start,line.end])+'" fill="none" stroke="#b23856" stroke-width=".5"/>';
  if(selectedFloor==='all'||selectedFloor==='0'){
    if(s.parking.aisle.length)html+=polygon(s.parking.aisle,'#dbe0e6','#96a4b1',.08,.9);
    for(const stall of s.parking.stalls){
      html+=polygon(stall.polygon,'#d5ecdd','#378b62',.1,.94);
      const c=center(stall.polygon);html+=txt(c,stall.id,.93);
    }
    for(const stall of s.parking.uncountedCandidates)html+=polygon(stall.polygon,'#eee9df','#be9775',.08,.6);
    if(s.parking.driveway.length)html+='<polyline points="'+points(s.parking.driveway)+'" stroke="#db8d3a" stroke-width=".26" stroke-dasharray=".55 .45" fill="none"/>';
  }
  for(const beam of s.beams)html+='<polyline points="'+points([beam.from,beam.to])+'" stroke="#607b88" stroke-width=".18" opacity=".6"/>';
  for(const c of s.columns)html+=polygon(c.polygon,'#314b59','#203b48',.1,1);
  const boxes=s.core.components;
  html+=polygon(boxes.stair,'#a3b6d7','#3b6088',.23,.8)+polygon(boxes.elevator,'#7995c3','#254a7c',.23,.9)+polygon(boxes.landing,'#d2deed','#7189a6',.16,.84)+polygon(boxes.shaft,'#bd9eca','#885795',.2,.88);
  if(boxes.stair.length)html+=txt(center(boxes.stair),'STAIR',.85);
  if(boxes.elevator.length)html+=txt(center(boxes.elevator),'LIFT',.8);
  if(boxes.shaft.length)html+=txt(center(boxes.shaft),'S',.65);
  return html+'</g>';
}
