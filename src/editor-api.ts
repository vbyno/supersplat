import { Mat4, Vec3 } from 'playcanvas';

import type { Events } from './events';
import type { Scene } from './scene';
import type { Shortcuts } from './shortcuts';
import type { ToolManager } from './tools/tool-manager';
import type { EditorUI } from './ui/editor';

// Returning true from pointerdown claims the gesture until release or cancellation.
type ToolInput = Partial<Record<'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel' | 'lostpointercapture', (event: PointerEvent) => boolean | void>>;

export function exposeEditorApi(events: Events, scene: Scene, tools: ToolManager, ui: EditorUI, shortcuts: Shortcuts, root: HTMLElement) {
    const api = {
        version: 1 as const,
        events,
        scene,
        Vec3,
        Mat4,
        dom: { root, canvas: ui.canvas, canvasContainer: ui.canvasContainer.dom, toolsContainer: ui.toolsContainer.dom, bottomToolbar: ui.bottomToolbar.dom },
        registerTool(name: string, tool: { activate(): void; deactivate(): void; canActivate?(): boolean; input?: ToolInput }) {
            if (tools.tools.has(name)) throw new Error(`Tool already registered: ${name}`);
            const parent = ui.toolsContainer.dom;
            const canvasContainer = ui.canvasContainer.dom;
            const pointers = new Set<number>();
            const cameraPointers = new Set<number>();
            const inputEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture'] as const satisfies readonly (keyof ToolInput)[];
            const handlers = inputEvents.flatMap((event) => {
                const listener = (value: PointerEvent) => {
                    // Touch capture can move from the tool surface to the camera.
                    if (event === 'lostpointercapture' && cameraPointers.has(value.pointerId) && canvasContainer.hasPointerCapture(value.pointerId)) return;
                    const owned = pointers.has(value.pointerId);
                    const handled = tool.input?.[event]?.(value) === true;
                    if (event === 'pointerdown' && handled) {
                        pointers.add(value.pointerId);
                        parent.setPointerCapture(value.pointerId);
                    } else if (event === 'pointerdown') {
                        cameraPointers.add(value.pointerId);
                    }
                    if (owned || handled) value.stopPropagation();
                    if (event === 'pointerup' || event === 'pointercancel' || event === 'lostpointercapture') {
                        pointers.delete(value.pointerId);
                        cameraPointers.delete(value.pointerId);
                        if (parent.hasPointerCapture(value.pointerId)) parent.releasePointerCapture(value.pointerId);
                    }
                };
                const cameraListener = (value: PointerEvent) => {
                    // Native camera capture retargets subsequent events to the canvas container.
                    // Observe them once, after the camera, so tools can distinguish a click from an orbit.
                    if (event === 'pointerdown' || value.target !== canvasContainer || !cameraPointers.has(value.pointerId)) return;
                    tool.input?.[event]?.(value);
                    if (event === 'pointerup' || event === 'pointercancel' || event === 'lostpointercapture') cameraPointers.delete(value.pointerId);
                };
                return [{ event, listener, cameraListener }];
            });
            let touchAction = '';
            let cursor = '';
            let canvasCursor = '';
            tools.register(name, {
                canActivate: tool.canActivate,
                activate() {
                    if (tool.input) {
                        touchAction = parent.style.touchAction;
                        cursor = parent.style.cursor;
                        canvasCursor = ui.canvasContainer.dom.style.cursor;
                        parent.style.cursor = 'inherit';
                        parent.style.touchAction = 'none';
                        parent.classList.remove('noevents');
                        parent.style.display = 'block';
                        for (const { event, listener, cameraListener } of handlers) {
                            parent.addEventListener(event, listener);
                            canvasContainer.addEventListener(event, cameraListener);
                        }
                    }
                    tool.activate();
                },
                deactivate() {
                    tool.deactivate();
                    for (const { event, listener, cameraListener } of handlers) {
                        parent.removeEventListener(event, listener);
                        canvasContainer.removeEventListener(event, cameraListener);
                    }
                    for (const pointer of pointers) {
                        if (parent.hasPointerCapture(pointer)) parent.releasePointerCapture(pointer);
                    }
                    pointers.clear();
                    cameraPointers.clear();
                    if (tool.input) {
                        parent.style.touchAction = touchAction;
                        parent.style.cursor = cursor;
                        ui.canvasContainer.dom.style.cursor = canvasCursor;
                    }
                    parent.classList.remove('noevents');
                    parent.style.display = 'none';
                }
            });
        },
        registerTooltip(target: HTMLElement, label: string) {
            ui.tooltips.register(target, label);
            return () => ui.tooltips.unregister(target);
        },
        overrideShortcuts: (handlers: Record<string, () => void>) => shortcuts.override(handlers)
    };
    Object.assign(window, { supersplatEditor: api });
    window.dispatchEvent(new CustomEvent('supersplat:ready'));
}
