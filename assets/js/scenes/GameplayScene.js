// @ts-nocheck
// scenes/GameplayScene.js  ── 完全 FSM 移植版
import { Scene } from '../core/Scene.js';
import { GameState } from '../core/GameState.js';
import { TETROMINOES } from '../resources/tetrominoes.js';
import { soundManager } from '../audio/globalSoundManager.js';
import { ACTIONS } from '../input/inputHandler.js';
import { EventBus } from '../utils/EventBus.js';
import { StatsManager } from '../utils/StatsManager.js';

import { leftWallImg, rightWallImg, topWallImg, downWallImg } from '../resources/wallImages.js';

const OPTIONS = {
    hardTopWall: true   // false にすれば旧仕様（めり込み可）
};

/* ---------- サブフェーズ列挙 ---------- */
const SUB = Object.freeze({
    PENDING_START: 'pending_start',
    PLAYING: 'playing',
    LOCKING: 'locking',
    CLEARING: 'clearing',
    COLLAPSING: 'collapsing',
    SPAWNING: 'spawning',
    PENDING_GAMEOVER: 'pending_gameover',
    GAMEOVER: 'gameover'
});

export default class GameplayScene extends Scene {

    /* ===== コンストラクタ ===== */
    constructor(mgr) {
        super(mgr);
//        this._mgr = mgr;
        // StatsManager を初期化（EventBus購読を登録）
        StatsManager.init();
        StatsManager.reset();
        this.cfg = this._mgr.app.gameConfig;
        this.state = new GameState(this.cfg);
        this.field = Array.from({ length: this.cfg.ROWS }, () => Array(this.cfg.COLS).fill(0));


        //！！必要なハズ！！    
        // buffered rotation: spawn前に押された回転入力を保持する (初期化)
        this._bufferedRotateDir = 0;
        // buffered rotation: バッファ回転適用済フラグ初期化
        this._bufferedRotationApplied = false;


        /* Next / Current ブロック */
        this.nextBlock = this.makeRandomBlock();
        this.spawnBlock();

        /* 描画用座標変換キャッシュ */
        this.BS = this.cfg.BLOCK_SIZE;

        //ゲームオーバ時SE＆BGM多重鳴り禁止用
        this._hasPlayedOverSE = false;




    }

    /* ===== Scene ライフサイクル ===== */
    enter() {
        soundManager.resumeContext();
        //        window.bgmManager.switch('bgm_play');

        // 設定画面で選んだ BGM キーを取得して再生
        const bgmKey = this.cfg.bgm;
        window.bgmManager.switch(bgmKey);

        // Delay before gameplay starts
        this._startDelay = 1800; // milliseconds
        this.state.currentPhase = SUB.PENDING_START;
        EventBus.emit('phaseChanged', 'playing');

    }
    exit() { soundManager.fadeOutBgm(500); }

    /* ===== メイン update ===== */
    update(dt) {

        //_startDelay　はゲーム開始時のディレイ　２秒弱　ココでのプリ回転入力を見ている。
        //処理を入れていたが、this.spawnBlock()　でプリ回転入力見ているので不要ー＞ではない。１回だけ実行。必要。
        if (this._startDelay != null && this.cfg.enableBufferedRotation) {
            if (window.input.isPressed(ACTIONS.ROTATE_L)) this._bufferedRotateDir = -1;
            if (window.input.isPressed(ACTIONS.ROTATE_R)) this._bufferedRotateDir = 1;
        }

        // Pending start delay
        if (this._startDelay != null) {
            this._startDelay -= dt;
            if (this._startDelay <= 0) {
                this._startDelay = null;
                this.state.currentPhase = SUB.PLAYING;

            }
            return;
        }


        const s = this.state;
        const inp = window.input;

        /* 1) 入力を状態へブリッジ */
        s.leftKeyDown = inp.isDown(ACTIONS.MOVE_LEFT);
        s.rightKeyDown = inp.isDown(ACTIONS.MOVE_RIGHT);
        s.forcedDrop = inp.isDown(ACTIONS.SOFT_DROP);
        if (inp.isPressed(ACTIONS.SOFT_DROP)) s.dropAccumulator = 0;
        if (inp.isPressed(ACTIONS.ROTATE_L)) this.rotateBlock(-1);
        if (inp.isPressed(ACTIONS.ROTATE_R)) this.rotateBlock(1);

        /* 2) サブ FSM */
        switch (s.currentPhase) {
            case SUB.PLAYING: this.updatePlaying(dt); break;
            case SUB.LOCKING: this.updateLocking(dt); break;
            case SUB.CLEARING: this.updateClearing(dt); break;
            case SUB.COLLAPSING: this.updateCollapsing(dt); break;
            case SUB.SPAWNING: this.updateSpawning(dt); break;
            case SUB.PENDING_GAMEOVER: this.updatePendingGameover(dt); break;
            case SUB.GAMEOVER: /* 何もしない */         break;
        }

        /* ゲームオーバー中にタイトルへ戻るキー */
        if (this.state.currentPhase === SUB.GAMEOVER &&
            window.input.isPressed(ACTIONS.BACK)) {
            this._mgr.changeTo('title');
            return;
        }

        /* ゲームオーバー中の再開キー */
        if (this.state.currentPhase === SUB.GAMEOVER &&
            (window.input.isPressed(ACTIONS.RESTART) ||
                window.input.isPressed(ACTIONS.START) ||
                window.input.isPressed(ACTIONS.ENTER))) {
            this._mgr.changeTo('gameplay');
            return;
        }



    }

    /* ===== 描画 ===== */
    draw(ctx) {
        const BS = this.BS;
        ctx.clearRect(0, 0, (this.cfg.COLS + 2) * BS,
            (this.cfg.ROWS + this.cfg.TOP_MARGIN + 1) * BS);

        /* 壁 */
        this.drawWalls(ctx);

        /* フィールド */
        for (let r = 0; r < this.cfg.ROWS; r++)
            for (let c = 0; c < this.cfg.COLS; c++)
                if (this.field[r][c])
                    this.drawBlock(ctx, c, r, this.field[r][c]);

        /* 操作中 */
        if (this.state.currentBlock) {
            const b = this.state.currentBlock;
            for (let r = 0; r < 4; r++)
                for (let c = 0; c < 4; c++)
                    if (b.shape[r][c])
                        this.drawBlock(ctx, b.col + c, b.row + r, b.color);
        }

        /* GAME OVER オーバーレイ */
        if (this.state.currentPhase === SUB.GAMEOVER) {
            ctx.save();

            // 背景を半透明黒で覆う
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(
                0, 0,
                (this.cfg.COLS + 2) * BS,
                (this.cfg.ROWS + this.cfg.TOP_MARGIN + 1) * BS
            );

            // 赤文字で GAME OVER
            ctx.fillStyle = 'red';
            ctx.font = 'bold 64px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(
                'GAME OVER',
                (this.cfg.COLS + 2) * BS / 2,
                (this.cfg.ROWS + this.cfg.TOP_MARGIN + 1) * BS / 2
            );

            // 半分のサイズ（24px）の白文字で再開メッセージ
            ctx.fillStyle = 'white';
            ctx.font = '28px cursive';
            // GAME OVER の下に少しスペースをあけて表示
            ctx.fillText(
                'Press R(START) to restart',
                (this.cfg.COLS + 2) * BS / 2,
                (this.cfg.ROWS + this.cfg.TOP_MARGIN + 1) * BS / 2 + 36
            );

            // 半分のサイズ（24px）の白文字で再開メッセージ
            ctx.fillStyle = 'white';
            ctx.font = '28px cursive';
            // GAME OVER の下に少しスペースをあけて表示
            ctx.fillText(
                'Press B(BACK) to main',
                (this.cfg.COLS + 2) * BS / 2,
                (this.cfg.ROWS + this.cfg.TOP_MARGIN + 1) * BS / 2 + 72
            );



            ctx.restore();
        }

        if (this.state.currentPhase !== SUB.GAMEOVER)
            this.drawNextBlock();     // ← 追加


    }

    /* ===================================================================== */
    /*                       以下：旧ロジックをメソッド化                     */
    /* ===================================================================== */

    /* -------- ブロック生成 -------- */
    makeRandomBlock() {
        const idx = Math.floor(Math.random() * TETROMINOES.length);
        const d = TETROMINOES[idx];
        return {
            tetrominoIndex: idx,
            rotationIndex: 0,
            shape: JSON.parse(JSON.stringify(d.shapes[0])),
            color: d.color
        };
    }

    //次のブロックを出す。ブロック満杯判定ー＞ゲームオーバへの分岐
    spawnBlock() {

        EventBus.emit('blockSpawned');

        // this._bufferedRotateDir = 0;//ここでこれを入れると回転しない！！！
        // buffered rotation: バッファ回転適用済フラグ初期化
        this._bufferedRotationApplied = false;

        console.log('spawnBlock:', 'enableBufferedRotation=', this.cfg.enableBufferedRotation, 'bufferedRotateDir=', this._bufferedRotateDir, 'bufferedApplied=', this._bufferedRotationApplied);

        this.state.blockFixed = false;       // フラグ解除
        this.state.currentBlock = this.nextBlock;
        this.state.currentBlock.row = -this.cfg.TOP_MARGIN;
        this.state.currentBlock.col = Math.floor(this.cfg.COLS / 2 - 2);
        this.nextBlock = this.makeRandomBlock();

        /* 出現衝突＝ゲームオーバー */
        if (this.isCollision()) {
            this._gameoverDelay = 800;              // 遅延時間
            this._hasPlayedOverSE = false;      //音多重鳴り防止
            this.state.currentPhase = SUB.PENDING_GAMEOVER;
        } else {
            this.state.currentPhase = SUB.PLAYING;
        }
    }

    /* -------- PLAYING -------- */
    updatePlaying(dt) {
        const s = this.state, cfg = this.cfg;
        
        /* 自然 or ソフトドロップ */
        if (!s.forcedDrop) {
            s.dropAccumulator += dt;
            /* 何行落とせるか計算。ROWS (20) を上限にして一括移動 */
            const steps = Math.min(Math.floor(s.dropAccumulator / cfg.NATURAL_DROP_INTERVAL), cfg.ROWS);
            if (steps) {
                s.dropAccumulator -= steps * cfg.NATURAL_DROP_INTERVAL;
                this.moveBlockDown(steps);

                //やはりこの位置か？？！！！削除対象！！！自然落下、ソフトドロップ両方でプリ回転を適用させたい。この位置は自然落下の条件なので不適切
                // buffered rotation: spawn前に押された回転を一度だけ適用
                //一段ブロックが落ちてから回転、が実装されていないだろう。出現直後に回転して回らないのが現状のハズ。現状認識から。    
                if (cfg.enableBufferedRotation && this._bufferedRotateDir && !this._bufferedRotationApplied && steps>0) {
                    if(this.rotateBlock(this._bufferedRotateDir)){
                        this._bufferedRotationApplied = true;   //falseが定位
                        this._bufferedRotateDir=0;              //回転方向初期化
                        //ここで統計窓に何回この「ワザ」がうまくいったか出力
                        EventBus.emit('bufferedRotationSuccess');
                    }
                }
            }
        } else {
            this.moveBlockDown(cfg.SOFT_DROP_FRAME);
        }

        /* 水平移動 */
        this.handleHorizontalMove(dt);
        //回転処理はキーイベントでcallされる。

        /* 着地判定 */
        // （C）「ブロックが床に接触している」かどうか判定
        //       → canDrop() == false なら、LockDelayへ遷移
        if (!this.canDrop()) {
            // 着地した瞬間に、Lockフェーズへ
            s.currentPhase = SUB.LOCKING;
            s.phaseTimer = 0;
            soundManager.play('land', { volume: 0.4 });
        }
    }

    /* -------- LOCKING -------- */
    updateLocking(dt) {
        const s = this.state, cfg = this.cfg;
        s.phaseTimer += dt;

        this.handleHorizontalMove(dt);
        if (this.canDrop()) {             // 持ち上げ
            s.currentPhase = SUB.PLAYING;
            return;
        }

        if (s.phaseTimer >= cfg.LOCK_DELAY || s.forcedDrop) {
            this.fixBlock();
            const lines = this.checkFullLines();        // ラインが揃ってるかどうか
            if (lines.length) {
                // ここで pendingLinesToClear に保持
                s.pendingLinesToClear = lines;
                s.currentPhase = SUB.CLEARING;
                s.phaseTimer = 0;
            } else {
                s.currentPhase = SUB.SPAWNING;
                s.phaseTimer = 0;
            }
        }
    }

    /* -------- CLEARING -------- */
    updateClearing(dt) {
        const s = this.state, cfg = this.cfg;
        if (s.phaseTimer === 0) {
            EventBus.emit('linesCleared', s.pendingLinesToClear.length);
            this.clearLines(s.pendingLinesToClear);

            soundManager.play('clear', { volume: 0.5 });
        }
        s.phaseTimer += dt;
        if (s.phaseTimer >= cfg.FALL_DELAY) {
            /* 段階落下モード開始 */
            s.stepsPerChunk = s.pendingLinesToClear.length;
            s.stepsRemainingInChunk = s.stepsPerChunk;
            s.collapseState = 'fall';
            s.collapseTimer = 0;
            s.currentPhase = SUB.COLLAPSING;
        }
    }

    /* -------- COLLAPSING -------- */
    updateCollapsing(dt) {
        const s = this.state, cfg = this.cfg;
        s.collapseTimer += dt;

        if (s.collapseState === 'fall') {

            /* ① A ms 経過で 1 段コピー */
            while (cfg.LINE_STEP_FALL_TIME === 0 ||
                s.collapseTimer >= cfg.LINE_STEP_FALL_TIME) {

                if (cfg.LINE_STEP_FALL_TIME) s.collapseTimer -= cfg.LINE_STEP_FALL_TIME;
                const moved = this.collapseStep();

                if (!moved) { /* もう浮いている塊は無い → 終了 */
                    s.pendingLinesToClear = null;
                    s.currentPhase = SUB.SPAWNING;
                    s.phaseTimer = 0;
                    return;
                }
                soundManager.play('drop', { volume: 0.3 });
                s.stepsRemainingInChunk--;
                if (!s.stepsRemainingInChunk) {/* 塊を落とし切った */
                    s.collapseState = 'pause';
                    break;
                }
            }
        } else { /* pause */
            if (cfg.LINE_STEP_PAUSE_TIME === 0 ||
                s.collapseTimer >= cfg.LINE_STEP_PAUSE_TIME) {
                if (cfg.LINE_STEP_PAUSE_TIME) s.collapseTimer -= cfg.LINE_STEP_PAUSE_TIME;
                /* 次の塊（さらに上）へ。再度 n ステップ必要 */
                s.stepsRemainingInChunk = s.stepsPerChunk;
                s.collapseState = 'fall';
            }
        }
    }

    /* 1 段落とす helper */
    collapseStep() {
        for (let r = this.cfg.ROWS - 2; r >= 0; r--) {
            if (this.field[r].some(x => x !== 0) && this.field[r + 1].every(x => x === 0)) {
                this.field[r + 1] = this.field[r].slice();
                this.field[r].fill(0);
                return true;
            }
        }
        return false;
    }




    /* -------- SPAWNING -------- */
    updateSpawning(dt) {
        // Buffered rotation input before spawn　これはOKそう
        if (this.cfg.enableBufferedRotation) {
            if (window.input.isPressed(ACTIONS.ROTATE_L)) this._bufferedRotateDir = -1;
            if (window.input.isPressed(ACTIONS.ROTATE_R)) this._bufferedRotateDir = 1;
        }
        const s = this.state, cfg = this.cfg;
        s.phaseTimer += dt;
        this.handleHorizontalMove(dt);
        if (s.phaseTimer >= cfg.SPAWN_DELAY) {
            this.spawnBlock();
        }
    }


    //ブロック重なりー＞delayー＞爆発音ー＞delayー＞GameOver(表示とBGM)とするためにごちゃごちゃflagやらdelayを設けている。
    //あまり美しいコードとは言えない。
    updatePendingGameover(dt) {
        if (this._gameoverDelay == null) return;

        this._gameoverDelay -= dt;
        if (this._gameoverDelay <= 0 && !this._hasPlayedOverSE) {
            this._hasPlayedOverSE = true;       // 一度きり
            this._gameoverDelay = null;         // 二度と入らないようにガード
            soundManager.play('se_over',{volume:0.6});       // 一度だけ SE 再生
            soundManager.fadeOutBgm(0);
            // BGM 切り替え
            setTimeout(() => {
                soundManager.play('bgm_over', { bus: 'bgm' ,volume:2});
                this.state.currentPhase = SUB.GAMEOVER;
                EventBus.emit('phaseChanged', 'gameover');
            }, 1800); /* overまでの長さ[ms] */
        }
    }







    /* ---------------- 旧ヘルパ群 ---------------- */
    handleHorizontalMove(dt) {
        const s = this.state, cfg = this.cfg;
        if (s.leftKeyDown) {
            if (!s.hasMovedLeft) {
                this.moveBlockHorizontal(-1);
                s.hasMovedLeft = true;
                s.lastMoveTimeLeft = 0;
            } else {
                s.lastMoveTimeLeft += dt;
                if (s.lastMoveTimeLeft > cfg.KEY_MOVE_INITIAL_DELAY) {
                    while (s.lastMoveTimeLeft > cfg.KEY_MOVE_REPEAT_INTERVAL + cfg.KEY_MOVE_INITIAL_DELAY) {
                        s.lastMoveTimeLeft -= cfg.KEY_MOVE_REPEAT_INTERVAL;
                        this.moveBlockHorizontal(-1);
                    }
                }
            }
        } else { s.hasMovedLeft = false; s.lastMoveTimeLeft = 0; }

        if (s.rightKeyDown) {
            if (!s.hasMovedRight) {
                this.moveBlockHorizontal(1);
                s.hasMovedRight = true;
                s.lastMoveTimeRight = 0;
            } else {
                s.lastMoveTimeRight += dt;
                if (s.lastMoveTimeRight > cfg.KEY_MOVE_INITIAL_DELAY) {
                    while (s.lastMoveTimeRight > cfg.KEY_MOVE_REPEAT_INTERVAL + cfg.KEY_MOVE_INITIAL_DELAY) {
                        s.lastMoveTimeRight -= cfg.KEY_MOVE_REPEAT_INTERVAL;
                        this.moveBlockHorizontal(1);
                    }
                }
            }
        } else { s.hasMovedRight = false; s.lastMoveTimeRight = 0; }
    }

    moveBlockHorizontal(dir) {
        const b = this.state.currentBlock;
        if (!b) return;
        b.col += dir;
        if (this.isCollision()) b.col -= dir;
        else soundManager.play('move', { volume: 0.3 });
    }

    rotateBlock(dir) {
        const b = this.state.currentBlock;
        if (!b) return;
        const tet = TETROMINOES[b.tetrominoIndex];
        const next = (dir === 1) ? (b.rotationIndex + 3) & 3 : (b.rotationIndex + 1) & 3;
        const old = b.shape;
        b.shape = JSON.parse(JSON.stringify(tet.shapes[next]));
        if (this.isCollision()){ 
            b.shape = old; return false; //回転失敗
        }else{ 
            b.rotationIndex = next; soundManager.play('rotate', { volume: 0.3 });
            return true; //回転成功
        }
    }

    moveBlockDown(step = 1) {
        const b = this.state.currentBlock;
        const cfg = this.cfg;
        for (let i = 0; i < step; i++) {

            b.row++;
            if (this.isCollision()) { 
                b.row--;
                return false; 
            }else{
                //削除対象か？？？ココでPre回転を入れるのは違う気がしてきた    
            }



        }
        return true;
    }



    //Helper
    //仮に1行下げた場合の衝突判定を行う
    canDrop() {
        const b = this.state.currentBlock;
        b.row++; const col = this.isCollision(); b.row--; return !col;
    }

    isCollision() {
        const { shape, row, col } = this.state.currentBlock;
        for (let r = 0; r < 4; r++)
            for (let c = 0; c < 4; c++)
                if (shape[r][c]) {
                    const fr = row + r, fc = col + c;
                    if (//上壁めり込み許容か否か？
                        (OPTIONS.hardTopWall && fr < 0) ||
                        fr >= this.cfg.ROWS || fc < 0 || fc >= this.cfg.COLS ||
                        this.field[fr]?.[fc])
                        return true;
                }
        return false;
    }

    fixBlock() {
        const s = this.state;

        const { shape, row, col, color } = this.state.currentBlock;
        for (let r = 0; r < 4; r++)
            for (let c = 0; c < 4; c++)
                if (shape[r][c]) {
                    const fr = row + r, fc = col + c;
                    if (fr >= 0) this.field[fr][fc] = color;
                }
        soundManager.play('fix', { volume: 0.4 });

        s.blockFixed = true;  //25-0415mae call元関数でこのフラグを参照しているため上位でこの行を定義したほうが良いのかもしれない
        s.currentBlock = null;   //旧ソースで入れていたが不要ー＞やはり必要！（ディレイ消し防止）

    }

    /* 行揃い検出 */
    checkFullLines() {
        const lines = [];
        for (let r = 0; r < this.cfg.ROWS; r++)
            if (this.field[r].every(x => x !== 0)) lines.push(r);
        return lines;
    }
    clearLines(lines) {
        for (const r of lines) this.field[r].fill(0);
    }



    // ★ 次ブロック描画関数
    drawNextBlock() {
        const cvs = document.getElementById('nextCanvas');
        const nx = cvs.getContext('2d');
        nx.clearRect(0, 0, cvs.width, cvs.height);
        const b = this.nextBlock;
        const BS = this.cfg.NEXT_BLOCK_SIZE ?? 40;
        for (let r = 0; r < 4; r++)
            for (let c = 0; c < 4; c++)
                if (b.shape[r][c]) {
                    nx.fillStyle = b.color;
                    nx.fillRect(c * BS, r * BS, BS, BS);
                    nx.strokeStyle = 'black';//ブロックの境界線：色
                    nx.lineWidth=2;        //ブロックの境界線：幅
                    nx.strokeRect(c * BS, r * BS, BS, BS);
                }
    }




    /* 壁+ブロック描画ヘルパ */
    drawBlock(ctx, c, r, color) {
        const x = (c + 1) * this.BS, y = (r + this.cfg.TOP_MARGIN) * this.BS;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, this.BS, this.BS);
        ctx.strokeStyle = 'black';//ブロックの境界線：色
        ctx.lineWidth=2;        //ブロックの境界線：幅
        ctx.strokeRect(x, y, this.BS, this.BS);//枠線
    }

    //グレー一色の暫定版
    drawWalls_old(ctx) {
        const BS = this.BS, cols = this.cfg.COLS, rows = this.cfg.ROWS, top = this.cfg.TOP_MARGIN;
        ctx.fillStyle = 'gray';
        for (let r = -top; r < rows; r++) {          // 左右
            ctx.fillRect(0, (r + top) * BS, BS, BS);
            ctx.fillRect((cols + 1) * BS, (r + top) * BS, BS, BS);
        }
        for (let c = 0; c < cols + 2; c++) {          // 上下
            ctx.fillRect(c * BS, (rows + top) * BS, BS, BS);
            ctx.fillRect(c * BS, 0, BS, BS);
        }
    }


    /* ---------------- 壁（テクスチャ付き）描画 ---------------- */
    drawWalls(ctx) {
        const BS = this.BS;                 // ブロックサイズ
        const COLS = this.cfg.COLS;
        const ROWS = this.cfg.ROWS;
        const TOP = this.cfg.TOP_MARGIN;

        // 小ヘルパー：画像ロード済みを確認
        const ok = img => img && img.complete && img.naturalWidth > 0;

        /* ── 左右壁 ── */
        for (let r = -TOP; r < ROWS; r++) {
            const y = (r + TOP) * BS;
            if (ok(leftWallImg))
                ctx.drawImage(leftWallImg, 0, y, BS, BS);
            else {
                ctx.fillStyle = 'gray';
                ctx.fillRect(0, y, BS, BS);
            }

            if (ok(rightWallImg))
                ctx.drawImage(rightWallImg, (COLS + 1) * BS, y, BS, BS);
            else {
                ctx.fillStyle = 'gray';
                ctx.fillRect((COLS + 1) * BS, y, BS, BS);
            }
        }

        /* ── 上壁 ── */
        for (let c = 0; c < COLS + 2; c++) {
            const x = c * BS;
            if (ok(topWallImg))
                ctx.drawImage(topWallImg, x, 0, BS, BS);
            else {
                ctx.fillStyle = 'gray';
                ctx.fillRect(x, 0, BS, BS);
            }
        }

        /* ── 下壁 ── */
        const yBottom = (ROWS + TOP) * BS;
        for (let c = 0; c < COLS + 2; c++) {
            const x = c * BS;
            if (ok(downWallImg))
                ctx.drawImage(downWallImg, x, yBottom, BS, BS);
            else {
                ctx.fillStyle = 'gray';
                ctx.fillRect(x, yBottom, BS, BS);
            }
        }


    }



}
