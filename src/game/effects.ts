import Phaser from 'phaser';
import type {Point, Actor, Hazard} from '../types';
import {project} from '../world/maps';
import type {Engine} from './engine';
type Spark={x:number;y:number;vx:number;vy:number;age:number;life:number;color:number;size:number};
export class CombatEffects {
 sparks:Spark[]=[];
 hit(p:Point,amount:number){const q=project(p);for(let i=0;i<8;i++){const a=i*Math.PI/4+amount*.1;this.sparks.push({x:q.x,y:q.y-29,vx:Math.cos(a)*(28+i*8),vy:Math.sin(a)*42-35,age:0,life:.22+i*.025,color:amount<0?0xdf9876:i%3===0?0xffefbe:0xd4c6a1,size:i%3===0?3:1.6});}if(this.sparks.length>128)this.sparks.splice(0,this.sparks.length-128);}
 draw(g:Phaser.GameObjects.Graphics,dt:number){for(const s of this.sparks){s.age+=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.vy+=120*dt;g.lineStyle(s.size,s.color,Math.max(0,1-s.age/s.life));g.lineBetween(s.x,s.y,s.x-s.vx*.035,s.y-s.vy*.035);}this.sparks=this.sparks.filter(s=>s.age<s.life);}
}
/** All trails share the exact world-space facing, angular width and reach of the damaging sweep. */
export function slash(g:Phaser.GameObjects.Graphics,h:Hazard,clock:number){
 const age=1-Math.min(1,h.life/.25),sweep=h.width*(.28+.72*age),start=h.angle-h.width/2;
 const color=h.friendly?h.color:0xe8b28a;
 for(let strip=0;strip<3;strip++){
  const radius=h.radius*(.70+strip*.10),points:Point[]=[];
  for(let i=0;i<=18;i++){const a=start+sweep*i/18;const q=project({x:h.x+Math.cos(a)*radius,y:h.y+Math.sin(a)*radius});points.push({x:q.x,y:q.y-22});}
  g.lineStyle(strip===2?2:6-strip*1.6,color,(1-age)*(.55+strip*.15));g.strokePoints(points,false);
 }
 const tip=project({x:h.x+Math.cos(start+sweep)*h.radius,y:h.y+Math.sin(start+sweep)*h.radius});g.fillStyle(0xfff0c9,Math.max(0,.7-age));g.fillTriangle(tip.x,tip.y-30,tip.x-4,tip.y-18,tip.x+4,tip.y-18);
}
export function weaponRig(g:Phaser.GameObjects.Graphics,a:Actor,e:Engine){
 const q=project(a),dir=project({x:Math.cos(a.angle),y:Math.sin(a.angle)}),face=dir.x<0?-1:1;
 // A physical shield rim makes guarding readable even while audio is disabled.
 if(a.kind==='player'&&e.secondaryHeld&&!e.strike&&(e.save.inventory.find(i=>i.id===e.save.equipment.weapon)?.family??'sword')==='sword'){const x=q.x+face*12,y=q.y-38;g.lineStyle(2,0xe0cd99,.8);g.strokeEllipse(x,y,23,30);}
}
