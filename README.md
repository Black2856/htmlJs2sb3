# htmlJs2sb3

Scratch-compatible DSLを正本として、検証、HTML/JavaScript Runtimeでの実行確認、`.sb3`出力を行う段階的な互換基盤です。Scratch完全互換や公式GUIの再現は目的としていません。

```text
DSL (project.ts)
  ├─ validate → Project / Runtime → Node・ブラウザ(preview)・Playwrightで実行確認
  └─ validate → project.json + assets → .sb3 → scratch-parserで形式検証
```

`scratch-parser`通過はSB3形式の妥当性確認です。Scratch公式エディタやTurboWarpでの完全な動作保証ではありません。

## 現在の状態

Phase 0〜6が完了し、検証、ドメインモデル、Runtime、Canvas/input、asset/audio、clone/procedure/pen/monitor、DSL→SB3出力までを実装済みです。Phase 7としてAI生成用fixture、検証フロー、実エディタ手動確認準備を整備しています。Phase 7.1では、ローカル作品を`workspace/<name>/`に置き、同じDSLをmanual previewとSB3 exportへ渡すフローを追加しています。

Phase 8（既存SB3 import）以降は未実装です。

## リポジトリ構成

```text
src/            検証・モデル・Runtime・render・audio・input・sb3など本体
  validation/   validateProject（検証の入口）
  model/        Project/Stage/Sprite/Cloneなどドメインモデル
  runtime/      Runtime・Thread・Sequencer・各Manager
  render/       CanvasRenderer・RendererPort・costume skin loader
  input/        DomInputManager・InputPort
  audio/        SoundManager・WebAudioPort・AudioPort
  sb3/          sb3Packager（.sb3生成）
preview/        ブラウザ手動preview（manual-preview.html / .ts）
tools/          previewProject.ts（previewサーバ）・exportSb3.ts・workspaceProject.ts
schemas/        project.schema.json
tests/          ユニットテスト・fixtures・e2e(Playwright)
docs/           設計ドキュメント（main_design/が中心）
workspace/      ローカル作品（直下に1作品1ディレクトリ、各作品が自分のassets/を持つ）（Git追跡対象外）
scratch-*/      上流Scratch公式リポジトリの固定checkout（read-only / 調査用）
```

## セットアップとテスト

Node.js 22以上を使用します（確認環境: v22.17.0）。

```powershell
npm install
npm test          # ユニットテスト（validation/model/runtime/render/input/assets/audio/sb3/compatibility）
npm run test:e2e  # Playwrightによるブラウザe2e（Canvas/DOM input/pen）
```

PowerShellの実行ポリシーで`npm.ps1`が拒否される場合は`npm.cmd`、`npx.ps1`の場合は`npx.cmd`を使います。

## Workspace project

各作品は`workspace/`直下に1作品1ディレクトリで並べます。素材は各作品の`assets/`に同梱し、共有プールは持ちません。`workspace/`はローカル作業用でGit追跡対象外です。

```text
workspace/
  <project-name>/        作品（workspace/直下に並ぶ）
    project.ts           DSL正本（default export、または named export "project"）
    assets.json          asset manifest（assets配列）
    assets/              この作品のcostume/sound素材
      sprite/ sound_effect/ music/
    output/              npm run sb3 の出力先（自動生成）
```

- `<project-name>`は英数字で始まり、英数字・ハイフン・アンダースコアのみ使用できます。
- `project.ts`のdefault exportをDSL正本として、previewとSB3 exportの両方で同じものを使います。
- `assets.json`と`project.ts`の`source`はリポジトリルート基準のパスです（例: `workspace/<name>/assets/sprite/foo.png`）。`meta.source`・DSLの`assets[].source`と同じ基準で揃えます。`assetId`は実bytesのMD5、`md5ext`は`assetId.dataFormat`として一致させます。

読み込み時（`tools/workspaceProject.ts`）に次を検証し、errorが1件でもあればpreview/SB3とも処理を中止します。

- DSL validation（`validateProject`）
- manifestの形状（必須フィールド）と`assetId`重複
- `md5ext`が`assetId.dataFormat`と一致するか
- 素材bytesの実MD5が`assetId`と一致するか
- DSLとmanifestの参照整合（dangling参照・kind/dataFormat/md5ext不一致）
- manifestにあるがDSLが参照しない素材はwarning（処理は継続）

同梱例として`workspace/full-feature-minimal/`があります。

### 新規作品をコマンドで作成

雛形（型）はコマンドで生成します。`workspace/<name>/`に最小の有効なDSL（`project.ts`）、空の`assets.json`、空の`assets/`、`output/`を作成します。

```powershell
npm run new -- my-project
```

- 生成される`project.ts`は検証を通過し、preview/sb3がそのまま実行できる最小骨組み（緑の旗→10歩動く）です。素材は持ちません。
- 既存ディレクトリがある名前は上書きせず中止します。
- 名前は英数字始まりで英数字・ハイフン・アンダースコアのみ使用できます。

生成後は`project.ts`を編集し、素材が必要なら`assets/`へファイルを置いて`assets.json`へ追記してから`npm run preview`/`npm run sb3`で確認します。

## プロジェクトの起動（手動preview）

DSLをブラウザのRuntime/Rendererで実行確認します。esbuildで`preview/manual-preview.ts`をバンドルし、ローカルHTTPサーバ（既定`http://localhost:4173`）を立ち上げ、既定でブラウザを自動で開きます。

```powershell
npm run preview -- full-feature-minimal
```

オプション:

| オプション | 説明 |
| --- | --- |
| `--port <n>` | 待受ポート（既定`4173`、1〜65535） |
| `--no-open` | ブラウザを自動で開かない（環境変数`PREVIEW_NO_OPEN=1`でも可） |

```powershell
npm run preview -- full-feature-minimal --port 5000 --no-open
```

画面には480×360 Canvas、緑の旗、Stop、thread/clone/asset/audio状態、frame数、現在実行中ブロック、diagnosticsが表示されます。`Ctrl+C`でサーバを停止します。

### 実行の挙動

- **緑の旗**: AudioContextを開始（ブラウザの自動再生制限のためクリック内で開始）し、`runtime.greenFlag()`を呼んで全`event_whenflagclicked`スレッドを起動します。Projectインスタンスは初回読み込み時に一度だけ生成し、緑の旗の再押下では**再生成せず再利用**します。そのためスプライトの座標は前回実行で移動した位置を保持したまま起動し、Scratch本来の「現在位置から相対的に動く」挙動になります（毎回初期座標へリセットされません）。
- **Stop**: 全スレッド停止、音声停止、最終フレーム描画を行います。pen layerは緑の旗でもStopでも消去しません（Scratch準拠）。
- **motion / pen**: `motion_movesteps`でライブ座標を更新し、pen down中の移動は移動前後の座標を結ぶ線としてpen layerへ描画します。
- **costume / clone**: costumeなしStageは透明背景として扱い、cloneは元Spriteのcostume skinを引き継ぎます。

> 座標を初期値に戻して実行し直したい場合は、ブラウザを再読み込みする（=`load()`が再実行されProjectが作り直される）か、previewサーバを再起動します。

## .sb3 出力

検証済みDSLからSB3（`project.json` + assets のZIP）を生成し、`scratch-parser`で形式検証してからファイル出力します。

```powershell
npm run sb3 -- full-feature-minimal
```

- 出力先: `workspace/<project-name>/output/<project-name>.sb3`
- 成功時は出力パス、バイト数、`scratch-parser: pass`を表示します。
- DSL validation、asset MD5検査、packaging、`scratch-parser`検証のいずれかが失敗した場合は出力せず、診断を表示して終了コード1で終わります。

SB3はRuntimeの可変状態からではなく、検証済みDSLからのみ生成します（Runtime-only cloneは出力されません）。生成された`project.json`やZIPは編集せず、変更はDSLを編集して再生成します。

## 新しい作品を追加する

1. `npm run new -- <name>`で`workspace/<name>/`を雛形生成する（手動で作る場合は同じ構成を用意する）。
2. `project.ts`のDSLを編集する（登録・実装済みopcodeのみ使用）。
3. 使用する素材を作品の`assets/`へ置き、`assets.json`に`assetId`(=実bytesのMD5)・`md5ext`・`dataFormat`・`kind`・`mimeType`・`source`(=リポジトリルート基準パス、例 `workspace/<name>/assets/sprite/foo.png`)を記述する。
4. `npm run preview -- <name>`で実行確認する。
5. `npm run sb3 -- <name>`でSB3を出力し、`scratch-parser`通過を確認する。

詳細フローは`docs/main_design/WORKSPACE_PROJECT_FLOW.md`を参照してください。

## Phase 7 sample fixtures

`tests/fixtures/phase7SampleProjects.ts`に次のfixtureがあります。

- hello-world
- motion-basic
- variable-score
- broadcast-basic
- list-basic
- keyboard-control
- procedure-basic
- clone-basic
- pen-basic
- sound-basic
- full-feature-minimal

各fixtureはvalidator、Runtime境界、SB3 packaging、scratch-parserで確認します。Canvas、DOM input、penはPlaywrightでも確認します。

## Test assets

素材は各作品の`assets/`に同梱します。asset-backedなPhase 7 fixture（`tests/fixtures/phase7SampleAssets.ts`）は、同梱例`full-feature-minimal`の`assets/`配下の素材を共有して読み込みます。外部素材を無断で追加しません。

現在使用する素材:

- `workspace/full-feature-minimal/assets/sprite/font/determination/glyphs/c0041.png`
- `workspace/full-feature-minimal/assets/sound_effect/カーソル移動6.mp3`

assetIdは実bytesのMD5、`md5ext`は`assetId.dataFormat`として一致させます。

## Authoring rules

- DSLを編集し、生成済み`project.json`やSB3 ZIPを直接編集しない。
- Runtime状態からSB3を生成しない。
- IDを保存ごとに再採番しない（プロジェクト全体で一意かつ安定）。
- 新規作品では登録・実装済みopcodeだけを使う。
- asset追加時はbytes、MD5、assetId、md5extを同時に確認する。

DSL変更時は`schemas/project.schema.json`と手書きvalidatorの両方を更新し、fixtureとテストを追加します。

詳細:

- `docs/main_design/AI_GENERATION_WORKFLOW_SPEC.md`
- `docs/main_design/DSL_AUTHORING_GUIDE_FOR_AI.md`
- `docs/main_design/WORKSPACE_PROJECT_FLOW.md`
- `docs/main_design/SB3_REAL_EDITOR_VERIFICATION_SPEC.md`
- `docs/templates/`

## Scope

Phase 7では新Runtime/Renderer機能、SB3 import、editor shell、外部Scratch/TurboWarpサイト操作の自動化を行いません。Phase 8/9の対象は`docs/NEXT_PHASE_ROADMAP(7~9).md`を参照してください。
