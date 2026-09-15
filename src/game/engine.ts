import { narrative } from '../content/story';
import { message } from '../content/messages';
import type { State, Save, Actor, WorldMap, WorldObject, StageDef, Point, Hazard, Projectile, RingId, AttackKind, Season, Family } from '../types';
import { STAGES, stageById } from '../content/stages';
import { RINGS, ringById, SYNERGIES } from '../content/rings';
import { t } from '../content/strings';
import { SaveStore } from '../systems/saves';
import { seasonAt, seasonalDamage } from '../systems/seasons';
import { highest, maxHp, maxStamina, weaponDamage, item, inSlot, effectiveRank, rankPower, ringCooldown, hasTalent, discoverRing, synergyReady, addItem, makeItem, addXp } from '../systems/progression';
import { once, credit, grantBoss, objectiveReward } from '../systems/economy';
import { makeMap, homeMap, moveWithCollision, lineOfSight, canStand, CELL, toWorld } from '../world/maps';
import { actor, distance, angleTo, angleDiff, hitHazard, incomingDamage, refillPlayer, tickCooldowns } from './combat';
export type GameEvent = {
    type: 'world' | 'ui' | 'toast' | 'sound' | 'hit' | 'state' | 'reward' | 'float';
    text?: string;
    key?: string;
    p?: Point;
    value?: number;
};
export class Engine {
    state: State = 'BOOT';
    presentationEnabled = false;
    storyId = '';
    storyReturn: State = 'EXPLORING';
    presentStory(id: string, back: State = this.state) {
        if (!this.presentationEnabled || !narrative[id] || this.save.claimed.includes('story-' + id)) return;
        this.storyId = id; this.storyReturn = back; this.clearInputs(); this.setState('STORY');
    }
    finishStory() {
        if (this.state !== 'STORY') return;
        const key = 'story-' + this.storyId;
        if (!this.save.claimed.includes(key)) this.save.claimed.push(key);
        this.persist(); this.clearInputs(); this.setState(this.storyReturn);
    }
    previous: State = 'HOME';
    map!: WorldMap;
    stage: StageDef = STAGES[0];
    season: Season = 'Spring';
    player!: Actor;
    enemies: Actor[] = [];
    objects: WorldObject[] = [];
    hazards: Hazard[] = [];
    projectiles: Projectile[] = [];
    loot: (Point & {
        id: string;
        gold: number;
    })[] = [];
    events: ((e: GameEvent) => void)[] = [];
    elapsed = 0;
    clock = 0;
    mode: 'campaign' | 'hard' | 'gauntlet' | 'defence' = 'campaign';
    run = 0;
    checkpointReached = false;
    counter = 0;
    pending = new Map<string, AttackKind>();
    synergyCd: Record<string, number> = {};
    dodgeTime = 0;
    barrierTime = 0;
    shelterTime = 0;
    shelter: Point | null = null;
    shelterLeft = 0;
    shelterRadius = 110;
    charge = 0;
    secondaryHeld = false;
    guardStarted = 0;
    lastAim: Point = { x: 1, y: 0 };
    inputMove: Point = { x: 0, y: 0 };
    aim: Point | null = null;
    attackHeld = false;
    stopTime = 0;
    spawnTimer = 0;
    wave = 0;
    dummyDamage = 0;
    lastStep = 0;
    inputEnabled = true;
    bossName = '';
    strike: {weapon:Family;age:number;impact:number;duration:number;angle:number;radius:number;width:number;damage:number;charged:boolean;applied:boolean;combo:number}|null=null;
    escortMoving = false;
    escortTarget = 0;
    escortPath: Point[] = [];
    ritual: {
        object: WorldObject;
        remaining: number;
    } | null = null;
    tutorial = 0;
    constructor(public save: Save, public store: SaveStore) { }
    emit(e: GameEvent) { for (const listener of this.events)
        listener(e); }
    toast(text: string) { this.emit({ type: 'toast', text }); }
    setState(state: State) { this.state = state; this.emit({ type: 'state' }); }
    persist() { void this.store.put(this.save); }
    resetTransient() { this.strike=null; this.enemies = []; this.objects = []; this.hazards = []; this.projectiles = []; this.loot = []; this.pending.clear(); this.synergyCd = {}; this.inputMove = { x: 0, y: 0 }; this.attackHeld = false; this.secondaryHeld = false; this.charge = 0; this.aim = null; this.dodgeTime = 0; this.barrierTime = 0; this.shelterTime = 0; this.shelter = null; this.stopTime = 0; this.escortMoving = false; this.escortTarget = 0; this.escortPath = []; this.ritual = null; }
    start() { const cp = this.save.checkpoint; if (cp.where === 'home')
        this.loadHome();
    else
        this.loadMission(cp.stage, cp.boss, true, cp.mode); }
    loadHome() { this.resetTransient(); this.map = homeMap(this.save); this.season = seasonAt(this.save.day); this.player = actor('player', 'player', this.map.spawn, maxHp(this.save)); refillPlayer(this.save, this.player); this.save.checkpoint = { where: 'home', stage: Math.min(30, highest(this.save) + 1), boss: false, season: this.season, runId: this.save.runId, mode: 'campaign', objectives: [] }; this.mode = 'campaign'; this.setState('HOME'); this.emit({ type: 'world' }); this.persist(); this.toast(this.save.tier === 0 ? t('firstHome') : t('walkHome')); if (this.save.cleared.includes(1) && this.save.tier === 0) this.presentStory('first-home'); else { const chapter=Math.floor(highest(this.save)/5)-1; if(chapter>=0) this.presentStory('return-'+chapter); } }
    loadMission(id: number, boss = false, resume = false, mode: Engine['mode'] = 'campaign') {
        this.resetTransient();
        this.stage = stageById(id);
        this.mode = mode;
        this.season = resume ? this.save.checkpoint.season : seasonAt(this.save.day);
        this.map = makeMap(this.stage, this.season);
        this.elapsed = 0;
        this.checkpointReached = boss;
        this.run = resume ? this.save.checkpoint.runId : ++this.save.runId;
        const done = resume ? this.save.checkpoint.objectives : [];
        this.player = actor('player', 'player', boss ? this.map.checkpoint : this.map.spawn, maxHp(this.save));
        refillPlayer(this.save, this.player);
        this.map.objectives.forEach((p, i) => this.objects.push({ ...p, id: `objective-${id}-${i}`, kind: 'objective', label: this.stage.objective, done: boss || done.includes(i), hp: 100, index: i, optional: false }));
        if (this.stage.kind === 'escort') {
            this.escortTarget = this.objects.filter(o => o.kind === 'objective' && o.done).length;
            this.objects.push({ ...this.escortTarget ? this.map.objectives[this.escortTarget - 1] : this.map.spawn, id: 'supply-cart', kind: 'cart', label: message("engine.001"), done: boss, hp: 100, index: 0, optional: false });
        }
        this.map.caches.forEach((p, i) => this.objects.push({ ...p, id: `cache-${id}-${i}`, kind: 'cache', label: 'Traveller’s cache', done: this.save.claimed.includes(`cache-${id}-${i}`), hp: 0, index: i, optional: true }));
        this.objects.push({ ...this.map.checkpoint, id: 'checkpoint', kind: 'checkpoint', label: message("engine.002"), done: false, hp: 0, index: 0, optional: false }, { ...this.map.exit, id: 'exit', kind: 'exit', label: message("engine.003"), done: false, hp: 0, index: 0, optional: false });
        const inscription = { ...this.map.caches[0], x: this.map.caches[0].x + 52 };
        this.objects.push({ ...inscription, id: 'inscription', kind: 'inscription', label: message("engine.004"), done: false, hp: 0, index: 0, optional: true });
        if ([8, 9, 21, 28].includes(id))
            this.objects.push({ ...this.map.caches[2], x: this.map.caches[2].x + 30, id: 'dark-ward', kind: 'ward', label: message("engine.005"), done: false, hp: 85, index: 0, optional: true });
        if (id === 1) {
            const p = toWorld({ x: 10, y: 14 });
            this.objects.push({ ...p, id: 'ember-discovery', kind: 'ring', label: message("engine.006"), done: !!this.save.rings.ember, hp: 0, index: 0, optional: false }, { ...toWorld({ x: 19, y: 9 }), id: 'bramble', kind: 'bramble', label: message("engine.007"), done: false, hp: 30, index: 0, optional: true });
        }
        if (!boss) {
            for (let ri = id === 1 ? 1 : 1; ri < this.map.rooms.length - 1; ri++) {
                const r = this.map.rooms[ri];
                const count = id === 1 ? (ri === 1 ? 1 : 2) : 2 + Math.floor(id / 9);
                for (let i = 0; i < count; i++) {
                    const p = toWorld({ x: r.x + 2 + (i * 2) % Math.max(3, r.w - 3), y: r.y + 2 + Math.floor(i / 2) * 2 });
                    const kinds: Actor['kind'][] = id === 1 ? (ri === 1 ? ['goblin'] : ['orc', 'goblin']) : this.stage.chapter === 1 ? ['spider', 'goblin', 'wight'] : this.stage.chapter === 4 ? ['wight', 'warg'] : this.stage.chapter === 2 ? ['orc', 'troll', 'goblin'] : ['orc', 'uruk', 'warg'];
                    const e = actor(`enemy-${id}-${ri}-${i}`, kinds[i % kinds.length], p, 37 + id * 8);
                    e.state = 'patrol';
                    e.angle = (i + ri) * 1.5;
                    this.enemies.push(e);
                }
            }
        }
        this.save.checkpoint = { where: 'mission', stage: id, boss, season: this.season, runId: this.run, mode, objectives: this.objects.filter(o => o.kind === 'objective' && o.done).map(o => o.index) };
        this.setState('EXPLORING');
        this.emit({ type: 'world' });
        this.persist();
        this.toast(id === 1 && !this.save.rings.ember ? t('firstInstruction') : this.stage.objective);
        if (boss)
            this.toast(t('checkpoint'));
        else if (id === 1 && !this.save.rings.ember && !done.length) this.presentStory('prologue');
        else if (id % 5 === 1) this.presentStory('chapter-' + this.stage.chapter);
    }
    refreshHome() { if (this.state === 'HOME' || this.state === 'PAUSED' && this.previous === 'HOME') {
        const p = { x: this.player.x, y: this.player.y };
        this.map = homeMap(this.save);
        if (canStand(this.map, p))
            Object.assign(this.player, p);
        else
            Object.assign(this.player, this.map.spawn);
        this.emit({ type: 'world' });
    } }
    clearInputs() { this.inputMove = { x: 0, y: 0 }; this.attackHeld = false; this.secondaryHeld = false; this.charge = 0; this.aim = null; }
    pause() { if (['EXPLORING', 'BOSS_FIGHT', 'HOME', 'STAGE_COMPLETE'].includes(this.state)) {
        this.previous = this.state;
        this.setState('PAUSED');
        this.clearInputs();
    } }
    resume() { if (this.state === 'PAUSED') {
        this.setState(this.previous);
        this.clearInputs();
    } }
    objectiveComplete() { return this.objects.filter(o => o.kind === 'objective' || o.kind === 'cart').every(o => o.done); }
    objectiveText() { if (this.state === 'HOME' || this.state === 'PAUSED' && this.previous === 'HOME')
        return this.save.tier === 0 ? message("engine.008") : `Your ${['camp', 'camp', 'cottage', message("engine.009"), 'courtyard', 'castle'][this.save.tier]} awaits`; if (this.state === 'BOSS_FIGHT')
        return this.stage.test; const total = this.objects.filter(o => ['objective', 'cart'].includes(o.kind)); const done = total.filter(o => o.done).length; if (done === total.length)
        return this.stage.id === 1 && !this.save.rings.ember ? message("engine.010") : message("engine.011"); return `${this.stage.objective} · ${done}/${total.length}`; }
    interact() {
        if (this.state === 'HOME') {
            this.emit({ type: 'ui', key: 'home-interact' });
            return;
        }
        if (this.state !== 'EXPLORING' && this.state !== 'STAGE_COMPLETE')
            return;
        const nearby = this.objects.filter(o => !o.done && distance(o, this.player) < 115 && o.kind !== 'bramble' && (o.kind !== 'exit' || this.state === 'STAGE_COMPLETE')).sort((a, b) => distance(a, this.player) - distance(b, this.player));
        const o = nearby[0];
        if (!o)
            return;
        if (o.kind === 'checkpoint') {
            if (!this.objectiveComplete() || this.stage.id === 1 && !this.save.rings.ember) {
                this.toast(t('bossLocked'));
                return;
            }
            if (!this.checkpointReached) {
                this.checkpointReached = true;
                this.save.checkpoint.boss = true;
                this.enemies = [];
                refillPlayer(this.save, this.player);
                this.persist();
                this.toast(t('checkpoint'));
            }
            this.setState('BOSS_INTRO');
            this.emit({ type: 'sound', key: 'boss' });
            return;
        }
        if (o.kind === 'exit') {
            this.loadHome();
            return;
        }
        if (o.kind === 'inscription') {
            o.done = true;
            this.toast(this.stage.story);
            return;
        }
        if (this.enemies.some(e => e.hp > 0 && distance(e, o) < 160)) {
            this.toast(message("engine.012"));
            return;
        }
        if (o.kind === 'ring') {
            once(this.save, 'ring-ember', () => discoverRing(this.save, 'ember'));
            o.done = true;
            this.toast(t('emberInstruction'));
            this.emit({ type: 'sound', key: 'ring' });
            this.persist();
            this.emit({ type: 'reward', key: 'ember' });
            this.presentStory('ember');
            return;
        }
        if (o.kind === 'cache') {
            if (o.index === 2 && this.objects.some(w => w.kind === 'ward' && !w.done)) {
                this.toast(message("engine.013"));
                return;
            }
            if (this.season === 'Spring' && o.index === 0 && this.map.tiles[Math.floor(this.map.seasonal.y/CELL)]?.[Math.floor(this.map.seasonal.x/CELL)] === 2) {
                this.toast(message("engine.014"));
                return;
            }
            once(this.save, o.id, () => { credit(this.save, { gold: 18 + this.stage.id * 3, wood: 4, stone: 3, shards: 3 }); if (o.index === 1)
                addItem(this.save, makeItem(this.stage.id, this.stage.id * 373 + 1)); this.save.stats.secrets++; });
            o.done = true;
            this.persist();
            this.toast(message("engine.015"));
            this.emit({ type: 'sound', key: 'loot' });
            return;
        }
        if (o.kind === 'cart') {
            if (this.escortMoving)
                return;
            this.escortMoving = true;
            this.escortPath = this.findPath(o, this.map.objectives[this.escortTarget]);
            this.toast(message("engine.016"));
            return;
        }
        if (o.kind === 'objective') {
            if (this.stage.kind === 'escort') {
                this.toast(message("engine.017"));
                return;
            }
            if (this.stage.kind === 'beacon' && !this.ritual) {
                this.ritual = { object: o, remaining: 10 };
                for (let i = 0; i < 2; i++) {
                    const p = { x: o.x + Math.cos(i * 3.14) * 120, y: o.y + Math.sin(i * 3.14) * 120 };
                    if (canStand(this.map, p)) {
                        const enemy = actor('ritual-' + o.index + '-' + i, 'goblin', p, 35 + this.stage.id * 5);
                        enemy.state = 'notice';
                        enemy.timer = 1;
                        this.enemies.push(enemy);
                    }
                }
                this.toast(message("engine.018"));
                return;
            }
            if (!this.ritual)
                this.completeObjective(o);
        }
    }
    completeObjective(o: WorldObject) { o.done = true; const count = this.objects.filter(x => x.kind === 'objective').length; objectiveReward(this.save, this.stage.id, o.index, count); this.save.checkpoint.objectives = this.objects.filter(x => x.kind === 'objective' && x.done).map(x => x.index); this.player.maxHp = maxHp(this.save); this.player.hp = Math.min(this.player.maxHp, this.player.hp + 12); this.persist(); this.toast(this.objectiveComplete() ? t('objectiveDone') : this.stage.kind === 'bridge' ? message("engine.019") : this.stage.kind === 'rescue' ? message("engine.020") : message("engine.021")); this.emit({ type: 'sound', key: 'loot' }); if(this.stage.id===1) this.presentStory('alda'); }
    findPath(from: Point, to: Point) { const start = { x: Math.floor(from.x / CELL), y: Math.floor(from.y / CELL) }, end = { x: Math.floor(to.x / CELL), y: Math.floor(to.y / CELL) }, q = [start], parent = new Map<string, Point | null>([[`${start.x},${start.y}`, null]]); for (let i = 0; i < q.length; i++) {
        const p = q[i];
        if (p.x === end.x && p.y === end.y) {
            const route: Point[] = [];
            let point: Point | null = p;
            while (point) {
                route.push(toWorld(point));
                point = parent.get(`${point.x},${point.y}`) ?? null;
            }
            return route.reverse();
        }
        for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
            const n = { x: p.x + d.x, y: p.y + d.y };
            const key = `${n.x},${n.y}`;
            if (parent.has(key) || !canStand(this.map, toWorld(n), 12))
                continue;
            parent.set(key, p);
            q.push(n);
        }
    } return []; }
    beginBoss() {
        this.enemies = [];
        this.hazards = [];
        this.projectiles = [];
        const hp = (380 + this.stage.id * 100 + (this.stage.major ? this.stage.id * 28 : 0)) * (this.mode === 'hard' ? 1.35 : 1);
        const boss = actor('boss', this.stage.enemy, this.map.arena, hp, true);
        boss.state = 'notice';
        boss.timer = 1.1;
        boss.speed = this.stage.enemy === 'warg' ? 145 : 88;
        this.enemies = [boss];
        this.objects = this.objects.filter(o => !['pillar', 'anchor', 'banner', 'web', 'mine', 'ballista'].includes(o.kind));
        const positions = [{ x: -150, y: -120 }, { x: 145, y: -100 }, { x: 135, y: 130 }];
        if ([5, 7, 15, 17, 18, 30].includes(this.stage.id)) {
            positions.forEach((p, i) => this.objects.push({ x: this.map.arena.x + p.x, y: this.map.arena.y + p.y, id: 'arena-' + i, kind: this.stage.id === 5 || this.stage.id === 7 ? 'pillar' : this.stage.id === 17 ? 'ballista' : this.stage.id === 18 ? 'banner' : 'anchor', label: this.stage.id === 5 ? message("engine.022") : message("engine.023"), done: false, hp: this.stage.id === 30 ? 90 : 65, index: i, optional: true }));
        }
        this.setState('BOSS_FIGHT');
        this.toast(this.stage.test);
        this.emit({ type: 'world' });
    }
    retry() { this.save.stats.deaths++; this.loadMission(this.stage.id, this.checkpointReached, true, this.mode); if (this.checkpointReached)
        this.setState('BOSS_INTRO'); }
    secondary(down: boolean) { const w = item(this.save, 'weapon')?.family ?? 'sword'; if (down && !this.secondaryHeld) {
        this.guardStarted = this.clock;
        this.charge = 0;
    } if (!down && this.secondaryHeld && w !== 'sword' && this.charge > .12)
        this.attack(true); this.secondaryHeld = down; }
    updateAim() { if (this.aim) {
        this.player.angle = angleTo(this.player, this.aim);
        return;
    } if ((this.save.settings.aimAssist || this.save.settings.keyboardAim) && this.enemies.length) {
        const target = this.enemies.filter(e => e.hp > 0 && distance(e, this.player) < 480 && lineOfSight(this.map, this.player, e)).sort((a, b) => distance(a, this.player) - distance(b, this.player))[0];
        if (target && this.attackHeld) {
            this.player.angle = angleTo(this.player, target);
            return;
        }
    } if (Math.hypot(this.inputMove.x, this.inputMove.y) > .1)
        this.player.angle = Math.atan2(this.inputMove.y, this.inputMove.x); }
    attack(charged = false) {
        if (!['EXPLORING', 'BOSS_FIGHT', 'HOME'].includes(this.state) || this.player.attackCd > 0)
            return;
        const p = this.player, w = item(this.save, 'weapon')?.family ?? 'sword', base = weaponDamage(this.save);
        p.combo = p.combo % 3 + 1;
        p.state = 'attack';
        p.timer = w === 'axe' ? .55 : w === 'bow' ? .36 : .32;
        const scale = charged ? 1 + Math.min(1.5, this.charge) * .65 : 1 + (p.combo === 3 ? .22 + (hasTalent(this.save, 'ranger9') ? .12 : 0) : 0);
        const damage = base * scale * (w === 'bow' && hasTalent(this.save, 'ranger7') ? 1.06 : 1);
        p.attackCd = (w === 'axe' ? .76 : w === 'bow' ? .55 : .38) * (1 - (hasTalent(this.save, 'ranger2') ? .04 : 0) - (inSlot(this.save, 'echo', 'support') ? .05 : 0));
        this.strike={weapon:w,age:0,impact:w==='axe'?.18:w==='bow'?.12:.075,duration:p.timer,angle:p.angle,radius:(w==='axe'?148:112)+(hasTalent(this.save,'ranger4')?10:0),width:w==='axe'?2.1:1.7,damage,charged,applied:false,combo:p.combo};
        if (p.echo > 0) {
            p.echo = 0;
            const rank = effectiveRank(this.save, 'echo'), echoPower = rank >= 7 ? .55 : rank >= 4 ? .5 : .45;
            this.addHazard({ x: p.x, y: p.y, shape: 'cone', radius: 160, angle: p.angle, width: 1.9, length: 0, delay: .35, life: .1, damage: damage * echoPower, friendly: true, color: 0xb8a2cb, kind: 'echo', source: 'secondary' });
        }
        this.emit({ type: 'sound', key: w === 'bow' ? 'bow' : 'swing' });
        this.charge = 0;
        if (this.state === 'HOME' && inSlot(this.save, 'echo', 'socket') && distance(p, toWorld({ x: 7, y: 8 })) < 180) {
            this.dummyDamage = Math.round(damage);
            this.save.bests.practiceDamage = Math.max(this.save.bests.practiceDamage ?? 0, this.dummyDamage);
            this.emit({ type: 'float', text: this.dummyDamage + ' · peak ' + this.save.bests.practiceDamage, p: toWorld({ x: 7, y: 8 }) });
        }
    }
    tickStrike(dt:number) {
        const strike=this.strike;if(!strike)return;
        strike.age+=dt;
        if(!strike.applied && strike.age>=strike.impact){
            strike.applied=true;
            if(strike.weapon==='bow')this.fire(this.player,strike.angle,650,strike.damage,true,'arrow',strike.charged?2:1);
            else {
                this.weaponSweep(this.player,strike.angle,strike.radius,strike.width,strike.damage,'primary');
                this.addHazard({x:this.player.x,y:this.player.y,shape:'cone',radius:strike.radius,angle:strike.angle,width:strike.width,length:0,delay:0,life:.18,damage:0,friendly:true,color:strike.combo===3?0xd7b878:0xe4e4d3,kind:'slash',source:'visual'});
            }
        }
        if(strike.age>=strike.duration)this.strike=null;
    }
    weaponSweep(p: Point, angle: number, radius: number, width: number, damage: number, source: string) {
        let hits = 0;
        for (const e of this.enemies) {
            if (e.hp <= 0 || distance(p, e) > radius + e.radius || Math.abs(angleDiff(angleTo(p, e), angle)) > width / 2 || !lineOfSight(this.map, p, e))
                continue;
            this.damageEnemy(e, damage, source);
            if (item(this.save, 'weapon')?.family === 'axe' && !e.boss && e.hp > 0) {
                e.state = 'stagger';
                e.timer = .4;
            }
            if (inSlot(this.save, 'ember', 'support') && e.burn <= 0) {
                e.burn = 2;
                e.burnDps = 2;
            }
            if (inSlot(this.save, 'venomcoil', 'support') && e.slow <= 0) {
                e.slow = 1;
                e.slowFactor = .95;
            }
            if (++hits >= 6)
                break;
        }
        for (const o of this.objects)
            if (!o.done && o.hp > 0 && o.kind !== 'objective' && o.kind !== 'cart' && distance(p, o) < radius + 20 && Math.abs(angleDiff(angleTo(p, o), angle)) < width / 2) {
                o.hp -= damage;
                if (o.hp <= 0) {
                    o.done = true;
                    if (o.kind === 'web')
                        this.hazards = this.hazards.filter(h => h.kind !== 'web' || distance(h, o) > 100);
                    this.emit({ type: 'sound', key: 'break' });
                    if (o.kind === 'anchor') {
                        const b = this.enemies.find(e => e.boss);
                        if (b) {
                            b.hp = Math.max(1, b.hp - b.maxHp * .06);
                            b.state = 'stagger';
                            b.timer = 1.7;
                            this.toast(message("engine.024"));
                        }
                    }
                }
            }
    }
    dodge() { if (!['EXPLORING', 'BOSS_FIGHT', 'HOME'].includes(this.state))
        return; const p = this.player, cost = 25 - (inSlot(this.save, 'frostwake', 'support') ? 3 : 0) - (hasTalent(this.save, 'ranger1') ? 2 : 0); if (p.dodgeCd > 0)
        return; if (p.stamina < cost) {
        this.toast(t('noStamina'));
        return;
    } p.stamina -= cost; p.regenDelay = .6; p.invuln = .18 + (hasTalent(this.save, 'ranger5') ? .02 : 0); p.dodgeCd = .8 * (hasTalent(this.save, 'ranger6') ? .92 : 1) * (inSlot(this.save, 'duskveil', 'support') ? .92 : 1); this.dodgeTime = .25; this.strike=null; this.player.state='idle'; this.lastAim = Math.hypot(this.inputMove.x, this.inputMove.y) > .1 ? { ...this.inputMove } : { x: Math.cos(p.angle), y: Math.sin(p.angle) }; this.emit({ type: 'sound', key: 'dodge' }); }
    heal() { if (!['EXPLORING', 'BOSS_FIGHT', 'HOME'].includes(this.state))
        return; const p = this.player; if (p.flasks <= 0) {
        this.toast(t('noCharges'));
        return;
    } if (p.hp >= p.maxHp)
        return; p.flasks--; let n = 52 + (inSlot(this.save, 'dawnward', 'support') ? 8 : 0) + (inSlot(this.save, 'venomcoil', 'socket') ? 5 : 0) + (this.save.buildings.some(b => b.kind === 'garden') ? 5 : 0); p.hp = Math.min(p.maxHp, p.hp + n); this.emit({ type: 'float', p, text: '+' + n }); this.emit({ type: 'sound', key: 'heal' }); }
    targets(range: number) { return this.enemies.filter(e => e.hp > 0 && distance(e, this.player) < range && lineOfSight(this.map, this.player, e)).sort((a, b) => distance(a, this.player) - distance(b, this.player)); }
    blink(range: number) { moveWithCollision(this.map, this.player, Math.cos(this.player.angle) * range, Math.sin(this.player.angle) * range, this.player.radius); this.player.invuln = .18; }
    ring(slot: 1 | 2) {
        if (!['EXPLORING', 'BOSS_FIGHT', 'HOME'].includes(this.state))
            return;
        const id = this.save.assignments[slot === 1 ? 'active1' : 'active2'];
        if (!id) {
            this.toast(t('noRing'));
            return;
        }
        const p = this.player;
        if ((p.cooldowns[id] ?? 0) > 0)
            return;
        if (p.silence > 0) {
            this.toast(message("engine.025"));
            return;
        }
        const r = ringById[id], rank = effectiveRank(this.save, id), power = r.power * rankPower(rank) * (1 + (hasTalent(this.save, 'ringkeeper0') ? .03 : 0)) * seasonalDamage(this.season, id);
        p.cooldowns[id] = ringCooldown(this.save, id);
        if (hasTalent(this.save, 'ringkeeper9')) {
            const other = this.save.assignments[slot === 1 ? 'active2' : 'active1'];
            if (other)
                p.cooldowns[other] = Math.max(0, (p.cooldowns[other] ?? 0) - .3);
        }
        this.emit({ type: 'sound', key: 'ring' });
        const cone = (radius: number, width: number, kind: string) => { this.addHazard({ ...p, shape: 'cone', radius: radius + (hasTalent(this.save, 'ringkeeper8') ? 15 : 0), angle: p.angle, width, length: 0, delay: 0, life: .28, damage: power, friendly: true, color: r.color, kind, source: 'primary' }); };
        switch (id) {
            case 'ember':
                cone(r.range, rank >= 4 ? 2.1 : 1.75, 'ember');
                for (const o of this.objects)
                    if (o.kind === 'bramble' && !o.done && distance(o, p) < r.range + 70) {
                        o.done = true;
                        this.toast(message("engine.026"));
                        once(this.save, 'ember-bramble-cache', () => credit(this.save, { gold: 20, wood: 5, shards: 2 }));
                        this.persist();
                    }
                if (rank >= 7)
                    this.addHazard({ x: p.x + Math.cos(p.angle) * 80, y: p.y + Math.sin(p.angle) * 80, shape: 'circle', radius: 65, angle: 0, width: 0, length: 0, delay: .3, life: 2, damage: 12, friendly: true, color: r.color, kind: 'firepatch', source: 'secondary' });
                break;
            case 'stoneward':
                p.barrier = (power + (rank >= 4 ? 10 : 0)) * (hasTalent(this.save, 'ringkeeper4') ? 1.1 : 1);
                this.barrierTime = 5;
                break;
            case 'windstep':
                this.blink(rank >= 4 ? 195 : 170);
                cone(155, 1.9, 'windstep');
                if (this.targets(300).some(e => e.burn > 0))
                    this.synergy('wildfire', () => this.targets(220).slice(0, 3).forEach(e => { e.burn = 3; e.burnDps = 4; this.damageEnemy(e, 12, 'secondary'); }));
                break;
            case 'thornwake':
                this.addHazard({ x: p.x + Math.cos(p.angle) * 100, y: p.y + Math.sin(p.angle) * 100, shape: 'circle', radius: rank >= 4 ? 100 : 85, angle: 0, width: 0, length: 0, delay: 0, life: 3, damage: power, friendly: true, color: r.color, kind: 'roots', source: 'primary' });
                this.synergy('nightgarden', () => this.targets(180).slice(0, 4).forEach(e => { e.poisonStacks = Math.min(3, e.poisonStacks + 1); e.poison = 4; }));
                break;
            case 'dawnward':
                this.addHazard({ ...p, shape: 'circle', radius: r.range + (rank >= 4 ? 15 : 0) + (hasTalent(this.save, 'ringkeeper8') ? 15 : 0), angle: 0, width: 0, length: 0, delay: 0, life: .55, damage: power, friendly: true, color: r.color, kind: 'dawnward', source: 'primary' });
                if (this.shelter && distance(p, this.shelter) < this.shelterRadius)
                    this.synergy('kindled', () => { p.hp = Math.min(p.maxHp, p.hp + 10); this.shelterRadius = 130; });
                for (const o of this.objects)
                    if (distance(p, o) < 300) {
                        if (o.kind === 'inscription')
                            this.toast(this.stage.story);
                        if (o.kind === 'ward')
                            o.done = true;
                    }
                break;
            case 'venomcoil':
                this.fire(p, p.angle, 510, power, true, 'venom', rank >= 7 ? 2 : 1);
                break;
            case 'frostwake':
                cone(r.range, rank >= 4 ? 1.83 : 1.48, 'frostwake');
                if (distance(p, this.map.seasonal) < 250) {
                    for (let y = 0; y < this.map.height; y++)
                        for (let x = 0; x < this.map.width; x++)
                            if (this.map.tiles[y][x] === 2 && distance(toWorld({x,y}),this.map.seasonal)<CELL*1.6)
                                this.map.tiles[y][x] = 3;
                    this.toast(message("engine.027"));
                    this.emit({ type: 'world' });
                }
                break;
            case 'iron-oath':
                p.guard = 1.3;
                p.counter = rank >= 4 ? .55 : .45;
                break;
            case 'echo':
                p.echo = 5;
                this.toast(message("engine.028"));
                break;
            case 'stormcall': {
                const ts = this.targets(250).slice(0, rank >= 7 ? 5 : rank >= 4 ? 4 : 3);
                for (const e of ts) {
                    this.damageEnemy(e, power, 'ring');
                    this.addHazard({ x: p.x, y: p.y, shape: 'line', radius: 0, angle: angleTo(p, e), width: 3, length: distance(p, e), delay: 0, life: .2, damage: 0, friendly: true, color: r.color, kind: 'lightning', source: 'visual' });
                }
                if (ts.some(e => e.slow > 0))
                    this.synergy('shatter', () => ts.slice(0, 3).forEach(e => this.damageEnemy(e, 16, 'secondary')));
                break;
            }
            case 'duskveil': {
                const old = { x: p.x, y: p.y };
                this.blink(160);
                this.targets(230).filter(e => !e.boss).forEach(e => { e.state = 'notice'; e.timer = rank >= 4 ? 2.5 : 2; e.target = old; });
                this.addHazard({ ...old, shape: 'circle', radius: 95, angle: 0, width: 0, length: 0, delay: .8, life: .35, damage: power, friendly: true, color: r.color, kind: 'shadow', source: 'secondary' });
                if (p.echo > 0)
                    this.synergy('aftermath', () => this.addHazard({ ...old, shape: 'circle', radius: 130, angle: 0, width: 0, length: 0, delay: 1, life: .2, damage: 18, friendly: true, color: r.color, kind: 'echo', source: 'secondary' }));
                break;
            }
            case 'last-hearth':
                this.shelter = { x: p.x, y: p.y };
                this.shelterTime = rank >= 7 ? 5 : 4;
                this.shelterLeft = rank >= 7 ? 9 : rank >= 4 ? 7 : 5;
                this.shelterRadius = 110;
                p.hp = Math.min(p.maxHp, p.hp + power * (hasTalent(this.save, 'ringkeeper7') ? 1.1 : 1));
                break;
        }
    }
    synergy(id: string, fn: () => void) { if (!synergyReady(this.save, id, this.synergyCd))
        return; const def = SYNERGIES.find(x => x.id === id)!; this.synergyCd[id] = def.cooldown * (hasTalent(this.save, 'ringkeeper3') ? .94 : 1); fn(); if (!this.save.synergies.includes(id)) {
        this.save.synergies.push(id);
        this.toast(message("engine.029") + def.name);
        this.persist();
    } }
    fire(p: Point, angle: number, speed: number, damage: number, friendly: boolean, kind = 'arrow', pierce = 1) { this.projectiles.push({ ...p, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.7, damage, friendly, kind, source: friendly ? 'player' : 'enemy', pierce, hit: new Set() }); }
    addHazard(h: Omit<Hazard, 'id' | 'hit'>) { this.hazards.push({ ...h, id: ++this.counter, hit: new Set() }); }
    damageEnemy(e: Actor, raw: number, source: string) { if (e.hp <= 0 || e.invuln > 0)
        return; let n = raw; if (e.boss && this.stage.id === 16 && e.state === 'telegraph')
        n *= .55; if (e.boss && this.stage.id === 19 && e.state === 'telegraph' && this.pending.get(e.id) === 'counter') {
        n *= .5;
    } if (e.boss && this.stage.id === 30 && e.phase === 2 && this.objects.some(o => o.kind === 'anchor' && !o.done))
        n = Math.min(n * .45, Math.max(0,e.hp-1)); e.hp -= n; if (source !== 'dot') {
        e.flash = .12;
        this.emit({ type: 'float', p: e, text: String(Math.round(n)) });
        this.emit({ type: 'hit', p: e, value: n });
        this.emit({ type: 'sound', key: 'impact' });
    } if (this.save.settings.hitstop && source === 'primary')
        this.stopTime = .035; if (e.hp <= 0) {
        e.hp = 0;
        e.state = 'death';
        e.deadTime = 0;
        if (e.boss) {
            this.win();
        }
        else {
            this.save.stats.kills++;
            const rewardId = `kill-${e.id}`;
            once(this.save, rewardId, () => { this.loot.push({ x: e.x, y: e.y, id: rewardId, gold: 4 + Math.floor(this.stage.id * .65) }); const roll = [...e.id].reduce((n, c) => n * 31 + c.charCodeAt(0), 17) >>> 0; if (roll % 5 === 0)
                credit(this.save, { wood: 1, iron: this.stage.id > 5 ? 1 : 0 }); if (roll % 13 === 0)
                addItem(this.save, makeItem(this.stage.id, roll)); });
        }
    } }
    damagePlayer(raw: number, source?: Actor) {
        const p = this.player;
        if (p.invuln > 0 || p.hp <= 0)
            return;
        const shieldHeld = this.secondaryHeld && (item(this.save, 'weapon')?.family ?? 'sword') === 'sword';
        const parry = shieldHeld && this.clock - this.guardStarted < .2 + (hasTalent(this.save, 'guardian3') ? .04 : 0);
        if ((parry || p.counter > 0) && source) {
            source.state = 'stagger';
            source.timer = (source.boss ? 1.4 : 1.8) + (hasTalent(this.save, 'guardian5') ? .2 : 0);
            p.invuln = .22;
            this.toast(message("engine.030"));
            if (parry && hasTalent(this.save, 'guardian7'))
                this.damageEnemy(source, weaponDamage(this.save) * .25, 'secondary');
            if (p.counter > 0) {
                this.damageEnemy(source, 38 * rankPower(effectiveRank(this.save, 'iron-oath')), 'secondary');
                if (effectiveRank(this.save, 'iron-oath') >= 7)
                    for (const target of this.targets(130).filter(a => a !== source).slice(0, 2)) {
                        this.damageEnemy(target, 38 * rankPower(effectiveRank(this.save, 'iron-oath')), 'secondary');
                        target.state = 'stagger';
                        target.timer = .7;
                    }
                p.counter = 0;
                this.synergy('bastion', () => { p.barrier = Math.max(p.barrier, 20); this.barrierTime = 5; this.damageEnemy(source, 15, 'secondary'); });
            }
            this.emit({ type: 'sound', key: 'parry' });
            return;
        }
        let n = incomingDamage(this.save, raw, shieldHeld || p.guard > 0);
        if (hasTalent(this.save, 'guardian6') && p.hp < p.maxHp * .35)
            n *= .94;
        if (this.season === 'Winter' && inSlot(this.save, 'ember', 'socket'))
            n *= .97;
        if (this.mode === 'defence') {
            n *= 1 - Math.min(4, this.save.buildings.filter(b => b.kind === 'wall').length) * .01;
            if (inSlot(this.save, 'iron-oath', 'socket'))
                n *= .95;
        }
        if (p.barrier > 0) {
            const absorbed = Math.min(p.barrier, n);
            p.barrier -= absorbed;
            n -= absorbed;
            if (p.barrier <= 0)
                this.burstBarrier();
        }
        p.hp = Math.max(0, p.hp - n);
        p.flash = .22;
        p.invuln = .45;
        if (shieldHeld) {
            p.stamina = Math.max(0, p.stamina - 10);
            p.regenDelay = .6;
        }
        this.emit({ type: 'hit', p, value: -n });
        this.emit({ type: 'sound', key: 'hurt' });
        if (p.hp <= 0)
            this.setState('DEFEATED');
    }
    burstBarrier() { this.barrierTime = 0; this.player.barrier = 0; this.addHazard({ ...this.player, shape: 'circle', radius: 100, angle: 0, width: 0, length: 0, delay: 0, life: .35, damage: 18, friendly: true, color: 0xc5b28b, kind: 'stoneward', source: 'secondary' }); }
    win() { if (this.state !== 'BOSS_FIGHT')
        return; this.hazards = []; this.projectiles = []; const first = !this.save.cleared.includes(this.stage.id); grantBoss(this.save, this.stage.id, this.run, this.elapsed, this.mode); this.player.maxHp = maxHp(this.save); this.player.hp = this.player.maxHp; this.persist(); this.emit({ type: 'sound', key: 'victory' }); if (this.stage.id === 30 && !this.save.ending) {
        this.setState('ENDING');
    }
    else
        this.setState('STAGE_COMPLETE'); if (first && this.stage.major)
        this.toast(message("engine.031")); }
    finishEnding(choice: 'valley' | 'hearth') { this.save.ending = choice; if (!this.save.cosmetics.includes('dawn'))
        this.save.cosmetics.push('dawn'); this.persist(); this.setState('STAGE_COMPLETE'); this.presentStory('ending-'+choice,'STAGE_COMPLETE'); }
    startDefence() { this.loadHome(); this.mode = 'defence'; this.wave = 0; this.spawnTimer = 1; this.run = ++this.save.runId; this.setState('EXPLORING'); if (inSlot(this.save, 'stoneward', 'socket')) {
        this.player.barrier = 20;
        this.barrierTime = 120;
    } this.toast(message("engine.032")); }
    tick(dt: number) {
        if (!['EXPLORING', 'BOSS_FIGHT', 'HOME', 'STAGE_COMPLETE'].includes(this.state))
            return;
        if (this.stopTime > 0) {
            this.stopTime -= dt;
            return;
        }
        this.clock += dt;
        this.elapsed += dt;
        this.save.stats.seconds += dt;
        const p = this.player;
        tickCooldowns(p, dt);
        for (const k of Object.keys(this.synergyCd))
            this.synergyCd[k] = Math.max(0, this.synergyCd[k] - dt);
        if(!this.strike)this.updateAim();
        p.maxHp = maxHp(this.save);
        if (p.regenDelay <= 0)
            p.stamina = Math.min(maxStamina(this.save), p.stamina + dt * (20 + (inSlot(this.save, 'thornwake', 'support') ? 2 : 0) + (hasTalent(this.save, 'guardian8') ? 2 : 0)));
        p.guard = Math.max(0, p.guard - dt);
        if (this.barrierTime > 0) {
            this.barrierTime -= dt;
            if (this.barrierTime <= 0)
                this.burstBarrier();
        }
        this.shelterTime = Math.max(0, this.shelterTime - dt);
        if (this.shelterTime === 0)
            this.shelter = null;
        let mx = this.inputMove.x, my = this.inputMove.y;
        const len = Math.hypot(mx, my);
        if (len > 1) {
            mx /= len;
            my /= len;
        }
        const speed = 175 * (1 + (hasTalent(this.save, 'ranger0') ? .035 : 0) + (hasTalent(this.save, 'ranger8') ? .02 : 0) + ((item(this.save, 'boots')?.tier ?? 1) - 1) * .005 + (inSlot(this.save, 'windstep', 'support') ? .05 : 0) + (item(this.save, 'boots')?.upgrade ?? 0) * .007) * (this.season === 'Winter' && inSlot(this.save, 'frostwake', 'socket') ? 1.03 : 1);
        if (this.dodgeTime > 0) {
            this.dodgeTime -= dt;
            moveWithCollision(this.map, p, this.lastAim.x * 580 * dt, this.lastAim.y * 580 * dt, p.radius);
        }
        else
            moveWithCollision(this.map, p, mx * speed * dt, my * speed * dt, p.radius);
        if (this.state === 'BOSS_FIGHT') {
            const room = this.map.rooms.at(-1)!;
            p.x = Math.max((room.x + .5) * CELL, Math.min((room.x + room.w - .5) * CELL, p.x));
            p.y = Math.max((room.y + .5) * CELL, Math.min((room.y + room.h - .5) * CELL, p.y));
        }
        if (len > .1 && this.clock - this.lastStep > .34) {
            this.emit({ type: 'sound', key: 'step' });
            this.lastStep = this.clock;
        }
        if (p.state === 'attack') {
            p.timer -= dt;
            if (p.timer <= 0)
                p.state = 'idle';
        }
        else
            p.state = len > .1 ? 'approach' : 'idle';
        if (this.secondaryHeld)
            this.charge = Math.min(1.5, this.charge + dt * (hasTalent(this.save, 'ranger3') ? 1.15 : 1));
        if (this.attackHeld)
            this.attack();
        this.tickStrike(dt);
        for (const e of this.enemies)
            this.enemyTick(e, dt);
        this.hazardTick(dt);
        this.projectileTick(dt);
        if (this.stage.id === 1 && this.mode === 'campaign' && this.state === 'EXPLORING') {
            if (this.tutorial === 0 && this.objectiveComplete()) {
                this.tutorial = 1;
                this.toast(t('attackInstruction'));
            }
            if (this.tutorial === 1 && this.enemies.some(e => e.state === 'telegraph' && e.kind === 'orc')) {
                this.tutorial = 2;
                this.toast(t('dodgeInstruction'));
            }
        }
        if (this.ritual) {
            if (distance(p, this.ritual.object) < 150 && !this.enemies.some(a => a.hp > 0 && distance(a, this.ritual!.object) < 180))
                this.ritual.remaining -= dt;
            if (this.ritual.remaining <= 0) {
                const o = this.ritual.object;
                this.ritual = null;
                this.completeObjective(o);
            }
        }
        if (this.escortMoving && this.state === 'EXPLORING') {
            const cart = this.objects.find(o => o.kind === 'cart')!, target = this.escortPath[0];
            if (target && distance(p, cart) < 185 && !this.enemies.some(a => a.hp > 0 && distance(a, cart) < 105)) {
                const a = angleTo(cart, target);
                moveWithCollision(this.map, cart, Math.cos(a) * 95 * dt, Math.sin(a) * 95 * dt, 12);
                if (distance(cart, target) < 5)
                    this.escortPath.shift();
            }
            if (!this.escortPath.length) {
                const o = this.objects.find(o => o.kind === 'objective' && o.index === this.escortTarget)!;
                if (o) {
                    this.completeObjective(o);
                    this.escortTarget++;
                    cart.hp = 100;
                }
                this.escortMoving = false;
                if (this.escortTarget >= this.map.objectives.length) {
                    cart.done = true;
                    this.toast(message("engine.033"));
                }
                else
                    this.toast(message("engine.034"));
            }
        }
        for (const coin of [...this.loot])
            if (distance(p, coin) < 100) {
                credit(this.save, { gold: coin.gold });
                this.loot = this.loot.filter(x => x !== coin);
                this.persist();
                this.emit({ type: 'sound', key: 'coin' });
            }
        if (this.enemies.length > 38)
            this.enemies = this.enemies.filter(e => e.hp > 0);
        if (this.mode === 'defence') {
            this.spawnTimer -= dt;
            if (!this.enemies.some(e => e.hp > 0) && this.spawnTimer <= 0) {
                if (this.wave >= 3) {
                    const cosmetic = 'defender';
                    if (!this.save.cosmetics.includes(cosmetic))
                        this.save.cosmetics.push(cosmetic);
                    this.toast(t('wonDefence'));
                    this.save.bests.defence = Math.min(this.save.bests.defence ?? Infinity, this.elapsed);
                    this.loadHome();
                }
                else {
                    this.wave++;
                    for (let i = 0; i < 3 + this.wave; i++) {
                        const e = actor(`defence-${this.run}-${this.wave}-${i}`, i % 2 ? 'orc' : 'warg', toWorld({ x: 7 + i, y: 3 }), 180 + this.wave * 45);
                        e.state = 'approach';
                        this.enemies.push(e);
                    }
                    this.spawnTimer = 2;
                    this.toast(message("engine.035", this.wave));
                }
            }
        }
    }
    enemyTick(e: Actor, dt: number) {
        if (e.hp <= 0) {
            e.deadTime += dt;
            return;
        }
        tickCooldowns(e, dt);
        if (e.burn > 0) {
            e.burn -= dt;
            this.damageEnemy(e, dt * e.burnDps * (hasTalent(this.save, 'ringkeeper1') ? 1.06 : 1), 'dot');
        }
        if (e.poison > 0) {
            e.poison -= dt;
            this.damageEnemy(e, dt * 4 * Math.min(3, e.poisonStacks) * (hasTalent(this.save, 'ringkeeper1') ? 1.06 : 1), 'dot');
        }
        else
            e.poisonStacks = 0;
        if (e.hp <= 0)
            return;
        const p = this.player, d = distance(e, p);
        if (e.boss) {
            const phases = this.stage.attacks.length, phase = phases === 3 ? (e.hp / e.maxHp < .33 ? 2 : e.hp / e.maxHp < .67 ? 1 : 0) : phases === 2 && e.hp / e.maxHp < .5 ? 1 : 0;
            if (phase !== e.phase) {
                e.phase = phase;
                e.state = 'recovery';
                e.timer = 1.6;
                this.hazards = this.hazards.filter(h => h.friendly);
                this.toast(this.stage.id===30&&phase===2?message('engine.conduit'):message('engine.phase',phase+1,this.stage.test));
                if (this.stage.id === 30 && phase === 2)
                    for (const o of this.objects.filter(o => o.kind === 'anchor')) {
                        o.done = false;
                        o.hp = 90;
                    }
                this.emit({ type: 'sound', key: 'boss' });
            }
        }
        if (e.state === 'death')
            return;
        if (e.state === 'patrol' || e.state === 'idle') {
            if (d < 320 && lineOfSight(this.map, e, p)) {
                e.state = 'notice';
                e.timer = .4;
            }
            else {
                const a = this.clock * .3 + e.spawn.x;
                moveWithCollision(this.map, e, Math.cos(a) * 15 * dt, Math.sin(a) * 15 * dt, e.radius);
                e.angle = a;
            }
            return;
        }
        if (['notice', 'recovery', 'stagger'].includes(e.state)) {
            e.timer -= dt;
            if (e.timer <= 0)
                e.state = 'approach';
            return;
        }
        if (e.state === 'telegraph') {
            e.timer -= dt;
            if (e.timer <= 0) {
                e.state = 'attack';
                e.timer = .16;
                this.performAttack(e, this.pending.get(e.id) ?? 'sweep');
            }
            return;
        }
        if (e.state === 'attack') {
            if(e.lunge){
                const l=e.lunge,step=Math.min(l.remaining,850*dt),before={x:e.x,y:e.y};
                moveWithCollision(this.map,e,Math.cos(l.angle)*step,Math.sin(l.angle)*step,e.radius);l.remaining-=step;
                const pillar=l.kind==='charge'&&this.objects.find(o=>o.kind==='pillar'&&!o.done&&distance(e,o)<95);
                if(pillar){pillar.done=true;e.hp=Math.max(1,e.hp-e.maxHp*.12);e.state='stagger';e.timer=2.1;e.lunge=undefined;this.toast(message('engine.036'));return;}
                if(l.remaining<=0||distance(before,e)<step*.3)e.lunge=undefined;
            }
            e.timer -= dt;
            if (e.timer <= 0) {
                e.lunge=undefined;
                e.state = 'recovery';
                e.timer = e.boss ? 1.15 : 1;
            }
            return;
        }
        if (e.root > 0 && !e.boss)
            return;
        e.angle = angleTo(e, p);
        const ranged = e.kind === 'wight' || e.kind === 'goblin' && this.stage.id > 6;
        const nextPattern = e.boss ? this.stage.attacks[e.phase][e.attackIndex % this.stage.attacks[e.phase].length] : 'sweep';
        const range = e.boss ? (['sweep', 'double', 'echo', 'shield', 'counter', 'stances'].includes(nextPattern) ? 112 : 300) : ranged ? 240 : 80;
        if (d < range && lineOfSight(this.map, e, p)) {
            const seq = e.boss ? this.stage.attacks[e.phase] : ranged ? ['lanes'] as AttackKind[] : e.kind === 'warg' ? ['charge'] as AttackKind[] : e.kind === 'troll' ? ['slam'] as AttackKind[] : ['sweep'] as AttackKind[];
            const kind = seq[e.attackIndex++ % seq.length];
            this.pending.set(e.id, kind);
            e.target = { x: p.x, y: p.y };
            e.state = 'telegraph';
            e.timer = kind === 'slam' || kind === 'breath' || kind === 'sectors' ? .9 : .65;
            this.telegraph(e, kind, e.timer);
            return;
        }
        const factor = e.slow > 0 ? e.slowFactor : 1;
        let ax = Math.cos(e.angle), ay = Math.sin(e.angle);
        if (e.kind === 'warg' && d > 140) {
            const a = e.angle + Math.sin(this.clock + e.spawn.x) * .55;
            ax = Math.cos(a);
            ay = Math.sin(a);
        }
        if (ranged && d < 145) {
            ax = -ax;
            ay = -ay;
        }
        moveWithCollision(this.map, e, ax * e.speed * factor * dt, ay * e.speed * factor * dt, e.radius);
        for (const other of this.enemies)
            if (other !== e && other.hp > 0) {
                const dd = distance(e, other);
                if (dd > 0 && dd < e.radius + other.radius)
                    moveWithCollision(this.map, e, (e.x - other.x) / dd * 15 * dt, (e.y - other.y) / dd * 15 * dt, e.radius);
            }
    }
    telegraph(e: Actor, kind: AttackKind, delay: number) {
        if(kind==='leap'){const a=angleTo(e,e.target),length=Math.min(330,distance(e,e.target)),landing={x:e.x,y:e.y};moveWithCollision(this.map,landing,Math.cos(a)*length,Math.sin(a)*length,e.radius);e.target=landing;}
        const angle = angleTo(e, e.target), dmg = (e.boss ? 14 + this.stage.id * 1.1 : 7 + this.stage.id * .8) * (this.mode === 'hard' ? 1.15 : 1);
        const add = (shape: Hazard['shape'], p: Point, radius: number, width: number, length: number, a = angle, d = delay, life = .25, damage = dmg, k: string = kind) => this.addHazard({ ...p, kind: k, shape, radius, angle: a, width, length, delay: d, life, damage, friendly: false, color: 0xce7144, source: e.id });
        switch (kind) {
            case 'sweep':
            case 'shield':
            case 'counter':
            case 'stances':
                add('cone', e, 125, 2, 0);
                break;
            case 'double':
                add('cone', e, 125, 1.9, 0);
                add('cone', e, 145, 2.3, 0, angle + .2, delay + .55);
                break;
            case 'echo':
                add('cone', e, 140, 2, 0);
                add('cone', e, 165, 2, 0, angle, delay + .8);
                break;
            case 'hook':
                add('line', e, 0, 28, 330);
                break;
            case 'charge':
                add('line', e, 0, e.boss ? 40 : 25, Math.min(330, distance(e, e.target)),angle,delay,.42);
                break;
            case 'slam':
                add('circle', e.target, e.boss ? 100 : 72, 0, 0, 0, delay, .35, dmg * 1.4);
                break;
            case 'leap':
                add('circle', e.target, 90, 0, 0, 0, delay+.38, .35, dmg * 1.2);
                break;
            case 'waves':
            case 'shock':
            case 'chain':
                for (let i = 0; i < 3; i++)
                    add('ring', e, 80 + i * 90, 16, 0, angle + (kind === 'chain' ? i * .9 : 0), delay + i * .3, .25);
                break;
            case 'lanes':
                for (let i = -1; i <= 1; i++)
                    add('line', e, 0, 18, 520, angle + i * .23, delay, .2);
                break;
            case 'web':
                add('circle', e.target, 90, 0, 0, 0, delay, 4, dmg * .55, 'web');
                break;
            case 'pools':
            case 'mines':
            case 'explosives':
                for (let i = 0; i < 3; i++) {
                    const a = i * 2.1 + this.clock;
                    add('circle', { x: e.target.x + Math.cos(a) * 80, y: e.target.y + Math.sin(a) * 80 }, kind === 'pools' ? 75 : 60, 0, 0, 0, delay + i * .18, kind === 'pools' ? 4 : .4, dmg, kind);
                }
                break;
            case 'silence':
                add('circle', e.target, 110, 0, 0, 0, delay, 4, dmg * .5, 'silence');
                break;
            case 'ballista': {
                const turret = this.objects.find(o => o.kind === 'ballista' && !o.done) ?? { x: this.map.arena.x - 220, y: this.map.arena.y - 170 };
                add('line', turret, 0, 32, 700, angleTo(turret, e.target), delay + 0.35, .3, dmg * 1.3);
                break;
            }
            case 'banners':
                add('circle', e, 100, 0, 0, 0, delay, .2);
                break;
            case 'shadow':
                for (let i = 0; i < 3; i++) {
                    const a = i * 2.1;
                    add('circle', { x: e.x + Math.cos(a) * 145, y: e.y + Math.sin(a) * 145 }, 55, 0, 0, 0, delay + .5, .3, dmg * .65, 'shadow');
                }
                add('cone', e, 150, 2, 0);
                break;
            case 'fissures':
                for (let i = -2; i <= 2; i++)
                    if (i % 2 === (e.attackIndex % 2 ? 0 : -1) || i === 2)
                        add('line', { x: this.map.arena.x + i * 75, y: this.map.arena.y - 250 }, 0, 23, 500, Math.PI / 2, delay, .4);
                break;
            case 'sectors':
                for (let i = 1; i < 4; i++)
                    add('cone', this.map.arena, 330, Math.PI / 2 - .15, 0, angle + i * Math.PI / 2, delay, .4, dmg * .85);
                break;
            case 'breath':
                add('cone', e, 310, 1.5, 0, angle, delay, 1.15, dmg * 1.2);
                break;
            case 'ringcopy':
                add('cone', e, 170, 2, 0, angle, delay, .3, dmg, 'borrowed-ember');
                add('circle', e.target, 80, 0, 0, 0, delay + 1, 2, dmg * .6, 'roots');
                break;
            case 'seasons': {
                const k = ['rain', 'fire', 'wind', 'frost'][e.attackIndex % 4];
                for (let i = 0; i < 3; i++)
                    add('circle', { x: this.map.arena.x + Math.cos(i * 2.1 + this.clock) * 145, y: this.map.arena.y + Math.sin(i * 2.1 + this.clock) * 145 }, 85, 0, 0, 0, delay, 2.5, dmg * .8, k);
                break;
            }
            case 'conduit':
                for (const o of this.objects.filter(o => o.kind === 'anchor' && !o.done))
                    add('line', o, 0, 20, distance(o, this.player) + 100, angleTo(o, this.player), delay, .3, dmg * .8);
                break;
        }
        this.emit({ type: 'sound', key: 'cue' });
    }
    performAttack(e: Actor, kind: AttackKind) {
        if (kind === 'charge' || kind === 'leap') {
            e.lunge={from:{x:e.x,y:e.y},angle:e.angle,remaining:Math.min(330,distance(e,e.target)),kind};
            e.timer=.42;
        }
        if (kind === 'web') {this.objects=this.objects.filter(o=>o.kind!=='web'||!o.done);while(this.objects.filter(o=>o.kind==='web').length>=6){const i=this.objects.findIndex(o=>o.kind==='web');this.objects.splice(i,1);}
            const p = { ...e.target };
            this.objects.push({ ...p, id: 'web-' + (++this.counter), kind: 'web', label: message("engine.037"), done: false, hp: 20, index: 0, optional: true });
            
        }
        if (kind === 'lanes')
            this.fire(e, e.angle, 320, 14 + this.stage.id, false, 'enemy-arrow');
        if ((kind === 'web' || kind === 'banners' && this.objects.some(o => o.kind === 'banner' && !o.done)) && this.enemies.filter(x => x.hp > 0).length < 7) {
            for (let i = 0; i < 2; i++) {
                const p = { x: e.x + Math.cos(i * 3.1) * 90, y: e.y + Math.sin(i * 3.1) * 90 };
                if (canStand(this.map, p)) {
                    const child = actor(`add-${++this.counter}`, kind === 'web' ? 'spider' : 'goblin', p, 25 + this.stage.id * 3);
                    child.state = 'notice';
                    child.timer = .8;
                    this.enemies.push(child);
                }
            }
        }
    }
    hazardTick(dt: number) {
        for (const h of [...this.hazards]) {
            if (h.delay > 0) {
                h.delay -= dt;
                continue;
            }
            h.life -= dt;
            if (h.damage > 0) {
                if (h.friendly) {
                    const cap = h.kind === 'windstep' ? (effectiveRank(this.save, 'windstep') >= 7 ? 5 : 3) : h.kind === 'echo' ? 3 : 5;
                    for (const e of this.enemies) {
                        if (h.hit.size >= cap)
                            break;
                        if (e.hp <= 0 || h.hit.has(e.id) || !hitHazard(h, e, e.radius) || !lineOfSight(this.map, h, e))
                            continue;
                        h.hit.add(e.id);
                        this.damageEnemy(e, h.damage, h.source);
                        if (h.kind === 'ember') {
                            e.burn = effectiveRank(this.save, 'ember') >= 4 ? 4 : 3;
                            e.burnDps = 4;
                        }
                        if (h.kind === 'frostwake') {
                            e.slow = 3;
                            e.slowFactor = .7;
                            if (!e.boss && effectiveRank(this.save, 'frostwake') >= 7)
                                e.root = .7;
                        }
                        if (h.kind === 'roots') {
                            e.root = e.boss ? 0 : (effectiveRank(this.save, 'thornwake') >= 7 ? 2.5 : 2) + (hasTalent(this.save, 'ringkeeper6') ? .2 : 0);
                            e.slow = e.boss ? 2 : 0;
                            e.slowFactor = .85;
                        }
                        if (h.kind === 'dawnward' && effectiveRank(this.save, 'dawnward') >= 7 && !e.boss) {
                            e.state = 'stagger';
                            e.timer = .7;
                        }
                        if (!e.boss && (h.kind === 'stoneward' && effectiveRank(this.save, 'stoneward') >= 7 || h.kind === 'shadow' && effectiveRank(this.save, 'duskveil') >= 7)) {
                            e.state = 'stagger';
                            e.timer = h.kind === 'shadow' ? .5 : .7;
                        }
                    }
                }
                else if (!h.hit.has('player') && (h.kind !== 'charge' || this.enemies.some(a=>a.id===h.source&&distance(a,this.player)<a.radius+this.player.radius+15)) && hitHazard(h, this.player, this.player.radius) && lineOfSight(this.map, h, this.player) && !this.blockedByCover(h, this.player)) {
                    h.hit.add('player');
                    const source = this.enemies.find(e => e.id === h.source);
                    this.damagePlayer(h.damage, source);
                    if (h.kind === 'silence')
                        this.player.silence = 2 * (hasTalent(this.save, 'ringkeeper5') ? .75 : 1);
                    if (h.kind === 'web')
                        this.player.regenDelay = 1;
                }
            }
            if (h.kind === 'ballista' && h.delay <= 0) {
                const boss = this.enemies.find(e => e.boss && e.hp > 0);
                if (boss && !h.hit.has('boss') && hitHazard(h, boss, boss.radius)) {
                    h.hit.add('boss');
                    this.damageEnemy(boss, boss.maxHp * .12, 'redirect');
                    boss.state = 'stagger';
                    boss.timer = 1.7;
                    this.toast(message("engine.038"));
                }
            }
            if (h.life <= 0)
                this.hazards = this.hazards.filter(x => x !== h);
        }
    }
    blockedByCover(from: Point, to: Point) { return this.objects.some(o => !o.done && o.kind === 'pillar' && Math.abs(distance(from, o) + distance(o, to) - distance(from, to)) < 9); }
    projectileTick(dt: number) {
        for (const p of [...this.projectiles]) {
            p.life -= dt;
            const steps = Math.ceil(Math.hypot(p.vx, p.vy) * dt / 10);
            for (let i = 0; i < steps && p.life > 0; i++) {
                p.x += p.vx * dt / steps;
                p.y += p.vy * dt / steps;
                if (!canStand(this.map, p, 2)) {
                    p.life = 0;
                    break;
                }
                const obstacle=this.objects.find(o=>!o.done&&['pillar','anchor','banner','web','ward','bramble'].includes(o.kind)&&distance(o,p)<25);
                if(obstacle){if(p.friendly){obstacle.hp-=p.damage;if(obstacle.hp<=0){obstacle.done=true;if(obstacle.kind==='anchor'){const boss=this.enemies.find(e=>e.boss);if(boss){boss.hp=Math.max(1,boss.hp-boss.maxHp*.06);boss.state='stagger';boss.timer=1.7;}}if(obstacle.kind==='web')this.hazards=this.hazards.filter(h=>h.kind!=='web'||distance(h,obstacle)>100);this.emit({type:'sound',key:'break'});}}
                    p.life = 0;
                    break;
                }
                if (!p.friendly && this.shelter && this.shelterLeft > 0 && distance(p, this.shelter) < this.shelterRadius) {
                    this.shelterLeft--;
                    p.life = 0;
                    break;
                }
                const targets = p.friendly ? this.enemies : [this.player];
                for (const e of targets)
                    if (e.hp > 0 && !p.hit.has(e.id) && distance(p, e) < e.radius + 7) {
                        p.hit.add(e.id);
                        if (p.friendly) {
                            this.damageEnemy(e, p.damage, 'primary');
                            if (p.kind === 'venom') {
                                e.poison = effectiveRank(this.save, 'venomcoil') >= 4 ? 5 : 4;
                                e.poisonStacks = Math.min(3, e.poisonStacks + 1);
                            }
                        }
                        else
                            this.damagePlayer(p.damage);
                        p.pierce--;
                        if (p.pierce <= 0)
                            p.life = 0;
                        break;
                    }
            }
            if (p.life <= 0)
                this.projectiles = this.projectiles.filter(x => x !== p);
        }
    }
}
