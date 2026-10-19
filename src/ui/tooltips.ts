import { Container, Element, Label } from '@playcanvas/pcui';

type Direction = 'left' | 'right' | 'top' | 'bottom';

class Tooltips extends Container {
    register: (target: Element | HTMLElement, text: string, direction?: Direction) => void;
    unregister: (target: Element | HTMLElement) => void;
    destroy: () => void;

    constructor(args: any = {}) {
        args = {
            ...args,
            class: 'tooltips',
            hidden: true
        };

        super(args);

        const text = new Label({
            class: 'tooltips-content'
        });

        this.append(text);

        const targets = new Map<Element | HTMLElement, any>();
        const style = this.dom.style;
        let timer: number = 0;

        this.register = (target: Element | HTMLElement, textString: string, direction: Direction = 'bottom') => {

            const dom = target instanceof HTMLElement ? target : target.dom;
            const activate = () => {
                const rect = dom.getBoundingClientRect();
                const midx = Math.floor((rect.left + rect.right) * 0.5);
                const midy = Math.floor((rect.top + rect.bottom) * 0.5);

                switch (direction) {
                    case 'left':
                        style.left = `${rect.left}px`;
                        style.top = `${midy}px`;
                        style.transform = 'translate(calc(-100% - 10px), -50%)';
                        break;
                    case 'right':
                        style.left = `${rect.right}px`;
                        style.top = `${midy}px`;
                        style.transform = 'translate(10px, -50%)';
                        break;
                    case 'top':
                        style.left = `${midx}px`;
                        style.top = `${rect.top}px`;
                        style.transform = 'translate(-50%, calc(-100% - 10px))';
                        break;
                    case 'bottom':
                        style.left = `${midx}px`;
                        style.top = `${rect.bottom}px`;
                        style.transform = 'translate(-50%, 10px)';
                        break;
                }

                text.text = textString;
                style.display = 'inline';
            };

            const startTimer = (fn: () => void) => {
                timer = window.setTimeout(() => {
                    fn();
                    timer = -1;
                }, 250);
            };

            const cancelTimer = () => {
                if (timer >= 0) {
                    clearTimeout(timer);
                    timer = -1;
                }
            };

            const enter = () => {
                cancelTimer();

                if (style.display === 'inline') {
                    activate();
                } else {
                    startTimer(() => activate());
                }
            };

            const leave = () => {
                cancelTimer();

                if (style.display === 'inline') {
                    startTimer(() => {
                        style.display = 'none';
                    });
                }
            };

            dom.addEventListener('pointerenter', enter);
            dom.addEventListener('pointerleave', leave);

            dom.addEventListener('focus', enter);
            dom.addEventListener('blur', leave);
            if (!(target instanceof HTMLElement)) target.on('destroy', () => this.unregister(target));

            targets.set(target, { enter, leave });
        };

        this.unregister = (target: Element | HTMLElement) => {
            const value = targets.get(target);
            if (value) {
                const dom = target instanceof HTMLElement ? target : target.dom;
                dom.removeEventListener('pointerenter', value.enter);
                dom.removeEventListener('pointerleave', value.leave);
                dom.removeEventListener('focus', value.enter);
                dom.removeEventListener('blur', value.leave);
                if (timer >= 0) clearTimeout(timer);
                style.display = 'none';
                targets.delete(target);
            }
        };

        this.destroy = () => {
            for (const target of targets.keys()) {
                this.unregister(target);
            }
        };
    }
}

export { Tooltips };
