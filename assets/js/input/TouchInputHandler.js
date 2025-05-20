import { InputHandler } from './inputHandler.js';

/**
 * TouchInputHandler listens to on-screen touch controls and updates active actions.
 */
export class TouchInputHandler extends InputHandler {
    constructor() {
        super();
        this._initTouchControls();
    }

    _initTouchControls() {
        window.addEventListener('load', () => {
            const container = document.getElementById('touchControls');
            if (!container) return;
            const buttons = Array.from(container.querySelectorAll('.control-button'));
buttons.forEach(btn => {
            const el = /** @type {HTMLButtonElement} */ (btn);
                const action = el.dataset.action;
                // Start pressing
                btn.addEventListener('touchstart', e => {
                    e.preventDefault();
                    this.active.add(action);
                });
                // Stop pressing
                const endFn = e => {
                    e.preventDefault();
                    this.active.delete(action);
                };
                btn.addEventListener('touchend', endFn);
                btn.addEventListener('touchcancel', endFn);
            });
        });
    }

    /** Called each frame but no-op since touch events update state */
    poll(/* deltaMs */) {
        // no-op
    }

    /** After poll, update previous state */
    _afterPoll() {
        super._afterPoll();
    }
}
