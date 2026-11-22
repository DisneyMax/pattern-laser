import {markHost,roundMark} from '../marks/fixtures.mjs';
export function duplicateFixture({allManual=false,sourceType='vector'}={}){
 const objects=[{...markHost(),sourceType}];
 for(let i=0;i<6;i++){
  const base=roundMark(`h${i}a`,10+i*6,15,1,{layer:'holes',manualLayer:allManual||i===2?'holes':null,sourceType});objects.push(base,{...structuredClone(base),id:`h${i}b`,sourceIds:[`h${i}b`],manualLayer:allManual?'holes':null},roundMark(`h${i}c`,10+i*6+.01,15,1,{layer:'holes',manualLayer:allManual?'holes':null,sourceType}));
 }
 return objects;
}
