import {canopyTarget,easeAlpha} from '../world/nature';
import {CombatEffects,slash,weaponRig} from './effects';
import { assetUrl } from '../assets';
import Phaser from 'phaser';
import type { Actor, Point, WorldObject, Hazard, Building } from '../types';
import { Engine, GameEvent } from './engine';
import { project, unproject, CELL, toWorld, rng } from '../world/maps';
import { footprint, validPlacement } from '../systems/building';
import { distance } from './combat';
import { ringById } from '../content/rings';
import { chapters } from '../content/strings';
import { item } from '../systems/progression';
const css = (n: number) => '#' + n.toString(16).padStart(6, '0');
export class WorldScene extends Phaser.Scene {
    engine: Engine | null = null;
    loaded = false;
    staticGroup: Phaser.GameObjects.GameObject[] = [];
    actorImages = new Map<string, Phaser.GameObjects.Image>();
    objectImages = new Map<string, Phaser.GameObjects.Image>();
    floor: Phaser.GameObjects.Image | null = null;
    graphics!: Phaser.GameObjects.Graphics;
    groundFX!: Phaser.GameObjects.Graphics;
    combatFX = new CombatEffects();
    silhouette!: Phaser.GameObjects.Image;
    weather!: Phaser.GameObjects.Graphics;
    labels!: Phaser.GameObjects.Text;
    floats: {
        text: Phaser.GameObjects.Text;
        life: number;
    }[] = [];
    accumulator = 0;
    onTick: () => void = () => { };
    onReady: () => void = () => { };
    placement: {
        kind: Building['kind'];
        x: number;
        y: number;
        rotation: number;
        id?: string;
    } | null = null;
    cameraReady = false;
    groundVersion = 0;
    cpuMs = 0;
    exporting = false;
    footprints: {
        p: Point;
        life: number;
    }[] = [];
    lastFoot = 0;
    minimap: HTMLCanvasElement | null = null;
    lastMini = 0;
    constructor() { super('WORLD'); }
    preload() { const progress = document.getElementById('loading-progress'); this.load.on('progress', (v: number) => { if (progress)
        progress.style.width = (v * 100) + '%'; }); this.load.spritesheet('traveller',assetUrl('assets/traveller-poses.webp'),{frameWidth:256,frameHeight:256});this.load.spritesheet('enemies',assetUrl('assets/enemy-poses.webp'),{frameWidth:256,frameHeight:256});this.load.spritesheet('dark-enemies',assetUrl('assets/dark-enemy-poses.webp'),{frameWidth:256,frameHeight:256});this.load.spritesheet('weapons',assetUrl('assets/weapon-poses.webp'),{frameWidth:256,frameHeight:256});this.load.atlas('nature',assetUrl('assets/nature-atlas.webp'),assetUrl('assets/nature-atlas.json')); this.load.atlas('world', assetUrl('assets/world-atlas.png'), assetUrl('assets/world-atlas.json')); for (const material of ['forest', 'earth', 'stone', 'snow'])
        this.load.image('ground-' + material, assetUrl('assets/ground-' + material + '.webp')); }
    create() { this.groundFX=this.add.graphics().setDepth(-500);this.silhouette=this.add.image(0,0,'traveller',0).setOrigin(.5,.90).setDepth(8900).setTintFill(0xe3d6ad).setAlpha(0);this.graphics = this.add.graphics().setDepth(10000); this.weather = this.add.graphics().setDepth(9000).setScrollFactor(0); this.labels = this.add.text(0, 0, '', { fontFamily: 'Georgia', fontSize: '15px', color: '#f4e9d4', backgroundColor: '#171c1bdd', padding: { x: 10, y: 8 }, align: 'center' }).setOrigin(.5, 1).setDepth(11000); this.cameras.main.setBackgroundColor('#162820'); this.loaded = true; this.onReady(); this.scale.on('resize', () => this.resize()); this.resize(); }
    bind(e: Engine) { this.engine = e; e.events.push(ev => this.event(ev)); if (this.loaded)
        this.rebuild(); }
    event(ev: GameEvent) { if(ev.type==='hit'&&ev.p)this.combatFX.hit(ev.p,ev.value??0); if (ev.type === 'world')
        this.rebuild(); if (ev.type === 'float' && ev.p && this.floats.length < 24) {
        const p = project(ev.p), txt = this.add.text(p.x, p.y - 68, ev.text ?? '', { fontFamily: 'Georgia', fontSize: '17px', color: ev.text?.startsWith('+') ? '#c8e0b3' : '#f2dfb5', stroke: '#171c1b', strokeThickness: 3 }).setOrigin(.5).setDepth(14000);
        this.floats.push({ text: txt, life: .8 });
    } if (ev.type === 'hit' && (ev.value ?? 0) < 0 && this.engine?.save.settings.shake)
        this.cameras.main.shake(90, .002); }
    resize() { this.cameras.main.setZoom(this.scale.width < 600 ? .84 : this.scale.width < 950 ? .95 : 1.08); }
    aimAt(x: number, y: number) { const p = this.cameras.main.getWorldPoint(x, y); return unproject(p); }
    addProp(frame: string, p: Point, height: number, depth?: number) {
        const at=project(p), nature=this.textures.get('nature').has(frame), key=nature?'nature':'world';
        const img=this.add.image(at.x,at.y,key,frame).setOrigin(.5,.96).setScale(height/256).setDepth(depth??at.y);
        if(!nature)img.setScale(height/img.height);
        const tree=['oak','birch','fir','deadwood','tree','pine'].includes(frame);
        img.setData('occludes',tree||frame==='ruin');img.setData('baseY',at.y);img.setData('wind',tree);img.setData('phase',p.x*.01+p.y*.02);
        this.staticGroup.push(img);
        if(tree){
            // Trunk/root pixels remain opaque; only the canopy eases out on actual head overlap.
            const trunk=this.add.image(at.x,at.y,key,frame).setOrigin(.5,.96).setScale(img.scaleX).setDepth(img.depth-.01);
            trunk.setCrop(0,trunk.height*.58,trunk.width,trunk.height*.42);img.setCrop(0,0,img.width,img.height*.58);this.staticGroup.push(trunk);
            img.setData('trunk',trunk);
        }
        return img;
    }
    rebuild() {
        if (!this.loaded || !this.engine?.map)
            return;
        const e = this.engine;
        this.staticGroup.forEach(x => x.destroy());
        this.staticGroup = [];
        this.actorImages.forEach(x => x.destroy());
        this.actorImages.clear();
        this.objectImages.forEach(x => x.destroy());
        this.objectImages.clear();
        this.floats.forEach(f => f.text.destroy());
        this.floats = [];
        if (this.floor) {
            const key = this.floor.texture.key;
            this.floor.destroy();
            this.textures.remove(key);
        }
        this.drawGround();
        for (const prop of e.map.props) {
            if (prop.kind === 'grass' && e.save.settings.quality==='low') continue;
            const frame = prop.kind === 'rock' ? 'rock' : prop.kind === 'ruin' ? 'ruin' : prop.kind;
            const img = this.addProp(frame, toWorld(prop), ({oak:187,birch:167,fir:194,deadwood:165,boulder:84,stones:40,outcrop:120,log:65,fern:46,flowers:48,reeds:64,grass:24,runestone:90,stump:54,wall:85}[frame]??(frame==='pine'?180:frame==='tree'?180:frame==='ruin'?125:58))*(1+prop.variant*.09));
            if (e.season === 'Winter')
                img.setTint(0xb7c9c9);
            else if (e.season === 'Autumn' && ['tree','oak','birch','flowers'].includes(frame))
                img.setTint(0xd9b37b);
        }
        if (e.state === 'HOME' || e.state === 'PAUSED' && e.previous === 'HOME') {
            for (let i = 0; i < 13; i++) {
                const q = toWorld({ x: i % 2 ? 1 : e.map.width - 2, y: 2 + i % 7 * 2 });
                this.addProp(i%3===0?'oak':'fir', q, 162 + i % 3 * 20);this.addProp(i%2?'fern':'boulder',{x:q.x+55,y:q.y+45},i%2?50:80);
            }
            for (const b of e.save.buildings)
                this.building(b);
            for (let i = 0; i < e.save.residents.length; i++) {
                const img = this.addProp('player', toWorld({ x: 7 + (i % 2) * 6, y: 5 + Math.floor(i / 2) * 4 }), 70);
                img.setTint([0xc9b68c, 0x9ac2a5, 0xc2bdad, 0xc5a478, 0xb5cdd1, 0xc8acd4][i]);
            }
            for (let i = 0; i < 6; i++)
                if (e.save.cleared.includes((i + 1) * 5)) {
                    const p = toWorld({ x: 3 + i * 3, y: 1.3 });
                    this.addProp('beacon', p, 95);
                }
            if (e.save.assignments.socket1 === 'echo' || e.save.assignments.socket2 === 'echo')
                this.addProp('uruk', toWorld({ x: 7, y: 8 }), 80).setTint(0xb49b6a);
            if (e.save.ending) {
                this.addProp('beacon', toWorld({ x: 10, y: 4 }), e.save.ending === 'hearth' ? 185 : 105);
            }
        }
        else {
            for (const r of e.map.rooms) {
                this.addProp('lantern', toWorld({ x: r.x, y: r.y }), 66);
                if (e.stage.chapter === 2 || e.stage.chapter === 5)
                    this.addProp('ruin', toWorld({ x: r.x + r.w - .8, y: r.y + .6 }), 125);
            }
            for (const o of e.objects)
                this.object(o);
        }
        this.combatFX.sparks=[];
        this.footprints = [];
        this.cameraReady = false;
        this.drawMini();
    }
    building(b: Building) { const e = this.engine!, f = footprint(b), p = toWorld({ x: f.x + f.w / 2 - .5, y: f.y + f.h / 2 - .1 }); const frames: Record<string, string> = { campfire: 'beacon', shelter: e.save.tier <= 1 ? 'tent' : e.save.tier <= 3 ? 'cottage' : 'castle', bed: 'tent', chest: 'chest', forge: 'forge', workbench: 'chest', garden: 'tree', watchtower: 'watchtower', wall: 'ruin', gate: 'ruin', trophy: 'beacon', lantern: 'lantern', tree: 'tree', path: 'rock', banner: 'lantern' }; const heights: Record<string, number> = { campfire: 68, shelter: e.save.tier <= 1 ? 140 : e.save.tier <= 3 ? 200 : 275, bed: 75, chest: 65, forge: 168, workbench: 80, garden: 118, watchtower: 190, wall: 98, gate: 140, trophy: 95, lantern: 100, tree: 140, path: 15, banner: 108 }; const img = this.addProp(frames[b.kind], p, heights[b.kind]); img.setFlipX(b.rotation % 2 === 1); if (b.kind === 'shelter' && e.save.tier === 3)
        img.setTint(0xc7ced0); if (b.kind === 'garden')
        img.setTint(0x9dc786); }
    object(o: WorldObject) { const frames: Record<string, string> = { objective: this.engine!.stage.kind === 'rescue' ? 'player' : this.engine!.stage.kind === 'ritual' || this.engine!.stage.kind === 'beacon' ? 'beacon' : this.engine!.stage.kind === 'bridge' ? 'ruin' : 'chest', cache: 'chest', ring: 'chest', checkpoint: 'beacon', exit: 'ruin', inscription: 'rock', bramble: 'tree', pillar: 'ruin', anchor: 'beacon', banner: 'lantern', web: 'spider', ballista: 'watchtower', mine: 'rock', cart: 'chest', ward: 'beacon' }; const height = o.kind === 'exit' ? 160 : o.kind === 'pillar' ? 120 : o.kind === 'bramble' ? 92 : o.kind === 'anchor' ? 100 : o.kind === 'checkpoint' ? 105 : o.kind === 'objective' && this.engine!.stage.kind === 'rescue' ? 70 : o.kind === 'objective' ? 75 : 55; const p = project(o); const img = this.add.image(p.x, p.y, 'world', frames[o.kind]).setOrigin(.5, .94).setDepth(p.y).setScale(1); img.setScale(height / img.height); this.objectImages.set(o.id, img); if (o.done)
        img.setTint(0x6f8174).setAlpha(.6); }
    drawGround() {
        const e = this.engine!, m = e.map, low = e.save.settings.quality === 'low', scale = low ? .5 : .8, pad = 180;
        const minX = -m.height * CELL * .88 - pad, minY = -pad, w = (m.width + m.height) * CELL * .88 + pad * 2, h = (m.width + m.height) * CELL * .44 + pad * 2;
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(w * scale);
        canvas.height = Math.ceil(h * scale);
        const c = canvas.getContext('2d')!;
        c.scale(scale, scale);
        c.translate(-minX, -minY);
        const random = rng(e.stage.seed + 92);
        const home = e.state === 'HOME' || e.state === 'PAUSED' && e.previous === 'HOME';
        const rock = e.stage.chapter === 2 || e.stage.chapter === 5;
        const snow = e.season === 'Winter' && (home || !rock);
        const pal = snow ? ['#778c8c', '#8a9c98', '#819693', '#94a7a1'] : rock && !home ? ['#514d40', '#555242', '#5b5746', '#504f45'] : e.season === 'Autumn' ? ['#646342', '#656346', '#716347', '#656040'] : ['#506148', '#58644c', '#5b6950', '#4d5d44'];
        const textureName = snow ? 'snow' : rock && !home ? 'stone' : 'earth';
        const floorPattern = c.createPattern(this.textures.get('ground-' + textureName).getSourceImage() as HTMLImageElement, 'repeat')!;
        const forestPattern = c.createPattern(this.textures.get('ground-forest').getSourceImage() as HTMLImageElement, 'repeat')!;
        c.fillStyle = forestPattern;
        c.fillRect(minX, minY, w, h);
        c.fillStyle = snow ? '#829b994a' : '#18372588';
        c.fillRect(minX, minY, w, h);
        if(m.river){
            const river=m.river,trace=()=>{c.beginPath();river.points.forEach((p,i)=>{const q=project(p);if(i===0)c.moveTo(q.x,q.y);else c.lineTo(q.x,q.y);});};
            c.lineJoin='round';c.lineCap='round';trace();c.lineWidth=river.width*1.45;c.strokeStyle=river.lava?'#443b30':'#616b51';c.stroke();
            trace();c.lineWidth=river.width*1.21;c.strokeStyle=river.lava?'#272526':'#2c534b';c.stroke();
            trace();c.lineWidth=river.width;c.strokeStyle=river.lava?'#9d502d':'#214d52';c.stroke();
            trace();c.lineWidth=river.width*.56;c.strokeStyle=river.lava?'#d3823d':'#2d6570';c.stroke();
            const waterRandom=rng(e.stage.seed+503);
            for(let i=0;i<river.points.length;i++){
                const p=project(river.points[i]);
                for(let n=0;n<6;n++){const offset=(waterRandom()-.5)*river.width*.95;c.fillStyle=river.lava?'#edc26923':n%3===0?'#b0d1be25':'#0c343744';c.beginPath();c.ellipse(p.x+offset,p.y+waterRandom()*12,3+waterRandom()*9,1+waterRandom()*3,-.2,0,Math.PI*2);c.fill();}
                if(i%2===0){c.fillStyle='#83948065';c.beginPath();c.ellipse(p.x+river.width*.53,p.y,4+waterRandom()*7,2+waterRandom()*4,0,0,Math.PI*2);c.fill();}
            }
            for(let i=0;i<river.points.length;i+=3){const p=project(river.points[i]);c.strokeStyle=river.lava?'#edb05c':'#a5d2c13f';c.lineWidth=1.2;c.beginPath();c.ellipse(p.x,p.y,river.width*.28,4,0,.1,Math.PI);c.stroke();}
        }
        const diamond = (p: Point, s: number) => { c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + CELL * .88 * s, p.y + CELL * .44 * s); c.lineTo(p.x, p.y + CELL * .88 * s); c.lineTo(p.x - CELL * .88 * s, p.y + CELL * .44 * s); c.closePath(); };
        for (let y = 0; y < m.height; y++)
            for (let x = 0; x < m.width; x++) {
                const t = m.tiles[y][x];
                if (!t || t===2 && m.river) continue;
                const p = project({ x: x * CELL, y: y * CELL });
                diamond(p, 1);
                c.fillStyle = t === 2 ? '#425e63' : t === 3 ? '#8aafb4' : t === 5 ? '#84765b' : floorPattern;
                c.fill();
                if(t===5){
                    c.strokeStyle='#362c25';c.lineWidth=2;diamond(p,.94);c.stroke();
                    for(let slat=1;slat<5;slat++){const k=slat/5;c.beginPath();c.moveTo(p.x+CELL*.88*k,p.y+CELL*.44*k);c.lineTo(p.x-CELL*.88*(1-k),p.y+CELL*.44*(1+k));c.stroke();}
                }
                if (t !== 2 && t !== 3 && t!==5) {
                    diamond(p, 1);
                    c.fillStyle = snow ? '#718b7a21' : rock ? '#28352930' : '#53614a2b';
                    c.fill();
                }
                if (home && (x === 9 || x === 10)) {
                    diamond(p, 1);
                    c.fillStyle = snow ? '#b0b4a6' : '#8a8066';
                    c.fill();
                }
                for (let i = 0; i < 5; i++) {
                    const q = project({ x: (x + random()) * CELL, y: (y + random()) * CELL });
                    c.fillStyle = random() < .5 ? '#c1bba027' : '#18282129';
                    c.beginPath();
                    c.ellipse(q.x, q.y, 1 + random() * 5, .7 + random() * 1.4, -.4, 0, Math.PI * 2);
                    c.fill();
                }
                if (m.tiles[y + 1]?.[x] === 0) {
                    c.beginPath();
                    c.moveTo(p.x, p.y + CELL * .88);
                    c.lineTo(p.x - CELL * .88, p.y + CELL * .44);
                    c.lineTo(p.x - CELL * .88, p.y + CELL * .44 + 14);
                    c.lineTo(p.x, p.y + CELL * .88 + 14);
                    c.fillStyle = '#1d3029';
                    c.fill();
                }
                if ((x + y) % 9 === 0 && !rock) {
                    for (let n = 0; n < 5; n++) {
                        const q = project({ x: (x + random()) * CELL, y: (y + random()) * CELL });
                        c.strokeStyle = snow ? '#d9ded677' : '#a4a97166';
                        c.beginPath();
                        c.moveTo(q.x, q.y);
                        c.lineTo(q.x - 2, q.y - 5 - random() * 4);
                        c.stroke();
                    }
                }
            }
        // Broken slabs define the boss arena while keeping the collision surface continuous.
        if (!home) {
            const r = m.rooms.at(-1)!;
            for (let y = r.y; y < r.y + r.h; y++)
                for (let x = r.x; x < r.x + r.w; x++) {
                    const p = project({ x: x * CELL, y: y * CELL });
                    diamond(p, .97);
                    c.strokeStyle = snow ? '#d1d2bd30' : '#bca88624';
                    c.lineWidth = 1;
                    c.stroke();
                }
            const center = project(m.arena);
            c.strokeStyle = '#c2a26455';
            c.lineWidth = 3;
            c.beginPath();
            c.ellipse(center.x, center.y, 250, 126, 0, 0, Math.PI * 2);
            c.stroke();
        }
        const key = 'ground-' + (++this.groundVersion);
        this.textures.addCanvas(key, canvas);
        this.floor = this.add.image(minX, minY, key).setOrigin(0).setScale(1 / scale).setDepth(-10000);
    }
    drawWater(){
        const e=this.engine!,river=e.map.river;if(!river)return;const g=this.groundFX;
        for(let i=0;i<river.points.length;i+=e.save.settings.quality==='low'?6:2){
            const p=river.points[i],x=p.x+Math.sin(i*3.1+e.clock*.7)*river.width*.22,y=p.y+(e.clock*17%24),tx=Math.floor(x/CELL),ty=Math.floor(y/CELL);
            if(e.map.tiles[ty]?.[tx]!==2)continue;const q=project({x,y});
            g.lineStyle(1,river.lava?0xe8b362:0xc1e0d4,.12+Math.sin(e.clock*1.2+i)*.06);g.lineBetween(q.x-10,q.y,q.x+10,q.y-3);
        }
    }
    drawMini() { if (!this.engine)
        return; const c = this.minimap ?? document.querySelector<HTMLCanvasElement>('#minimap'); if (!c)
        return; this.minimap = c; const ctx = c.getContext('2d')!, e = this.engine, m = e.map; ctx.clearRect(0, 0, c.width, c.height); const sx = c.width / m.width, sy = c.height / m.height; ctx.fillStyle = '#192620'; ctx.fillRect(0, 0, c.width, c.height); for (let y = 0; y < m.height; y++)
        for (let x = 0; x < m.width; x++)
            if (m.tiles[y][x]) {
                ctx.fillStyle = m.tiles[y][x] === 2 ? '#52757b' : '#63705a';
                ctx.fillRect(x * sx, y * sy, sx + .1, sy + .1);
            } for (const o of e.objects.filter(o => !o.done && (['objective', 'ring', 'checkpoint'].includes(o.kind) || o.kind === 'cache' && (e.save.buildings.some(b => b.kind === 'watchtower') || Object.entries(e.save.assignments).some(([k, v]) => k.startsWith('socket') && ['windstep', 'stormcall', 'dawnward', 'duskveil'].includes(v)))))) {
        ctx.fillStyle = o.kind === 'ring' ? '#ed9866' : '#dcc697';
        ctx.fillRect(o.x / CELL * sx - 2, o.y / CELL * sy - 2, 4, 4);
    } ctx.fillStyle = '#fff2d4'; ctx.beginPath(); ctx.arc(e.player.x / CELL * sx, e.player.y / CELL * sy, 3, 0, Math.PI * 2); ctx.fill(); }
    polygon(points: Point[], fill: number, alpha: number, stroke: number, width = 2) { const g = this.graphics; g.fillStyle(fill, alpha); g.lineStyle(width, stroke, .9); g.beginPath(); for (let i = 0; i < points.length; i++) {
        const p = project(points[i]);
        if (i === 0)
            g.moveTo(p.x, p.y);
        else
            g.lineTo(p.x, p.y);
    } g.closePath(); g.fillPath(); g.strokePath(); }
    circle(p: Point, r: number, color: number, alpha = .12, stroke = color) { const points: Point[] = []; for (let i = 0; i < 40; i++) {
        const a = i / 40 * Math.PI * 2;
        points.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r });
    } this.polygon(points, color, alpha, stroke); }
    hazard(h: Hazard) {
        if(h.kind==='slash'){slash(this.graphics,h,this.engine!.clock);return;}
        if(h.delay<=0&&h.shape==='cone'&&['sweep','double','echo','shield','counter','stances'].includes(h.kind))slash(this.graphics,h,this.engine!.clock);
        const warn = h.delay > 0, color = h.friendly ? h.color : warn ? 0xe0ad75 : 0xf4c89c;
        const alpha = h.friendly ? .18 : warn ? .08 : .27;
        const p: Point[] = [];
        if (h.shape === 'circle')
            this.circle(h, h.radius, color, alpha);
        else if (h.shape === 'cone') {
            p.push(h);
            for (let i = 0; i <= 20; i++) {
                const a = h.angle - h.width / 2 + h.width * i / 20;
                p.push({ x: h.x + Math.cos(a) * h.radius, y: h.y + Math.sin(a) * h.radius });
            }
            this.polygon(p, color, alpha, color);
        }
        else if (h.shape === 'line') {
            const ca = Math.cos(h.angle), sa = Math.sin(h.angle);
            p.push({ x: h.x - sa * h.width, y: h.y + ca * h.width }, { x: h.x + ca * h.length - sa * h.width, y: h.y + sa * h.length + ca * h.width }, { x: h.x + ca * h.length + sa * h.width, y: h.y + sa * h.length - ca * h.width }, { x: h.x + sa * h.width, y: h.y - ca * h.width });
            this.polygon(p, color, alpha, color);
        }
        else {
            for (let i = 0; i <= 42; i++) {
                const a = h.angle + .42 + (Math.PI * 2 - .84) * i / 42;
                p.push({ x: h.x + Math.cos(a) * (h.radius + h.width), y: h.y + Math.sin(a) * (h.radius + h.width) });
            }
            for (let i = 42; i >= 0; i--) {
                const a = h.angle + .42 + (Math.PI * 2 - .84) * i / 42;
                p.push({ x: h.x + Math.cos(a) * (h.radius - h.width), y: h.y + Math.sin(a) * (h.radius - h.width) });
            }
            this.polygon(p, color, alpha, color);
        }
        if (warn && !h.friendly) {
            const q = project(h);
            this.graphics.lineStyle(2, 0xf2daba, .8);
            this.graphics.lineBetween(q.x - 7, q.y - 6, q.x + 7, q.y + 6);
            this.graphics.lineBetween(q.x - 7, q.y + 6, q.x + 7, q.y - 6);
        }
    }
    renderActor(a: Actor) {
        const e = this.engine!, base = a.kind === 'player' ? 112 : a.boss ? (a.kind === 'troll' ? 155 : a.kind === 'spider' ? 133 : 126) : a.kind === 'troll' ? 104 : a.kind === 'warg' ? 70 : a.kind === 'spider' ? 54 : a.kind === 'goblin' ? 57 : 78;
        let img = this.actorImages.get(a.id);
        if (!img) {
            const key = a.kind === 'regent' ? 'wight' : a.kind === 'resident' ? 'player' : a.kind;
            img = this.add.image(0, 0, 'world', key).setOrigin(.5, .94);
            this.actorImages.set(a.id, img);
        }
        let pose=0;
        const enemyRow=({goblin:0,orc:1,troll:2,warg:3,uruk:4,wight:5,nazgul:6,spider:7,regent:5} as Record<string,number>)[a.kind];
        if(a.kind==='player'){
            if(a.hp<=0)pose=11;else if(e.dodgeTime>0)pose=9;else if(a.flash>0)pose=10;else if(e.strike){const st=e.strike;pose=st.age<st.impact?4:st.age<st.impact+.07?5:st.age<st.duration*.74?6:7;}else if(e.secondaryHeld)pose=8;else if(a.state==='approach')pose=[1,2,3,2][Math.floor(e.clock*9)%4];
            const family=item(e.save,'weapon')?.family??'sword';
            if(family!=='sword'&&a.hp>0){const st=e.strike;const weaponPose=st?(st.age<st.impact?1:st.age<st.impact+.10?2:3):e.secondaryHeld?1:0;img.setTexture('weapons',(family==='axe'?4:0)+weaponPose).setOrigin(.5,.90);}else img.setTexture('traveller',pose).setOrigin(.5,.90);
        } else if(enemyRow!==undefined){
            const follow=e.hazards.some(h=>h.source===a.id&&h.shape==='cone'&&h.delay<=0&&h.life>0);
            pose=a.flash>0||a.state==='stagger'?3:a.state==='telegraph'?1:a.state==='attack'||follow?2:0;
            img.setTexture(enemyRow>=4?'dark-enemies':'enemies',(enemyRow%4)*4+pose).setOrigin(.5,.94);
        }
        const pp = project(a), moving = a.state === 'approach' || a.state === 'patrol', bob = moving ? Math.sin(e.clock * 12 + a.spawn.x) * 2.5 : Math.sin(e.clock * 2.1) * .6;
        let stretch = 1, angle = 0;
        if (a.state === 'attack') {
            stretch = 1.05;
            angle = Math.sin(a.timer * 18) * .12;
        }
        else if (a.state === 'telegraph') {
            stretch = .94;
            angle = -.06;
        }
        else if (a.state === 'stagger')
            angle = Math.sin(e.clock * 30) * .09;
        if (a.hp <= 0) {
            img.setAlpha(Math.max(0,.8-a.deadTime*.2)).setRotation(a.kind==='player'?0:Math.min(1.45,a.deadTime*3)).setScale(base/img.height);img.setDepth(pp.y+5);if(a.kind==='player')img.setPosition(pp.x,pp.y);
            img.y = pp.y;
            return;
        }
        if (a.boss && a.kind === 'nazgul' && a.phase === 0) {
            let mount = this.actorImages.get('boss-mount');
            if (!mount) {
                mount = this.add.image(0, 0, 'enemies', 12).setOrigin(.5, .9);
                this.actorImages.set('boss-mount', mount);
            }
            mount.setPosition(pp.x, pp.y + 8).setScale(125 / mount.height).setDepth(pp.y + 9).setFlipX(Math.cos(a.angle) - Math.sin(a.angle) < 0);
            pp.y -= 38;
        }
        if(a.lunge?.kind==='leap')pp.y-=Math.sin(Math.min(1,(.42-a.timer)/.42)*Math.PI)*45;
        const s = base / img.height;
        img.setPosition(pp.x, pp.y + bob).setDepth(project(a).y + 12).setScale(s * stretch, s / stretch).setRotation(angle).setFlipX(Math.cos(a.angle) - Math.sin(a.angle) < 0).setAlpha(a.invuln > 0 ? .7 : 1);
        if (a.flash > 0)
            img.setTint(0xffd7b0);
        else if (a.kind === 'regent')
            img.setTint(0xd7a683);
        else if (a.kind === 'player' && e.save.cloak > 0)
            img.setTint([0xffffff, 0xb7ccd5, 0xd6b087, 0xcab8d1, 0xe1ceb0, 0xbbcfb6][e.save.cloak]);
        else
            img.clearTint();
        const g = this.graphics;
        this.groundFX.fillStyle(0x0c1511,.33);this.groundFX.fillEllipse(pp.x,pp.y+2,a.radius*2.4,a.radius*.85);
        if (a.id !== 'player' && !a.boss && a.hp < a.maxHp) {
            g.fillStyle(0x141d18, .9);
            g.fillRect(pp.x - 22, pp.y - base - 8, 44, 4);
            g.fillStyle(0xc2a264, 1);
            g.fillRect(pp.x - 22, pp.y - base - 8, 44 * a.hp / a.maxHp, 4);
        }
        weaponRig(g,a,e);
        if (a.id === 'player') {
            if (a.barrier > 0)
                this.circle(a, 36, 0xd6ceac, .12);
            if (e.dodgeTime > 0)
                this.circle(a, 27, 0xe5dfc0, .1);
            if ((item(e.save, 'armour')?.upgrade ?? 0) > 0) {
                g.lineStyle(2, 0xc2a264, .7);
                g.lineBetween(pp.x - 8, pp.y - 39, pp.x + 8, pp.y - 31);
            }

        }
    }
    update(_time: number, delta: number) {
        const cpuStart = performance.now();
        if (!this.engine?.player)
            return;
        const e = this.engine;
        this.onTick();
        this.accumulator += Math.min(delta, 100) / 1000;
        let steps = 0;
        while (this.accumulator >= 1 / 60 && steps < 6) {
            e.tick(1 / 60);
            this.accumulator -= 1 / 60;
            steps++;
        }
        this.graphics.clear();this.groundFX.clear();
        this.weather.clear();
        const pp = project(e.player);
        const dt=Math.min(delta,100)/1000, running=['HOME','EXPLORING','BOSS_FIGHT','STAGE_COMPLETE'].includes(e.state);
        let occluded=0;
        for(const prop of this.staticGroup){
            if(!(prop instanceof Phaser.GameObjects.Image))continue;
            const view=this.cameras.main.worldView,visible=prop.x>view.left-240&&prop.x<view.right+240&&prop.y>view.top-100&&prop.y<view.bottom+300;
            prop.setVisible(visible);if(!visible)continue;
            if(prop.getData('occludes')){
                const target=canopyTarget({x:prop.x,y:prop.y,width:prop.displayWidth,height:prop.displayHeight},pp);
                prop.setAlpha(easeAlpha(prop.alpha,target,dt));occluded=Math.max(occluded,1-prop.alpha);
            }
            if(prop.getData('wind'))prop.setRotation(Math.sin(e.clock*.65+prop.getData('phase'))*.008);
        }
        const playerImage=this.actorImages.get('player');
        if(playerImage){this.silhouette.setTexture(playerImage.texture.key,playerImage.frame.name).setPosition(playerImage.x,playerImage.y).setScale(playerImage.scaleX,playerImage.scaleY).setFlipX(playerImage.flipX).setRotation(playerImage.rotation).setAlpha(occluded*.40);}
        this.drawWater();
        if (this.exporting) { }
        else if (!this.cameraReady) {
            this.cameras.main.centerOn(pp.x, pp.y - 30);
            this.cameraReady = true;
        }
        else {
            const cam = this.cameras.main;
            cam.centerOn(Phaser.Math.Linear(cam.midPoint.x, pp.x, 1-Math.exp(-dt*7)), Phaser.Math.Linear(cam.midPoint.y, pp.y - 20, 1-Math.exp(-dt*7)));
        }
        if (e.season === 'Winter') {
            if (e.player.state === 'approach' && e.clock - this.lastFoot > .22) {
                this.footprints.push({ p: { x: e.player.x, y: e.player.y }, life: 12 });
                if (this.footprints.length > 40)
                    this.footprints.shift();
                this.lastFoot = e.clock;
            }
            for (const f of this.footprints) {
                f.life -= Math.min(delta, 100) / 1000;
                const p = project(f.p);
                this.graphics.fillStyle(0x536d6b, Math.max(0, f.life / 12) * .4);
                this.graphics.fillEllipse(p.x - 3, p.y, 3, 6);
                this.graphics.fillEllipse(p.x + 3, p.y + 3, 3, 6);
            }
            this.footprints = this.footprints.filter(f => f.life > 0);
        }
        for (const h of e.hazards) this.hazard(h);
        this.combatFX.draw(this.graphics,running?dt:0);
        if (e.shelter)
            this.circle(e.shelter, e.shelterRadius, 0xf2d298, .14);
        if (e.state === 'HOME' || e.state === 'PAUSED' && e.previous === 'HOME') {
            for (const [slot, id] of Object.entries(e.save.assignments))
                if (slot.startsWith('socket')) {
                    const p = toWorld({ x: slot === 'socket1' ? 7 : 13, y: 8 });
                    this.circle(p, 90, ringById[id].color, .12);
                    const q = project(p);
                    this.graphics.lineStyle(3, ringById[id].color, .6);
                    for (let n = 0; n < 5; n++) {
                        const a = e.clock * .5 + n * 1.256;
                        this.graphics.strokeEllipse(q.x + Math.cos(a) * 35, q.y + Math.sin(a) * 15 - 20, 8, 12);
                    }
                }
        }
        for (const a of [e.player, ...e.enemies])
            this.renderActor(a);
        for (const [id, img] of this.actorImages)
            if (id !== 'player' && !e.enemies.some(a => a.id === id) && !(id === 'boss-mount' && e.enemies.some(a => a.boss && a.kind === 'nazgul' && a.phase === 0 && a.hp > 0))) {
                img.destroy();
                this.actorImages.delete(id);
            }
        for (const o of e.objects) {
            if(!this.objectImages.has(o.id))this.object(o);
            const img = this.objectImages.get(o.id);
            if (img) {
                const op = project(o);
                img.setPosition(op.x, op.y).setDepth(op.y);
                img.setVisible(!o.done || ['objective', 'cart', 'cache'].includes(o.kind));
                if (o.done)
                    img.setTint(0x6e8176).setAlpha(.6);
            }
            if (!o.done && ['objective', 'ring', 'checkpoint'].includes(o.kind)) {
                const p = project(o), r = o.kind === 'ring' ? 10 : 7;
                this.graphics.lineStyle(1.5, 0xe4c88c, .8);
                this.graphics.strokePoints([{ x: p.x, y: p.y - 95 - r }, { x: p.x + r, y: p.y - 95 }, { x: p.x, y: p.y - 95 + r }, { x: p.x - r, y: p.y - 95 }], true);
            }
        }
        for (const p of e.projectiles) {
            const q = project(p), tail = project({ x: p.x - p.vx * .035, y: p.y - p.vy * .035 });
            this.graphics.lineStyle(p.kind === 'venom' ? 4 : 2, p.friendly ? (p.kind === 'venom' ? 0xa4b965 : 0xe4d8bc) : 0xeea26f, 1);
            this.graphics.lineBetween(tail.x,tail.y-30,q.x,q.y-30);
            const len=Math.max(1,Math.hypot(q.x-tail.x,q.y-tail.y)),dx=(q.x-tail.x)/len,dy=(q.y-tail.y)/len;this.graphics.fillStyle(p.friendly?0xf4ead1:0xeeaa81,1);this.graphics.fillTriangle(q.x+dx*5,q.y-30+dy*5,q.x-dx*4-dy*3,q.y-30-dy*4+dx*3,q.x-dx*4+dy*3,q.y-30-dy*4-dx*3);
        }
        for (const c of e.loot) {
            const p = project(c);
            this.graphics.fillStyle(0xd3b86e, 1);
            this.graphics.fillEllipse(p.x, p.y, 6, 3);
        }
        const near = e.objects.filter(o => !o.done && distance(o, e.player) < 110 && (o.kind !== 'exit' || e.state === 'STAGE_COMPLETE')).sort((a, b) => distance(a, e.player) - distance(b, e.player))[0];
        if (near && ['EXPLORING', 'STAGE_COMPLETE'].includes(e.state)) {
            const p = project(near);
            const mobile=this.scale.width<600,cam=this.cameras.main,view=cam.worldView;
            this.labels.setWordWrapWidth(mobile?210:320).setText((mobile?'':'['+(e.save.settings.bindings.interact??'KeyF').replace('Key','')+'] ')+near.label).setVisible(true);
            const half=this.labels.displayWidth/2,padding=10/cam.zoom;
            this.labels.setPosition(Phaser.Math.Clamp(p.x,view.left+half+padding,view.right-half-padding),p.y-88);
        }
        else
            this.labels.setVisible(false);
        if (this.placement) {
            const b = this.placement, f = footprint(b), valid = validPlacement(e.save, b, b.id), points = [{ x: f.x * CELL, y: f.y * CELL }, { x: (f.x + f.w) * CELL, y: f.y * CELL }, { x: (f.x + f.w) * CELL, y: (f.y + f.h) * CELL }, { x: f.x * CELL, y: (f.y + f.h) * CELL }];
            this.polygon(points, valid ? 0xb3c79e : 0xe3a17e, .3, valid ? 0xe7e5ba : 0xf7ad85);
        }
        for (const f of [...this.floats]) {
            f.life -= Math.min(delta, 60) / 1000;
            f.text.y -= delta * .027;
            f.text.setAlpha(Math.min(1, f.life * 2));
            if (f.life <= 0) {
                f.text.destroy();
                this.floats = this.floats.filter(x => x !== f);
            }
        }
        if (e.save.settings.weather && e.save.settings.quality === 'high') {
            const n = e.season === 'Winter' ? 26 : e.season === 'Spring' ? 32 : e.season === 'Autumn' ? 14 : 7;
            const w = this.scale.width, h = this.scale.height;
            for (let i = 0; i < n; i++) {
                const x = (i * 137.31 + e.clock * (e.season === 'Spring' ? -20 : 8)) % w, y = (i * 71.17 + e.clock * (e.season === 'Spring' ? 170 : 20)) % h;
                this.weather.fillStyle(e.season === 'Winter' ? 0xdbe6df : e.season === 'Autumn' ? 0xc2a264 : 0xa7c4bd, .32);
                if (e.season === 'Spring') {
                    this.weather.lineStyle(1, 0xa7c4bd, .18);
                    this.weather.lineBetween(x, y, x - 2, y + 9);
                }
                else
                    this.weather.fillEllipse(x, y, e.season === 'Autumn' ? 4 : 2, 2);
            }
        }
        if ((e.state === 'HOME' || e.state === 'PAUSED' && e.previous === 'HOME') && e.season === 'Winter') {
            for (const b of e.save.buildings.filter(b => ['shelter', 'forge', 'watchtower'].includes(b.kind))) {
                const f = footprint(b), p = project(toWorld({ x: f.x + f.w / 2 - .5, y: f.y + f.h / 2 - .1 }));
                this.graphics.lineStyle(4, 0xe0e7d5, .48);
                this.graphics.lineBetween(p.x - 27, p.y - 100, p.x + 21, p.y - 115);
            }
        }
        if (e.clock - this.lastMini > .25) {
            this.drawMini();
            this.lastMini = e.clock;
        }
        this.cpuMs = performance.now() - cpuStart;
    }
    exportStronghold(done: (blob: Blob) => void) { const e = this.engine!, cam = this.cameras.main, zoom = cam.zoom, center = { x: cam.midPoint.x, y: cam.midPoint.y }; this.exporting = true; const p = project({ x: e.map.width * CELL / 2, y: e.map.height * CELL / 2 }); cam.setZoom(Math.min(this.scale.width / ((e.map.width + e.map.height) * CELL * .88 + 180), this.scale.height / ((e.map.width + e.map.height) * CELL * .44 + 180))); cam.centerOn(p.x, p.y - 40); setTimeout(() => { this.game.canvas.toBlob(blob => { if (blob)
        done(blob); this.exporting = false; cam.setZoom(zoom); cam.centerOn(center.x, center.y); }); }, 120); }
}
