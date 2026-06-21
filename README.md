# htmlJs2sb3 — Scratch互換ランタイムシステム

Scratch 互換の最小サブセットを HTML/JS で実装し、**中間DSL（JSON）を唯一の正本**として
① ブラウザ上の Web 実行系（engine）と ② Scratch 3.0 `.sb3` 生成系（tools）の両方を
同じソースから導出する「型（システム）」。内部座標は Scratch 標準の 480×360 固定、
表示拡大は CSS のみ。

> このブランチ（`scratch-system`）は音ゲー部分（判定・譜面・ノーツ生成）を取り除き、
> Scratch互換ランタイムと DSL→sb3 変換だけを残した構成です。
> 音ゲー一式は `main` ブランチにあります。

- 実装の正本（DSL / モジュールAPI / opcode対応表）: [`CONTRACT.md`](./CONTRACT.md)
- 設計レポート: [`claudedocs/REPORT.md`](./claudedocs/REPORT.md)

## ディレクトリ

| ディレクトリ | 内容 |
|---|---|
| `spec/` | DSL 正本（`scratch-rhythm.dsl.json`）|
| `engine/` | Scratch風ランタイム（変数/リスト/イベント/スレッド/クローン/描画/音）。中核は Node でもヘッドレス動作 |
| `tools/` | DSL→sb3 変換（`generate-sb3` / `pack-sb3`）・DSL検証（`generate-web`）・静的配信（`serve`）|
| `web/` | ブラウザ用デモ（DSL を engine で実行）|
| `tests/` | `node --test` 用テスト |

## 実装している Scratch ブロック（カテゴリ）

動き / 見た目 / 音 / イベント / 制御 / 調べる / 演算 / 変数 / リスト / ブロック定義。
詳細な opcode 対応は `CONTRACT.md` §2/§3/§6。

## 使い方

```bash
# テスト
node --test

# DSL → sb3 project.json
node tools/generate-sb3.js spec/scratch-rhythm.dsl.json dist/project.json

# DSL + assets → .sb3（zip）。実アセット未配置時はプレースホルダを合成
node tools/pack-sb3.js spec/scratch-rhythm.dsl.json dist/scratch-rhythm.sb3

# Web デモを配信 → http://localhost:8123/web/index.html
node tools/serve.js 8123
```

Web デモは「緑の旗」で DSL を実行。サンプル DSL では Note スプライトがクローンされ落下し、
broadcast / clone / motion / variables の実行を可視化する。実アセットが無くても動作する
（Renderer はプレースホルダ描画、SoundBridge は無音フォールバック）。
