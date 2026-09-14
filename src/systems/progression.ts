import { message } from '../content/messages';
import type { Save, RingId, RingSlot, Item, Wallet } from '../types';
import { RINGS, ringById, SYNERGIES } from '../content/rings';
import { TALENTS } from '../content/home';
export const xpThreshold = (level: number) => 60 + 24 * level + 4 * level * level;
export const rankCap = (level: number) => Math.min(10, 1 + Math.floor((Math.max(1, Math.min(30, level)) - 1) / 3));
export const rankPower = (rank: number) => 1 + 0.06 * (Math.max(1, Math.min(10, rank)) - 1);
export const grade = (rank: number) => rank >= 10 ? 'Legendary' : rank >= 7 ? 'Epic' : rank >= 4 ? 'Rare' : 'Common';
export function addXp(s: Save, amount: number) { s.xp += Math.max(0, Math.floor(amount)); while (s.level < 30 && s.xp >= xpThreshold(s.level)) {
    s.xp -= xpThreshold(s.level);
    s.level++;
} if (s.level === 30)
    s.xp = 0; }
export const highest = (s: Save) => s.cleared.length ? Math.max(...s.cleared) : 0;
export const hasTalent = (s: Save, id: string) => s.talents.includes(id);
export const countTalent = (s: Save, path: string) => s.talents.filter(t => t.startsWith(path)).length;
export const inSlot = (s: Save, id: RingId, group: 'support' | 'active' | 'socket') => Object.entries(s.assignments).some(([k, v]) => k.startsWith(group) && v === id);
export const hasActive = (s: Save, id: RingId) => inSlot(s, id, 'active');
export const effectiveRank = (s: Save, id: RingId) => Math.min(s.rings[id] ?? 1, rankCap(s.level));
export const item = (s: Save, slot: 'weapon' | 'armour' | 'boots') => s.inventory.find(i => i.id === s.equipment[slot])!;
export const maxHp = (s: Save) => Math.round((100 + (s.level - 1) * 7 + (hasTalent(s, 'guardian0') ? 8 : 0) + (hasTalent(s, 'guardian9') ? 12 : 0) + ((item(s, 'armour')?.tier ?? 1) - 1) * 3 + (item(s, 'armour')?.upgrade ?? 0) * (5 + (hasTalent(s, 'guardian4') ? 2 : 0))) * (inSlot(s, 'last-hearth', 'support') ? 1.06 : 1));
export const maxStamina = (s: Save) => 100 + (s.level - 1) * 2 + (hasTalent(s, 'ranger8') ? 4 : 0);
export const weaponDamage = (s: Save) => { const w = item(s, 'weapon'); return (15 + (s.level - 1) * 1.7 + (w?.tier ?? 1) * 2 + (w?.upgrade ?? 0) * 4) * (w?.family === 'axe' ? 1.6 : w?.family === 'bow' ? 0.95 : 1); };
export const talentPoints = (s: Save) => s.level - 1 - s.talents.length;
export function learnTalent(s: Save, id: string) { const def = TALENTS.find(t => t.id === id); if (!def || talentPoints(s) < 1 || s.talents.includes(id))
    return false; if (def.index > 0 && !s.talents.includes(def.path.toLowerCase() + (def.index - 1)))
    return false; s.talents.push(id); return true; }
export function slotUnlocked(s: Save, slot: RingSlot) { const h = highest(s); return slot === 'active1' || slot === 'active2' && h >= 5 || slot === 'support1' && h >= 12 || slot === 'support2' && h >= 20 || slot.startsWith('socket') && h >= 10; }
export function assignRing(s: Save, id: RingId, slot: RingSlot) { if (!s.rings[id] || !slotUnlocked(s, slot))
    return false; for (const k of Object.keys(s.assignments) as RingSlot[])
    if (s.assignments[k] === id)
        delete s.assignments[k]; s.assignments[slot] = id; return true; }
export function discoverRing(s: Save, id: RingId) { if (s.rings[id]) {
    s.wallet.shards += 6 + highest(s);
    return false;
} s.rings[id] = 1; if (!s.assignments.active1)
    s.assignments.active1 = id;
else if (!s.assignments.active2 && highest(s) >= 5)
    s.assignments.active2 = id; return true; }
export function synergyReady(s: Save, id: string, cd: Record<string, number>, source = 'primary') { const def = SYNERGIES.find(x => x.id === id); return !!def && source === 'primary' && (cd[id] ?? 0) <= 0 && def.pair.every(r => hasActive(s, r)); }
export function makeItem(stage: number, seed: number, slot?: Item['slot']): Item { const slots: Item['slot'][] = ['weapon', 'armour', 'boots']; const type = slot ?? slots[seed % 3]; const family = (['sword', 'bow', 'axe'] as const)[Math.floor(seed / 3) % 3]; const tier = Math.min(6, 1 + Math.floor(stage / 5)); const prefix = ['Roadworn', 'Tempered', 'Wayfarer’s', 'Mountain', 'Beacon', 'Hearthbound'][tier - 1]; return { id: `loot-${stage}-${seed}`, name: `${prefix} ${type === 'weapon' ? { sword: 'sword & shield', bow: 'longbow', axe: message("progression.001") }[family] : type === 'armour' ? 'mail' : 'boots'}`, slot: type, ...(type === 'weapon' ? { family } : {}), tier, upgrade: 0, locked: false, value: 10 + tier * 12 }; }
export const newWallet = (): Wallet => ({ gold: 0, wood: 0, stone: 0, iron: 0, shards: 0 });
export function addItem(s: Save, i: Item) { if (s.inventory.some(v => v.id === i.id) || s.overflow.some(v => v.id === i.id))
    return; (s.inventory.length < 30 ? s.inventory : s.overflow).push(i); }
export const ringList = () => RINGS.map(r => r.id);
export const ringCooldown = (s: Save, id: RingId) => ringById[id].cooldown * Math.max(.8, 1 - (hasTalent(s, 'ringkeeper2') ? .03 : 0) - (inSlot(s, 'stormcall', 'support') ? .05 : 0));
