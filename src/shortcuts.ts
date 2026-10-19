import { Events } from './events';

interface ShortcutOptions {
    ctrl?: boolean;
    shift?: boolean;
    sticky?: boolean;
    capture?: boolean;      // use capture phase - i.e. handle the events before anyone else
    func?: () => void;
    event?: string;
}

class Shortcuts {
    shortcuts: { keys: string[], options: ShortcutOptions, toggled: boolean }[] = [];

    overrides: Map<string, Array<() => void>> = new Map();

    override(handlers: Record<string, () => void>) {
        for (const [name, handler] of Object.entries(handlers)) {
            const stack = this.overrides.get(name) ?? [];
            stack.push(handler);
            this.overrides.set(name, stack);
        }
        let released = false;
        return () => {
            if (released) return;
            released = true;
            for (const [name, handler] of Object.entries(handlers)) {
                const stack = this.overrides.get(name);
                if (!stack) continue;
                const index = stack.lastIndexOf(handler);
                if (index !== -1) stack.splice(index, 1);
                if (!stack.length) this.overrides.delete(name);
            }
        };
    }

    constructor(events: Events, container: HTMLElement) {
        const shortcuts = this.shortcuts;

        const handleEvent = (e: KeyboardEvent, down: boolean, capture: boolean) => {
            if (!(e.target instanceof Node) || !container.contains(e.target)) return;
            if (e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable=true]')) return;
            // Escape also closes tools after using a button in an editor panel.
            if (!capture && e.target !== container && e.key !== 'Escape') return;

            for (let i = 0; i < shortcuts.length; i++) {
                const shortcut  = shortcuts[i];
                const options = shortcut.options;

                if (shortcut.keys.includes(e.key) &&
                    ((options.capture ?? false) === capture) &&
                    !!options.ctrl === !!(e.ctrlKey || e.metaKey) &&
                    !!options.shift === !!e.shiftKey) {

                    e.stopPropagation();
                    e.preventDefault();

                    // handle sticky shortcuts
                    if (options.sticky) {
                        if (down) {
                            shortcut.toggled = e.repeat;
                        }

                        if (down === shortcut.toggled) {
                            return;
                        }
                    } else {
                        // ignore up events on non-sticky shortcuts
                        if (!down) return;
                    }

                    if (shortcuts[i].options.event) {
                        const name = shortcuts[i].options.event;
                        const handler = this.overrides.get(name)?.at(-1);
                        if (handler) handler();
                        else events.fire(name);
                    } else {
                        shortcuts[i].options.func();
                    }

                    break;
                }
            }
        };

        // register keyboard handler
        document.addEventListener('keydown', (e) => {
            handleEvent(e, true, false);
        });

        document.addEventListener('keyup', (e) => {
            handleEvent(e, false, false);
        });

        // also handle capture phase
        document.addEventListener('keydown', (e) => {
            handleEvent(e, true, true);
        }, true);

        document.addEventListener('keyup', (e) => {
            handleEvent(e, false, true);
        }, true);
    }

    register(keys: string[], options: ShortcutOptions) {
        this.shortcuts.push({ keys, options, toggled: false });
    }
}

export {
    Shortcuts
};
