import {prepare,refresh,samples,selectedBounds,LAYERS} from './geometry.mjs';

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
 const relation=gap>tolerance?'exceeds':'is within';
 return `Endpoint gap ${gap.toFixed(3)} mm ${relation} the ${Number(tolerance).toFixed(3)} mm join tolerance (source units). `+boundaryRepairExplanation(objects,o.id,{tolerance});
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
// Diagnostics use source millimetres and never change geometry or global tolerance.
const reviewLimit=.2;
const reviewStyle=o=>JSON.stringify([o.stroke,o.fill??null,o.width,o.alpha,o.sourceType||'vector']);
const reviewPointSegment=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;return reviewGap(p,[a[0]+t*dx,a[1]+t*dy]);};
function reviewTopology(objects){
 const open=objects.filter(o=>!o.closed&&o.layer!=='reference'&&o.cmds.length>1);
 if(open.length>500)throw new Error('More than 500 open paths. Inspect a smaller page or use manual selection.');
 if(open.reduce((n,o)=>n+o.cmds.reduce((m,c)=>m+(['C','Q'].includes(c[0])?24:1),0),0)>20000)throw new Error('Open boundaries are too complex for this scan. Use manual selection.');
 const records=open.map(o=>({o,ends:reviewEnds(o),points:samples(o.cmds),neighbors:[[],[]]}));
 if(records.reduce((n,r)=>n+r.points.length,0)>20000)throw new Error('Open boundaries are too complex for this scan. Use manual selection.');
 const graph=new Map(records.map(r=>[r.o.id,new Set()])),gaps=[],interior=[];
 const connect=(a,b)=>{graph.get(a.o.id).add(b.o.id);graph.get(b.o.id).add(a.o.id);};
 const touches=(p,r)=>reviewGap(p,r.ends[0])>reviewLimit&&reviewGap(p,r.ends[1])>reviewLimit&&r.points.some((a,i)=>i&&reviewPointSegment(p,r.points[i-1],a)<=reviewLimit);
 for(let i=0;i<records.length;i++){
  const a=records[i];if(reviewGap(...a.ends)<=reviewLimit){a.neighbors[0].push({id:a.o.id,side:1});a.neighbors[1].push({id:a.o.id,side:0});gaps.push({ids:[a.o.id],a:a.ends[0],b:a.ends[1],distance:reviewGap(...a.ends)});}
  for(let j=0;j<i;j++){
   const b=records[j],ab=a.o.bbox,bb=b.o.bbox;
   if(ab.x>bb.x+bb.w+reviewLimit||bb.x>ab.x+ab.w+reviewLimit||ab.y>bb.y+bb.h+reviewLimit||bb.y>ab.y+ab.h+reviewLimit)continue;
   for(let ai=0;ai<2;ai++)for(let bi=0;bi<2;bi++){const distance=reviewGap(a.ends[ai],b.ends[bi]);if(distance<=reviewLimit){connect(a,b);a.neighbors[ai].push({id:b.o.id,side:bi});b.neighbors[bi].push({id:a.o.id,side:ai});gaps.push({ids:[a.o.id,b.o.id],a:a.ends[ai],b:b.ends[bi],distance});}}
   for(const [from,to]of [[a,b],[b,a]])for(const point of from.ends)if(touches(point,to)){connect(a,b);interior.push({point,ids:[from.o.id,to.o.id]});}
  }
 }
 const visited=new Set(),components=[];
 for(const record of records){if(visited.has(record.o.id))continue;const ids=[],todo=[record.o.id];while(todo.length){const id=todo.pop();if(visited.has(id))continue;visited.add(id);ids.push(id);todo.push(...graph.get(id));}components.push(ids.sort());}
 return {records,gaps,interior,components};
}
function reviewComponent(topology,ids){
 const set=new Set(ids),records=topology.records.filter(r=>set.has(r.o.id)),branches=[],freeEnds=[];
 const addBranch=(point,memberIds)=>{const nearby=branches.find(b=>reviewGap(b.point,point)<=reviewLimit);if(nearby)nearby.ids=[...new Set([...nearby.ids,...memberIds])];else branches.push({point,ids:[...new Set(memberIds)]});};
 for(const r of records)for(let side=0;side<2;side++){const n=r.neighbors[side];if(!n.length&&!topology.interior.some(c=>c.ids[0]===r.o.id&&reviewGap(c.point,r.ends[side])<1e-9))freeEnds.push({point:r.ends[side],id:r.o.id});if(n.length>1)addBranch(r.ends[side],[r.o.id,...n.map(n=>n.id)]);}
 for(const contact of topology.interior)if(contact.ids.some(id=>set.has(id)))addBranch(contact.point,contact.ids);
 return {ids,records,branches,freeEnds,gaps:topology.gaps.filter(g=>g.ids.every(id=>set.has(id))&&g.distance>1e-9),bbox:selectedBounds(records.map(r=>r.o))};
}
function reviewAttempt(objects,id,{tolerance=.03}={},topology=null){
 const target=objects.find(o=>o.id===id),fail=reason=>({preview:null,reason});
 if(!target||target.closed)return fail('Choose an open boundary; closed features need operation assignment.');
 topology=topology||reviewTopology(objects);
 const ids=topology.components.find(ids=>ids.includes(id));if(!ids)return fail('Reference geometry is excluded from boundary repair.');
 const part=reviewComponent(topology,ids),chosen=part.records.map(r=>r.o);
 if(chosen.some(o=>o.cmds.filter(c=>c[0]==='M').length!==1))return fail('Multiple subpaths share an object. Split and inspect them before repairing.');
 if(chosen.some(o=>o.clipped||o.outsideClip||o.dash?.length||!o.stroke||o.alpha<.7))return fail('Clipped, dashed, faint or unsupported paths meet this boundary. Compare the PDF and edit manually.');
 if(chosen.some(o=>!reviewEligible(o)))return fail('Assigned open paths meet this boundary. Their operations are protected; inspect the junction and edit manually.');
 if(part.branches.length)return fail(`${part.branches.length} branching junction${part.branches.length===1?'':'s'}: competing continuations or an endpoint meeting a path interior. Inspect the connected paths; select only intended segments or explicitly exclude construction spurs before rescanning.`);
 if(new Set(chosen.map(reviewStyle)).size>1)return fail('Source styles or vector/raster origins differ. Joining would discard style information; edit manually.');
 if(part.freeEnds.length){const distances=part.freeEnds.flatMap((a,i)=>part.freeEnds.slice(i+1).map(b=>reviewGap(a.point,b.point))),nearest=Math.min(...distances);return fail(`${part.freeEnds.length} free endpoints remain${Number.isFinite(nearest)?`; nearest free-end gap ${nearest.toFixed(3)} mm`:''}. No closed contour is available within the 0.200 mm repair limit. Inspect or assign an open operation manually.`);}
 let result,gap,kind,joins=1;
 if(chosen.length===1){gap=reviewGap(...reviewEnds(target));if(gap>reviewLimit||target.cmds.length<3||reviewArea(target)<1e-5)return fail('This path has no usable enclosed area. A short stroke cannot be closed into a cutting contour.');result=refresh({...structuredClone(target),cmds:[...structuredClone(target.cmds),['Z']]});kind='close';}
 else{const joined=prepare(chosen,{dedupe:false,join:true,tolerance:reviewLimit});if(joined.objects.length!==1||!joined.objects[0].closed||reviewArea(joined.objects[0])<1e-5)return fail('These paths do not produce one closed contour with usable area. Inspect their endpoints and source geometry manually.');result=joined.objects[0];gap=joined.stats.maxGap;joins=joined.stats.joins;kind='join';}
 const beforeBounds=part.bbox,afterBounds=result.bbox;
 if(['x','y','w','h'].some(k=>Math.abs(beforeBounds[k]-afterBounds[k])>1e-6))return fail('The proposed contour changes source bounds. Inspect and repair it manually.');
 reviewAssignResult(result,objects.filter(o=>!ids.includes(o.id)));
 const summary=kind==='close'?`Close a ${gap.toFixed(3)} mm endpoint gap.`:`Join ${chosen.length} paths into one closed contour; largest bridged gap ${gap.toFixed(3)} mm.`;
 const preview={targetId:id,beforeKey:reviewStateKey(objects),ids:[...ids],objects:[result],kind,gap,joins,tolerance:Number(tolerance),beforeBounds:{...beforeBounds},afterBounds:{...afterBounds},summary:`${summary} Assign as ${result.layer==='inner'?'Internal cuts':'Outer cuts'}. Source bounds ${beforeBounds.w.toFixed(3)} × ${beforeBounds.h.toFixed(3)} mm stay unchanged. Global join tolerance stays ${Number(tolerance).toFixed(3)} mm. Other assignments are unchanged.`};
 return {preview,reason:`Eligible for ${kind==='close'?'closing one small gap':'joining into one closed contour'}. Preview the result before applying.`};
}
export function findBoundaryIssues(objects,options={}){
 if(!objects.some(o=>!o.closed&&o.layer==='unassigned'&&o.cmds.length>1))return {sourceKey:reviewStateKey(objects),components:[],limit:reviewLimit};
 const topology=reviewTopology(objects),components=topology.components.filter(ids=>ids.some(id=>objects.find(o=>o.id===id)?.layer==='unassigned')).map(ids=>{const part=reviewComponent(topology,ids),assessment=reviewAttempt(objects,ids[0],options,topology);return {id:'boundary:'+ids[0],ids:[...ids],targetId:ids[0],bbox:{...part.bbox},gaps:part.gaps,branches:part.branches,freeEnds:part.freeEnds,repairable:!!assessment.preview,reason:assessment.reason};}).sort((a,b)=>a.bbox.y-b.bbox.y||a.bbox.x-b.bbox.x);
 return {sourceKey:reviewStateKey(objects),components,limit:reviewLimit};
}
export function suggestedRepair(objects,id,options={}){try{return reviewAttempt(objects,id,options).preview;}catch{return null;}}
export function boundaryRepairExplanation(objects,id,options={}){try{return reviewAttempt(objects,id,options).reason;}catch(error){return error.message;}}
export function applySuggestedRepair(objects,preview){
 if(!preview||preview.beforeKey!==reviewStateKey(objects))throw new Error('Geometry changed after this preview. Preview the repair again.');
 const fresh=suggestedRepair(objects,preview.targetId,{tolerance:preview.tolerance??.03});
 if(!fresh||['ids','objects','kind','gap','joins'].some(key=>JSON.stringify(fresh[key])!==JSON.stringify(preview[key])))throw new Error('Repair preview changed. Preview the repair again.');
 const ids=new Set(fresh.ids);return [...objects.filter(o=>!ids.has(o.id)),...structuredClone(fresh.objects)];
}

export function previewJunctionExclusion(objects,scan,{componentId,junctionIndex,pathId,tolerance=.03}={}){
 if(!scan||scan.sourceKey!==reviewStateKey(objects))throw new Error('Boundary geometry changed. Inspect open boundaries again.');
 const current=findBoundaryIssues(objects,{tolerance}),part=current.components.find(c=>c.id===componentId);
 if(!part||!Number.isInteger(junctionIndex)||junctionIndex<0||!part.branches[junctionIndex]?.ids.includes(pathId))throw new Error('Choose a path connected to this junction.');
 const original=objects.find(o=>o.id===pathId);
 if(!original||original.closed||original.layer==='reference')throw new Error('Only a connected open path can be excluded here.');
 const candidate={...structuredClone(original),layer:'reference',manualLayer:'reference',reason:'Construction path explicitly excluded after junction preview'};
 const next=objects.map(o=>o.id===pathId?candidate:o),remainingIds=part.ids.filter(id=>id!==pathId),after=findBoundaryIssues(next,{tolerance}),affected=after.components.filter(c=>c.ids.some(id=>remainingIds.includes(id)));
 return {beforeKey:reviewStateKey(objects),componentId,junctionIndex,pathId,tolerance,ids:[pathId],componentIds:[...part.ids],candidate,afterComponents:affected,summary:`Exclude the entire ${pathId} path (${original.bbox.w.toFixed(3)} × ${original.bbox.h.toFixed(3)} mm source bounds) from SVG export. Operation ${LAYERS[original.layer]?.name||original.layer} → Reference. Geometry is retained.${original.manualLayer?' This replaces its existing manual operation.':''} Other paths and assignments stay unchanged. After exclusion: ${affected.length} affected unresolved boundary components, ${affected.filter(c=>c.repairable).length} with a repair preview. Verify that this path is construction geometry before applying.`};
}
export function applyJunctionExclusion(objects,preview){
 if(!preview||preview.beforeKey!==reviewStateKey(objects))throw new Error('Geometry changed after exclusion preview. Preview again.');
 const fresh=previewJunctionExclusion(objects,findBoundaryIssues(objects,{tolerance:preview.tolerance}),preview);
 if(JSON.stringify(fresh.candidate)!==JSON.stringify(preview.candidate)||JSON.stringify(fresh.componentIds)!==JSON.stringify(preview.componentIds)||JSON.stringify(fresh.ids)!==JSON.stringify(preview.ids))throw new Error('Exclusion preview changed. Preview again.');
 return objects.map(o=>o.id===fresh.pathId?fresh.candidate:o);
}
