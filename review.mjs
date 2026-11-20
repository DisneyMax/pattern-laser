import {prepare,refresh,samples} from './geometry.mjs';

const reviewEnds=o=>[o.cmds[0].slice(-2),o.cmds.at(-1).slice(-2)];
const reviewGap=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const reviewEligible=o=>o.layer==='unassigned'&&!o.closed&&!o.clipped&&!o.outsideClip&&!o.dash?.length&&o.stroke&&o.alpha>=.7;
export const reviewStateKey=objects=>JSON.stringify(objects);
export function reviewItems(objects,audit){
 const ids=new Set([...audit.unresolved,...audit.suspectedExclusions]);
 return objects.filter(o=>ids.has(o.id));
}
export function reviewExplanation(o,objects,{tolerance=.03}={}){
 if(o.clipped)return 'Clipping affects this path. Compare it with the PDF; automatic repairs are unavailable.';
 if(o.layer==='reference')return 'This excluded path may be a pattern feature. Inspect it, then assign an operation or explicitly confirm Exclude.';
 if(o.closed)return 'This closed feature needs an operation. Compare the overlay and assign its intended role, or exclude it.';
 const [a,b]=reviewEnds(o),gap=reviewGap(a,b);
 const neighbors=objects.filter(p=>p.id!==o.id&&reviewEligible(p));
 const nearby=[a,b].some(endpoint=>neighbors.flatMap(reviewEnds).some(p=>reviewGap(endpoint,p)<=.2));
 const branch=[a,b].some(endpoint=>neighbors.flatMap(reviewEnds).filter(p=>reviewGap(endpoint,p)<=.2).length>1);
 const relation=gap>tolerance?'exceeds':'is within';
 return `Endpoint gap ${gap.toFixed(3)} mm ${relation} the ${Number(tolerance).toFixed(3)} mm join tolerance (source units). `+(branch?'Several endpoints meet nearby; inspect the branching paths manually.':gap<=.2?'Preview a suggested repair before applying it.':nearby?'Nearby open endpoints may form a closed contour. Preview a proposed join before applying it.':'The gap is too large for automatic closing. Inspect neighboring segments or assign an open operation.');
}
function reviewArea(o){
 const points=samples(o.cmds);let sum=0;
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];sum+=a[0]*b[1]-b[0]*a[1];}
 return Math.abs(sum)/2;
}
function reviewInside(point,polygon){
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];
  if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
function reviewAssignResult(result,others){
 const vertices=samples(result.cmds);
 const contained=others.some(o=>o.closed&&o.layer==='cut'&&vertices.every(p=>reviewInside(p,samples(o.cmds))));
 result.layer=result.manualLayer=contained?'inner':'cut';
 result.reason='Repair preview explicitly applied';
 return result;
}
export function suggestedRepair(objects,id,{tolerance=.03}={}){
 const target=objects.find(o=>o.id===id);
 if(!target||!reviewEligible(target))return null;
 const eligible=objects.filter(reviewEligible);
 if(eligible.length>500)return null;
 // A fixed, bounded suggestion limit never alters the global cleanup tolerance.
 const limit=.2,component=new Set([id]),todo=[target];
 while(todo.length){
  const current=todo.pop();
  for(const other of eligible){
   if(component.has(other.id))continue;
   if(reviewEnds(current).some(a=>reviewEnds(other).some(b=>reviewGap(a,b)<=limit))){component.add(other.id);todo.push(other);}
  }
 }
 const chosen=objects.filter(o=>component.has(o.id));
 // Assigned guides and unsupported open paths must not be silently joined through.
 if(objects.some(o=>!component.has(o.id)&&!o.closed&&o.layer!=='reference'&&chosen.some(p=>reviewEnds(p).some(a=>reviewEnds(o).some(b=>reviewGap(a,b)<=limit)))))return null;
 // Every endpoint must have at most one possible continuation, including closure.
 for(const o of chosen){
  const ends=reviewEnds(o);
  for(let side=0;side<2;side++){
   let count=reviewGap(ends[side],ends[1-side])<=limit?1:0;
   for(const p of chosen)if(p!==o)for(const end of reviewEnds(p))if(reviewGap(ends[side],end)<=limit)count++;
   if(count>1)return null;
  }
 }
 let result,gap,kind,joins=1;
 if(chosen.length===1){
  const ends=reviewEnds(target);gap=reviewGap(...ends);
  if(gap>limit||target.cmds.length<3||reviewArea(target)<1e-5)return null;
  result=refresh({...structuredClone(target),cmds:[...structuredClone(target.cmds),['Z']]});kind='close';
 }else{
  const joined=prepare(chosen,{dedupe:false,join:true,tolerance:limit});
  if(joined.objects.length!==1||!joined.objects[0].closed||reviewArea(joined.objects[0])<1e-5)return null;
  result=joined.objects[0];gap=joined.stats.maxGap;joins=joined.stats.joins;kind='join';
 }
 reviewAssignResult(result,objects.filter(o=>!component.has(o.id)));
 const summary=kind==='close'?`Close a ${gap.toFixed(3)} mm endpoint gap.`:`Join ${chosen.length} paths into one closed contour; largest bridged gap ${gap.toFixed(3)} mm.`;
 return {targetId:id,beforeKey:reviewStateKey(objects),ids:[...component],objects:[result],kind,gap,joins,summary:`${summary} Assign as ${result.layer==='inner'?'Internal cuts':'Outer cuts'}. Global join tolerance stays ${Number(tolerance).toFixed(3)} mm. Other assignments are unchanged.`};
}
export function applySuggestedRepair(objects,preview){
 if(!preview||preview.beforeKey!==reviewStateKey(objects))throw new Error('Geometry changed after this preview. Preview the repair again.');
 const ids=new Set(preview.ids);
 return [...objects.filter(o=>!ids.has(o.id)),...structuredClone(preview.objects)];
}
