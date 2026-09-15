import {chooseRenderer} from './game/renderer';
import { message } from './content/messages';
import Phaser from 'phaser';
import './style.css';
import { WorldScene } from './game/scene';
import { Engine } from './game/engine';
import { Controls } from './game/input';
import { HearthAudio } from './game/audio';
import { Interface } from './ui/ui';
import { SaveStore, freshSave, defaultSettings } from './systems/saves';
import type { Save } from './types';
const root = document.getElementById('ui')!;
root.innerHTML = message("main.001");
const store = new SaveStore();
let engine: Engine | null = null;
const scene = new WorldScene();
const audio = new HearthAudio(() => engine?.save.settings ?? defaultSettings());
let ui: Interface;
const controls = new Controls(() => engine, (x, y) => scene.aimAt(x, y), p => ui?.placeAt(p) ?? false);
ui = new Interface(scene, controls, audio, store);
const game = new Phaser.Game({ type: chooseRenderer(), parent: 'game', backgroundColor: '#171c1b', width: window.innerWidth, height: window.innerHeight, scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH }, render: { antialias: true, roundPixels: false, preserveDrawingBuffer: true }, fps: { target: 60, forceSetTimeOut: false }, audio: { noAudio: true }, scene: [scene] });
async function start(save: Save) { if (engine)
    engine.events = []; engine = new Engine(save, store); engine.presentationEnabled = true; ui.bindEngine(engine); scene.bind(engine); engine.start(); document.getElementById('game')!.classList.add('active'); if (import.meta.env.DEV) {
    const { installFixtures } = await import('./dev/fixtures');
    installFixtures(engine, scene, ui);
} }
ui.onStart = async (isNew) => { if (isNew) {
    await store.archive();
    const save = freshSave();
    save.settings = structuredClone(ui.titleSettings?.settings ?? defaultSettings());
    await store.put(save);
    await start(save);
}
else {
    const save = await store.get();
    await start(save ?? freshSave());
} };
ui.onImport = save => { ui.panel = ''; void start(save); };
scene.onReady = async () => { await store.open(); ui.title(await store.get()); };
scene.onTick = () => { controls.update(); if (performance.now() - ui.lastHud > 110) {
    ui.hud();
    ui.lastHud = performance.now();
} };
document.addEventListener('visibilitychange', () => { if (document.hidden)
    audio.suspend();
else
    audio.resume(); });
window.addEventListener('error', event => { const a = document.getElementById('announcer'); if (a)
    a.textContent = message("main.002"); console.error(message("main.003"), event.message); });
