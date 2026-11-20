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
export function roundMarkGroups(objects){
 const hosts=objects.filter(o=>o.layer==='cut'&&o.closed&&!o.clipped&&!o.outsideClip&&o.bbox.w>8&&o.bbox.h>8).map(o=>({id:o.id,area:o.bbox.w*o.bbox.h,polygon:samples(o.cmds)})).sort((a,b)=>a.area-b.area);
 const marks=[];
 for(const o of objects){
  if(!markCandidate(o))continue;
  const circle=circleInfo(o,{maxDiameter:10});if(!circle)continue;
  const mark={id:o.id,x:circle.cx,y:circle.cy,diameter:circle.r*2,manual:!!o.manualLayer,layer:o.layer};
  const host=hosts.find(h=>markInside(mark,h.polygon));if(host)marks.push({...mark,host:host.id});
 }
 if(marks.length>1500)throw new Error('Too many round marks to group at once. Use manual box selection to review smaller groups.');
 const candidates=new Map();
 for(const host of hosts){
  const row=marks.filter(m=>m.host===host.id);
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
     for(const members of runs){
      const editable=members.filter(p=>!p.manual);if(members.length<3||editable.length<1)continue;
      const sizes=members.map(p=>p.diameter);if(Math.max(...sizes)/Math.min(...sizes)>1.4)continue;
      const ids=editable.map(p=>p.id).sort(),key=ids.join('|');
      if(candidates.has(key))continue;
      const diameters=editable.map(p=>p.diameter);
      candidates.set(key,{id:key,ids,hostId:host.id,manualCount:members.length-editable.length,diameterMin:Math.min(...diameters),diameterMax:Math.max(...diameters),spacing:pitch,currentLayers:[...new Set(editable.map(p=>p.layer))].sort()});
     }
    }
   }
  }
 }
 // Prefer longer rows and avoid assigning the same automatic mark to two groups.
 const ordered=[...candidates.values()].sort((a,b)=>b.ids.length-a.ids.length||(a.id<b.id?-1:a.id>b.id?1:0)),claimed=new Set(),groups=[],sourceKey=markGroupStateKey(objects);
 for(const group of ordered){if(group.ids.some(id=>claimed.has(id)))continue;for(const id of group.ids)claimed.add(id);groups.push({...group,sourceKey});}
 return groups;
}
export function previewMarkGroup(objects,group,layer){
 if(!['holes','hardware'].includes(layer))throw new Error('Choose Stitch holes or Fastener / round marks before previewing.');
 if(!group||group.sourceKey!==markGroupStateKey(objects))throw new Error('Pattern changed. Find round-mark groups again.');
 const ids=new Set(group.ids),chosen=objects.filter(o=>ids.has(o.id));
 if(chosen.length!==ids.size||chosen.some(o=>o.manualLayer||!markCandidate(o)||!circleInfo(o,{maxDiameter:10})))throw new Error('Group membership changed. Find round-mark groups again.');
 const result=chosen.map(o=>({...structuredClone(o),layer,manualLayer:layer,reason:`Round-mark group explicitly assigned as ${layer==='holes'?'stitching':'hardware'}; original geometry retained`}));
 return {beforeKey:markGroupStateKey(objects),ids:[...ids],objects:result,layer,manualCount:group.manualCount,summary:`Assign ${chosen.length} marks as ${layer==='holes'?'Stitch holes':'Fastener / round marks'}. Geometry and source sizes stay unchanged. ${group.manualCount} existing manual assignment${group.manualCount===1?' stays':'s stay'} unchanged.`};
}
export function applyMarkGroup(objects,preview){
 if(!preview||preview.beforeKey!==markGroupStateKey(objects))throw new Error('Pattern changed after the preview. Find round-mark groups again.');
 if(!['holes','hardware'].includes(preview.layer))throw new Error('Invalid group operation.');
 const ids=new Set(preview.ids),chosen=objects.filter(o=>ids.has(o.id));
 if(chosen.length!==ids.size||chosen.some(o=>o.manualLayer||!markCandidate(o)))throw new Error('Group membership changed. Find round-mark groups again.');
 // Applying a role can never replace commands, bounds, source sizes or styles.
 return objects.map(o=>ids.has(o.id)?{...structuredClone(o),layer:preview.layer,manualLayer:preview.layer,reason:`Round-mark group explicitly assigned as ${preview.layer==='holes'?'stitching':'hardware'}; original geometry retained`}:o);
}
