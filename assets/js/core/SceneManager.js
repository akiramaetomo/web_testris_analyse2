// core/SceneManager.js
export class SceneManager {
    /**
     * @param {Scene} initialScene  最初に表示するシーン
     */
    constructor(initialScene) {
      this._stack = [];
      this.changeTo(initialScene);
    }
  
    /** 現在のシーンを置き換える */
    changeTo(scene, params = {}) {
      if (this._stack.length) {
        this._stack.pop().exit();
      }
      this._pushScene(scene, params);
    }
  
    /** 上に一時的なシーンを重ねる（Pause など Step3 用） */
    push(scene, params = {}) {
      this._pushScene(scene, params);
    }
  
    /** push で重ねたシーンを終了させる */
    pop() {
      if (this._stack.length > 1) {
        this._stack.pop().exit();
      }
    }
  
    /** --- 内部ヘルパ --- */
    _pushScene(scene, params) {
      scene.setManager(this);
      scene.enter(params);
      this._stack.push(scene);
    }
  
    /** 毎フレーム呼び出す共通 API */
    update(dt) { this._stack.at(-1).update(dt); }
    draw(ctx)  { this._stack.at(-1).draw(ctx); }

    /**
     * Returns the current active scene.
     */
    getCurrentScene() { return this._stack.at(-1); }
  }
