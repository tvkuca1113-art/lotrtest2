import { assetUrl } from '../assets';
import type { Settings } from '../types';
export class HearthAudio {
    context: AudioContext | null = null;
    buffers = new Map<string, AudioBuffer>();
    groups: Record<string, GainNode> = {};
    started = false;
    constructor(public settings: () => Settings) { }
    async start() { if (this.started) {
        void this.context?.resume();
        return;
    } this.started = true; try {
        this.context = new AudioContext();
        for (const g of ['music', 'sfx', 'ambience']) {
            const gain = this.context.createGain();
            gain.connect(this.context.destination);
            this.groups[g] = gain;
        }
        this.volumes();
        await this.context.resume();
        for (const name of ['step', 'swing', 'impact', 'dodge', 'bow', 'hurt', 'ring', 'heal', 'loot', 'coin', 'boss', 'cue', 'parry', 'break', 'victory', 'music', 'ambience']) {
            const bytes = await fetch(assetUrl(`assets/audio/${name}.wav`)).then(r => r.arrayBuffer());
            this.buffers.set(name, await this.context.decodeAudioData(bytes));
        }
        this.play('music', true);
        this.play('ambience', true);
    }
    catch {
        this.started = false;
    } }
    volumes() { for (const g of ['music', 'sfx', 'ambience'] as const)
        if (this.groups[g])
            this.groups[g].gain.value = this.settings()[g]; }
    play(name: string, loop = false) { if (!this.context || this.context.state !== 'running' || !this.buffers.has(name))
        return; const src = this.context.createBufferSource(); src.buffer = this.buffers.get(name)!; src.loop = loop; src.connect(this.groups[name === 'music' ? 'music' : name === 'ambience' ? 'ambience' : 'sfx']); src.start(); }
    suspend() { void this.context?.suspend(); }
    resume() { void this.context?.resume(); }
}
