import {refresh} from '../../geometry.mjs';
export const markHost=(id='host',x=0,y=0,w=100,h=80)=>refresh({id,sourceIds:[id],cmds:[['M',x,y],['L',x+w,y],['L',x+w,y+h],['L',x,y+h],['Z']],stroke:'#000000',fill:null,alpha:1,width:.1,dash:[],layer:'cut',manualLayer:'cut',reason:'Fixture host'});
export function roundMark(id,x,y,diameter=.8,{layer='hardware',manualLayer=null,sourceType='vector',...extra}={}){
 const r=diameter/2,k=r*.5522847498;
 return refresh({id,sourceIds:[id],cmds:[['M',x+r,y],['C',x+r,y+k,x+k,y+r,x,y+r],['C',x-k,y+r,x-r,y+k,x-r,y],['C',x-r,y-k,x-k,y-r,x,y-r],['C',x+k,y-r,x+r,y-k,x+r,y],['Z']],stroke:'#000000',fill:null,alpha:1,width:.1,dash:[],layer,manualLayer,sourceType,reason:'Fixture round mark',...extra});
}
export function markRows({manual=[],secondRow=true,sourceType='vector'}={}){
 const objects=[markHost()];
 for(let i=0;i<6;i++)objects.push(roundMark('a'+i,10+i*6,15,i%2?.94:.8,{manualLayer:manual.includes(i)?'hardware':null,sourceType}));
 if(secondRow)for(let i=0;i<6;i++)objects.push(roundMark('b'+i,10+i*6,45,.9,{layer:'holes',sourceType}));
 return objects;
}
export function overlappingRow({manual=false}={}){
 const objects=[markHost()];
 for(let i=0;i<6;i++)for(let copy=0;copy<4;copy++)objects.push(roundMark(`a${i}c${copy}`,10+i*6+[0,.004,.006,.014][copy],15+(copy===3?.003:0),1+(copy===3?.0002:0),{manualLayer:manual&&i===2&&copy===0?'hardware':null}));
 return objects;
}
export function curvedRow(){return [markHost(),...Array.from({length:7},(_,i)=>roundMark('curve'+i,50+20*Math.cos(i*Math.PI/12),30+20*Math.sin(i*Math.PI/12),1))];}
