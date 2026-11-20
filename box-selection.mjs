export function selectionBox(a,b){return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(b.x-a.x),h:Math.abs(b.y-a.y)};}
export function pathsInsideBox(objects,box,{visible=null,getBounds=o=>o.bbox}={}){
 if(!(box.w>0&&box.h>0))return [];
 const epsilon=1e-7;
 return objects.filter(o=>{if(visible&&visible[o.layer]===false)return false;const b=getBounds(o);return b&&[b.x,b.y,b.w,b.h].every(Number.isFinite)&&b.x>=box.x-epsilon&&b.y>=box.y-epsilon&&b.x+b.w<=box.x+box.w+epsilon&&b.y+b.h<=box.y+box.h+epsilon;}).map(o=>o.id);
}
export function mergeBoxSelection(previous,hits,additive=false){return new Set(additive?[...previous,...hits]:hits);}
// Pointer handling is independent of geometry and rendering, so selection cannot edit a path.
export function createBoxSelector({host,toPoint,enabled,getObjects,getVisible,getBounds,getSelected,onPreview,onCommit,onCancel,onBlankClick}){
 let gesture=null,ignoreClick=false;
 const consumeClick=()=>{if(!ignoreClick)return false;ignoreClick=false;return true;};
 function release(id){try{if(host.hasPointerCapture?.(id))host.releasePointerCapture(id);}catch{}}
 function cancel(){if(!gesture)return false;const g=gesture;gesture=null;ignoreClick=g.dragged;release(g.id);onCancel?.(g.before);return true;}
 const down=e=>{ignoreClick=false;if(!enabled()||e.button!==0||e.pointerType==='touch'||gesture)return;const start=toPoint(e);if(!start)return;e.preventDefault();gesture={id:e.pointerId,start,clientX:e.clientX,clientY:e.clientY,before:new Set(getSelected()),additive:!!e.shiftKey,dragged:false};};
 function preview(e){const g=gesture;if(!g||e.pointerId!==g.id)return null;const point=toPoint(e);if(!point)return null;if(!g.dragged&&Math.hypot(e.clientX-g.clientX,e.clientY-g.clientY)<4)return null;if(!g.dragged)host.setPointerCapture?.(g.id);g.dragged=true;g.additive=!!e.shiftKey;const box=selectionBox(g.start,point),hits=pathsInsideBox(getObjects(),box,{visible:getVisible(),getBounds}),ids=mergeBoxSelection(g.before,hits,g.additive);return {box,hits:new Set(hits),ids,additive:g.additive};}
 const move=e=>{const result=preview(e);if(result){e.preventDefault();onPreview(result);}};
 const up=e=>{if(!gesture||e.pointerId!==gesture.id)return;const result=preview(e),g=gesture;gesture=null;release(g.id);if(g.dragged){e.preventDefault();ignoreClick=true;if(result)onCommit(result.ids);else onCancel?.(g.before);}};
 const canceled=e=>{if(gesture&&e.pointerId===gesture.id)cancel();};
 const lost=e=>{if(gesture&&e.pointerId===gesture.id)cancel();};
 const click=e=>{if(e.target!==host)return;if(consumeClick())return;if(enabled())onBlankClick?.(!!e.shiftKey);};
 const handlers={pointerdown:down,pointermove:move,pointerup:up,pointercancel:canceled,lostpointercapture:lost,click};
 for(const [name,handler]of Object.entries(handlers))host.addEventListener(name,handler);
 return {cancel,consumeClick,destroy(){cancel();for(const [name,handler]of Object.entries(handlers))host.removeEventListener(name,handler);}};
}
