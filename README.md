# htmlJs2sb3 — Scratch互換 音ゲー基盤

Scratch 互換の最小サブセットを HTML/JS で実装し、**中間DSL（JSON）を唯一の正本**として
Web 実行系と Scratch 3.0 `.sb3` 生成系の両方を同じソースから導出する音ゲー基盤。
内部座標は Scratch 標準の 480×360 固定、表示拡大は CSS のみ。譜面・判定の真の時刻は
`AudioContext.currentTime`、描画・入力は `performance.now()` を用いる。

- 設計・実装レポート: [`claudedocs/REPORT.md`](./claudedocs/REPORT.md)
- 実装の正本（DSL/モジュールAPI/opcode対応）: [`CONTRACT.md`](./CONTRACT.md)

## ディレクトリ

| ディレクトリ | 内容 |
|---|---|
| `spec/` | DSL 正本・譜面スキーマ(draft-07)・サンプル |
| `engine/` | Scratch風ランタイム（変数/リスト/イベント/スレッド/クローン/描画/音）。中核は Node でもヘッドレス動作 |
| `game/` | 4レーン縦スクロール音ゲー（ChartLoader/JudgeSystem/NoteSpawner/RhythmGame/DebugOverlay）|
| `tools/` | DSL→sb3 変換・譜面検証・静的配信 |
| `web/` | ブラウザ用エントリ（index.html / style.css / main.js）|
| `tests/` | `node --test` 用テスト（157件）|

## 使い方

```bash
# テスト（157/157 pass）
node --test

# 譜面検証
node tools/validate-chart.js spec/sample-chart.json

# DSL → sb3 project.json
node tools/generate-sb3.js spec/scratch-rhythm.dsl.json dist/project.json

# DSL + assets → .sb3（zip）。実アセット未配置時はプレースホルダを合成
node tools/pack-sb3.js spec/scratch-rhythm.dsl.json dist/scratch-rhythm.sb3

# Web デモを配信 → http://localhost:8123/web/index.html
node tools/serve.js 8123
```

Web デモは `Start` で開始、`Auto` で自動演奏（全ノーツ Perfect）、`Debug` で計測オーバーレイ。
プレイ操作は `D / F / J / K`（レーン 1〜4）。実アセットが無くても全機能が動作する。

## 状態

実装完了。`node --test` 157件全パス、Chrome での実プレイ検証済み（Auto 12/12 Perfect・手動入力判定 OK）、
`.sb3` 生成・パッケージング検証済み（dangling参照ゼロ・proccode整合）。詳細はレポート参照。
