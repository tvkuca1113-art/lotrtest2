import type { Save, Building, BuildingKind, Point } from '../types';
import { buildingByKind, TIERS } from '../content/home';
import { pay, credit } from './economy';
import { highest } from './progression';
export const homeExtent = (s: Save) => highest(s) >= 20 ? 28 : highest(s) >= 5 ? 24 : 20;
export function footprint(b: Pick<Building, 'kind' | 'rotation' | 'x' | 'y'>) { const d = buildingByKind[b.kind]; return { x: b.x, y: b.y, w: b.rotation % 2 ? d.h : d.w, h: b.rotation % 2 ? d.w : d.h }; }
export function isWalkableBuilding(b: Building) { return ['gate', 'path', 'garden'].includes(b.kind); }
export function validPlacement(s: Save, b: Pick<Building, 'kind' | 'x' | 'y' | 'rotation'>, ignoreId = '') {
    const f = footprint(b), size = homeExtent(s);
    if (!Number.isInteger(b.x) || !Number.isInteger(b.y) || f.x < 2 || f.y < 2 || f.x + f.w > size - 2 || f.y + f.h > size - 2)
        return false;
    if (f.x <= 10 && f.x + f.w > 9 && !['path', 'gate'].includes(b.kind))
        return false;
    const all = s.buildings.filter(x => x.id !== ignoreId);
    for (const old of all) {
        const a = footprint(old);
        if (f.x < a.x + a.w && f.x + f.w > a.x && f.y < a.y + a.h && f.y + f.h > a.y)
            return false;
    }
    const proposed = [...all, { ...b, id: 'preview', cost: {} } as Building];
    const blocked = new Set<string>();
    for (const z of proposed)
        if (!isWalkableBuilding(z)) {
            const a = footprint(z);
            for (let x = a.x; x < a.x + a.w; x++)
                for (let y = a.y; y < a.y + a.h; y++)
                    blocked.add(`${x},${y}`);
        }
    const visited = new Set<string>(['10,18']);
    const queue: Point[] = [{ x: 10, y: 18 }];
    for (let i = 0; i < queue.length; i++) {
        const p = queue[i];
        for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
            const x = p.x + d.x, y = p.y + d.y, k = `${x},${y}`;
            if (x < 1 || y < 1 || x >= size - 1 || y >= size - 1 || blocked.has(k) || visited.has(k))
                continue;
            visited.add(k);
            queue.push({ x, y });
        }
    }
    return proposed.every(z => { const a = footprint(z); return visited.has(`${a.x + Math.floor(a.w / 2)},${a.y + a.h}`); });
}
export function placeBuilding(s: Save, kind: BuildingKind, p: Point, rotation: number, id: string) { const d = buildingByKind[kind]; if (!d || kind === 'shelter' && s.buildings.some(b => b.kind === 'shelter') || highest(s) < d.unlock || !validPlacement(s, { kind, ...p, rotation }) || s.buildings.some(b => b.id === id) || !pay(s, d.cost))
    return false; s.buildings.push({ kind, ...p, rotation, id, cost: { ...d.cost } }); if (kind === 'shelter')
    s.tier = Math.max(1, s.tier); return true; }
export function moveBuilding(s: Save, id: string, p: Point, rotation: number) { const b = s.buildings.find(x => x.id === id); if (!b || !validPlacement(s, { ...b, ...p, rotation }, id))
    return false; Object.assign(b, p, { rotation }); return true; }
export function buildingRefund(s: Save, b: Building) { const refund = { ...b.cost }; if (b.kind === 'shelter')
    for (const tier of TIERS.slice(2, s.tier + 1))
        for (const [k, n] of Object.entries(tier.cost)) {
            const key = k as keyof typeof refund;
            refund[key] = (refund[key] ?? 0) + (n ?? 0);
        } return refund; }
export function removeBuilding(s: Save, id: string) { const b = s.buildings.find(x => x.id === id); if (!b)
    return false; const refund = buildingRefund(s, b); s.buildings = s.buildings.filter(x => x.id !== id); credit(s, refund); if (b.kind === 'shelter' && !s.buildings.some(x => x.kind === 'shelter'))
    s.tier = 0; return true; }
export function upgradeHome(s: Save) { const next = TIERS[s.tier + 1]; if (s.tier < 1 || !next || highest(s) < next.unlock || !pay(s, next.cost))
    return false; s.tier++; return true; }
