import type { Point } from '../types';
import { Engine } from './engine';
import { unproject } from '../world/maps';
export class Controls {
    keys = new Set<string>();
    stick: Point = { x: 0, y: 0 };
    touch = false;
    onMenu: (name: string) => void = () => { };
    remap: string | null = null;
    remapped: (action: string, code: string) => void = () => { };
    listeners: (() => void)[] = [];
    constructor(public engine: () => Engine | null, public aimAt: (x: number, y: number) => Point, public placeAt: (p: Point) => boolean) {
        this.listen(window, 'keydown', (raw) => { const ev = raw as KeyboardEvent; const e = this.engine(); if (this.remap) {
            ev.preventDefault();
            this.remapped(this.remap, ev.code);
            this.remap = null;
            return;
        } if (!e || e.state==='STORY')
            return; if ((ev.target as HTMLElement)?.matches('input,textarea,select'))
            return; const action = Object.entries(e.save.settings.bindings).find(([, v]) => v === ev.code)?.[0]; if (action || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.code))
            ev.preventDefault(); this.keys.add(ev.code); if (ev.repeat)
            return; switch (action) {
            case 'attack':
                e.attackHeld = true;
                break;
            case 'secondary':
                e.secondary(true);
                break;
            case 'dodge':
                e.dodge();
                break;
            case 'ring1':
                e.ring(1);
                break;
            case 'ring2':
                e.ring(2);
                break;
            case 'heal':
                e.heal();
                break;
            case 'interact':
                e.interact();
                break;
            case 'inventory':
                this.onMenu('equipment');
                break;
            case 'map':
                this.onMenu('map');
                break;
            case 'pause':
                this.onMenu('pause');
                break;
        } });
        this.listen(window, 'keyup', (raw) => { const ev = raw as KeyboardEvent; this.keys.delete(ev.code); const e = this.engine(); if (!e)
            return; if (ev.code === e.save.settings.bindings.attack)
            e.attackHeld = false; if (ev.code === e.save.settings.bindings.secondary)
            e.secondary(false); });
        const cancel = () => { this.keys.clear(); this.stick = { x: 0, y: 0 }; this.engine()?.clearInputs(); };
        this.listen(window, 'blur', () => { cancel(); this.engine()?.pause(); });
        this.listen(window, 'orientationchange', cancel);
        this.listen(document, 'visibilitychange', () => { if (document.hidden) {
            cancel();
            this.engine()?.pause();
        } });
        this.listen(window, 'pointercancel', cancel);
        const host = document.getElementById('game')!;
        this.listen(host, 'pointermove', (raw) => { const ev = raw as PointerEvent; if (ev.pointerType !== 'touch') {
            const e = this.engine();
            if (e && !e.save.settings.keyboardAim)
                e.aim = this.aimAt(ev.clientX, ev.clientY);
        } });
        this.listen(host, 'pointerdown', (raw) => { const ev = raw as PointerEvent; const e = this.engine(); if (!e)
            return; const p = this.aimAt(ev.clientX, ev.clientY); if (this.placeAt(p))
            return; if (ev.pointerType === 'touch')
            return; e.aim = p; if (ev.button === 0)
            e.attackHeld = true; if (ev.button === 2)
            e.secondary(true); });
        this.listen(window, 'pointerup', (raw) => { const ev = raw as PointerEvent; if (ev.pointerType === 'touch')
            return; const e = this.engine(); if (!e)
            return; if (ev.button === 0)
            e.attackHeld = false; if (ev.button === 2)
            e.secondary(false); });
        this.listen(host, 'contextmenu', ev => ev.preventDefault());
    }
    listen(target: EventTarget, type: string, fn: EventListener) { target.addEventListener(type, fn); this.listeners.push(() => target.removeEventListener(type, fn)); }
    bindTouch(root: HTMLElement) {
        const stick = root.querySelector<HTMLElement>('#joystick');
        if (stick) {
            let pointer: number | null = null;
            const knob = stick.querySelector<HTMLElement>('span')!;
            const update = (ev: PointerEvent) => { const b = stick.getBoundingClientRect(), dx = (ev.clientX - b.left - b.width / 2) / 45, dy = (ev.clientY - b.top - b.height / 2) / 45, len = Math.max(1, Math.hypot(dx, dy)); this.stick = { x: dx / len, y: dy / len }; knob.style.transform = `translate(${this.stick.x * 35}px,${this.stick.y * 35}px)`; this.engine()!.aim = null; };
            stick.onpointerdown = ev => { ev.preventDefault(); pointer = ev.pointerId; try {
                stick.setPointerCapture(ev.pointerId);
            }
            catch { } update(ev); };
            stick.onpointermove = ev => { if (ev.pointerId === pointer)
                update(ev); };
            const end = () => { pointer = null; this.stick = { x: 0, y: 0 }; knob.style.transform = ''; };
            stick.onpointerup = end;
            stick.onpointercancel = end;
        }
        root.querySelectorAll<HTMLElement>('[data-touch]').forEach(b => { const action = b.dataset.touch!; b.onpointerdown = ev => { ev.preventDefault(); try {
            b.setPointerCapture(ev.pointerId);
        }
        catch { } const e = this.engine(); if (!e)
            return; e.aim = null; if (action === 'attack')
            e.attackHeld = true;
        else if (action === 'secondary')
            e.secondary(true);
        else if (action === 'dodge')
            e.dodge();
        else if (action === 'ring1')
            e.ring(1);
        else if (action === 'ring2')
            e.ring(2);
        else if (action === 'heal')
            e.heal();
        else if (action === 'interact')
            e.interact(); }; b.onpointerup = () => { const e = this.engine(); if (action === 'attack' && e)
            e.attackHeld = false; if (action === 'secondary')
            e?.secondary(false); }; b.onpointercancel = b.onpointerup; });
    }
    update() { const e = this.engine(); if (!e)
        return; const b = e.save.settings.bindings, has = (s: string) => this.keys.has(s); let x = Number(has(b.right) || has('ArrowRight')) - Number(has(b.left) || has('ArrowLeft')) + this.stick.x, y = Number(has(b.down) || has('ArrowDown')) - Number(has(b.up) || has('ArrowUp')) + this.stick.y; const d = unproject({ x, y }); const l = Math.max(1, Math.hypot(d.x, d.y)); e.inputMove = { x: d.x / l, y: d.y / l }; }
    destroy() { this.listeners.forEach(fn => fn()); }
}
