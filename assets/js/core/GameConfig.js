// GameConfig.js 2025-05-02
// ゲームパラメータをまとめた「設定」クラス。
// new GameConfig({ ROWS:30, speedIndex:2 }) のようにオーバーライド可能。

// ドロップ速度オプション（SettingsSceneで表示するラベル）



import { SETTING_DEFINITIONS } from '../config/settingDefinitions.js';

export class GameConfig {
    constructor(overrides = {}) {
        for (const def of SETTING_DEFINITIONS) {
            const key = def.key;
            const options = def.options;
            const saved = overrides[key] ?? window.settingOptions?.[key];
            let selected;

            if (typeof saved !== 'undefined') {
                const idx = options.findIndex(opt => JSON.stringify(opt.value) === JSON.stringify(saved));
                selected = idx >= 0 ? idx : def.defaultIndex;
            } else {
                selected = def.defaultIndex;
            }

            const opt = options[selected];
            this[key] = opt.value;

            // ラベルも必要なら同時に
            this[key + 'Label'] = opt.label;

            // 特別用途に応じた追加変数も（例：落下間隔）
            if (key === 'speedIndex') {
                this.NATURAL_DROP_INTERVAL = opt.value;
            }

            if (key === 'fieldSize') {
                this.COLS = opt.value[0];
                this.ROWS = opt.value[1];
            }
        }

        // 固定設定（今後可変化予定）
        this.TOP_MARGIN = 1;
        this.BLOCK_SIZE = 40;
        this.NEXT_BLOCK_SIZE = 40;
        this.SOFT_DROP_FRAME = 3;
        this.KEY_MOVE_INITIAL_DELAY = 200;
        this.KEY_MOVE_REPEAT_INTERVAL = 17;
        this.LINE_STEP_FALL_TIME = 0;
        this.LINE_STEP_PAUSE_TIME = 0;
        this.FALL_DELAY = 500;
        this.LOCK_DELAY = 500;
        this.SPAWN_DELAY = 500;
    }
}






export const DROP_SPEED_LABEL_old = [
    '20G(833us)',
    '10G(1.67ms)',
    '5G(3.33ms)',
    '1G(16.67ms)',
    '0.5G(33.3ms)',
    '50ms',
    '100ms',
    '500ms',
    '1s'
];

// ドロップ速度定数（ms単位）
export const DROP_SPEED_VALUES_old = [
    0.833,
    1.667,
    3.333,
    16.667,
    33.3,
    50,
    100,
    500,
    1000
];

export class GameConfig_old {
    constructor(overrides = {}) {
        // drop speed index: overrides or persistent setting or default(1G)
        let speedIndex = overrides.speedIndex;
        if (speedIndex == null) {
            speedIndex = window.settingOptions?.['落下速度'];
        }
        if (typeof speedIndex !== 'number' ||
            speedIndex < 0 || speedIndex >= DROP_SPEED_VALUES.length) {
            speedIndex = 3; // default to 1G
        }
        delete overrides.speedIndex;

        Object.assign(this, {
            /* --- プレイフィールド寸法 --- */
            COLS: 10,
            ROWS: 20,
            TOP_MARGIN: 1,

            /* --- 描画 --- */
            BLOCK_SIZE: 40,
            NEXT_BLOCK_SIZE: 40,

            /* --- ソフトドロップ --- */
            SOFT_DROP_FRAME: 3,

            /* --- 横移動 DAS --- */
            KEY_MOVE_INITIAL_DELAY: 200,
            KEY_MOVE_REPEAT_INTERVAL: 17,

            /* --- 行消去アニメ --- */
            LINE_STEP_FALL_TIME: 0,
            LINE_STEP_PAUSE_TIME: 0,

            /* --- 各種ディレイ --- */
            FALL_DELAY: 500, // ブロックが揃い、消去までのディレイ
            LOCK_DELAY: 500, // Lock Delay
            SPAWN_DELAY: 500 // 新ブロック出現前の待機時間
        }, overrides);

        // set natural drop interval from selected speed
        this.NATURAL_DROP_INTERVAL = DROP_SPEED_VALUES[speedIndex];
        this.speedIndex = speedIndex;
        this.dropSpeedLabel = DROP_SPEED_LABELS[speedIndex];
    }
}
