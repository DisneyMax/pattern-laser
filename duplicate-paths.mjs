import {circleInfo} from './geometry.mjs';

export const duplicateStateKey=objects=>JSON.stringify(objects);
const duplicateLayers=new Set(['cut','holes','hardware','inner','score']);
const duplicateEligible=o=>duplicateLayers.has(o.layer)&&!o.clipped&&!o.outsideClip&&!o.dash?.length&&(o.alpha??1)>=.7;
const duplicateStyleKey=o=>JSON.stringify([o.layer,o.stroke??null,o.fill??null,o.width??null,o.alpha??1,o.dash||[],o.sourceType||'vector']);
const duplicateCommandKey=o=>Array.isArray(o.cmds)&&o.cmds.length>1?JSON.stringify(o.cmds):null;
const nearDuplicateCircles=(a,b)=>Math.hypot(a.circle.cx-b.circle.cx,a.circle.cy-b.circle.cy)<=Math.min(.03,Math.min(a.circle.r,b.circle.r)*.2)&&Math.abs(a.circle.r-b.circle.r)*2<=Math.max(.005,Math.min(a.circle.r,b.circle.r)*.04);

export function findDuplicateGroups(objects,{includeManualCopies=false}={}){
 if(objects.length>20000)throw new Error('Too many paths to scan for duplicates. Review a smaller page.');
 const ordered=[...objects].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),exact=new Map(),groups=[],blocked=[],protectedIds=new Set(ordered.filter(o=>o.manualLayer).map(o=>o.id));
 const add=(members,kind)=>{
  if(members.length<2)return;
  if(members.every(o=>o.layer==='reference'))return;
  if(!members.every(duplicateEligible)||members.some(o=>o.manualLayer&&o.manualLayer!==o.layer)||new Set(members.map(duplicateStyleKey)).size!==1){blocked.push({kind,ids:members.map(o=>o.id),reason:'Different operations/styles or unsupported paths; inspect manually.'});return;}
  const manual=members.filter(o=>o.manualLayer);for(const o of manual)protectedIds.add(o.id);
  const keepIds=(manual.length?(includeManualCopies?[manual[0]]:manual):[members[0]]).map(o=>o.id),removeIds=members.filter(o=>(includeManualCopies||!o.manualLayer)&&!keepIds.includes(o.id)).map(o=>o.id);
  if(!removeIds.length){blocked.push({kind,ids:members.map(o=>o.id),reason:'All copies have manual assignments; none will be removed.'});return;}
  const circles=members.map(o=>circleInfo(o,{maxDiameter:10}));
  let maxCenterOffset=0,maxDiameterDifference=0;
  if(circles.every(Boolean))for(let i=0;i<circles.length;i++)for(let j=0;j<i;j++){maxCenterOffset=Math.max(maxCenterOffset,Math.hypot(circles[i].cx-circles[j].cx,circles[i].cy-circles[j].cy));maxDiameterDifference=Math.max(maxDiameterDifference,Math.abs(circles[i].r-circles[j].r)*2);}
  groups.push({id:kind+':'+members[0].id,kind,ids:members.map(o=>o.id),keepIds,removeIds,manualCount:manual.length,maxCenterOffset,maxDiameterDifference,layer:members[0].layer});
 };
 for(const o of ordered){const key=duplicateCommandKey(o);if(!key)continue;if(!exact.has(key))exact.set(key,[]);exact.get(key).push(o);}
 for(const members of exact.values())add(members,'exact');
 const circles=ordered.map(o=>({object:o,circle:circleInfo(o,{maxDiameter:10})})).filter(o=>o.circle);
 if(circles.length>3000)throw new Error('Too many round paths to compare for near overlaps. Review a smaller page.');
 const clusters=[];
 for(const candidate of circles){const cluster=clusters.find(group=>group.every(other=>nearDuplicateCircles(candidate,other)));if(cluster)cluster.push(candidate);else clusters.push([candidate]);}
 for(const cluster of clusters)if(new Set(cluster.map(c=>duplicateCommandKey(c.object))).size>1)add(cluster.map(c=>c.object),'near');
 return {sourceKey:duplicateStateKey(objects),groups,blocked,protectedManualPaths:protectedIds.size,includeManualCopies:!!includeManualCopies};
}

export function previewDuplicateRemoval(objects,scan,{kind='exact',groupIds=null}={}){
 if(!['exact','near'].includes(kind))throw new Error('Choose exact copies or near-overlapping round paths.');
 if(!scan||scan.sourceKey!==duplicateStateKey(objects))throw new Error('Pattern changed. Find duplicate paths again.');
 const selected=groupIds?new Set(groupIds):null,groups=scan.groups.filter(g=>g.kind===kind&&(!selected||selected.has(g.id)));
 if(!groups.length||selected&&groups.length!==selected.size)throw new Error('Choose a removable duplicate group.');
 const removeIds=[...new Set(groups.flatMap(g=>g.removeIds))],keepIds=[...new Set(groups.flatMap(g=>g.keepIds))],remove=new Set(removeIds);
 if(keepIds.some(id=>remove.has(id))||!scan.includeManualCopies&&objects.some(o=>remove.has(o.id)&&o.manualLayer))throw new Error('Protected manual assignments cannot be removed.');
 const beforeHoles=objects.filter(o=>o.layer==='holes').length,afterHoles=objects.filter(o=>o.layer==='holes'&&!remove.has(o.id)).length;
 const removedManual=objects.filter(o=>remove.has(o.id)&&o.manualLayer).length;
 return {beforeKey:duplicateStateKey(objects),includeManualCopies:scan.includeManualCopies,kind,groupIds:groups.map(g=>g.id),removeIds,keepIds,ids:[...new Set([...removeIds,...keepIds])],summary:`Remove ${removeIds.length} ${kind==='exact'?'exact command copies':'near-overlapping round paths'} across ${groups.length} groups. Total paths: ${objects.length} → ${objects.length-removeIds.length}; stitch-hole paths: ${beforeHoles} → ${afterHoles}. Retained paths keep their original geometry and operations. ${removedManual?`${removedManual} matching manual copies are included; each group's retained manual operation stays unchanged.`:'Manual assignments are protected.'}${kind==='near'?' Near paths differ in position or size. Inspect red removals against green retained paths and the PDF before applying.':''}`,maxCenterOffset:Math.max(...groups.map(g=>g.maxCenterOffset)),maxDiameterDifference:Math.max(...groups.map(g=>g.maxDiameterDifference))};
}

export function applyDuplicateRemoval(objects,preview){
 if(!preview||preview.beforeKey!==duplicateStateKey(objects))throw new Error('Pattern changed after preview. Find duplicate paths again.');
 const expected=previewDuplicateRemoval(objects,findDuplicateGroups(objects,{includeManualCopies:!!preview.includeManualCopies}),{kind:preview.kind,groupIds:preview.groupIds});
 for(const key of ['keepIds','removeIds'])if(JSON.stringify(expected[key])!==JSON.stringify(preview[key]))throw new Error('Duplicate removal membership changed. Preview again.');
 const remove=new Set(expected.removeIds);return objects.filter(o=>!remove.has(o.id));
}
