// Browser/worker-safe raster centreline extraction. All tolerances are physical millimetres.
export function rasterTrace(image,{threshold=150,pixelMmX=.0846666667,pixelMmY=pixelMmX,xMm=0,yMm=0,minAreaMm2=.025,pruneMm=1.2,simplifyMm=.08,includePoints=false,includeOpen=false,idPrefix='raster'}={}){
 const {width:w,height:h,data}=image;
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<3||h<3||w*h>20000000||data.length!==w*h*4)throw new Error('Choose a smaller trace area (maximum 20 million pixels).');
 if(![xMm,yMm,minAreaMm2].every(Number.isFinite)||minAreaMm2<0||![pixelMmX,pixelMmY].every(x=>Number.isFinite(x)&&x>0))throw new Error('Invalid raster scale.');
 if(!Number.isFinite(threshold)||threshold<1||threshold>254||!Number.isFinite(simplifyMm)||simplifyMm<0||simplifyMm>.5||!Number.isFinite(pruneMm)||pruneMm<0||pruneMm>5)throw new Error('Invalid raster settings.');
 const pitch=Math.max(pixelMmX,pixelMmY),n=w*h,bin=new Uint8Array(n),seen=new Uint8Array(n),queue=new Int32Array(n),components=[],stats={threshold,pixelPitchMm:pitch,components:0,specklesRemoved:0,prunedPixels:0,closedContours:0,openPaths:0,pointMarks:0,omittedPoints:0,omittedShortLines:0,borderComponents:0,simplifyMm,minAreaMm2,pruneMm};
 for(let i=0;i<n;i++){const j=i*4,a=data[j+3]/255,lum=(.2126*data[j]+.7152*data[j+1]+.0722*data[j+2])*a+255*(1-a);bin[i]=lum<threshold?1:0;}
 const directions=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
 for(let start=0;start<n;start++)if(bin[start]&&!seen[start]){
  let head=0,tail=1,minX=w,minY=h,maxX=0,maxY=0,sumX=0,sumY=0;queue[0]=start;seen[start]=1;
  while(head<tail){const p=queue[head++],x=p%w,y=(p/w)|0;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);sumX+=x;sumY+=y;
   for(const [dx,dy]of directions){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const q=yy*w+xx;if(bin[q]&&!seen[q]){seen[q]=1;queue[tail++]=q;}}
  }
  if(tail*pixelMmX*pixelMmY<minAreaMm2){for(let j=0;j<tail;j++)bin[queue[j]]=0;stats.specklesRemoved++;continue;}
  const component={minX,minY,maxX,maxY,pixels:tail,indices:Int32Array.from(queue.subarray(0,tail)),cx:sumX/tail,cy:sumY/tail};
  component.border=minX===0||minY===0||maxX===w-1||maxY===h-1;if(component.border)stats.borderComponents++;
  components.push(component);
 }
 stats.components=components.length;
 // Compact, isolated round components are printed point marks; keep their source-size estimate separate.
 const points=[];
 for(const c of components){const bw=(c.maxX-c.minX+1)*pixelMmX,bh=(c.maxY-c.minY+1)*pixelMmY,diam=(bw+bh)/2,ratio=bw/bh,fill=c.pixels/((c.maxX-c.minX+1)*(c.maxY-c.minY+1));
  if(!c.border&&diam>=.2&&diam<=3&&ratio>.7&&ratio<1.43&&fill>.4){
   for(const p of c.indices)bin[p]=0;points.push({cx:xMm+(c.cx+.5)*pixelMmX,cy:yMm+(c.cy+.5)*pixelMmY,r:Math.sqrt(c.pixels*pixelMmX*pixelMmY/Math.PI)});
  }
 }
 stats.pointMarks=points.length;
 // Zhang–Suen thinning; operate on one snapshot per subiteration so thick lines become one centreline.
 const removal=[];let changed=true,iterations=0;
 const occupied=()=>{const a=[];for(let i=0;i<n;i++)if(bin[i])a.push(i);return a;};
 let active=occupied();
 while(changed&&iterations++<300){changed=false;
  for(let phase=0;phase<2;phase++){
   removal.length=0;
   for(const p of active){if(!bin[p])continue;const x=p%w,y=(p/w)|0;if(x===0||x===w-1||y===0||y===h-1)continue;
    const a=[bin[p-w],bin[p-w+1],bin[p+1],bin[p+w+1],bin[p+w],bin[p+w-1],bin[p-1],bin[p-w-1]],sum=a.reduce((x,y)=>x+y,0);if(sum<2||sum>6)continue;
    let transitions=0;for(let k=0;k<8;k++)if(!a[k]&&a[(k+1)%8])transitions++;if(transitions!==1)continue;
    if(phase===0?(a[0]*a[2]*a[4]||a[2]*a[4]*a[6]):(a[0]*a[2]*a[6]||a[0]*a[4]*a[6]))continue;
    removal.push(p);
   }
   if(removal.length){changed=true;for(const p of removal)bin[p]=0;}
  }
  if(changed)active=active.filter(p=>bin[p]);
 }
 if(changed)throw new Error('The trace is too dense. Lower the threshold or select a smaller area.');
 function neighbors(p){const out=[],x=p%w,y=(p/w)|0;for(const [dx,dy]of directions){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const q=yy*w+xx;if(!bin[q])continue;
   // Do not create a diagonal shortcut through an existing orthogonal corner.
   if(dx&&dy&&(bin[y*w+xx]||bin[yy*w+x]))continue;out.push(q);
  }return out;}
 // Remove short dangling branches, not complete short components such as printed dashes.
 for(let iteration=0;iteration<8&&pruneMm>0;iteration++){const gone=new Set();for(const p of active){if(!bin[p]||neighbors(p).length!==1)continue;const chain=[p];let prev=-1,current=p,length=0;
   while(true){const ns=neighbors(current).filter(q=>q!==prev);if(ns.length!==1)break;const next=ns[0];length+=Math.hypot((next%w-current%w)*pixelMmX,(((next/w)|0)-((current/w)|0))*pixelMmY);if(length>pruneMm)break;
    const degree=neighbors(next).length;if(degree>2){for(const q of chain)gone.add(q);break;}if(degree===1)break;chain.push(next);prev=current;current=next;
   }
  }if(!gone.size)break;for(const p of gone)bin[p]=0;stats.prunedPixels+=gone.size;active=active.filter(p=>bin[p]);}
 const edgeSeen=new Set(),paths=[];
 const edge=(a,b)=>a<b?a*n+b:b*n+a;
 function walk(start,next){const path=[start];let prev=start,current=next;edgeSeen.add(edge(start,next));
  for(let guard=0;guard<=active.length+1;guard++){path.push(current);if(current===start)break;const ns=neighbors(current);if(ns.length!==2)break;const q=ns[0]===prev?ns[1]:ns[0];if(edgeSeen.has(edge(current,q)))break;edgeSeen.add(edge(current,q));prev=current;current=q;}
  return path;
 }
 for(const p of active)if(neighbors(p).length!==2)for(const q of neighbors(p))if(!edgeSeen.has(edge(p,q)))paths.push(walk(p,q));
 for(const p of active)for(const q of neighbors(p))if(!edgeSeen.has(edge(p,q)))paths.push(walk(p,q));
 const xy=p=>[xMm+(p%w+.5)*pixelMmX,yMm+(((p/w)|0)+.5)*pixelMmY];
 function simplify(points,tolerance){if(points.length<=2)return points;const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;const stack=[[0,points.length-1]],limit=tolerance*tolerance;
  while(stack.length){const [start,end]=stack.pop();let maximum=limit,index=-1;const a=points[start],b=points[end],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
   for(let i=start+1;i<end;i++){const p=points[i],t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0,d=(p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;if(d>maximum){maximum=d;index=i;}}
   if(index>=0){keep[index]=1;stack.push([start,index],[index,end]);}
  }return points.filter((_,i)=>keep[i]);
 }
 const objects=[];
 function object(cmds,kind){const id=idPrefix+'_'+objects.length;objects.push({id,sourceIds:[id],cmds,stroke:'#000000',fill:null,alpha:1,width:.1,dash:[],clipped:false,sourceType:'raster',rasterKind:kind,layer:'unassigned',reason:'Raster-derived geometry · review overlay and scale'});}
 for(const pixels of paths){if(pixels.length<2)continue;const closed=pixels[0]===pixels[pixels.length-1],pts=pixels.map(xy);let length=0;for(let i=1;i<pts.length;i++)length+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
  if(length<Math.max(.2,pitch*2))continue;
  if(!closed&&!includeOpen&&length<10){stats.omittedShortLines++;continue;}
  if(closed&&length<3&&!includePoints){stats.omittedPoints++;continue;}
  let simple;
  if(closed){const mid=Math.floor((pts.length-1)/2);simple=[...simplify(pts.slice(0,mid+1),simplifyMm),...simplify(pts.slice(mid),simplifyMm).slice(1)];simple.pop();if(simple.length<3)continue;}
  else simple=simplify(pts,simplifyMm);
  const cmds=simple.map((p,i)=>[i?'L':'M',...p]);if(closed){cmds.push(['Z']);stats.closedContours++;}else stats.openPaths++;
  object(cmds,closed?'outline':'open');
 }
 if(includePoints)for(const p of points){const k=p.r*.5522847498;object([['M',p.cx+p.r,p.cy],['C',p.cx+p.r,p.cy+k,p.cx+k,p.cy+p.r,p.cx,p.cy+p.r],['C',p.cx-k,p.cy+p.r,p.cx-p.r,p.cy+k,p.cx-p.r,p.cy],['C',p.cx-p.r,p.cy-k,p.cx-k,p.cy-p.r,p.cx,p.cy-p.r],['C',p.cx+k,p.cy-p.r,p.cx+p.r,p.cy-k,p.cx+p.r,p.cy],['Z']],'point');}
 else stats.omittedPoints+=points.length;
 return {objects,stats};
}
export function rasterAudit(objects,{reviewed=false,layers=['cut','holes','hardware','inner','score'],batches=[]}={}){
 const included=objects.filter(o=>o.sourceType==='raster'&&layers.includes(o.layer)).length;
 return {included,pending:included>0&&!reviewed,omittedPoints:batches.reduce((n,b)=>n+(b.stats.omittedPoints||0),0),omittedShortLines:batches.reduce((n,b)=>n+(b.stats.omittedShortLines||0),0),borderComponents:batches.reduce((n,b)=>n+(b.stats.borderComponents||0),0),batchCount:batches.length};
}
export function rasterTextBoxes(items,viewportTransform){
 const boxes=[],a=viewportTransform,unitScale=Math.hypot(a[0],a[1]);
 for(const item of items){if(!item.str?.trim()||!item.transform||!Number.isFinite(item.width))continue;const b=item.transform,t=[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]],length=Math.hypot(t[0],t[1]),fontHeight=Math.hypot(t[2],t[3]);if(!length||!fontHeight)continue;
  const u=[t[0]/length,t[1]/length],v=[t[2]/fontHeight,t[3]/fontHeight],width=item.width*unitScale,points=[];for(const dx of[0,width])for(const dy of[-fontHeight*.2,fontHeight])points.push([t[4]+u[0]*dx+v[0]*dy,t[5]+u[1]*dx+v[1]*dy]);const x=Math.min(...points.map(p=>p[0]))-1,y=Math.min(...points.map(p=>p[1]))-1;boxes.push({x,y,w:Math.max(...points.map(p=>p[0]))-x+1,h:Math.max(...points.map(p=>p[1]))-y+1});
 }return boxes;
}
