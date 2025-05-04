//Test-ris   2025-0412 ver 0.1  0428 ver 0.92 akiramaetomo


/* =========================================================
 *  ゲーム起動処理
 * =======================================================*/
import { GameConfig } from './GameConfig.js';
import { Engine } from './core/Engine.js';
import { SceneManager } from './scenes/SceneManager.js';
import TitleScene from './scenes/TitleScene.js';

// デバッグ用パフォーマンス計測
import { PerfStats } from './utils/perfStats.js';
const perf = new PerfStats({ enabled: true, interval: 1000, keyToggle: 'F3' });

// サウンドマネージャー初期化
import { soundManager } from './audio/globalSoundManager.js';

import { CombinedInputHandler } from './input/CombinedInputHandler.js';
import { ACTIONS } from './input/inputHandler.js';
import { AppInitializer } from './utils/AppInitializer.js';
import { StatsManager } from './utils/StatsManager.js'; // 統計情報
import { DisplayManager } from './utils/DisplayManager.js'; //画面表示レンダラー _oldとの違いは僅か？
import { WallpaperController } from './utils/WallpaperController.js'; // 背景切替コントローラ
import { BGMManager } from './utils/BGMManager.js'; // BGM 再生管理

import { EventBus } from './utils/EventBus.js'//イベント シングルトン

// 入力ハンドラ初期化
const input = new CombinedInputHandler();
window.input = input;

// GameConfig と Engine, SceneManager を組み立て
const cfg = new GameConfig({ speedIndex: window.settingOptions?.['落下速度'] });
const engine = new Engine('gameCanvas', cfg);
const bgmManager = new BGMManager();
window.bgmManager = bgmManager;
const sceneMgr = new SceneManager('title');

// infoArea レイアウト適用 (次ブロック領域幅に合わせる)
const nextCanvasWidth = document.getElementById('nextCanvas').width;
document.getElementById('infoArea').style.width = `${nextCanvasWidth}px`;
document.getElementById('statsArea').style.width = `${nextCanvasWidth}px`;
document.getElementById('statsArea').style.height = `${engine.canvas.height}px`;
const statsEl = document.getElementById('statsArea');
const infoEl = document.getElementById('infoArea');



// AppInitializer: 起動時の初期化タスクをまとめて実行
const appInitializer = new AppInitializer();
const wallpaperController = new WallpaperController();

// サウンドロードタスク
appInitializer.register('LoadSounds', async () => {
    await soundManager.loadAllSounds({
        move: './assets/audio/move.wav',
        rotate: './assets/audio/rotate.wav',
        land: './assets/audio/land.wav',
       fix: './assets/audio/fix.wav',
        clear: './assets/audio/clear.wav',
        drop: './assets/audio/drop.wav',
        bgm_play: './assets/audio/bgm_play.wav',
        bgm_over: './assets/audio/bgm_over.wav',
        se_over: './assets/audio/se_over.wav'
    });
    soundManager.setVolume({ master: 0.1, sfx: 0.2, bgm: 0.2 });
});

// StatsManager 初期化タスク
appInitializer.register('InitStatsManager', async () => {
    StatsManager.init();
});

// DisplayManager 初期化タスク
let displayManager;
appInitializer.register('InitDisplayManager', async () => {
    displayManager = new DisplayManager(statsEl, infoEl);
});

EventBus.emit('phaseChanged', 'title');


// WallpaperController 初期化タスク
appInitializer.register('InitWallpaper', async () => wallpaperController.init());

 // BGMManager 初期化タスク
appInitializer.register('InitBGMManager', async () => {
await bgmManager.init({
        bgm_init: './assets/audio/bgm_init.wav',
        bgm_play: './assets/audio/bgm_play.wav',
        bgm_over: './assets/audio/bgm_over.wav'
    });
    bgmManager.play('bgm_init');
});

EventBus.emit('phaseChanged', 'title');

// 初期化実行後にゲームループ開始
appInitializer.init().then(() => {
    let lastStatsHTML = "";
    engine.start((dt) => {
        perf.begin();
        performance.mark('loop-start');

        input.poll(dt);
        sceneMgr.update(dt);
        sceneMgr.draw(engine.ctx);
        input._afterPoll();

        // 情報／デバッグ表示
        const scene = sceneMgr.getCurrentScene();
        if (scene.state?.cfg) {
            displayManager.render(scene.state);
            lastStatsHTML = statsEl.innerHTML;
        } else {
            statsEl.innerHTML = lastStatsHTML;
            infoEl.innerHTML = "";
        }

        performance.mark('loop-end');
        performance.measure('frame', 'loop-start', 'loop-end');
        perf.end();
    });
});
