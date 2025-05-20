import { InputHandler } from './inputHandler.js';
import { KeyboardInputHandler } from './keyboard.js';
import { GamepadInputHandler } from './gamepad.js';
import { TouchInputHandler } from './TouchInputHandler.js';

/**
 * Keyboard と Gamepad を同時に監視し、どちらかの入力を受け付けるハンドラ
 */
export class CombinedInputHandler extends InputHandler {
constructor() {
        super();
        this.keyboard = new KeyboardInputHandler();
        this.gamepad = new GamepadInputHandler();
        this.touch = new TouchInputHandler();
    }

    /**
     * 毎フレーム呼び出し。両方のハンドラを poll し、
     * active セットをマージする。
     */
    poll(dt) {
this.keyboard.poll();
        this.gamepad.poll();
        this.touch.poll();
        this.active.clear();
        for (const act of this.keyboard.active) {
            this.active.add(act);
        }
for (const act of this.gamepad.active) {
            this.active.add(act);
        }
        for (const act of this.touch.active) {
            this.active.add(act);
        }
    }

    /**
     * poll 後に呼び出し、両方の _afterPoll() を実行し、
     * 統合した前フレームセットを更新する。
     */
    _afterPoll() {
this.keyboard._afterPoll();
        this.gamepad._afterPoll();
        this.touch._afterPoll();
        super._afterPoll();
    }
}
