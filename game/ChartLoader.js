/**
 * ChartLoader.js
 * 譜面JSONを読み込み、検証し、正規化するユーティリティ。
 * DOM非依存（Node.js でもテスト可能）。
 */

// ── 軽量バリデーション（DOM非依存版） ─────────────────────────────
// tools/validate-chart.js はfsモジュールを使うためブラウザ非対応。
// ここでは必要最低限のバリデーションをインライン実装し、
// Node環境ではtools/validate-chart.js も使える形にする。

function validateInline(chart) {
  const errors = [];

  if (!chart || typeof chart !== 'object') {
    return { ok: false, errors: ['chart must be an object'] };
  }

  for (const key of ['version', 'meta', 'audio', 'timing', 'notes']) {
    if (!(key in chart)) errors.push(`missing required property "${key}"`);
  }
  if (errors.length > 0) return { ok: false, errors };

  if (chart.version !== '1.0') {
    errors.push(`version must be "1.0", got "${chart.version}"`);
  }

  const meta = chart.meta;
  if (!meta || typeof meta !== 'object') {
    errors.push('meta must be an object');
  } else {
    for (const k of ['title', 'bpm', 'offsetMs', 'lanes']) {
      if (!(k in meta)) errors.push(`meta: missing "${k}"`);
    }
    if (typeof meta.bpm === 'number' && meta.bpm <= 0) {
      errors.push('meta.bpm must be > 0');
    }
    if (typeof meta.lanes === 'number' && (meta.lanes < 1 || meta.lanes > 8)) {
      errors.push('meta.lanes must be 1..8');
    }
  }

  const audio = chart.audio;
  if (!audio || typeof audio !== 'object') {
    errors.push('audio must be an object');
  } else if (!audio.file || typeof audio.file !== 'string') {
    errors.push('audio.file is required');
  }

  if (!Array.isArray(chart.notes)) {
    errors.push('notes must be an array');
  } else {
    for (let i = 0; i < chart.notes.length; i++) {
      const n = chart.notes[i];
      if (!n || typeof n !== 'object') {
        errors.push(`notes[${i}]: must be object`);
        continue;
      }
      for (const k of ['id', 'timeMs', 'lane', 'type']) {
        if (!(k in n)) errors.push(`notes[${i}]: missing "${k}"`);
      }
      if (typeof n.timeMs === 'number' && n.timeMs < 0) {
        errors.push(`notes[${i}]: timeMs must be >= 0`);
      }
      const validTypes = ['tap', 'hold', 'flick', 'slide'];
      if (n.type && !validTypes.includes(n.type)) {
        errors.push(`notes[${i}]: type "${n.type}" not in enum`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export class ChartLoader {
  /**
   * 譜面JSONを検証して { ok, errors } を返す。
   * DOM非依存。
   * @param {object} chart
   * @returns {{ ok: boolean, errors: string[] }}
   */
  static validate(chart) {
    return validateInline(chart);
  }

  /**
   * 譜面を正規化する。
   * - notes を timeMs 昇順安定ソート
   * - 各ノーツに既定値を補完（type デフォルト "tap"）
   * DOM非依存。
   * @param {object} chart
   * @returns {object} 正規化済み chart（元オブジェクトは変更しない）
   */
  static normalize(chart) {
    const timing = chart.timing ?? {};
    const normalized = {
      ...chart,
      timing: {
        perfectMs: timing.perfectMs ?? 40,
        greatMs: timing.greatMs ?? 80,
        goodMs: timing.goodMs ?? 120,
        ...timing,
      },
      notes: chart.notes
        ? chart.notes
            .map((n, i) => ({
              type: 'tap',
              sfx: null,
              ...n,
              _origIndex: i, // 安定ソート用
            }))
            .sort((a, b) => {
              const dt = a.timeMs - b.timeMs;
              if (dt !== 0) return dt;
              return a._origIndex - b._origIndex; // 安定
            })
            .map(({ _origIndex, ...note }) => note) // _origIndex を除去
        : [],
    };
    return normalized;
  }

  /**
   * URLから譜面JSONをfetchして validate + normalize して返す。
   * @param {string} url
   * @returns {Promise<object>}
   */
  static async load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ChartLoader: fetch failed ${res.status} ${url}`);
    const chart = await res.json();

    const validation = ChartLoader.validate(chart);
    if (!validation.ok) {
      console.warn('[ChartLoader] Validation errors:', validation.errors);
    }

    return ChartLoader.normalize(chart);
  }
}
