import type {InputPort} from './InputPort.ts';
import {clientToScratch} from '../render/coordinates.ts';
import {normalizeKey} from './keyNames.ts';

/**
 * Browser-only InputPort implementation. Subscribes to mouse/keyboard DOM
 * events on the given canvas/event target and normalizes them into Scratch
 * stage space (per SCRATCH_EVENT_SPEC.md "Key / mouse"): CSS display scaling
 * is undone via clientToScratch so the reported mouse position always
 * matches the fixed 480x360 internal stage regardless of canvas CSS size.
 */
export class DomInputManager implements InputPort {
    private readonly canvas: HTMLCanvasElement;
    private readonly target: EventTarget;
    private mouseX = 0;
    private mouseY = 0;
    private mouseDown = false;
    private readonly keysDown = new Set<string>();

    private readonly onMouseMove = (event: MouseEvent): void => {
        const rect = this.canvas.getBoundingClientRect();
        const point = clientToScratch(event.clientX, event.clientY, rect);
        this.mouseX = point.x;
        this.mouseY = point.y;
    };

    private readonly onMouseDown = (): void => {
        this.mouseDown = true;
    };

    private readonly onMouseUp = (): void => {
        this.mouseDown = false;
    };

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        this.keysDown.add(normalizeKey(event.key));
    };

    private readonly onKeyUp = (event: KeyboardEvent): void => {
        this.keysDown.delete(normalizeKey(event.key));
    };

    constructor(canvas: HTMLCanvasElement, eventTarget: EventTarget = window) {
        this.canvas = canvas;
        this.target = eventTarget;

        this.target.addEventListener('mousemove', this.onMouseMove as EventListener);
        this.target.addEventListener('mousedown', this.onMouseDown as EventListener);
        this.target.addEventListener('mouseup', this.onMouseUp as EventListener);
        this.target.addEventListener('keydown', this.onKeyDown as EventListener);
        this.target.addEventListener('keyup', this.onKeyUp as EventListener);
    }

    getMouseX(): number {
        return this.mouseX;
    }

    getMouseY(): number {
        return this.mouseY;
    }

    isMouseDown(): boolean {
        return this.mouseDown;
    }

    isKeyDown(key: string): boolean {
        return this.keysDown.has(key);
    }

    /** Removes all DOM event listeners registered by this instance. */
    dispose(): void {
        this.target.removeEventListener('mousemove', this.onMouseMove as EventListener);
        this.target.removeEventListener('mousedown', this.onMouseDown as EventListener);
        this.target.removeEventListener('mouseup', this.onMouseUp as EventListener);
        this.target.removeEventListener('keydown', this.onKeyDown as EventListener);
        this.target.removeEventListener('keyup', this.onKeyUp as EventListener);
    }
}
