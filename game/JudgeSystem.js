/**
 * JudgeSystem.js
 * 判定閾値と判定ロジック。DOM非依存（Node でもテスト可能）。
 */

export class JudgeSystem {
  /**
   * @param {{ perfectMs?: number, greatMs?: number, goodMs?: number }} opts
   */
  constructor({ perfectMs = 40, greatMs = 80, goodMs = 120 } = {}) {
    this._perfectMs = perfectMs;
    this._greatMs = greatMs;
    this._goodMs = goodMs;

    // オフセット（ms）
    this._chartOffsetMs = 0;
    this._userOffsetMs = 0;
    this._deviceCalibMs = 0;
  }

  /**
   * オフセットを設定する。
   * @param {{ chartOffsetMs?: number, userOffsetMs?: number, deviceCalibMs?: number }} opts
   */
  setOffsets({ chartOffsetMs = 0, userOffsetMs = 0, deviceCalibMs = 0 } = {}) {
    this._chartOffsetMs = chartOffsetMs;
    this._userOffsetMs = userOffsetMs;
    this._deviceCalibMs = deviceCalibMs;
  }

  /**
   * 有効オフセット合計（ms）。
   * @returns {number}
   */
  effectiveOffsetMs() {
    return this._chartOffsetMs + this._userOffsetMs + this._deviceCalibMs;
  }

  /**
   * ノーツの時刻と入力時刻から判定結果を返す。
   * hitErrorMs = hitAudioMs - noteTimeMs（正=遅い、負=早い）
   * @param {number} noteTimeMs - ノーツ時刻（ms）
   * @param {number} hitAudioMs - 入力時刻（AudioContext基準 ms）
   * @returns {{ result: 'perfect'|'great'|'good'|'miss', hitErrorMs: number }}
   */
  judge(noteTimeMs, hitAudioMs) {
    const hitErrorMs = hitAudioMs - noteTimeMs;
    const result = this.classify(hitErrorMs);
    return { result, hitErrorMs };
  }

  /**
   * hitErrorMs（ms）から判定名を返す。
   * @param {number} hitErrorMs
   * @returns {'perfect'|'great'|'good'|'miss'}
   */
  classify(hitErrorMs) {
    const abs = Math.abs(hitErrorMs);
    if (abs <= this._perfectMs) return 'perfect';
    if (abs <= this._greatMs)  return 'great';
    if (abs <= this._goodMs)   return 'good';
    return 'miss';
  }

  get perfectMs() { return this._perfectMs; }
  get greatMs()   { return this._greatMs; }
  get goodMs()    { return this._goodMs; }
}
