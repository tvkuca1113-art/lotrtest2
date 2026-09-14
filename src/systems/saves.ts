import { message } from '../content/messages';
import type { Save, Settings, Item, RingId, RingSlot } from '../types';
import { newWallet, rankCap, slotUnlocked } from './progression';
import { RINGS, SYNERGIES } from '../content/rings';
import { BUILDINGS, TALENTS, TIERS } from '../content/home';
import { validPlacement } from './building';
export const defaultSettings = (): Settings => ({ difficulty: 'Adventurer', music: .18, sfx: .55, ambience: .25, shake: true, hitstop: true, weather: true, quality: 'high', leftHanded: false, aimAssist: true, keyboardAim: false, bindings: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', attack: 'KeyJ', secondary: 'KeyK', dodge: 'Space', ring1: 'KeyQ', ring2: 'KeyE', heal: 'KeyR', interact: 'KeyF', inventory: 'KeyI', map: 'KeyM', pause: 'Escape' } });
export function freshSave(): Save { const starter: Item[] = [{ id: 'starter-sword', name: message("saves.001"), slot: 'weapon', family: 'sword', tier: 1, upgrade: 0, locked: true, value: 0 }, { id: 'starter-cloak', name: message("saves.002"), slot: 'armour', tier: 1, upgrade: 0, locked: true, value: 0 }, { id: 'starter-boots', name: 'Traveller’s boots', slot: 'boots', tier: 1, upgrade: 0, locked: true, value: 0 }]; return { version: 2, revision: 0, level: 1, xp: 0, wallet: newWallet(), rings: {}, assignments: {}, equipment: { weapon: 'starter-sword', armour: 'starter-cloak', boots: 'starter-boots' }, inventory: starter, overflow: [], talents: [], loadouts: [null, null, null], cleared: [], claimed: [], buildings: [], tier: 0, residents: [], day: 0, runId: 0, rng: 18273645, checkpoint: { where: 'mission', stage: 1, boss: false, season: 'Spring', runId: 0, mode: 'campaign', objectives: [] }, settings: defaultSettings(), ending: null, synergies: [], bests: {}, cosmetics: ['forest'], cloak: 0, stats: { kills: 0, deaths: 0, secrets: 0, seconds: 0 } }; }
export function migrate(raw: unknown): unknown { if (raw && typeof raw === 'object' && (raw as any).version === 1) {
    const a = structuredClone(raw) as any;
    return { ...freshSave(), ...a, version: 2, revision: a.revision ?? 0, settings: { ...defaultSettings(), ...a.settings }, loadouts: a.loadouts ?? [null, null, null], overflow: a.overflow ?? [] };
} return raw; }
const integer = (x: unknown, min: number, max: number) => typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
export function validateSave(input: unknown): Save {
    const a = migrate(input) as Save;
    if (!a || typeof a !== 'object' || a.version !== 2)
        throw Error(message("saves.003"));
    if (!integer(a.revision, 0, 1000000000))
        throw Error(message("saves.004"));
    if (!integer(a.level, 1, 30) || !integer(a.xp, 0, 999999) || !integer(a.tier, 0, 5) || !integer(a.day, 0, 1000000) || !integer(a.runId, 0, 100000000) || !integer(a.rng, 0, 4294967295))
        throw Error(message("saves.005"));
    for (const k of ['gold', 'wood', 'stone', 'iron', 'shards'] as const)
        if (!integer(a.wallet?.[k], 0, 99999999))
            throw Error(message("saves.006"));
    const ringIds = RINGS.map(r => r.id);
    for (const [k, v] of Object.entries(a.rings ?? {}))
        if (!ringIds.includes(k as RingId) || !integer(v, 1, 10) || v > rankCap(a.level))
            throw Error(message("saves.007"));
    const slots: RingSlot[] = ['active1', 'active2', 'support1', 'support2', 'socket1', 'socket2'];
    const seen = new Set<string>();
    for (const [k, v] of Object.entries(a.assignments ?? {})) {
        if (!slots.includes(k as RingSlot) || !a.rings[v as RingId] || seen.has(v))
            throw Error(message("saves.008"));
        seen.add(v);
    }
    if (!Array.isArray(a.cleared) || new Set(a.cleared).size !== a.cleared.length || a.cleared.some(x => !integer(x, 1, 30)))
        throw Error(message("saves.009"));
    for (let stage = 1; stage <= Math.max(0, ...a.cleared); stage++)
        if (!a.cleared.includes(stage))
            throw Error(message("saves.010"));
    for (const slot of Object.keys(a.assignments) as RingSlot[])
        if (!slotUnlocked(a, slot))
            throw Error(message("saves.011"));
    if (!Array.isArray(a.claimed) || a.claimed.length > 100000 || a.claimed.some(x => typeof x !== 'string' || x.length > 180) || new Set(a.claimed).size !== a.claimed.length)
        throw Error(message("saves.012"));
    const ids = new Set<string>();
    if (!Array.isArray(a.inventory) || !Array.isArray(a.overflow) || a.inventory.length > 30 || a.overflow.length > 10000)
        throw Error(message("saves.013"));
    for (const i of [...a.inventory, ...a.overflow]) {
        if (!i || typeof i.id !== 'string' || i.id.length > 100 || ids.has(i.id) || typeof i.name !== 'string' || i.name.length > 150 || !['weapon', 'armour', 'boots'].includes(i.slot) || !integer(i.tier, 1, 6) || !integer(i.upgrade, 0, 10) || !integer(i.value, 0, 100000) || typeof i.locked !== 'boolean' || i.slot === 'weapon' && !['sword', 'bow', 'axe'].includes(i.family ?? ''))
            throw Error(message("saves.014"));
        ids.add(i.id);
    }
    for (const slot of ['weapon', 'armour', 'boots'] as const)
        if (!a.inventory.some(i => i.id === a.equipment?.[slot] && i.slot === slot))
            throw Error(message("saves.015"));
    if (!Array.isArray(a.talents) || a.talents.length > a.level - 1 || new Set(a.talents).size !== a.talents.length || a.talents.some(x => !TALENTS.some(t => t.id === x)))
        throw Error(message("saves.016"));
    const bIds = new Set<string>();
    if (!Array.isArray(a.buildings) || a.buildings.length > 160)
        throw Error(message("saves.017"));
    for (const b of a.buildings) {
        if (!BUILDINGS.some(x => x.kind === b.kind) || typeof b.id !== 'string' || bIds.has(b.id) || !integer(b.x, 0, 28) || !integer(b.y, 0, 28) || !integer(b.rotation, 0, 3))
            throw Error(message("saves.018"));
        bIds.add(b.id);
        const d = BUILDINGS.find(x => x.kind === b.kind)!;
        for (const k of ['gold', 'wood', 'stone', 'iron', 'shards'] as const)
            if ((b.cost?.[k] ?? 0) !== (d.cost[k] ?? 0))
                throw Error(message("saves.019"));
    }
    if (a.buildings.filter(b => b.kind === 'shelter').length > 1 || a.tier > 0 && !a.buildings.some(b => b.kind === 'shelter') || a.tier === 0 && a.buildings.some(b => b.kind === 'shelter') || Math.max(0, ...a.cleared) < TIERS[a.tier].unlock)
        throw Error(message("saves.020"));
    for (const b of a.buildings)
        if (!validPlacement(a, b, b.id))
            throw Error(message("saves.021"));
    const cp = a.checkpoint;
    if (!cp || !['home', 'mission'].includes(cp.where) || !integer(cp.stage, 1, 30) || !integer(cp.runId, 0, a.runId) || typeof cp.boss !== 'boolean' || !['Spring', 'Summer', 'Autumn', 'Winter'].includes(cp.season) || !['campaign', 'hard', 'gauntlet', 'defence'].includes(cp.mode) || !Array.isArray(cp.objectives) || cp.objectives.some(x => !integer(x, 0, cp.stage === 1 ? 0 : 3)) || new Set(cp.objectives).size !== cp.objectives.length)
        throw Error(message("saves.022"));
    if (!a.settings || !['Story', 'Adventurer', 'Veteran'].includes(a.settings.difficulty))
        throw Error(message("saves.023"));
    for (const k of ['music', 'sfx', 'ambience'] as const)
        if (typeof a.settings[k] !== 'number' || !Number.isFinite(a.settings[k]) || a.settings[k] < 0 || a.settings[k] > 1)
            throw Error(message("saves.024"));
    for (const key of ['shake', 'hitstop', 'weather', 'leftHanded', 'aimAssist', 'keyboardAim'] as const)
        if (typeof a.settings[key] !== 'boolean')
            throw Error(message("saves.025"));
    if (!['high', 'low'].includes(a.settings.quality) || !a.settings.bindings || Object.values(a.settings.bindings).some(k => typeof k !== 'string' || !/^([A-Za-z0-9]{1,30})$/.test(k)))
        throw Error(message("saves.026"));
    if (![null, 'hearth', 'valley'].includes(a.ending) || !Array.isArray(a.residents) || a.residents.some(x => !['smith', 'scout', 'mason', 'gardener', 'healer', 'chronicler'].includes(x)) || !Array.isArray(a.loadouts) || a.loadouts.length !== 3)
        throw Error(message("saves.027"));
    for (const l of a.loadouts)
        if (l && (typeof l.name !== 'string' || l.name.length > 80 || !l.rings || !l.equipment || Object.values(l.equipment).some(id => typeof id !== 'string' || id.length > 100) || !Array.isArray(l.talents) || new Set(l.talents).size !== l.talents.length || l.talents.length > a.level - 1 || l.talents.some(x => !TALENTS.some(t => t.id === x)) || new Set(Object.values(l.rings)).size !== Object.values(l.rings).length || Object.entries(l.rings).some(([k, v]) => !slots.includes(k as RingSlot) || !ringIds.includes(v as RingId))))
            throw Error(message("saves.028"));
    if(!a.stats||['kills','deaths','secrets','seconds'].some(k=>typeof (a.stats as unknown as Record<string,unknown>)[k]!=='number')||Object.keys(defaultSettings().bindings).some(k=>typeof a.settings.bindings[k]!=='string'))throw Error(message('saves.required'));
    if(cp.stage>Math.min(30,Math.max(0,...a.cleared)+1)||a.ending&&!a.cleared.includes(30))throw Error(message('saves.story'));
    if (a.cosmetics?.some(x => !['forest', 'frost', 'ember', 'dusk', 'dawn', 'defender'].includes(x)) || a.synergies?.some(x => !SYNERGIES.some(d => d.id === x)))
        throw Error(message("saves.029"));
    if (!a.stats || Object.values(a.stats).some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0) || !a.bests || Object.values(a.bests).some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0) || !Array.isArray(a.cosmetics) || !Array.isArray(a.synergies) || !integer(a.cloak, 0, 5))
        throw Error(message("saves.030"));
    return structuredClone(a);
}
export class SaveStore {
    constructor(public name = 'last-hearth-v01') { }
    db: IDBDatabase | null = null;
    memory: Save | null = null;
    error = '';
    queue: Promise<unknown> = Promise.resolve();
    onStatus: (ok: boolean) => void = () => { };
    async open() { try {
        this.db = await new Promise<IDBDatabase>((resolve, reject) => { const q = indexedDB.open(this.name, 2); q.onupgradeneeded = () => { if (!q.result.objectStoreNames.contains('saves'))
            q.result.createObjectStore('saves'); }; q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
    }
    catch (e) {
        this.error = String(e);
        this.onStatus(false);
    } }
    async get(key = 'current'): Promise<Save | null> { if (!this.db)
        return this.memory; try {
        const raw = await new Promise<unknown>((res, rej) => { const q = this.db!.transaction('saves').objectStore('saves').get(key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
        if (!raw)
            return null;
        return validateSave(raw);
    }
    catch (e) {
        this.error = String(e);
        if (key === 'current')
            return this.get('backup');
        return null;
    } }
    put(s: Save, preserveCurrent = true): Promise<boolean> { const copy = structuredClone(s); copy.revision++; s.revision = copy.revision; this.memory = copy; const task = async () => { if (!this.db) {
        this.onStatus(false);
        return false;
    } try {
        await new Promise<void>((res, rej) => { const tx = this.db!.transaction('saves', 'readwrite'); const st = tx.objectStore('saves'); if (preserveCurrent) {
            const q = st.get('current');
            q.onsuccess = () => { if (q.result) {
                try {
                    validateSave(q.result);
                    st.put(q.result, 'backup');
                }
                catch { }
            } st.put(copy, 'current'); };
        }
        else
            st.put(copy, 'current'); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
        this.onStatus(true);
        return true;
    }
    catch (e) {
        this.error = String(e);
        this.onStatus(false);
        return false;
    } }; const p = this.queue.then(task, task); this.queue = p; return p; }
    async archive() { if (!this.db)
        return; const current = await this.get(); if (!current)
        return; await new Promise<void>((resolve, reject) => { const tx = this.db!.transaction('saves', 'readwrite'); tx.objectStore('saves').put(current, 'archive'); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); }
    async import(text: string) { if (text.length > 8000000)
        throw Error(message("saves.031")); return validateSave(JSON.parse(text)); }
    export(s: Save) { return JSON.stringify(s, null, 2); }
}
