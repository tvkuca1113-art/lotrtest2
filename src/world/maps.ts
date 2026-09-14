import type {WorldMap,Point,Season,StageDef,Tile,Save} from '../types';
import {homeExtent,footprint,isWalkableBuilding} from '../systems/building';
export const CELL=48;
export const toWorld=(p:Point)=>({x:(p.x+.5)*CELL,y:(p.y+.5)*CELL});
export const project=(p:Point)=>({x:(p.x-p.y)*.88,y:(p.x+p.y)*.44});
export const unproject=(p:Point)=>({x:p.x/1.76+p.y/.88,y:p.y/.88-p.x/1.76});
export function rng(seed:number){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
export function makeMap(stage:StageDef,season:Season):WorldMap{
 const random=rng(stage.seed),small=stage.id===1,width=small?45:64,height=small?35:49;const tiles:Tile[][]=Array.from({length:height},()=>Array(width).fill(0));
 const rooms=small?[{x:3,y:23,w:7,h:7},{x:5,y:11,w:8,h:8},{x:18,y:8,w:8,h:8},{x:29,y:6,w:13,h:13}]:[{x:3,y:34,w:8,h:9},{x:5+stage.id%3,y:18,w:9,h:9},{x:18,y:5+stage.id%3,w:10,h:10},{x:30,y:19+stage.id%2,w:10,h:10},{x:37,y:34,w:9,h:9},{x:48,y:9,w:13,h:14}];
 const center=(r:{x:number;y:number;w:number;h:number})=>({x:r.x+Math.floor(r.w/2),y:r.y+Math.floor(r.h/2)});
 const paint=(x:number,y:number,w:number,h:number,v:Tile=1)=>{for(let j=Math.max(1,y);j<Math.min(height-1,y+h);j++)for(let i=Math.max(1,x);i<Math.min(width-1,x+w);i++)tiles[j][i]=v;};
 for(const r of rooms)paint(r.x,r.y,r.w,r.h);
 for(let i=1;i<rooms.length;i++){const a=center(rooms[i-1]),b=center(rooms[i]);const corner=i%2?{x:a.x,y:b.y}:{x:b.x,y:a.y};paint(Math.min(a.x,corner.x)-1,Math.min(a.y,corner.y)-1,Math.abs(a.x-corner.x)+3,Math.abs(a.y-corner.y)+3);paint(Math.min(b.x,corner.x)-1,Math.min(b.y,corner.y)-1,Math.abs(b.x-corner.x)+3,Math.abs(b.y-corner.y)+3);}
 const branch={x:small?15:31,y:small?24:5};paint(branch.x-2,branch.y-2,5,5);const connect=center(rooms[small?1:2]);paint(Math.min(connect.x,branch.x),branch.y,Math.abs(branch.x-connect.x)+1,2);paint(connect.x,Math.min(connect.y,branch.y),2,Math.abs(connect.y-branch.y)+1);
 const seasonal={x:branch.x-2,y:branch.y};tiles[seasonal.y][seasonal.x]=season==='Spring'?2:season==='Winter'?3:4;tiles[seasonal.y+1][seasonal.x]=tiles[seasonal.y][seasonal.x];
 const last=rooms.at(-1)!,arena=center(last),cp={x:last.x+2,y:last.y+last.h-1};
 // A guaranteed approach corridor reaches the checkpoint from the previous room.
 const prev=center(rooms.at(-2)!);paint(Math.min(prev.x,cp.x)-1,prev.y-1,Math.abs(prev.x-cp.x)+3,3);paint(cp.x-1,Math.min(cp.y,prev.y)-1,3,Math.abs(cp.y-prev.y)+3);
 const props:WorldMap['props']=[];for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){if(tiles[y][x]===0&&random()<.12)props.push({x,y,kind:stage.chapter===2||stage.chapter===5?(random()<.55?'rock':'ruin'):random()<.6?'pine':'tree',variant:Math.floor(random()*3)});else if(tiles[y][x]===1&&random()<.015&&!rooms.some(r=>x>r.x&&x<r.x+r.w-1&&y>r.y&&y<r.y+r.h-1))props.push({x,y,kind:'grass',variant:0});}
 const objectiveRooms=small?[rooms[0]]:rooms.slice(1,-1);return {width,height,tiles,spawn:toWorld({x:rooms[0].x+2,y:rooms[0].y+rooms[0].h-2}),arena:toWorld(arena),checkpoint:toWorld(cp),exit:toWorld({x:arena.x+3,y:arena.y-3}),objectives:objectiveRooms.map(r=>toWorld(center(r))),caches:[toWorld(branch),toWorld({x:rooms[1].x+1,y:rooms[1].y+1}),toWorld({x:rooms.at(-2)!.x+1,y:rooms.at(-2)!.y+1})],rooms,seasonal:toWorld(seasonal),props};
}
export function homeMap(s:Save):WorldMap{const size=homeExtent(s);const tiles:Tile[][]=Array.from({length:size},(_,y)=>Array.from({length:size},(_,x)=>(x>0&&y>0&&x<size-1&&y<size-1?1:0) as Tile));for(const b of s.buildings)if(!isWalkableBuilding(b)){const f=footprint(b);for(let y=f.y;y<f.y+f.h;y++)for(let x=f.x;x<f.x+f.w;x++)if(tiles[y])tiles[y][x]=0;}return {width:size,height:size,tiles,spawn:toWorld({x:10,y:18}),arena:toWorld({x:10,y:7}),checkpoint:toWorld({x:10,y:18}),exit:toWorld({x:10,y:2}),objectives:[],caches:[],rooms:[{x:1,y:1,w:size-2,h:size-2}],seasonal:toWorld({x:1,y:1}),props:[]};}
export function walkable(m:WorldMap,x:number,y:number){const t=m.tiles[Math.floor(y/CELL)]?.[Math.floor(x/CELL)];return t!==undefined&&t!==0&&t!==2;}
export function canStand(m:WorldMap,p:Point,r=13){return [{x:p.x-r,y:p.y-r},{x:p.x+r,y:p.y-r},{x:p.x-r,y:p.y+r},{x:p.x+r,y:p.y+r}].every(q=>walkable(m,q.x,q.y));}
export function moveWithCollision(m:WorldMap,p:Point,dx:number,dy:number,r=13){const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/8));for(let i=0;i<steps;i++){if(canStand(m,{x:p.x+dx/steps,y:p.y},r))p.x+=dx/steps;if(canStand(m,{x:p.x,y:p.y+dy/steps},r))p.y+=dy/steps;}}
export function lineOfSight(m:WorldMap,a:Point,b:Point){const d=Math.hypot(b.x-a.x,b.y-a.y);for(let n=0;n<=d;n+=12){const t=d?n/d:0;if(!walkable(m,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false;}return true;}
export function reachable(m:WorldMap,start:Point,end:Point){const sx=Math.floor(start.x/CELL),sy=Math.floor(start.y/CELL),ex=Math.floor(end.x/CELL),ey=Math.floor(end.y/CELL),seen=new Set([`${sx},${sy}`]),q=[{x:sx,y:sy}];for(let i=0;i<q.length;i++){const p=q[i];if(p.x===ex&&p.y===ey)return true;for(const d of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]){const x=p.x+d.x,y=p.y+d.y,k=`${x},${y}`;if(!seen.has(k)&&walkable(m,(x+.5)*CELL,(y+.5)*CELL)){seen.add(k);q.push({x,y});}}}return false;}
