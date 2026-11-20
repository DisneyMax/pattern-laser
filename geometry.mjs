// Geometry is in millimetres. PDF.js adapter targets the bundled 5.6.x operator format.
export const MM = 25.4 / 72;
export const LAYERS = {
  cut: {name:'Outer cuts', color:'#FF0000'},
  holes: {name:'Stitch holes', color:'#FF00FF'},
  hardware: {name:'Fastener / round marks', color:'#7C3AED'},
  inner: {name:'Internal cuts', color:'#FF7F00'},
  score: {name:'Score / fold', color:'#00A6D6'},
  unassigned: {name:'Needs review', color:'#9A7600'},
  reference: {name:'Reference · excluded', color:'#858585'}
};
const ident=()=>[1,0,0,1,0,0];
export function multiply(a,b) {return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
const point=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const last=(a)=>a[a.length-1];
const end=(c)=>c.slice(-2);
const fmt=n=>Number(n.toFixed(5)).toString();
export const pathData=cmds=>cmds.map(c=>c[0]+c.slice(1).map(fmt).join(' ')).join(' ');
export function samples(cmds, steps=24) {
 const out=[];let p=[0,0],start=p;
 for(const c of cmds){
  if(c[0]==='M'){p=end(c);start=p;out.push(p);}
  else if(c[0]==='L'){p=end(c);out.push(p);}
  else if(c[0]==='Z'){p=start;out.push(p);}
  else {
   const a=p;
   for(let i=1;i<=steps;i++){const t=i/steps,u=1-t;
    out.push(c[0]==='C'?[u*u*u*a[0]+3*u*u*t*c[1]+3*u*t*t*c[3]+t*t*t*c[5],u*u*u*a[1]+3*u*u*t*c[2]+3*u*t*t*c[4]+t*t*t*c[6]]:[u*u*a[0]+2*u*t*c[1]+t*t*c[3],u*u*a[1]+2*u*t*c[2]+t*t*c[4]]);
   }p=end(c);
  }
 }return out;
}
export function bounds(cmds) {
 // Include exact Bezier extrema, not control-point bounds or sampled approximations.
 let p=[0,0],start=p;const pts=[];
 for(const c of cmds){
  if(c[0]==='M'){p=end(c);start=p;pts.push(p);continue;}
  if(c[0]==='Z'){p=start;pts.push(p);continue;}
  if(c[0]==='C'||c[0]==='Q'){
   const evalAt=t=>{const u=1-t;return c[0]==='C'?[u**3*p[0]+3*u*u*t*c[1]+3*u*t*t*c[3]+t**3*c[5],u**3*p[1]+3*u*u*t*c[2]+3*u*t*t*c[4]+t**3*c[6]]:[u*u*p[0]+2*u*t*c[1]+t*t*c[3],u*u*p[1]+2*u*t*c[2]+t*t*c[4]];};
   for(let k=0;k<2;k++){
    let roots=[];
    if(c[0]==='C'){
     const a=-p[k]+3*c[1+k]-3*c[3+k]+c[5+k], b=2*(p[k]-2*c[1+k]+c[3+k]), cc=c[1+k]-p[k];
     if(Math.abs(a)<1e-12){if(Math.abs(b)>1e-12)roots=[-cc/b];}
     else {const d=b*b-4*a*cc;if(d>=0)roots=[(-b+Math.sqrt(d))/(2*a),(-b-Math.sqrt(d))/(2*a)];}
    }else{const den=p[k]-2*c[1+k]+c[3+k];if(Math.abs(den)>1e-12)roots=[(p[k]-c[1+k])/den];}
    for(const t of roots)if(t>0&&t<1)pts.push(evalAt(t));
   }
  }
  p=end(c);pts.push(p);
 }
 if(!pts.length)return {x:0,y:0,w:0,h:0};
 const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const x=Math.min(...xs),y=Math.min(...ys);
 return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};
}
export function refresh(o){o.bbox=bounds(o.cmds);o.closed=last(o.cmds)?.[0]==='Z'||(o.cmds.length>1&&dist(end(o.cmds[0]),end(last(o.cmds)))<0.002);return o;}
export function circleInfo(o,{minDiameter=0.25,maxDiameter=3}={}){
 const b=o.bbox,diam=(b.w+b.h)/2;
 if(!o.closed||diam<minDiameter||diam>maxDiameter||Math.abs(b.w-b.h)>diam*0.1)return null;
 const cx=b.x+b.w/2,cy=b.y+b.h/2,r=diam/2;
 if(samples(o.cmds).some(p=>Math.abs(Math.hypot(p[0]-cx,p[1]-cy)-r)>r*0.07))return null;
 return {cx,cy,r};
}
export function extract(opList, viewport, OPS) {
 const objects=[],warnings=new Set();const stack=[];
 let state={matrix:ident(),stroke:'#000000',fill:'#000000',strokeAlpha:1,fillAlpha:1,groupOpacity:1,width:1,dash:[],clips:[]};
 const clone=()=>({...state,matrix:[...state.matrix],dash:[...state.dash],clips:[...state.clips]});
 let pendingClip=false,rectangularClips=0,containedPaths=0;
 const save=()=>stack.push(clone()),restore=()=>{if(stack.length)state=stack.pop();else warnings.add('Unbalanced PDF graphics state.');};
 const mapping=()=>multiply(viewport.transform.map(v=>v*MM),state.matrix);
 const paintName=Object.fromEntries(Object.entries(OPS).map(([k,v])=>[v,k]));
 // A rectangular clip changes no centreline geometry wholly contained within it.
 // Non-rectangular clips and paths crossing a rectangular edge still need review.
 function rectangleClip(cmds){
  if(cmds.some(c=>!['M','L','Z'].includes(c[0]))||cmds.filter(c=>c[0]==='M').length!==1)return null;
  let pts=cmds.filter(c=>c[0]!=='Z').map(end);
  if(pts.length>1&&dist(pts[0],last(pts))<1e-6)pts=pts.slice(0,-1);
  if(pts.length!==4)return null;
  const b=bounds(cmds);if(b.w<1e-8||b.h<1e-8)return null;
  const eps=1e-5;
  if(pts.some((p,i)=>{const q=pts[(i+1)%4];return Math.abs(p[0]-q[0])>eps&&Math.abs(p[1]-q[1])>eps;}))return null;
  const corners=new Set(pts.map(p=>(Math.abs(p[0]-b.x)<eps?'L':'R')+(Math.abs(p[1]-b.y)<eps?'T':'B')));
  return corners.size===4?b:null;
 }
 function addClip(cmds){const rect=rectangleClip(cmds);state.clips.push(rect);if(rect)rectangularClips++;}
 function addBoxClip(bbox,m){const p0=point(m,bbox[0],bbox[1]),p1=point(m,bbox[2],bbox[1]),p2=point(m,bbox[2],bbox[3]),p3=point(m,bbox[0],bbox[3]);addClip([['M',...p0],['L',...p1],['L',...p2],['L',...p3],['Z']]);}
 function assessClip(b){let affected=false,outside=false;const eps=0.0001; // Float32 operator rounding, in mm.
  for(const clip of state.clips){if(!clip){affected=true;continue;}
   if(b.x+b.w<clip.x-eps||b.x>clip.x+clip.w+eps||b.y+b.h<clip.y-eps||b.y>clip.y+clip.h+eps)outside=true;
   else if(b.x<clip.x-eps||b.y<clip.y-eps||b.x+b.w>clip.x+clip.w+eps||b.y+b.h>clip.y+clip.h+eps)affected=true;
  }
  return {affected,outside};
 }
 function consume(paint,data){
  if(!data){if(pendingClip){state.clips.push(null);pendingClip=false;}return;}
  const name=paintName[paint];
  const stroke=/[sS]troke/.test(name||''),fill=/[fF]ill/.test(name||'');
  const noPaint=['clip','eoClip','endPath'].includes(name);
  if(!stroke&&!fill&&!noPaint){warnings.add('Unsupported path paint operation: '+name);return;}
  const m=mapping(),subpaths=[];let cmds=[];
  function flush(){if(cmds.length>1)subpaths.push(cmds);cmds=[];}
  for(let i=0;i<data.length;){const op=data[i++];
   if(op===0){flush();cmds.push(['M',...point(m,data[i++],data[i++])]);}
   else if(op===1)cmds.push(['L',...point(m,data[i++],data[i++])]);
   else if(op===2)cmds.push(['C',...point(m,data[i++],data[i++]),...point(m,data[i++],data[i++]),...point(m,data[i++],data[i++])]);
   else if(op===3)cmds.push(['Q',...point(m,data[i++],data[i++]),...point(m,data[i++],data[i++])]);
   else if(op===4)cmds.push(['Z']);
   else {warnings.add('Unsupported packed path command: '+op);break;}
  }
  flush();
  if(!noPaint)for(const path of subpaths){
   const b=bounds(path),clip=assessClip(b);
   const o=refresh({id:'p'+objects.length,sourceIds:[],cmds:path,stroke:stroke?state.stroke:null,fill:fill?state.fill:null,alpha:state.groupOpacity*(stroke?(state.stroke==='transparent'?0:state.strokeAlpha):(state.fill==='transparent'?0:state.fillAlpha)),width:state.width*Math.hypot(m[0],m[1]),dash:[...state.dash],clipped:clip.affected,outsideClip:clip.outside,layer:'unassigned',reason:''});
   if(state.clips.length&&!clip.affected&&!clip.outside)containedPaths++;
   o.sourceIds=[o.id];objects.push(o);
  }
  // PDF paints a path before consuming its pending clipping operation.
  if(pendingClip||name==='clip'||name==='eoClip'){addClip(subpaths.flat());pendingClip=false;}
 }

 let images=0,text=0;
 for(let i=0;i<opList.fnArray.length;i++){
  const fn=opList.fnArray[i],a=opList.argsArray[i]||[],name=paintName[fn];
  switch(name){
   case 'save':save();break;
   case 'restore':restore();break;
   case 'transform':state.matrix=multiply(state.matrix,a);break;
   case 'paintFormXObjectBegin':save();if(a[0])state.matrix=multiply(state.matrix,Array.from(a[0]));if(a[1])addBoxClip(Array.from(a[1]),mapping());break;
   case 'paintFormXObjectEnd':restore();break;
   case 'beginGroup':save();state.groupOpacity*=state.fillAlpha;state.fillAlpha=state.strokeAlpha=1;/* Group matrix sets buffer/clip bounds; the following form op transforms geometry. */if(a[0]?.bbox)addBoxClip(Array.from(a[0].bbox),a[0].matrix?multiply(mapping(),Array.from(a[0].matrix)):mapping());if(a[0]?.smask)warnings.add('Soft-mask artwork requires manual review.');break;
   case 'endGroup':restore();break;
   case 'setLineWidth':state.width=a[0];break;
   case 'setDash':state.dash=Array.from(a[0]);break;
   case 'setStrokeRGBColor':state.stroke=a[0];break;
   case 'setFillRGBColor':state.fill=a[0];break;
   case 'setStrokeTransparent':state.stroke='transparent';break;
   case 'setFillTransparent':state.fill='transparent';break;
   case 'setGState':for(const [k,v] of a[0]||[]){if(k==='CA')state.strokeAlpha=v;if(k==='ca')state.fillAlpha=v;if(k==='LW')state.width=v;if(k==='D')state.dash=Array.from(v[0]);if(k==='SMask'&&v)warnings.add('Soft-mask artwork requires manual review.');}break;
   case 'constructPath':
    if(typeof a[0]!=='number'||!a[1])throw new Error('Unsupported PDF.js operator format.');
    consume(a[0],a[1][0]);break;
   case 'clip':case 'eoClip':pendingClip=true;break;
   case 'rawFillPath':warnings.add('Unconverted raw fill artwork detected.');break;
   case 'shadingFill':warnings.add('Gradient artwork is not extracted.');break;
   case 'setStrokeColorN':case 'setFillColorN':warnings.add('Pattern colour artwork requires manual review.');break;
   default:
    if(name?.startsWith('paint')&&/Image/.test(name))images++;
    if(['showText','showSpacedText','nextLineShowText','nextLineSetSpacingShowText'].includes(name))text++;
  }
 }
 if(objects.some(o=>o.clipped&&!o.outsideClip))warnings.add('Paths crossing a clip boundary or under non-rectangular clipping require review; they are not trimmed automatically.');
 if(images)warnings.add('Raster images detected: this version extracts vector paths only.');
 if(text)warnings.add('PDF text is visible in the reference but is not converted to cutting geometry.');
 if(!objects.length)warnings.add('No vector paths found. Scanned PDFs need a raster tracing workflow.');
 return {objects,warnings:[...warnings],images,text,clipInfo:{rectangularClips,containedPaths,affectedPaths:objects.filter(o=>o.clipped&&!o.outsideClip).length}};
}
function classify(o){
 if(o.manualLayer){o.layer=o.manualLayer;o.reason='Manually assigned';return o;}
 if(o.autoRole==='dimension'||o.autoRole==='paintDuplicate'){o.layer='reference';o.reason=o.autoRole==='dimension'?'Dimension annotation · paired arrows and witness lines':'Fill duplicates a stroked circle';return o;}
 if(o.autoRole==='stitch'){o.layer='holes';o.reason='Repeated circular stitch marks · original geometry';}
 else if(o.autoRole==='hardware'){o.layer='hardware';o.reason='Isolated circular / fastener mark · verify intended use';}
 else if(o.autoRole==='filledUnknown'){o.layer='unassigned';o.reason='Possible filled pattern feature · assign or exclude';}
 else if(o.outsideClip){o.layer='reference';o.reason='Outside rectangular clipping region';}
 else if(!o.stroke||o.alpha<0.7||whiteInk(o.stroke)){o.layer='reference';o.reason=!o.stroke?'Filled artwork':whiteInk(o.stroke)?'White masking artwork':'Translucent artwork';}
 else if(circleInfo(o,{maxDiameter:10})){o.layer='hardware';o.reason='Circular / fastener mark · original geometry';}
 else if(Math.max(o.bbox.w,o.bbox.h)<0.2){o.layer='reference';o.reason='Tiny fragment';}
 else if(o.dash.length){o.layer='unassigned';o.reason='Dashed path · confirm intended operation';}
 else if(o.closed){o.layer='cut';o.reason='Closed contour';}
 else{o.layer='unassigned';o.reason='Open boundary · review or join';}
 if(o.clipped&&!o.outsideClip&&o.layer!=='reference'){o.layer='unassigned';o.reason='Clip boundary affects path · compare reference';}
 return o;
}
function segments(cmds){const out=[];let p=null,start=null;for(const c of cmds){if(c[0]==='M'){p=end(c);start=p;}else if(c[0]==='Z'){if(dist(p,start)>1e-7)out.push([p,['L',...start]]);p=start;}else{out.push([p,c]);p=end(c);}}return out;}
function reverseSegment(p,c){if(c[0]==='C')return ['C',c[3],c[4],c[1],c[2],...p];if(c[0]==='Q')return ['Q',c[1],c[2],...p];return ['L',...p];}
export function reversePath(cmds){const seg=segments(cmds);if(!seg.length)return cmds;return [['M',...end(last(seg)[1])],...seg.reverse().map(([p,c])=>reverseSegment(p,c))];}
function quant(values){return values.map(v=>typeof v==='number'?Math.round(v/0.001):v).join(',');}
function segmentKey(p,c){const a=quant([...p,...c]),b=quant([...end(c),...reverseSegment(p,c)]);return a<b?a:b;}
function rgb(color){if(typeof color!=='string')return null;let s=color.replace('#','');if(s.length===3)s=s.split('').map(c=>c+c).join('');return /^[0-9a-f]{6}$/i.test(s)?[0,2,4].map(i=>parseInt(s.slice(i,i+2),16)/255):null;}
const whiteInk=color=>{const c=rgb(color);return c&&Math.min(...c)>.94;};
const darkInk=color=>{const c=rgb(color);return c&&(.2126*c[0]+.7152*c[1]+.0722*c[2])<.85;};
function arrowInfo(o){
 if(!o.closed||!o.stroke||o.cmds.some(c=>!['M','L','Z'].includes(c[0])))return null;
 const pts=[];for(const c of o.cmds)if(c[0]!=='Z'){const p=end(c);if(!pts.some(q=>dist(p,q)<.001))pts.push(p);}
 if(pts.length!==3)return null;
 let pair=[0,1],short=Infinity;for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){const d=dist(pts[i],pts[j]);if(d<short){short=d;pair=[i,j];}}
 const mid=[(pts[pair[0]][0]+pts[pair[1]][0])/2,(pts[pair[0]][1]+pts[pair[1]][1])/2],tip=pts[3-pair[0]-pair[1]],len=dist(mid,tip);
 if(short<.15||short>2||len<short*1.8||len>5)return null;
 return {object:o,base:mid,tip,direction:[(tip[0]-mid[0])/len,(tip[1]-mid[1])/len]};
}
function straightInfo(o){const c=o.cmds.filter(c=>c[0]!=='Z');return !o.closed&&c.length===2&&c[0][0]==='M'&&c[1][0]==='L'?{object:o,a:end(c[0]),b:end(c[1])}:null;}
function pointSegmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy;if(!d)return dist(p,a);const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d));return dist(p,[a[0]+t*dx,a[1]+t*dy]);}
function dimensionGroups(objects){
 const arrows=objects.filter(o=>!o.clipped&&!o.outsideClip&&o.alpha>=.7).map(arrowInfo).filter(Boolean),lines=objects.filter(o=>o.stroke&&!o.clipped&&!o.outsideClip&&o.alpha>=.7).map(straightInfo).filter(Boolean),groups=[];
 const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
 for(let i=0;i<arrows.length;i++)for(let j=i+1;j<arrows.length;j++){
  const a=arrows[i],b=arrows[j];if(a.object.stroke!==b.object.stroke||dot(a.direction,b.direction)>-.98)continue;
  const d=dist(a.base,b.base);if(d<2)continue;const u=[(b.base[0]-a.base[0])/d,(b.base[1]-a.base[1])/d];
  if(dot(a.direction,u)>-.98||dot(b.direction,u)<.98)continue;
  const baseline=lines.find(l=>l.object.stroke===a.object.stroke&&((dist(l.a,a.base)<.06&&dist(l.b,b.base)<.06)||(dist(l.b,a.base)<.06&&dist(l.a,b.base)<.06)));
  if(!baseline)continue;
  const extensions=[];
  for(const tip of[a.tip,b.tip]){
   const match=lines.filter(l=>{if(l===baseline||l.object.stroke!==a.object.stroke)return false;const len=dist(l.a,l.b);return len>1&&Math.abs(((l.b[0]-l.a[0])*u[0]+(l.b[1]-l.a[1])*u[1])/len)<.05&&pointSegmentDistance(tip,l.a,l.b)<.06&&Math.min(dist(tip,l.a),dist(tip,l.b))>.25;});
   if(match.length===1)extensions.push(match[0]);
  }
  // Require the paired arrowheads, baseline and both witness lines; colour alone is never sufficient.
  if(extensions.length!==2)continue;
  groups.push([a.object,b.object,baseline.object,...extensions.map(l=>l.object)]);
 }
 for(const group of groups)for(const o of group){o.autoRole='dimension';o.annotationGroup=group.map(x=>x.id);}
 return groups.length;
}
function applyContainment(objects){
 const closed=objects.filter(o=>o.layer==='cut'&&o.closed);
 for(const o of closed){if(o.manualLayer)continue;const b=o.bbox,probe=end(o.cmds[0]);
  if(closed.some(parent=>parent!==o&&parent.bbox.w*parent.bbox.h>b.w*b.h&&inside(probe,samples(parent.cmds)))){o.layer='inner';o.reason='Closed contour inside another boundary · review';}
 }
}
export function classifyPatternFeatures(objects){
 for(const o of objects){delete o.autoRole;delete o.annotationGroup;if(!o.manualLayer)delete o.omissionCandidate;classify(o);}
 dimensionGroups(objects);for(const o of objects)if(o.autoRole==='dimension')classify(o);
 const hosts=objects.filter(o=>o.stroke&&o.alpha>=.7&&!whiteInk(o.stroke)&&!o.clipped&&!o.outsideClip&&o.autoRole!=='dimension'&&o.bbox.w>8&&o.bbox.h>8&&o.cmds.length>=4&&!circleInfo(o,{maxDiameter:10})).map(o=>({o,polygon:o.closed?samples(o.cmds):null}));
 const hostFor=(o,allowOpen=false)=>{const p=[o.bbox.x+o.bbox.w/2,o.bbox.y+o.bbox.h/2];return hosts.filter(h=>h.o!==o&&(h.polygon?(inside(p,h.polygon)||h.polygon.some((q,i)=>pointSegmentDistance(p,q,h.polygon[(i+1)%h.polygon.length])<=Math.min(2,Math.max(o.bbox.w,o.bbox.h)/2))):allowOpen&&p[0]>=h.o.bbox.x&&p[0]<=h.o.bbox.x+h.o.bbox.w&&p[1]>=h.o.bbox.y&&p[1]<=h.o.bbox.y+h.o.bbox.h)).sort((a,b)=>Number(!!b.polygon)-Number(!!a.polygon)||a.o.bbox.w*a.o.bbox.h-b.o.bbox.w*b.o.bbox.h)[0]||null;};
 const rounds=objects.filter(o=>o.alpha>=.7&&!o.clipped&&!o.outsideClip&&o.autoRole!=='dimension'&&(darkInk(o.stroke)||darkInk(o.fill))).map(o=>({o,ci:circleInfo(o,{maxDiameter:10})})).filter(x=>x.ci);
 // A painted fill and outline of the same circle are one mark, not two features.
 for(const a of rounds)if(!a.o.stroke&&!a.o.manualLayer){const same=rounds.find(b=>b.o.stroke&&dist([a.ci.cx,a.ci.cy],[b.ci.cx,b.ci.cy])<.01&&Math.abs(a.ci.r-b.ci.r)<.01);if(same){a.o.autoRole='paintDuplicate';a.duplicate=true;}}
 const candidates=rounds.filter(x=>!x.duplicate).map(x=>({...x,host:hostFor(x.o,!!x.o.stroke)}));
 const eligible=candidates.filter(x=>x.ci.r*2<=3&&(x.o.stroke||x.host));
 const visited=new Set();
 for(const seed of eligible){if(visited.has(seed.o.id))continue;const group=[],queue=[seed];visited.add(seed.o.id);
  while(queue.length){const a=queue.pop();group.push(a);for(const b of eligible){if(visited.has(b.o.id)||a.host?.o.id!==b.host?.o.id)continue;const diam=Math.min(a.ci.r,b.ci.r)*2;if(Math.abs(a.ci.r-b.ci.r)*2>Math.max(.03,diam*.12))continue;if(!a.host&&dist([a.ci.cx,a.ci.cy],[b.ci.cx,b.ci.cy])>Math.max(9,diam*7))continue;visited.add(b.o.id);queue.push(b);}}
  if(group.length<3)continue;
  const supported=group.some(a=>{const centre=[a.ci.cx,a.ci.cy],diam=a.ci.r*2;const ns=group.filter(b=>b!==a&&dist(centre,[b.ci.cx,b.ci.cy])>diam*1.5&&dist(centre,[b.ci.cx,b.ci.cy])<=Math.max(9,diam*7));
   for(let i=0;i<ns.length;i++)for(let j=i+1;j<ns.length;j++){const v=[ns[i].ci.cx-a.ci.cx,ns[i].ci.cy-a.ci.cy],w=[ns[j].ci.cx-a.ci.cx,ns[j].ci.cy-a.ci.cy],dv=Math.hypot(...v),dw=Math.hypot(...w);if(Math.max(dv,dw)/Math.min(dv,dw)<1.3&&(v[0]*w[0]+v[1]*w[1])/(dv*dw)<-.35)return true;}return false;
  });
  if(supported)for(const a of group)if(!a.o.manualLayer)a.o.autoRole='stitch';
 }
 for(const a of candidates){if(a.o.manualLayer)continue;if(a.o.autoRole==='stitch'){if(!a.o.stroke)a.o.omissionCandidate=true;continue;}if(a.o.stroke||a.host){a.o.autoRole='hardware';if(!a.o.stroke)a.o.omissionCandidate=true;}}
 for(const o of objects){if(o.manualLayer||o.autoRole||o.stroke||!darkInk(o.fill)||o.alpha<.7||o.outsideClip)continue;const host=hostFor(o);if(host&&o.bbox.w*o.bbox.h<host.o.bbox.w*host.o.bbox.h*.15){o.autoRole='filledUnknown';o.omissionCandidate=true;}}
 for(const o of objects)classify(o);
 applyContainment(objects);
 return objects;
}
export function auditExport(objects,{layers=['cut','holes','hardware','inner','score']}={}){
 const selected=new Set(layers),summary=Object.keys(LAYERS).filter(k=>!['reference','unassigned'].includes(k)).map(layer=>{const total=objects.filter(o=>o.layer===layer).length;return {layer,name:LAYERS[layer].name,total,included:selected.has(layer)?total:0,excluded:selected.has(layer)?0:total};});
 const unresolved=objects.filter(o=>o.layer==='unassigned').map(o=>o.id),suspectedExclusions=objects.filter(o=>o.omissionCandidate&&o.layer==='reference'&&o.manualLayer!=='reference').map(o=>o.id);
 return {blocked:!!(unresolved.length||suspectedExclusions.length),unresolved,suspectedExclusions,summary,annotationsExcluded:objects.filter(o=>o.autoRole==='dimension'&&o.layer==='reference').length,confirmedPatternExclusions:objects.filter(o=>o.omissionCandidate&&o.manualLayer==='reference').length};
}

export function prepare(raw,{dedupe=true,join=true,tolerance=0.03}={}){
 tolerance=Math.max(0,Math.min(0.2,Number(tolerance)||0));
 let objects=classifyPatternFeatures(raw.map(o=>refresh(structuredClone(o))));
 const stats={inputPaths:objects.length,duplicateSegments:0,duplicatePaths:0,joins:0,maxGap:0};
 if(dedupe){
  const seen=new Set(),previous=[],clean=[];
  // Prefer intact closed contours when another drawing repeats only part of them.
  objects.sort((a,b)=>Number(b.closed)-Number(a.closed));
  for(const o of objects){
   if(o.layer==='reference'){clean.push(o);continue;}
   const segs=segments(o.cmds),runs=[];let run=[],removed=0;
   for(const [p,c]of segs){
    const key=segmentKey(p,c),rev=[...end(c),...reverseSegment(p,c)],direct=[...p,...c];
    const near=(a,b)=>a.length===b.length&&a.every((v,i)=>typeof v==='number'?Math.abs(v-b[i])<=0.001:v===b[i]);
    let parts=[[p,c]];
    if(seen.has(key)||previous.some(s=>near(s,direct)||near(s,rev)))parts=[];
    else if(c[0]==='L'){
     // Subtract collinear overlapping line intervals; retain uncovered portions.
     const q=end(c),dx=q[0]-p[0],dy=q[1]-p[1],len=Math.hypot(dx,dy);
     if(len>1e-8){
      let ranges=[[0,1]];
      for(const prev of previous){if(prev[2]!=='L')continue;
       const a=prev.slice(0,2),b=prev.slice(-2);
       if(Math.abs((a[0]-p[0])*dy-(a[1]-p[1])*dx)/len>0.001||Math.abs((b[0]-p[0])*dy-(b[1]-p[1])*dx)/len>0.001)continue;
       const ta=((a[0]-p[0])*dx+(a[1]-p[1])*dy)/(len*len),tb=((b[0]-p[0])*dx+(b[1]-p[1])*dy)/(len*len),lo=Math.min(ta,tb),hi=Math.max(ta,tb);
       ranges=ranges.flatMap(([l,h])=>hi<=l||lo>=h?[[l,h]]:[[l,Math.min(h,lo)],[Math.max(l,hi),h]].filter(([x,y])=>(y-x)*len>0.001));
      }
      parts=ranges.map(([l,h])=>[[p[0]+dx*l,p[1]+dy*l],['L',p[0]+dx*h,p[1]+dy*h]]);
     }
    }
    const changed=parts.length!==1||dist(parts[0][0],p)>0.001||dist(end(parts[0][1]),end(c))>0.001;
    if(changed){removed++;if(run.length>1)runs.push(run);run=[];}
    seen.add(key);
    for(const [pp,cc]of parts){
     previous.push([...pp,...cc]);
     if(run.length&&dist(end(last(run)),pp)>0.001){if(run.length>1)runs.push(run);run=[];}
     if(!run.length)run=[['M',...pp]];run.push(cc);
    }
   }
   if(run.length>1)runs.push(run);
   stats.duplicateSegments+=removed;
   if(!runs.length){stats.duplicatePaths++;continue;}
   if(!removed){clean.push(o);continue;}
   for(let i=0;i<runs.length;i++)clean.push(classify(refresh({...o,id:o.id+'r'+i,cmds:runs[i]})));
  }objects=clean;
 }
 if(join){
  const candidates=objects.filter(o=>o.layer==='unassigned'&&!o.dash.length&&!o.clipped&&o.stroke&&o.alpha>=0.7),removed=new Set();
  const ends=o=>[end(o.cmds[0]),end(last(o.cmds))];
  for(const a of candidates){
   if(removed.has(a.id))continue;
   let again=true;
   while(again&&!a.closed){again=false;const [a0,a1]=ends(a);
    if(dist(a0,a1)<=tolerance&&a.cmds.length>2){const gap=dist(a0,a1);a.cmds.push(['Z']);refresh(a);stats.joins++;stats.maxGap=Math.max(stats.maxGap,gap);break;}
    for(let side=0;side<2;side++){
     const ep=side?a1:a0;
     const matches=[];
     for(const b of candidates){if(b===a||removed.has(b.id)||b.closed||b.stroke!==a.stroke||Math.abs(b.width-a.width)>0.005)continue;
      const be=ends(b);for(let bs=0;bs<2;bs++)if(dist(ep,be[bs])<=tolerance)matches.push({b,bs,gap:dist(ep,be[bs])});
     }
     if(matches.length!==1)continue;
     const {b,bs,gap}=matches[0],bp=ends(b)[bs];
     // Do not join through a branch, even if this endpoint sees one candidate.
     let reciprocal=0;
     for(const c of candidates){if(c===b||removed.has(c.id)||c.closed||c.stroke!==b.stroke||Math.abs(c.width-b.width)>0.005)continue;for(const cp of ends(c))if(dist(cp,bp)<=tolerance)reciprocal++;}
     if(reciprocal!==1)continue;
     let ac=side?a.cmds:reversePath(a.cmds),bc=bs===0?b.cmds:reversePath(b.cmds);
     if(gap>1e-7)ac=[...ac,['L',...end(bc[0])]];
     a.cmds=[...ac,...bc.slice(1)];a.sourceIds.push(...b.sourceIds);removed.add(b.id);refresh(a);stats.joins++;stats.maxGap=Math.max(stats.maxGap,gap);again=true;break;
    }
   }
  }
  objects=objects.filter(o=>!removed.has(o.id)).map(classify);
 }
 classifyPatternFeatures(objects);
 applyContainment(objects);
 for(const o of objects)if(o.closed&&last(o.cmds)[0]!=='Z')o.cmds.push(['Z']);
 return {objects,stats};
}
function inside(p,polygon){let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
export function findPieces(objects){
 const outlines=objects.filter(o=>o.layer==='cut'&&o.closed);
 return outlines.map((outer,i)=>({name:'Piece '+(i+1),outerId:outer.id,objects:objects.filter(o=>o.id===outer.id||(!['cut','reference','unassigned'].includes(o.layer)&&inside([o.bbox.x+o.bbox.w/2,o.bbox.y+o.bbox.h/2],samples(outer.cmds))))}));
}
export function selectedBounds(objects){const bs=objects.map(o=>o.bbox);if(!bs.length)return {x:0,y:0,w:0,h:0};const x=Math.min(...bs.map(b=>b.x)),y=Math.min(...bs.map(b=>b.y));return {x,y,w:Math.max(...bs.map(b=>b.x+b.w))-x,h:Math.max(...bs.map(b=>b.y+b.h))-y};}
export function exportSVG(objects,{width,height,scale=1,holeDiameter=null,crop=false,title='Leather pattern',layers=['cut','holes','hardware','inner','score']}={}){
 if(!Number.isFinite(scale)||scale<=0)throw new Error('Scale must be greater than zero.');
 const chosen=objects.filter(o=>layers.includes(o.layer));if(!chosen.length)throw new Error('No exportable geometry.');
 const extentObjects=chosen.map(o=>{const ci=o.layer==='holes'&&holeDiameter?circleInfo(o):null;return ci?{bbox:{x:ci.cx-holeDiameter/(2*scale),y:ci.cy-holeDiameter/(2*scale),w:holeDiameter/scale,h:holeDiameter/scale}}:o;});
 const b=crop?selectedBounds(extentObjects):{x:0,y:0,w:width,h:height};
 const padding=crop?1:0,w=(b.w+padding*2)*scale,h=(b.h+padding*2)*scale;
 const xml=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 let body='';
 for(const layer of layers){const group=chosen.filter(o=>o.layer===layer);if(!group.length)continue;
  body+=`  <g id="${layer}" fill="none" stroke="${LAYERS[layer].color}" stroke-width="0.05">\n`;
  for(const o of group){const ci=layer==='holes'&&holeDiameter?circleInfo(o):null;
   if(ci)body+=`    <circle id="${o.id}" cx="${fmt((ci.cx-b.x+padding)*scale)}" cy="${fmt((ci.cy-b.y+padding)*scale)}" r="${fmt(holeDiameter/2)}"/>\n`;
   else {const cmds=o.cmds.map(c=>[c[0],...c.slice(1).map((v,i)=>(v-(i%2?b.y:b.x)+padding)*scale)]);body+=`    <path id="${o.id}" d="${pathData(cmds)}"/>\n`;}
  }body+='  </g>\n';
 }
 return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(w)}mm" height="${fmt(h)}mm" viewBox="0 0 ${fmt(w)} ${fmt(h)}">\n<title>${xml(title)}</title>\n<desc>Dimensions in millimetres. Assign processing operations and verify scale in xTool Studio. Stroke colours identify roles.</desc>\n${body}</svg>`;
}
export function calibrationSVG(){return `<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="110mm" height="30mm" viewBox="0 0 110 30"><title>100 mm calibration rectangle</title><path d="M5 5H105V25H5Z" fill="none" stroke="#FF0000" stroke-width="0.05"/></svg>`;}
