import {refresh} from '../../geometry.mjs';
import {roundMark} from '../marks/fixtures.mjs';
export const boundaryPath=(id,cmds,extra={})=>refresh({id,sourceIds:[id],cmds,stroke:'#000000',fill:null,alpha:1,width:.1,dash:[],layer:'unassigned',reason:'Generated open boundary',...extra});
export function boundaryFixture({branch=false,sourceType='vector'}={}){
 const objects=[boundaryPath('left',[['M',10,10],['L',20,10],['L',20,20]],{sourceType}),boundaryPath('right',[['M',20,20],['L',10,20],['L',10,10.04]],{sourceType}),roundMark('hole',15,15,1,{layer:'holes',manualLayer:'holes',sourceType}),boundaryPath('guide',[['M',60,60],['L',70,60]],{layer:'score',manualLayer:'score',sourceType})];
 if(branch)objects.push(boundaryPath('spur',[['M',20,20],['L',24,24]],{sourceType}));return objects;
}
