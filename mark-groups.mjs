import {circleInfo,samples} from './geometry.mjs';

const markDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const markMedian=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;};
const markInside=(point,polygon)=>{
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];
  if((a[1]>point.y)!==(b[1]>point.y)&&point.x<(b[0]-a[0])*(point.y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
};
const markCandidate=o=>['holes','hardware','unassigned'].includes(o.layer)&&o.closed&&!o.clipped&&!o.outsideClip&&!o.dash?.length&&o.alpha>=.7;
export const markGroupStateKey=objects=>JSON.stringify(objects);
// Positions are detection-only clusters. All source paths remain editable/protected individually.
function markPositions(marks){
 const positions=[];
 for(const mark of [...marks].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)){
  const position=positions.find(p=>p.host===mark.host&&p.paths.every(other=>markDistance(mark,other)<=Math.min(.03,Math.min(mark.diameter,other.diameter)*.1)&&Math.abs(mark.diameter-other.diameter)<=Math.max(.005,Math.min(mark.diameter,other.diameter)*.02)));
  if(position)position.paths.push(mark);else positions.push({...mark,paths:[mark]});
 }
 for(const p of positions){p.x=markMedian(p.paths.map(m=>m.x));p.y=markMedian(p.paths.map(m=>m.y));p.diameter=markMedian(p.paths.map(m=>m.diameter));}
 return positions;
}
export const roundMarkGroups=objects=>scanRoundMarks(objects).groups;
export function scanRoundMarks(objects,{scope='rows'}={}){
 if(!['rows','piece'].includes(scope))throw new Error('Choose continuous rows or whole-piece grouping.');
 const hosts=objects.filter(o=>o.layer==='cut'&&o.closed&&!o.clipped&&!o.outsideClip&&o.bbox.w>8&&o.bbox.h>8).map(o=>({id:o.id,area:o.bbox.w*o.bbox.h,polygon:samples(o.cmds)})).sort((a,b)=>a.area-b.area);
 const marks=[],diagnostics={roundPaths:0,outsideBoundaryPaths:0,unsupportedPaths:0,manualPaths:0,overlapPaths:0,ungroupedPositions:0};
 for(const o of objects){
  if(!['holes','hardware','unassigned'].includes(o.layer))continue;
  const circle=circleInfo(o,{maxDiameter:10});if(!markCandidate(o)||!circle){diagnostics.unsupportedPaths++;continue;}
  diagnostics.roundPaths++;
  const mark={id:o.id,x:circle.cx,y:circle.cy,diameter:circle.r*2,manual:!!o.manualLayer,layer:o.layer};
  const host=hosts.find(h=>markInside(mark,h.polygon));if(host)marks.push({...mark,host:host.id});else diagnostics.outsideBoundaryPaths++;
 }
 if(marks.length>1500)throw new Error('Too many round marks to group at once. Use manual box selection to review smaller groups.');
 const positions=markPositions(marks),candidates=new Map();
 diagnostics.manualPaths=marks.filter(m=>m.manual).length;
 diagnostics.overlapPaths=marks.length-positions.length;
 const addCandidate=(members,pitch,shape='straight row')=>{
  const paths=members.flatMap(p=>p.paths),editable=paths.filter(p=>!p.manual);if(members.length<(scope==='piece'?1:3)||!editable.length)return;
  const sizes=paths.map(p=>p.diameter);if(scope==='rows'&&Math.max(...sizes)/Math.min(...sizes)>1.4)return;
  const ids=editable.map(p=>p.id).sort(),key=ids.join('|');if(candidates.has(key))return;
  const diameters=editable.map(p=>p.diameter);
  candidates.set(key,{id:key,ids,scope,hostId:members[0].host,manualCount:paths.length-editable.length,positionCount:members.filter(p=>p.paths.some(m=>!m.manual)).length,totalPositionCount:members.length,overlapCount:paths.length-members.length,diameterMin:Math.min(...diameters),diameterMax:Math.max(...diameters),spacing:pitch,shape,currentLayers:[...new Set(editable.map(p=>p.layer))].sort()});
 };
 for(const host of hosts){
  const row=positions.filter(m=>m.host===host.id);
  if(scope==='piece'){addCandidate(row,null,'whole piece');continue;}
  for(const a of row){
   const neighbors=row.filter(b=>b!==a&&Math.max(a.diameter,b.diameter)/Math.min(a.diameter,b.diameter)<=1.4&&markDistance(a,b)>Math.max(a.diameter,b.diameter)*1.5&&markDistance(a,b)<=20).sort((b,c)=>markDistance(a,b)-markDistance(a,c)).slice(0,8);
   for(const b of neighbors){
    const distance=markDistance(a,b),dx=(b.x-a.x)/distance,dy=(b.y-a.y)/distance,tolerance=Math.max(.15,Math.min(a.diameter,b.diameter)*.35);
    const line=row.filter(p=>Math.max(a.diameter,p.diameter)/Math.min(a.diameter,p.diameter)<=1.4&&Math.abs((p.x-a.x)*dy-(p.y-a.y)*dx)<=tolerance).map(p=>({...p,t:(p.x-a.x)*dx+(p.y-a.y)*dy})).sort((p,q)=>p.t-q.t);
    const chunks=[];let chunk=[];
    for(const point of line){if(chunk.length){const previous=chunk.at(-1),gap=point.t-previous.t;if(gap>20||gap<Math.max(point.diameter,previous.diameter)*1.5){chunks.push(chunk);chunk=[];}}chunk.push(point);}chunks.push(chunk);
    for(const part of chunks){
     if(part.length<3)continue;
     const gaps=part.slice(1).map((p,i)=>p.t-part[i].t),pitch=markMedian(gaps),runs=[];let run=[part[0]];
     for(let i=1;i<part.length;i++){if(Math.abs(gaps[i-1]-pitch)>pitch*.25){runs.push(run);run=[];}run.push(part[i]);}runs.push(run);
     for(const members of runs)addCandidate(members,pitch);
    }
   }
  }
  // Curves require mutually nearest, similarly spaced neighbors and no branch or sharp turn.
  const distances=new Map(row.map(a=>[a,row.filter(b=>b!==a&&Math.max(a.diameter,b.diameter)/Math.min(a.diameter,b.diameter)<=1.4).map(b=>({point:b,gap:markDistance(a,b)})).filter(e=>e.gap>Math.max(a.diameter,e.point.diameter)*1.5&&e.gap<=20)]));
  const nearest=new Map(row.map(a=>[a,Math.min(...distances.get(a).map(e=>e.gap))]));
  const graph=new Map(row.map(a=>[a,distances.get(a).filter(e=>Math.abs(e.gap-nearest.get(a))<=nearest.get(a)*.25&&Math.abs(e.gap-nearest.get(e.point))<=nearest.get(e.point)*.25).map(e=>e.point)]));
  const ambiguous=new Set(row.filter(a=>{const neighbors=graph.get(a);if(neighbors.length>2)return true;if(neighbors.length!==2)return false;const [b,c]=neighbors;return ((b.x-a.x)*(c.x-a.x)+(b.y-a.y)*(c.y-a.y))/(markDistance(a,b)*markDistance(a,c))>-.5;}));
  const visited=new Set();
  for(const start of row){
   if(visited.has(start)||ambiguous.has(start))continue;
   const members=[],pending=[start];while(pending.length){const a=pending.pop();if(visited.has(a)||ambiguous.has(a))continue;visited.add(a);members.push(a);pending.push(...graph.get(a));}
   if(members.length<4)continue;
   const memberSet=new Set(members),gaps=members.flatMap(a=>graph.get(a).filter(b=>memberSet.has(b)).map(b=>markDistance(a,b))),pitch=markMedian(gaps);
   if(gaps.every(gap=>Math.abs(gap-pitch)<=pitch*.25))addCandidate(members,pitch,'continuous row');
  }

 }
 // Prefer longer rows and avoid assigning the same automatic mark to two groups.
 const ordered=[...candidates.values()].sort((a,b)=>b.totalPositionCount-a.totalPositionCount||b.ids.length-a.ids.length||(a.id<b.id?-1:a.id>b.id?1:0)),claimed=new Set(),groups=[],sourceKey=markGroupStateKey(objects);
 for(const group of ordered){if(group.ids.some(id=>claimed.has(id)))continue;for(const id of group.ids)claimed.add(id);groups.push({...group,sourceKey});}
 diagnostics.ungroupedPositions=positions.filter(p=>p.paths.some(m=>!m.manual&&!claimed.has(m.id))).length;
 return {groups,diagnostics};
}
export function previewMarkGroup(objects,group,layer){
 if(!['holes','hardware'].includes(layer))throw new Error('Choose Stitch holes or Fastener / round marks before previewing.');
 if(!group||group.sourceKey!==markGroupStateKey(objects))throw new Error('Pattern changed. Find round-mark groups again.');
 const ids=new Set(group.ids),chosen=objects.filter(o=>ids.has(o.id));
 if(chosen.length!==ids.size||chosen.some(o=>o.manualLayer||!markCandidate(o)||!circleInfo(o,{maxDiameter:10})))throw new Error('Group membership changed. Find round-mark groups again.');
 const result=chosen.map(o=>({...structuredClone(o),layer,manualLayer:layer,reason:`Round-mark group explicitly assigned as ${layer==='holes'?'stitching':'hardware'}; original geometry retained`}));
 return {beforeKey:markGroupStateKey(objects),ids:[...ids],objects:result,layer,manualCount:group.manualCount,summary:`Assign ${chosen.length} paths at ${group.positionCount} positions as ${layer==='holes'?'Stitch holes':'Fastener / round marks'}. Geometry and source sizes stay unchanged. ${group.manualCount} existing manual assignment${group.manualCount===1?' stays':'s stay'} unchanged.${group.scope==='piece'?' Whole-piece scope includes stitching and hardware candidates regardless of spacing or size; verify every highlighted mark.':''}${group.overlapCount?` ${group.overlapCount} overlapping copies are retained; this does not remove repeated laser paths.`:''}`};
}
export function applyMarkGroup(objects,preview){
 if(!preview||preview.beforeKey!==markGroupStateKey(objects))throw new Error('Pattern changed after the preview. Find round-mark groups again.');
 if(!['holes','hardware'].includes(preview.layer))throw new Error('Invalid group operation.');
 const ids=new Set(preview.ids),chosen=objects.filter(o=>ids.has(o.id));
 if(chosen.length!==ids.size||chosen.some(o=>o.manualLayer||!markCandidate(o)))throw new Error('Group membership changed. Find round-mark groups again.');
 // Applying a role can never replace commands, bounds, source sizes or styles.
 return objects.map(o=>ids.has(o.id)?{...structuredClone(o),layer:preview.layer,manualLayer:preview.layer,reason:`Round-mark group explicitly assigned as ${preview.layer==='holes'?'stitching':'hardware'}; original geometry retained`}:o);
}

export function markScanSummary(d){
 return [
  `${d.roundPaths} round paths inspected.`,
  d.outsideBoundaryPaths?`${d.outsideBoundaryPaths} round paths outside recognized closed cut boundaries were excluded; review open boundaries first.`:'',
  d.unsupportedPaths?`${d.unsupportedPaths} non-round, open, clipped, dashed or faint paths were excluded from grouping.`:'',
  d.manualPaths?`${d.manualPaths} manual assignments inside closed boundaries are protected.`:'',
  d.overlapPaths?`${d.overlapPaths} overlapping copies inside closed boundaries share positions for detection. All source paths remain; review duplicate paths separately before cutting.`:'',
  d.ungroupedPositions?`${d.ungroupedPositions} editable positions did not form a supported row because of spacing, size, sharp turns or competing neighbors. Use manual selection to review them.`:''
 ].filter(Boolean).join(' ');
}
