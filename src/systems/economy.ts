import type { Save, Wallet, RingId, Item } from '../types';
import { rankCap, discoverRing, addXp, xpThreshold, addItem, makeItem } from './progression';
import { RINGS } from '../content/rings';
import { chapters } from '../content/strings';
export const resources = (['gold', 'wood', 'stone', 'iron', 'shards'] as const);
export const costText = (c: Partial<Wallet>) => resources.filter(k => c[k]).map(k => `${c[k]} ${k}`).join(' · ') || 'Free';
export function canPay(s: Save, c: Partial<Wallet>) { return resources.every(k => Number.isFinite(c[k] ?? 0) && (c[k] ?? 0) >= 0 && s.wallet[k] >= (c[k] ?? 0)); }
export function pay(s: Save, c: Partial<Wallet>) { if (!canPay(s, c))
    return false; for (const k of resources)
    s.wallet[k] -= c[k] ?? 0; return true; }
export function credit(s: Save, c: Partial<Wallet>) { for (const k of resources) {
    const n = c[k] ?? 0;
    if (Number.isFinite(n) && n > 0)
        s.wallet[k] = Math.min(99999999, s.wallet[k] + Math.floor(n));
} }
export function once(s: Save, id: string, mutate: () => void) { if (s.claimed.includes(id))
    return false; mutate(); s.claimed.push(id); return true; }
export const ringCost = (rank: number) => ({ gold: rank * 8, shards: rank + 2 });
export function upgradeRing(s: Save, id: RingId) { const rank = s.rings[id]; if (!rank || rank >= rankCap(s.level) || rank >= 10 || !pay(s, ringCost(rank)))
    return false; s.rings[id] = rank + 1; return true; }
export const equipmentCost = (i: Item) => ({ gold: 20 + (i.upgrade + 1) * 25, iron: Math.max(1, i.upgrade + 1) });
export function upgradeEquipment(s: Save, id: string) { const i = s.inventory.find(x => x.id === id); if (!i || i.upgrade >= 10 || i.upgrade >= rankCap(s.level) || !pay(s, equipmentCost(i)))
    return false; i.upgrade++; return true; }
export const firstClearReward = (stage: number): Partial<Wallet> => ({ gold: 80 + 35 * stage, wood: 18 + stage * 3, stone: 5 + stage * 4, iron: stage === 1 ? 0 : 3 + Math.floor(stage * 1.6), shards: 6 + stage * 2 });
export const replayReward = (stage: number): Partial<Wallet> => ({ gold: Math.floor((80 + 35 * stage) * .25), wood: 3 + Math.floor(stage / 3), stone: 2 + Math.floor(stage / 3), iron: Math.floor(stage / 4), shards: 3 + Math.floor(stage / 5) });
export function grantBoss(s: Save, stage: number, runId: number, seconds: number, mode = 'campaign') {
    const first = !s.cleared.includes(stage);
    const reward = first ? firstClearReward(stage) : replayReward(stage);
    return once(s, `clear-run-${runId}-${stage}-${mode}`, () => {
        if (first) {
            s.cleared.push(stage);
            s.cleared.sort((a, b) => a - b);
            s.claimed.push(`boss-${stage}`);
            addXp(s, xpThreshold(stage) - Math.floor(xpThreshold(stage) * .4));
            for (const r of RINGS)
                if (r.stage === stage && r.id !== 'ember')
                    discoverRing(s, r.id);
            if (stage % 5 === 0)
                s.residents.push(chapters[stage / 5 - 1].service);
            addItem(s, makeItem(stage, stage * 271, 'weapon'));
        }
        credit(s, reward);
        if (Object.entries(s.assignments).some(([k, v]) => k.startsWith('socket') && v === 'thornwake') && first)
            credit(s, { wood: 3 });
        if (stage === 5 || stage === 15 || stage === 25) {
            const colour = stage === 5 ? 'ember' : stage === 15 ? 'frost' : 'dusk';
            if (!s.cosmetics.includes(colour))
                s.cosmetics.push(colour);
        }
        s.day++;
        const key = mode + '-' + stage;
        s.bests[key] = Math.min(s.bests[key] ?? Infinity, Math.max(1, seconds));
        s.checkpoint = { ...s.checkpoint, where: 'home', boss: false, objectives: [] };
    });
}
export function objectiveReward(s: Save, stage: number, index: number, count: number) { return once(s, `objective-${stage}-${index}`, () => { const total = Math.floor(xpThreshold(stage) * .4); addXp(s, Math.floor(total / count) + (index === count - 1 ? total % count : 0)); credit(s, { gold: 5 + stage, wood: 2 }); }); }
export function salvage(s: Save, ids: string[]) { let n = 0; for (const id of new Set(ids)) {
    const i = s.inventory.find(x => x.id === id);
    if (!i || i.locked || Object.values(s.equipment).includes(id))
        continue;
    s.inventory = s.inventory.filter(x => x.id !== id);
    credit(s, { iron: i.tier, shards: Math.max(1, Math.floor(i.tier / 2)) });
    n++;
} return n; }
export function sell(s: Save, id: string) { const i = s.inventory.find(x => x.id === id); if (!i || i.locked || Object.values(s.equipment).includes(id))
    return false; s.inventory = s.inventory.filter(x => x.id !== id); credit(s, { gold: i.value }); return true; }
export function buy(s: Save, i: Item) { if (s.inventory.some(x => x.id === i.id) || s.overflow.some(x => x.id === i.id) || s.claimed.includes(`buy-${i.id}`) || !pay(s, { gold: i.value * 3 }))
    return false; s.claimed.push(`buy-${i.id}`); addItem(s, { ...i }); return true; }
