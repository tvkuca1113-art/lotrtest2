import type {Point, WorldMap, Season, StageDef} from '../types';
import {CELL, rng, project} from './maps';
export type River = {points:Point[]; width:number; lava:boolean};
export function riverFor(width:number,height:number,chapter:number,stage:number):River {
 const points:Point[]=[];
 for(let y=-2;y<=height+2;y+=.5)points.push({x:(width*.24+y*.19+Math.sin(y*.18+stage*.2)*2.6)*CELL,y:y*CELL});
 return {points,width:(chapter===2?1.25:2.05)*CELL,lava:chapter===5||chapter===2&&stage%5===2};
}
export function riverDistance(p:Point,r:River){let d=Infinity;for(const a of r.points)d=Math.min(d,Math.hypot(a.x-p.x,a.y-p.y));return d;}
/** Add water only outside authored routes; existing route cells become traversable bridge decks. */
export function enrichMap(m:WorldMap,stage:StageDef,season:Season){
 const random=rng(stage.seed+7919), river=riverFor(m.width,m.height,stage.chapter,stage.id);
 m.river=river;m.props=[];
 for(let y=1;y<m.height-1;y++)for(let x=1;x<m.width-1;x++){
  const d=riverDistance({x:(x+.5)*CELL,y:(y+.5)*CELL},river), tile=m.tiles[y][x];
  if(d<river.width*.43){if(tile===0)m.tiles[y][x]=2;else if(tile===1)m.tiles[y][x]=5;}
 }
 for(let y=1;y<m.height-1;y++)for(let x=1;x<m.width-1;x++){
  const tile=m.tiles[y][x],water=tile===2,d=riverDistance({x:(x+.5)*CELL,y:(y+.5)*CELL},river);
  const nearRoute=[[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dy])=>[1,3,4,5].includes(m.tiles[y+dy]?.[x+dx]??0));
  const roll=random(),cave=stage.chapter===2||stage.chapter===5;
  let kind='';
  if(tile===0){
   if(d<river.width*.85&&roll<.7)kind=cave?'stones':['reeds','stones','fern','log'][Math.floor(random()*4)];
   else if(nearRoute&&roll<.66)kind=cave?['outcrop','boulder','runestone'][Math.floor(random()*3)]:['fern','flowers','boulder','stones','log','fern','stump'][Math.floor(random()*7)];
   else if(!nearRoute&&roll<.17)kind=cave?(random()<.6?'outcrop':'boulder'):['oak','fir','fir','birch',season==='Winter'?'deadwood':'oak'][Math.floor(random()*5)];
  }else if(!water&&tile!==5&&roll<.04)kind='grass';
  if(kind)m.props.push({x:x+(random()-.5)*.18,y:y+(random()-.5)*.18,kind,variant:Math.floor(random()*3)});
 }
 // Landmarks reward looking off the road without obstructing any objective.
 for(const p of m.caches)m.props.push({x:p.x/CELL-.5+1.2,y:p.y/CELL-.5-.8,kind:'runestone',variant:0});
}
export function canopyTarget(tree:{x:number;y:number;width:number;height:number},player:Point){
 const head={x:player.x,y:player.y-48};
 const inFront=tree.y>player.y+14;
 const overlaps=inFront&&Math.abs(tree.x-head.x)<tree.width*.40&&head.y>tree.y-tree.height*.95&&head.y<tree.y-tree.height*.30;
 return overlaps?.48:1;
}
export const easeAlpha=(current:number,target:number,dt:number)=>current+(target-current)*(1-Math.exp(-Math.min(dt,.1)*9));
export const riverScreen=(r:River)=>r.points.map(project);
