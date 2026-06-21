/**
 * NoteSpawner.js
 * ノーツの出現・移動・破棄を管理する。
 * engine の CloneManager を使ってノーツcloneを生成。
 * ノーツの y 位置はネイティブ（JS）側で songTimeMs から逆算して更新する。
 * DSL の forever ループには依存しない。
 */

export class NoteSpawner {
  /**
   * @param {import('../engine/Runtime.js').Runtime} runtime
   * @param {object} chart - 正規化済み譜面
   * @param {{
   *   judgeY?: number,
   *   spawnY?: number,
   *   laneX?: number[],
   *   leadTimeMs?: number,
   * }} config
   */
  constructor(runtime, chart, config = {}) {
    this._runtime = runtime;
    this._chart = chart;

    // 座標設定（内部座標 480x360 Scratch系）
    this._judgeY   = config.judgeY   ?? -120;
    this._spawnY   = config.spawnY   ??  180;
    this._laneX    = config.laneX    ?? [-90, -30, 30, 90];
    // leadTimeMs: ノーツが spawnY から judgeY に到達するまでの時間
    this._leadTimeMs = config.leadTimeMs ?? 1500; // 1.5秒

    // 譜面ノーツ（ポインタで管理）
    this._notes = chart.notes ? [...chart.notes] : [];
    this._nextNoteIndex = 0;

    // 活ノーツリスト（判定用）
    // 各エントリ: { id, lane, timeMs, clone: SpriteRuntime, consumed: bool }
    this._activeNotes = [];

    // "Note" スプライト（clone元）
    this._noteSprite = null;
  }

  /**
   * Note スプライトを runtime から取得（init 後に呼ぶ）。
   */
  init() {
    this._noteSprite = this._runtime.getTargetByName('Note');
    if (!this._noteSprite) {
      console.warn('[NoteSpawner] "Note" sprite not found in runtime');
    }
  }

  /**
   * laneIndex から x 座標を返す。
   * @param {number} lane
   * @returns {number}
   */
  laneXFor(lane) {
    return this._laneX[lane] ?? this._laneX[0] ?? 0;
  }

  /**
   * songTimeMs に基づきノーツの出現・y更新を行う。
   * RhythmGame のメインループから毎フレーム呼ぶ。
   * @param {number} songTimeMs
   */
  update(songTimeMs) {
    // 出現すべきノーツをclone生成
    // spawnY到達時刻 = note.timeMs - leadTimeMs
    while (this._nextNoteIndex < this._notes.length) {
      const note = this._notes[this._nextNoteIndex];
      const spawnTime = note.timeMs - this._leadTimeMs;
      if (songTimeMs < spawnTime) break; // まだ出現しない

      this._spawnNote(note);
      this._nextNoteIndex++;
    }

    // 活ノーツのy座標を更新
    for (const entry of this._activeNotes) {
      if (entry.consumed) continue;
      const clone = entry.clone;
      if (!clone) continue;

      // y = judgeY + (note.timeMs - songTimeMs) / leadTimeMs * (spawnY - judgeY)
      // songTimeMs === note.timeMs のとき y = judgeY（判定ライン）
      // songTimeMs === note.timeMs - leadTimeMs のとき y = spawnY
      const timeDelta = entry.timeMs - songTimeMs; // ms
      const frac = timeDelta / this._leadTimeMs;
      const y = this._judgeY + frac * (this._spawnY - this._judgeY);

      clone.setY(y);

      // 判定窓を大幅に過ぎたノーツ（ミス扱い）を自動破棄
      // goodMs + マージン = 200ms 超過後に消す
      if (timeDelta < -300) {
        this.consume(entry);
      }
    }

    // consumed 済みは除去
    this._activeNotes = this._activeNotes.filter(e => !e.consumed);
  }

  /**
   * 1ノーツをclone生成して activeNotes に追加。
   * @param {object} note
   */
  _spawnNote(note) {
    if (!this._noteSprite) return;

    const clone = this._runtime.clones.createClone(this._noteSprite);
    if (!clone) return; // clone上限

    // DSL側の clone_start スクリプトが走る前に位置を強制設定
    // clone_start が forever ループで動かすのを避けるため、
    // clone の _def.scripts から clone_start スクリプトを除去した
    // 専用の def を使う（または clone_start スクリプトの停止）。
    // ここでは clone 生成直後に位置・表示を上書きする。
    clone.setX(this.laneXFor(note.lane));
    clone.setY(this._spawnY);
    clone.show();

    // clone_start で起動したスレッドを停止（DSLのforeverに依存しない）
    const cloneThreads = this._runtime.threads.threadsForTarget(clone);
    for (const t of cloneThreads) {
      this._runtime.threads.stopThread(t);
    }

    this._activeNotes.push({
      id: note.id,
      lane: note.lane,
      timeMs: note.timeMs,
      clone,
      consumed: false,
    });
  }

  /**
   * 判定済みノーツを活ノーツリストから除去し、cloneを削除する。
   * @param {{ id, lane, timeMs, clone, consumed }} entry
   */
  consume(entry) {
    if (entry.consumed) return;
    entry.consumed = true;
    if (entry.clone) {
      this._runtime.clones.deleteClone(entry.clone);
      entry.clone = null;
    }
  }

  /**
   * 判定用アクティブノーツ配列。
   * @returns {Array<{ id, lane, timeMs, clone, consumed }>}
   */
  get activeNotes() {
    return this._activeNotes.filter(e => !e.consumed);
  }

  /**
   * スポーナーをリセット（再スタート用）。
   */
  reset() {
    // 既存cloneを全て破棄
    for (const entry of this._activeNotes) {
      this.consume(entry);
    }
    this._activeNotes = [];
    this._nextNoteIndex = 0;
  }
}
