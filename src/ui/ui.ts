import {narrative, storyUI} from '../content/story';
import {assetUrl} from '../assets';
import { message } from '../content/messages';
import type { Save, RingId, RingSlot, BuildingKind, Point, Item } from '../types';
import { Engine } from '../game/engine';
import { WorldScene } from '../game/scene';
import { Controls } from '../game/input';
import { HearthAudio } from '../game/audio';
import { SaveStore, validateSave, freshSave } from '../systems/saves';
import { t, chapters, lore } from '../content/strings';
import { RINGS, ringById, SYNERGIES } from '../content/rings';
import { STAGES } from '../content/stages';
import { TIERS, BUILDINGS, TALENTS, buildingByKind } from '../content/home';
import { highest, xpThreshold, maxStamina, rankCap, effectiveRank, grade, assignRing, slotUnlocked, talentPoints, learnTalent, item, makeItem, weaponDamage, maxHp, inSlot } from '../systems/progression';
import { costText, canPay, upgradeRing, ringCost, upgradeEquipment, equipmentCost, salvage, sell, buy, firstClearReward, replayReward } from '../systems/economy';
import { seasonAt, seasonDay, seasonClue } from '../systems/seasons';
import { validPlacement, placeBuilding, moveBuilding, removeBuilding, upgradeHome, buildingRefund } from '../systems/building';
import { CELL } from '../world/maps';
import { distance } from '../game/combat';
import { icon, esc } from './icons';
export class Interface {
    root = document.getElementById('ui')!;
    engine: Engine | null = null;
    panel = '';
    storyPage = 0;
    selectedStage = 1;
    selectedRing: RingId = 'ember';
    selectedChapter = 0;
    toastTimer = 0;
    lastHud = 0;
    lastPlacement: {
        id: string;
        before: Save;
    } | null = null;
    onStart: (isNew: boolean) => void = () => { };
    onImport: (s: Save) => void = () => { };
    saved: Save | null = null;
    titleSettings: Save | null = null;
    constructor(public scene: WorldScene, public controls: Controls, public audio: HearthAudio, public store: SaveStore) { this.controls.onMenu = p => this.open(p); this.controls.remapped = (action, code) => { if (this.engine) {
        this.engine.save.settings.bindings[action] = code;
        this.engine.persist();
        this.open('settings');
    } }; this.store.onStatus = ok => { const status = document.getElementById('save-status'); if (status) {
        status.textContent = ok ? 'Saved' : message("ui.001");
        status.classList.toggle('error', !ok);
    } if (!ok)
        this.toast(t('saveError')); }; }
    get s() { return this.engine!.save; }
    get home() { return this.engine?.state === 'HOME' || this.engine?.state === 'PAUSED' && this.engine.previous === 'HOME'; }
    title(saved: Save | null) { this.saved = saved; this.panel = 'title'; this.root.innerHTML = message("ui.002", icon('hearth'), saved ? message("ui.003", t('continue'), saved.level, TIERS[saved.tier].name) : '', saved ? '' : 'primary', t('newGame'), t('fan')); this.bind(); }
    bindEngine(e: Engine) { this.engine = e; e.events.push(ev => { if (ev.type === 'toast')
        this.toast(ev.text ?? ''); if (ev.type === 'state')
        this.state(); if (ev.type === 'sound')
        this.audio.play(ev.key ?? ''); if (ev.type === 'ui' && ev.key === 'home-interact')
        this.homeInteract(); if (ev.type === 'reward')
        this.rewardRing(ev.key as RingId); }); this.panel = ''; this.mount(); }
    mount() { this.root.innerHTML = message("ui.004", icon('stone'), icon('hearth'), icon('echo'), icon('bolt')); this.bind(); this.controls.bindTouch(this.root); this.scene.minimap = null; this.hud(); }
    state() { const state = this.engine?.state; if (state === 'STORY') { this.storyPage=0; this.story(); } else if (state === 'BOSS_INTRO')
        this.bossIntro();
    else if (state === 'DEFEATED')
        this.defeat();
    else if (state === 'STAGE_COMPLETE')
        this.complete();
    else if (state === 'ENDING')
        this.ending();
    else if (state === 'PAUSED' && !this.panel)
        this.open('pause');
    else if (['HOME', 'EXPLORING', 'BOSS_FIGHT'].includes(state ?? '') && !['equipment', 'rings', 'map', 'build', 'journal', 'settings', 'talents', 'trade', 'challenge', 'residents'].includes(this.panel)) {
        this.panel = '';
        this.hideModal();
    } this.hud(); }
    modal(html: string, wide = false) { document.getElementById('modal-host')!.innerHTML = message("ui.005", wide ? 'wide' : '', esc(this.panel || 'Journey'), html); this.bind(); }
    hideModal() { const el = document.getElementById('modal-host'); if (el)
        el.innerHTML = ''; }
    close() { this.panel = ''; this.hideModal(); this.engine?.resume(); this.engine?.clearInputs(); }
    header(title: string, sub: string) { return message("ui.006", esc(sub), esc(title)); }
    tabs(active: string) { const tabs = [['equipment', 'Equipment'], ['rings', 'Rings'], ['talents', 'Paths'], ['map', 'Campaign'], ['build', 'Home'], ['journal', 'Chronicle']]; return message("ui.007", tabs.map(([p, label]) => message("ui.008", p, p === active ? 'selected' : '', label)).join('')); }
    wallet() { return message("ui.009", Object.entries(this.s.wallet).map(([k, v]) => `<span><b>${Math.floor(v).toLocaleString('en')}</b> ${k}</span>`).join('')); }
    open(panel: string) { if (this.engine && ['BOSS_INTRO', 'DEFEATED', 'ENDING', 'STORY'].includes(this.engine.state))
        return; if (panel === 'pause' && this.panel) {
        this.close();
        return;
    } if (!this.engine) {
        if (panel === 'settings')
            this.titleSettingsPanel();
        return;
    } if (this.scene.placement) {
        this.scene.placement = null;
        this.placementUI();
    } this.panel = panel; this.engine.pause(); this.engine.clearInputs(); const renderers: Record<string, () => string> = { equipment: () => this.equipment(), rings: () => this.rings(), map: () => this.campaign(), build: () => this.build(), talents: () => this.talents(), journal: () => this.journal(), settings: () => this.settings(), pause: () => this.pause(), trade: () => this.trade(), challenge: () => this.challenge(), residents: () => this.residents() }; const content = renderers[panel]?.() ?? this.pause(); this.modal(content, ['equipment', 'rings', 'map', 'build', 'talents', 'journal', 'trade', 'challenge'].includes(panel)); }
    pause() { return this.header(t('pause'), message("ui.010")) + message("ui.011", this.home ? '' : message("ui.012")); }
    equipment() { const equipped = Object.values(this.s.equipment); return this.header(message("ui.013"), `LEVEL ${this.s.level} · ${this.s.inventory.length}/30 ITEMS`) + this.tabs('equipment') + this.wallet() + message("ui.014", (['weapon', 'armour', 'boots'] as const).map(slot => { const i = item(this.s, slot); return message("ui.015", slot.toUpperCase(), esc(i.name), i.tier, i.upgrade, i.id, !this.home || i.upgrade >= rankCap(this.s.level) || !canPay(this.s, equipmentCost(i)) ? 'disabled' : '', costText(equipmentCost(i))); }).join(''), this.home ? message("ui.016") : message("ui.017"), this.s.overflow.length, this.s.inventory.map(i => message("ui.018", esc(i.name), i.slot, i.tier, i.upgrade, equipped.includes(i.id) ? '· EQUIPPED' : '', this.compareItem(i), i.id, equipped.includes(i.id) ? 'disabled' : '', i.id, i.locked ? 'Unlock' : 'Lock')).join('')); }
    compareItem(i: Item) { const current = item(this.s, i.slot), rating = (a: Item) => a.slot === 'weapon' ? a.tier * 2 + a.upgrade * 4 : a.slot === 'armour' ? (a.tier - 1) * 3 + a.upgrade * 5 : (a.tier - 1) * .5 + a.upgrade * .7; const n = rating(i), delta = n - rating(current), unit = i.slot === 'weapon' ? message("ui.019") : i.slot === 'armour' ? message("ui.020") : '% movement'; return message("ui.021", n.toFixed(i.slot === 'boots' ? 1 : 0), unit, i.family ? ' · ' + i.family : '', delta >= 0 ? '+' : '', delta.toFixed(i.slot === 'boots' ? 1 : 0)); }
    rings() { const r = ringById[this.selectedRing], owned = !!this.s.rings[r.id], rank = this.s.rings[r.id] ?? 1; const place = Object.entries(this.s.assignments).find(([, v]) => v === r.id)?.[0]; return this.header(message("ui.022"), message("ui.023", rankCap(this.s.level))) + this.tabs('rings') + this.wallet() + message("ui.024", RINGS.map(x => message("ui.025", x.id === r.id ? 'selected' : '', !this.s.rings[x.id] ? 'undiscovered' : '', x.id, x.color.toString(16), icon(x.icon), this.s.rings[x.id] ? esc(x.name) : message("ui.026"), this.s.rings[x.id] ? grade(this.s.rings[x.id]!) + ` · ${this.s.rings[x.id]}/10` : `Stage ${x.stage}`)).join(''), r.color.toString(16), icon(r.icon), owned ? grade(rank) + ' · ' + (place ?? message("ui.027")) : message("ui.028"), owned ? r.name : message("ui.029"), owned ? r.lore : r.clue, owned ? message("ui.030", r.cooldown, r.active, r.support, r.home, r.ev4, r.ev7, (1 + .06 * (rank - 1)).toFixed(2), r.id, !this.home || rank >= rankCap(this.s.level) || !canPay(this.s, ringCost(rank)) ? 'disabled' : '', rank >= rankCap(this.s.level) ? message("ui.031") : message("ui.032") + (rank + 1) + ' · ' + costText(ringCost(rank)), (['active1', 'active2', 'support1', 'support2', 'socket1', 'socket2'] as RingSlot[]).map(slot => message("ui.033", r.id, slot, !this.home || !slotUnlocked(this.s, slot) ? 'disabled' : '', slot.replace(/(\d)/, ' $1'), slotUnlocked(this.s, slot) ? this.s.assignments[slot] ? ringById[this.s.assignments[slot]!].name : 'Empty' : message("ui.034", slot === 'active2' ? 5 : slot === 'support1' ? 12 : slot === 'support2' ? 20 : 10))).join(''), place ? message("ui.035", r.id, !this.home ? 'disabled' : '') : '') : ''); }
    talents() { return this.header(message("ui.036"), message("ui.037", talentPoints(this.s))) + this.tabs('talents') + message("ui.038", ['Guardian', 'Ranger', 'Ringkeeper'].map(path => `<div><h3>${path}</h3>${TALENTS.filter(n => n.path === path).map(n => message("ui.039", this.s.talents.includes(n.id) ? 'learned' : '', n.id, !this.home || this.s.talents.includes(n.id) || talentPoints(this.s) < 1 ? 'disabled' : '', n.index + 1, n.name, n.description)).join('')}</div>`).join(''), !this.home ? 'disabled' : '', this.s.loadouts.map((l, i) => message("ui.040", l ? esc(l.name) : 'Loadout ' + (i + 1), i, !this.home ? 'disabled' : '', i, !this.home || !l ? 'disabled' : '')).join('')); }
    campaign() { const st = STAGES[this.selectedStage - 1], cleared = this.s.cleared.includes(st.id), unlocked = st.id === 1 || this.s.cleared.includes(st.id - 1); return this.header(message("ui.041"), message("ui.042", this.s.day + 1, seasonAt(this.s.day).toUpperCase(), this.s.cleared.length)) + this.tabs('map') + message("ui.043", chapters.map((c, i) => message("ui.044", i, i === this.selectedChapter ? 'selected' : '', i + 1, c.name)).join(''), chapters[this.selectedChapter].region, chapters[this.selectedChapter].problem, STAGES.filter(s => s.chapter === this.selectedChapter).map(s => message("ui.045", s.id, s.id === st.id ? 'selected' : '', String(s.id).padStart(2, '0'), s.name, s.major ? message("ui.046") : '', s.boss, this.s.cleared.includes(s.id) ? '✓' : s.id <= highest(this.s) + 1 ? '→' : '·')).join(''), this.s.cleared.includes((this.selectedChapter + 1) * 5) ? chapters[this.selectedChapter].change : chapters[this.selectedChapter].story, cleared ? message("ui.047") : message("ui.048"), st.recommended, st.name, st.objective, st.boss, st.clue, seasonAt(this.s.day), seasonDay(this.s.day), seasonClue(seasonAt(this.s.day)), cleared ? message("ui.049") : message("ui.050"), costText(cleared ? replayReward(st.id) : firstClearReward(st.id)), RINGS.some(r => r.stage === st.id) ? '<br>' + RINGS.filter(r => r.stage === st.id).map(r => r.name + ' ring').join(', ') : '', Object.entries(this.s.assignments).filter(([k]) => !k.startsWith('socket')).map(([k, v]) => ringById[v].name + ' (' + k + ')').join(', ') || 'None', Object.entries(this.s.assignments).filter(([k]) => k.startsWith('socket')).map(([, v]) => ringById[v].name).join(', ') || 'None', st.id, !this.home || !unlocked ? 'disabled' : '', !this.home ? message("ui.051") : unlocked ? message("ui.052") : message("ui.053"), cleared && this.s.ending ? message("ui.054", st.id, !this.home ? 'disabled' : '') : ''); }
    build() { const next = TIERS[this.s.tier + 1]; return this.header(message("ui.055"), TIERS[this.s.tier].name.toUpperCase()) + this.tabs('build') + this.wallet() + message("ui.056", this.s.tier === 5 ? message("ui.057") : message("ui.058"), next?.name ?? message("ui.059"), next ? message("ui.060", next.unlock, costText(next.cost)) : message("ui.061"), this.s.tier > 0 && next ? message("ui.062", !this.home || highest(this.s) < next.unlock || !canPay(this.s, next.cost) ? 'disabled' : '') : '', TIERS.slice(1).map((tier, i) => message("ui.063", this.s.tier >= i + 1 ? 'done' : '', tier.name, tier.unlock, costText(tier.cost))).join(''), BUILDINGS.map(b => message("ui.064", b.name, b.purpose, costText(b.cost), b.w, b.h, b.kind, !this.home || highest(this.s) < b.unlock || !canPay(this.s, b.cost) || (b.kind === 'shelter' && this.s.buildings.some(x => x.kind === 'shelter')) ? 'disabled' : '', highest(this.s) < b.unlock ? message("ui.065") + b.unlock : message("ui.066"))).join(''), this.s.buildings.map(b => message("ui.067", buildingByKind[b.kind].name, b.x, b.y, costText(buildingRefund(this.s, b)), b.id, !this.home ? 'disabled' : '', b.id, !this.home ? 'disabled' : '')).join('') || message("ui.068"), !this.home || !this.lastPlacement ? 'disabled' : '', !this.home || this.s.tier < 1 ? 'disabled' : '', !this.home ? 'disabled' : ''); }
    journal() { return this.header(message("ui.069"), message("ui.070")) + this.tabs('journal') + `<button data-action="read-prologue">${storyUI.replay}</button>` + message("ui.071", chapters.map((c, i) => message("ui.072", i + 1, this.s.cleared.includes((i + 1) * 5) ? '· RESTORED' : '', c.name, c.problem, c.story, this.s.cleared.includes((i + 1) * 5) ? `<p>${c.change}</p>` : '')).join(''), SYNERGIES.map(s => message("ui.073", this.s.synergies.includes(s.id) ? 'DISCOVERED' : message("ui.074"), s.name, s.pair.map(id => ringById[id].name).join(' + '), s.text)).join(''), this.s.ending ? t(this.s.ending === 'valley' ? 'endingValleyText' : 'endingHearthText') : message("ui.075"), !this.s.ending ? 'disabled' : ''); }
    settings() { return this.header(message("ui.076"), 'CONTROLS · ACCESSIBILITY · SAVES') + message("ui.077", ['Story', 'Adventurer', 'Veteran'].map(x => `<option ${this.s.settings.difficulty === x ? 'selected' : ''}>${x}</option>`).join(''), (['music', 'sfx', 'ambience'] as const).map(k => message("ui.078", k === 'sfx' ? message("ui.079") : k, this.s.settings[k], k)).join(''), (['shake', 'hitstop', 'weather', 'leftHanded', 'aimAssist', 'keyboardAim'] as const).map(k => message("ui.080", k, this.s.settings[k] ? 'checked' : '', ({ shake: message("ui.081"), hitstop: message("ui.082"), weather: message("ui.083"), leftHanded: message("ui.084"), aimAssist: message("ui.085"), keyboardAim: message("ui.086") }[k]))).join(''), this.s.settings.quality === 'high' ? 'selected' : '', this.s.settings.quality === 'low' ? 'selected' : '', Object.entries(this.s.settings.bindings).map(([k, v]) => message("ui.087", k, k, v.replace('Key', ''))).join('')); }
    titleSettingsPanel() { this.titleSettings ??= this.saved ?? freshSave(); const s = this.titleSettings.settings; this.panel = 'settings'; this.modal(this.header(message("ui.088"), message("ui.089")) + message("ui.090", ['Story', 'Adventurer', 'Veteran'].map(x => `<option ${s.difficulty === x ? 'selected' : ''}>${x}</option>`).join(''), (['music', 'sfx', 'ambience'] as const).map(k => message("ui.078", k, s[k], k)).join(''), (['shake', 'hitstop', 'weather', 'leftHanded', 'aimAssist', 'keyboardAim'] as const).map(k => message("ui.080", k, s[k] ? 'checked' : '', ({ shake: message("ui.081"), hitstop: message("ui.082"), weather: message("ui.083"), leftHanded: message("ui.084"), aimAssist: message("ui.085"), keyboardAim: message("ui.086") }[k]))).join(''))); }
    trade() { const st = highest(this.s); const stock = [makeItem(st, st * 99 + 0, 'weapon'), makeItem(st, st * 99 + 3, 'weapon'), makeItem(st, st * 99 + 6, 'weapon'), makeItem(st, st * 99 + 2, 'armour'), makeItem(st, st * 99 + 5, 'boots')].map((i, n) => ({ ...i, id: 'shop-' + st + '-' + n })); return this.header(message("ui.091"), message("ui.092")) + this.wallet() + message("ui.093", stock.map(i => message("ui.094", esc(i.name), i.slot, i.family ?? '', i.tier, i.id, !this.home || this.s.claimed.includes('buy-' + i.id) || !canPay(this.s, { gold: i.value * 3 }) ? 'disabled' : '', i.value * 3)).join(''), this.s.inventory.filter(i => !Object.values(this.s.equipment).includes(i.id)).map(i => message("ui.095", esc(i.name), i.locked ? 'Locked' : i.value + ' gold', i.id, !this.home || i.locked ? 'disabled' : '', i.id, !this.home || i.locked ? 'disabled' : '')).join(''), !this.home ? 'disabled' : ''); }
    challenge() { return this.header(message("ui.096"), message("ui.097")) + message("ui.098", !this.home || !this.s.ending ? 'disabled' : '', !this.home || highest(this.s) < 20 ? 'disabled' : '', STAGES.map(s => message("ui.099", s.id, s.boss, this.s.bests['campaign-' + s.id] ? message("ui.100", this.time(this.s.bests['campaign-' + s.id])) : message("ui.101"), costText(replayReward(s.id)), s.id, !this.home || !this.s.ending ? 'disabled' : '')).join(''), Object.keys(this.s.rings).length, this.s.synergies.length, this.s.stats.secrets, ['forest', 'frost', 'ember', 'dusk', 'dawn', 'defender'].map((name, i) => message("ui.102", i, !this.home || !this.s.cosmetics.includes(name) ? 'disabled' : '', name)).join('')); }
    residents() { return this.header(message("ui.103"), message("ui.104")) + message("ui.105", chapters.filter(c => this.s.residents.includes(c.service)).map(c => message("ui.106", c.service.toUpperCase(), c.resident, c.dialogue, c.service, ({ smith: message("ui.107"), scout: message("ui.108"), mason: message("ui.109"), gardener: message("ui.110"), healer: message("ui.111"), chronicler: message("ui.112") } as Record<string, string>)[c.service])).join('') || message("ui.113")); }
    story() {
        const e=this.engine!, pages=narrative[e.storyId], page=pages?.[this.storyPage]; if(!page)return;
        this.panel='story'; e.clearInputs(); this.controls.keys.clear(); this.controls.stick={x:0,y:0};
        const art=page.scene==='road'?assetUrl('assets/prologue.webp'):page.scene==='hearth'?assetUrl('assets/title.webp'):'';
        const html=`<section class="story-screen ${page.scene==='world'?'in-world':''}" role="dialog" aria-modal="true" aria-labelledby="story-title" tabindex="-1" style="${art?`--story-art:url('${art}')`:''}">
          <div class="story-art"></div><div class="story-grain"></div><div class="story-copy"><p class="eyebrow">${esc(page.eyebrow)}</p><h1 id="story-title">${esc(page.title)}</h1>${page.speaker?`<p class="story-speaker">${esc(page.speaker)}</p>`:''}<p class="story-body">${esc(page.body)}</p>
          <div class="story-progress">${pages.map((_,i)=>`<span class="${i===this.storyPage?'current':''}"></span>`).join('')}<small>${this.storyPage+1} / ${pages.length}</small></div>
          <button class="primary story-next" data-action="story-next">${this.storyPage<pages.length-1?storyUI.next:e.storyId==='prologue'?storyUI.begin:storyUI.return}<span aria-hidden="true"> →</span></button>
          ${e.storyId==='prologue'&&this.storyPage<pages.length-1?`<button class="story-skip" data-action="story-skip">${storyUI.skip}</button>`:''}<small class="story-waits">${storyUI.storyHint}</small></div></section>`;
        document.getElementById('modal-host')!.innerHTML=html;this.bind();document.querySelector<HTMLElement>('.story-next')?.focus();
    }
    bossIntro() { this.panel = 'boss-intro'; const e = this.engine!; this.modal(message("ui.114", e.stage.major ? 'THE ' + ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'LAST'][e.stage.chapter] + ' BEACON' : message("ui.115"), e.stage.id, e.stage.boss, e.stage.intro, e.stage.test)); }
    defeat() { this.panel = 'defeated'; this.modal(message("ui.116", this.engine!.stage.name.toUpperCase(), t('defeated'), t('defeatText'), this.engine!.stage.test, t('retry'))); }
    complete() { this.panel = 'complete'; const e = this.engine!, id = e.stage.id; this.modal(message("ui.117", id, this.time(e.elapsed), icon('hearth'), id === 25 ? message("ui.118") : id === 30 ? message("ui.119") : message("ui.120"), id === 30 ? t('endingAfter') : id === 25 ? message("ui.121") : e.stage.boss + message("ui.122"), this.s.level, this.s.cleared.length, Object.keys(this.s.rings).length, id % 5 === 0 ? `<p class="lore">${chapters[id / 5 - 1].change}</p>` : '', e.mode === 'gauntlet' && id < 30 ? message("ui.123", id + 5, id / 5) : '')); }
    ending() { this.panel = 'ending'; this.modal(message("ui.124", t('endingTitle'), t('endingValley'), t('endingHearth')), true); }
    rewardRing(id: RingId) { const r = ringById[id]; this.toast(`${r.name} recovered · ${r.active}`); }
    homeInteract() { const p = this.engine!.player; const b = this.s.buildings.map(b => ({ b, d: distance(p, { x: (b.x + 1) * CELL, y: (b.y + 2) * CELL }) })).sort((a, b) => a.d - b.d)[0]; if (b && b.d < 180) {
        const panels: Record<string, string> = { shelter: 'build', bed: 'build', campfire: 'residents', chest: 'equipment', forge: 'trade', workbench: 'rings', garden: 'residents', watchtower: 'map', gate: 'challenge', trophy: 'journal' };
        this.open(panels[b.b.kind] ?? 'build');
    }
    else
        this.open('residents'); }
    hud() {
        if (!this.engine?.player)
            return;
        const e = this.engine, p = e.player;
        const set = (id: string, value: string) => { const x = document.getElementById(id); if (x)
            x.textContent = value; };
        const width = (id: string, v: number) => { const x = document.getElementById(id); if (x)
            x.style.width = Math.max(0, Math.min(100, v * 100)) + '%'; };
        set('level-value', String(this.s.level));
        set('hp-value', `${Math.ceil(p.hp)} / ${p.maxHp}`);
        set('stamina-value', `${Math.floor(p.stamina)} / ${maxStamina(this.s)}`);
        width('hp-fill', p.hp / p.maxHp);
        width('stamina-fill', p.stamina / maxStamina(this.s));
        width('xp-fill', this.s.xp / xpThreshold(this.s.level));
        set('location-label', this.home ? message("ui.010") : `STAGE ${e.stage.id} · ${e.stage.name.toUpperCase()}`);
        set('objective-label', e.objectiveText());
        set('season-label', `${e.season} · ${seasonDay(this.s.day)}/4`);
        set('flask-value', 'Flask · ' + p.flasks);
        set('weapon-label', item(this.s, 'weapon')?.family === 'sword' ? 'Sword & shield' : item(this.s, 'weapon')?.family === 'bow' ? 'Longbow' : message("ui.125"));
        for (const [slot, id] of [['active1', 'ring-one'], ['active2', 'ring-two']] as const) {
            const r = this.s.assignments[slot];
            const el = document.getElementById(id);
            if (el)
                el.innerHTML = `<kbd>${slot === 'active1' ? 'Q' : 'E'}</kbd>${r ? `${icon(ringById[r].icon)}<b>${(p.cooldowns[r] ?? 0) > 0 ? Math.ceil(p.cooldowns[r]!) + 's' : ringById[r].name}</b>` : message("ui.126")}`;
            const te = document.getElementById(slot === 'active1' ? 'touch-ring-one' : 'touch-ring-two');
            if (te)
                te.innerHTML = r ? `${icon(ringById[r].icon)}<small>${(p.cooldowns[r] ?? 0) > 0 ? Math.ceil(p.cooldowns[r]!) + 's' : ringById[r].name}</small>` : slot === 'active1' ? 'Q' : 'E';
        }
        const boss = e.enemies.find(x => x.boss && x.hp > 0);
        const bh = document.getElementById('boss-hud');
        if (bh)
            bh.style.display = boss ? 'block' : 'none';
        if (boss) {
            set('boss-name', e.stage.boss);
            width('boss-fill', boss.hp / boss.maxHp);
            set('boss-phase', `PHASE ${boss.phase + 1} · ${e.stage.test}`);
        }
        const build = document.getElementById('build-nav');
        if (build)
            build.style.display = this.home ? '' : 'none';
        const plans = document.getElementById('home-plans');
        if (plans) {
            plans.style.display = this.home ? 'block' : 'none';
            if (this.home) {
                const tier = TIERS[this.s.tier + 1], rr = RINGS.find(r => this.s.rings[r.id] && this.s.rings[r.id]! < rankCap(this.s.level) && canPay(this.s, ringCost(this.s.rings[r.id]!)));
                plans.textContent = this.s.tier === 0 ? message("ui.127") : (tier ? 'Goal: ' + tier.name : message("ui.128")) + ' · Next: ' + (rr ? rr.name + ' rank ' + (this.s.rings[rr.id]! + 1) : message("ui.129"));
            }
        }
        const art = document.querySelector<HTMLElement>('[data-touch=secondary]');
        if (art)
            art.textContent = item(this.s, 'weapon')?.family === 'sword' ? 'Guard' : 'Charge';
        const touch = document.getElementById('touch-controls');
        touch?.classList.toggle('left-handed', this.s.settings.leftHanded);
        const ti = document.getElementById('touch-interact');
        if (ti)
            ti.style.display = this.home || e.objects.some(o => !o.done && distance(o, p) < 115) ? 'block' : 'none';
    }
    toast(text: string) { const el = document.getElementById('toast'); if (!el)
        return; el.textContent = text; el.classList.add('visible'); clearTimeout(this.toastTimer); this.toastTimer = window.setTimeout(() => el.classList.remove('visible'), 5500); const aria = document.getElementById('announcer'); if (aria)
        aria.textContent = text; }
    placementUI() { const el = document.getElementById('build-placement'); if (!el)
        return; const p = this.scene.placement; if (!p) {
        el.innerHTML = '';
        return;
    } el.innerHTML = message("ui.130", p.id ? 'Move' : 'Place', buildingByKind[p.kind].name, validPlacement(this.s, p, p.id) ? message("ui.131") : message("ui.132"), !validPlacement(this.s, p, p.id) ? 'disabled' : ''); this.bind(); }
    placeAt(p: Point) { if (!this.scene.placement)
        return false; this.scene.placement.x = Math.floor(p.x / CELL); this.scene.placement.y = Math.floor(p.y / CELL); this.placementUI(); return true; }
    async action(action: string) {
        const [key, a, b] = action.split(':');
        const e = this.engine;
        await this.audio.start();
        if (key === 'new') {
            if (this.saved && !window.confirm(t('titleConfirm')))
                return;
            this.onStart(true);
            return;
        }
        if (key === 'continue') {
            this.onStart(false);
            return;
        }
        if (key === 'title-settings') {
            this.titleSettingsPanel();
            return;
        }
        if (key === 'title-close') {
            this.title(this.saved);
            return;
        }
        if (key === 'credits') {
            this.panel = 'credits';
            this.modal(this.header(message("ui.133"), 'CREDITS') + message("ui.134", lore.franchise, lore.world));
            return;
        }
        if (!e)
            return;
        if(key==='read-prologue'){e.storyId='prologue';e.storyReturn=e.state==='PAUSED'?e.previous:e.state;e.clearInputs();e.setState('STORY');return;}
        if (key === 'story-next' || key === 'story-skip') {
            if(e.state!=='STORY')return;
            if(key==='story-next'&&this.storyPage<narrative[e.storyId].length-1){this.storyPage++;this.story();}
            else {this.panel='';this.hideModal();this.controls.keys.clear();e.finishStory();}
            return;
        }
        if (key === 'menu') {
            this.open(a);
            return;
        }
        if (key === 'close') {
            this.close();
            return;
        }
        if (key === 'act') {
            if (a === 'attack')
                e.attack();
            if (a === 'dodge')
                e.dodge();
            if (a === 'heal')
                e.heal();
            if (a === 'ring1')
                e.ring(1);
            if (a === 'ring2')
                e.ring(2);
            return;
        }
        if (key === 'fight') {
            this.panel = '';
            this.hideModal();
            e.beginBoss();
            return;
        }
        if (key === 'retry') {
            this.panel = '';
            e.retry();
            return;
        }
        if (key === 'return-home') {
            this.panel = '';
            this.hideModal();
            e.loadHome();
            return;
        }
        if (key === 'explore-exit') {
            this.panel = '';
            this.hideModal();
            e.clearInputs();
            return;
        }
        if (key === 'chapter') {
            this.selectedChapter = Number(a);
            this.selectedStage = Number(a) * 5 + 1;
            this.open('map');
            return;
        }
        if (key === 'stage') {
            this.selectedStage = Number(a);
            this.open('map');
            return;
        }
        if (key === 'depart' || key === 'hard' || key === 'gauntlet-next') {
            if (!this.home && key !== 'gauntlet-next')
                return;
            this.panel = '';
            this.hideModal();
            e.loadMission(Number(a), key === 'gauntlet-next', false, key === 'hard' ? 'hard' : key === 'gauntlet-next' ? 'gauntlet' : 'campaign');
            if (key === 'gauntlet-next')
                e.setState('BOSS_INTRO');
            return;
        }
        if (key === 'ending') {
            e.finishEnding(a as 'valley' | 'hearth');
            return;
        }
        if (key === 'ring-select') {
            this.selectedRing = a as RingId;
            this.open('rings');
            return;
        }
        if (key === 'remap') {
            this.controls.remap = a;
            this.toast(message("ui.135") + a + '.');
            return;
        }
        if (key === 'export-save') {
            this.download(new Blob([this.store.export(this.s)], { type: 'application/json' }), 'last-hearth-save.json');
            return;
        }
        if (key === 'import-save') {
            document.getElementById('save-import')?.click();
            return;
        }
        if (key === 'restore-backup' || key === 'restore-archive') {
            const backup = await this.store.get(key === 'restore-archive' ? 'archive' : 'backup');
            if (backup && window.confirm(message("ui.136"))) {
                await this.store.put(backup);
                this.onImport(backup);
            }
            else if (!backup)
                this.toast(message("ui.137"));
            return;
        }
        if (key === 'share-loadout') {
            this.shareLoadout();
            return;
        }
        if (key === 'share-home') {
            this.close();
            this.scene.exportStronghold(blob => this.download(blob, 'last-hearth-stronghold.png'));
            return;
        }
        if (!this.home && ['assign', 'retrieve', 'upgrade-ring', 'upgrade-item', 'talent', 'respec', 'save-loadout', 'load-loadout', 'place', 'move-building', 'remove-building', 'upgrade-home', 'rest', 'buy', 'sell', 'salvage', 'salvage-all', 'defence', 'gauntlet', 'cloak', 'confirm-place', 'undo'].includes(key)) {
            this.toast(message("ui.138"));
            return;
        }
        let changed = false;
        switch (key) {
            case 'assign':
                changed = assignRing(this.s, a as RingId, b as RingSlot);
                break;
            case 'retrieve':
                for (const slot of Object.keys(this.s.assignments) as RingSlot[])
                    if (this.s.assignments[slot] === a) {
                        delete this.s.assignments[slot];
                        changed = true;
                    }
                break;
            case 'upgrade-ring':
                changed = upgradeRing(this.s, a as RingId);
                break;
            case 'upgrade-item':
                changed = upgradeEquipment(this.s, a);
                break;
            case 'equip': {
                const i = this.s.inventory.find(x => x.id === a);
                if (i) {
                    this.s.equipment[i.slot] = i.id;
                    changed = true;
                }
                break;
            }
            case 'lock': {
                const i = this.s.inventory.find(x => x.id === a);
                if (i) {
                    i.locked = !i.locked;
                    changed = true;
                }
                break;
            }
            case 'sort':
                this.s.inventory.sort((x, y) => x.slot.localeCompare(y.slot) || y.tier - x.tier || y.upgrade - x.upgrade);
                changed = true;
                break;
            case 'overflow':
                while (this.s.inventory.length < 30 && this.s.overflow.length)
                    this.s.inventory.push(this.s.overflow.shift()!);
                changed = true;
                break;
            case 'talent':
                changed = learnTalent(this.s, a);
                break;
            case 'respec':
                this.s.talents = [];
                changed = true;
                break;
            case 'save-loadout':
                this.s.loadouts[Number(a)] = { name: 'Loadout ' + (Number(a) + 1), rings: { ...this.s.assignments }, talents: [...this.s.talents], equipment: { ...this.s.equipment } };
                changed = true;
                break;
            case 'load-loadout': {
                const l = this.s.loadouts[Number(a)];
                if (l) {
                    const assignments: Save['assignments'] = {};
                    for (const [k, v] of Object.entries(l.rings))
                        if (this.s.rings[v] && slotUnlocked(this.s, k as RingSlot))
                            assignments[k as RingSlot] = v;
                    this.s.assignments = assignments;
                    this.s.talents = l.talents.slice(0, this.s.level - 1);
                    for (const k of ['weapon', 'armour', 'boots'] as const)
                        if (this.s.inventory.some(i => i.id === l.equipment[k] && i.slot === k))
                            this.s.equipment[k] = l.equipment[k];
                    changed = true;
                }
                break;
            }
            case 'place':
                this.close();
                this.scene.placement = { kind: a as BuildingKind, x: 5, y: 12, rotation: 0 };
                this.placementUI();
                return;
            case 'move-building': {
                const building = this.s.buildings.find(x => x.id === a);
                if (building) {
                    this.close();
                    this.scene.placement = { ...building };
                    this.placementUI();
                }
                return;
            }
            case 'rotate':
                if (this.scene.placement)
                    this.scene.placement.rotation = (this.scene.placement.rotation + 1) % 4;
                this.placementUI();
                return;
            case 'cancel-place':
                this.scene.placement = null;
                this.placementUI();
                return;
            case 'confirm-place': {
                const p = this.scene.placement;
                if (p) {
                    const before = structuredClone(this.s), id = p.id ?? `building-${++this.s.rng}`;
                    changed = p.id ? moveBuilding(this.s, id, p, p.rotation) : placeBuilding(this.s, p.kind, p, p.rotation, id);
                    if (changed) {
                        this.lastPlacement = { id, before };
                        this.scene.placement = null;
                        this.placementUI();
                        e.refreshHome();
                        this.toast(message("ui.139"));
                    }
                }
                break;
            }
            case 'remove-building':
                changed = removeBuilding(this.s, a);
                if (changed) {
                    this.lastPlacement = null;
                    e.refreshHome();
                }
                break;
            case 'upgrade-home':
                changed = upgradeHome(this.s);
                if (changed) {
                    this.lastPlacement = null;
                    e.refreshHome();
                }
                break;
            case 'undo': {
                if (this.lastPlacement) {
                    const old = this.lastPlacement.before.buildings.find(b => b.id === this.lastPlacement!.id);
                    changed = old ? moveBuilding(this.s, old.id, old, old.rotation) : removeBuilding(this.s, this.lastPlacement.id);
                    this.lastPlacement = null;
                    e.refreshHome();
                }
                break;
            }
            case 'rest':
                if (this.s.tier > 0) {
                    this.s.day++;
                    this.close();
                    e.loadHome();
                    this.toast(message("ui.140") + seasonAt(this.s.day) + message("ui.141"));
                    return;
                }
                break;
            case 'buy': {
                const st = highest(this.s), index = Number(a.split('-').at(-1));
                const seeds = [0, 3, 6, 2, 5];
                const i = { ...makeItem(st, st * 99 + seeds[index], index < 3 ? 'weapon' : index === 3 ? 'armour' : 'boots'), id: a };
                changed = buy(this.s, i);
                break;
            }
            case 'sell':
                changed = sell(this.s, a);
                break;
            case 'salvage':
                changed = salvage(this.s, [a]) > 0;
                break;
            case 'salvage-all':
                changed = salvage(this.s, this.s.inventory.map(i => i.id)) > 0;
                break;
            case 'gauntlet':
                if (this.s.ending) {
                    this.close();
                    e.loadMission(5, true, false, 'gauntlet');
                    e.setState('BOSS_INTRO');
                }
                return;
            case 'defence':
                if (highest(this.s) >= 20) {
                    this.close();
                    e.startDefence();
                }
                return;
            case 'cloak':
                this.s.cloak = Number(a);
                changed = true;
                break;
            case 'service':
                if (a === 'healer') {
                    this.action('rest');
                    return;
                }
                this.open(({ smith: 'trade', scout: 'map', mason: 'build', gardener: 'build', chronicler: 'journal' } as Record<string, string>)[a] ?? 'build');
                return;
        }
        if (changed) {
            if (['assign', 'retrieve', 'cloak'].includes(key))
                this.scene.rebuild();
            e.persist();
            if (key !== 'confirm-place')
                this.lastPlacement = key === 'undo' ? null : this.lastPlacement;
            e.player.maxHp = maxHp(this.s);
            e.player.hp = Math.min(e.player.hp, e.player.maxHp);
            this.audio.play('loot');
            if (this.panel)
                this.open(this.panel);
            else
                this.hud();
        }
        else if (['upgrade-home', 'confirm-place', 'upgrade-ring', 'upgrade-item', 'talent', 'buy'].includes(key))
            this.toast(message("ui.142"));
    }
    bind() { this.root.querySelectorAll<HTMLElement>('[data-action]').forEach(b => b.onclick = () => { if (!(b as HTMLButtonElement).disabled)
        void this.action(b.dataset.action!); }); this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-setting]').forEach(input => { input.onchange = () => { const target = this.engine?.save ?? this.titleSettings; if (!target)
        return; const k = input.dataset.setting!; const value = input instanceof HTMLInputElement && input.type === 'checkbox' ? input.checked : input instanceof HTMLInputElement && input.type === 'range' ? Number(input.value) : input.value; (target.settings as unknown as Record<string, unknown>)[k] = value; if (this.engine)
        this.engine.persist();
    else if (this.saved)
        void this.store.put(target); this.audio.volumes(); if (k === 'quality')
        this.scene.rebuild(); this.hud(); }; }); const file = document.getElementById('save-import') as HTMLInputElement | null; if (file)
        file.onchange = async () => { if (!file.files?.[0])
            return; try {
            const validated = await this.store.import(await file.files[0].text());
            if (window.confirm(t('importConfirm'))) {
                await this.store.archive();
                await this.store.put(validated);
                this.onImport(validated);
            }
        }
        catch (err) {
            this.toast(String(err));
            const el = document.getElementById('import-error');
            if (el)
                el.textContent = String(err);
        } }; }
    time(seconds: number) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }
    download(blob: Blob, name: string) { const url=URL.createObjectURL(blob);this.panel='export';this.engine?.pause();this.engine?.clearInputs();this.modal(this.header(t('exportReady'),t('journeyCopy'))+message('ui.export',url,esc(name),blob.type.startsWith('image/')?message('ui.exportImage',url):message('ui.exportSave')),true);setTimeout(()=>URL.revokeObjectURL(url),300000); }
    shareLoadout() { const c = document.createElement('canvas'); c.width = 1200; c.height = 760; const x = c.getContext('2d')!; x.fillStyle = '#171c1b'; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = '#c2a264'; x.lineWidth = 2; x.strokeRect(35, 35, 1130, 690); x.fillStyle = '#c2a264'; x.font = message("ui.143"); x.fillText(message("ui.144"), 75, 92); x.fillStyle = '#e4d8bc'; x.font = message("ui.145"); x.fillText(`Level ${this.s.level} · ${TIERS[this.s.tier].name}`, 75, 170); x.font = message("ui.146"); x.fillText(`${this.s.cleared.length}/30 stages · ${Object.keys(this.s.rings).length}/12 rings · ${seasonAt(this.s.day)}`, 75, 220); let y = 295; for (const [slot, id] of Object.entries(this.s.assignments)) {
        x.fillStyle = '#c2a264';
        x.fillText(slot.replace(/(\d)/, ' $1'), 75, y);
        x.fillStyle = '#e4d8bc';
        x.fillText(`${ringById[id].name} · Rank ${this.s.rings[id]}`, 300, y);
        y += 50;
    } x.fillStyle = '#c2a264'; x.font = message("ui.147"); x.fillText(message("ui.148"), 75, 675); c.toBlob(blob => { if (blob)
        this.download(blob, 'last-hearth-loadout.png'); }); }
}
