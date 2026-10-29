// WebGL rough-structure drawing. No wall solids: slabs, structural members, vertical cores, stalls only.
export function renderRoughStructure({THREE,mesh,line,label,group},d,options={}){
  const s=d.structure;if(!s)return;
  const floor=options.floor??'all',visible=f=>floor==='all'||String(f.floor)===String(floor)||String(f.id)===String(floor);
  const layers=options.layers||{slabs:true,columns:true,cores:true,parking:true};
  const roof=s.roofLevel,ground=floor==='all'||floor==='0';
  if(layers.slabs!==false){
    for(const slab of s.slabs.filter(visible)){
      const isRoof=slab.kind==='roof';
      mesh(slab.polygon,.22,isRoof?'#a6c1c6':slab.kind==='parking-ground'?'#6e8798':'#8fb7c5',slab.z,.28);
      if(slab.kind!=='parking-ground'&&slab.kind!=='roof'){
        const p=slab.polygon;line([...p,p[0]].map(x=>[x[0],x[1],slab.z+.27]),'#517889',1.5);
      }
    }
  }
  if(layers.columns!==false){
    for(const col of s.columns){
      mesh(col.polygon,roof,'#526b79',.18,.9);
      if(ground)label(col.id,[col.x,col.y,.65]);
    }
    if(layers.slabs!==false)for(const slab of s.slabs.filter(visible)){
      if(slab.floor===0)continue;
      for(const beam of s.beams){
        // Rectangular beam approximation expressed as a line at its actual storey elevation.
        line([[...beam.from,slab.z-.18],[...beam.to,slab.z-.18]],'#355365',2);
      }
    }
  }
  if(layers.cores!==false){
    const c=s.core.components;
    if(c.stair.length){mesh(c.stair,roof,'#517da8',.22,.32);const p=s.core.components.stair;label('پله',[p.reduce((z,a)=>z+a[0],0)/p.length,p.reduce((z,a)=>z+a[1],0)/p.length,roof+.5]);}
    if(c.elevator.length){mesh(c.elevator,roof,'#a68a68',.23,.38);const p=c.elevator;label('آسانسور',[p.reduce((z,a)=>z+a[0],0)/p.length,p.reduce((z,a)=>z+a[1],0)/p.length,roof+1]);}
    if(c.landing.length&&ground)mesh(c.landing,.12,'#a5b9cd',.3,.85);
    for(const shaft of s.shafts)mesh(shaft.polygon,roof,'#967da6',.2,.3);
  }
  if(layers.parking!==false&&ground){
    if(s.parking.aisle.length)mesh(s.parking.aisle,.05,'#b9c3cc',.25,.85);
    if(s.parking.driveway.length)line(s.parking.driveway.map(p=>[p[0],p[1],.46]),'#bf792c',3);
    for(const stall of s.parking.stalls){
      mesh(stall.polygon,.04,'#73bba0',.30,.68);
      const a=stall.polygon,center=a.reduce((v,p)=>[v[0]+p[0]/a.length,v[1]+p[1]/a.length],[0,0]);
      // A low, visually recognizable car proxy, inset within the actual drawn parking bay.
      const xs=a.map(p=>p[0]),ys=a.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
      const dx=maxX-minX,dy=maxY-minY,padX=Math.min(.36,dx*.15),padY=Math.min(.55,dy*.14);
      const car=[[minX+padX,minY+padY],[maxX-padX,minY+padY],[maxX-padX,maxY-padY],[minX+padX,maxY-padY]];
      mesh(car,1.25,'#f2f5f4',.36,.97);
      label(stall.id,[center[0],center[1],1.9]);
    }
  }
  const l=d.assumptions.buildingLine;
  if(l){line([[...l.start,.5],[...l.end,.5]],'#bd3751',3);label('رج بنا',[(l.start[0]+l.end[0])/2,(l.start[1]+l.end[1])/2,.8]);}
}
