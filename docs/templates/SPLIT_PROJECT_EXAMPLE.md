# 分割方針の worked example（`project.ts` を `src/` に分割する）

`VIBE_CODING_REFERENCE.md` §2 の「大きい作品は `project.ts` を main だけにし、スプライト/
機能ごとに `workspace/<name>/src/` へ分割する」方針の、**実作品で検証済みの実例**。

題材は `workspace/manual-verification`（Phase 7.2 の観察確認作品、~480 行の単一
`project.ts`）。これを下記の構成に分割し、分割前後で生成 `project.json` が
**MD5 完全一致**（＝ブロック ID 採番まで含めて挙動不変）になることを確認している。

> `workspace/` は Git 追跡対象外なので、この文書が追跡可能な「分割の正解形」の参照元。
> 実コードは `workspace/manual-verification/` にある（ローカル）。

## 分割後の構成

```text
workspace/manual-verification/
  project.ts        # main: import して DslProject を組み立て default export（~80 行）
  src/
    vars.ts         # 変数 / broadcast の id（VARS, varId, BROADCASTS, bcId）
    builder.ts      # metadata 駆動の汎用ブロックグラフビルダー + 型（In/Cmd/Hat/Script…）
    helpers.ts      # setv / changev / readv / wait / join / recvHat … オーサリング補助
    assets.ts       # costume / sfx ヘルパ + BACKDROPS / ABBY_* / MONITORS / ASSETS
    stage.ts        # buildStage() — 初期化 + キールーティング + 各種 hat
    abby.ts         # buildAbby() — カテゴリ別実演 + click + clone
    mark.ts         # buildMark() — 静的ターゲット（スクリプト無し）
  assets.json
  assets/
  output/
```

責務の分け方の指針:

| モジュール   | 置くもの                                                          |
| ------------ | ----------------------------------------------------------------- |
| `vars.ts`    | 変数 / broadcast / その他「複数箇所で同じ id を共有する」定数      |
| `builder.ts` | ブロックグラフ生成の汎用ヘルパーと公開型（作品固有の中身は持たない） |
| `helpers.ts` | `builder` の型を使った薄いオーサリング糖衣（`setv` など）          |
| `assets.ts`  | costume / sound / monitor / asset manifest（純データ）             |
| `<sprite>.ts`| そのスプライトのスクリプト。`build<Sprite>(): Builder` を export   |

## 設計上のポイント

- **スプライトモジュールはトップレベルで副作用を起こさない。** ビルダーを即実行せず
  `buildStage()` / `buildAbby()` の**関数**として export する。これで main が組み立て順を
  制御でき、各モジュールは「スクリプトを足して builder を返す」純粋な形に保てる。
- **型は `builder.ts` から export して共有する。** `helpers.ts` と各スプライトは
  `import type {Cmd, Hat, In, Rep} from './builder.ts'` で受け取る。`getOpcodeMetadata`
  への依存は `builder.ts` に閉じ込める。
- **ビルダーの prefix と `addScript` の呼び出し順を変えない。** SB3 のブロック ID は
  `${prefix}-${counter++}` で採番されるため、分割でスクリプトの順序や prefix が変わると
  ID が変わる（挙動は同じでも diff が出る）。

## import 深度（ここを間違えやすい）

| ファイル                         | リポジトリ `src/` への相対パス        |
| -------------------------------- | ------------------------------------- |
| `project.ts`                     | `../../src/...`                       |
| `src/builder.ts` ほか `src/*.ts` | `../../../src/...`                    |

同一作品内のモジュール同士は `./vars.ts` のように相対 import する。node の type stripping
が `.ts` のネスト import を解決する（**検証済み**）。

## main（`project.ts`）の形

```ts
import type {DslProject} from '../../src/validation/projectValidator.ts';
import {BROADCASTS, VARS, bcId, varId} from './src/vars.ts';
import {ABBY_COSTUMES, ABBY_SOUNDS, ASSETS, BACKDROPS, MONITORS, costume} from './src/assets.ts';
import {buildStage} from './src/stage.ts';
import {buildAbby} from './src/abby.ts';
import {buildMark} from './src/mark.ts';

const stage = buildStage();
const abby = buildAbby();
const mark = buildMark();

const project: DslProject = {
    schemaVersion: '1.0.0',
    project: {id: 'manual-verification', name: 'manual-verification'},
    stage: {
        id: 'stage', isStage: true, name: 'Stage',
        variables: VARS.map(v => ({id: varId(v), name: v, value: '', isCloud: false})),
        lists: [], broadcasts: BROADCASTS.map(b => ({id: bcId(b), name: b})),
        blocks: stage.blocks, scripts: stage.scripts, comments: [],
        currentCostume: 0, costumes: BACKDROPS, sounds: [], volume: 100,
        layerOrder: 0, tempo: 60, videoTransparency: 50, videoState: 'on', textToSpeechLanguage: null
    },
    sprites: [
        {
            id: 'abby', isStage: false, name: 'Abby', variables: [], lists: [], broadcasts: [],
            blocks: abby.blocks, scripts: abby.scripts, comments: [],
            currentCostume: 0, costumes: ABBY_COSTUMES, sounds: ABBY_SOUNDS,
            volume: 100, layerOrder: 1, visible: true, x: 0, y: 0, size: 100, direction: 90, draggable: false, rotationStyle: 'all around'
        }
        // … 他スプライトも同様
    ],
    assets: ASSETS, monitors: MONITORS, extensions: ['pen'],
    meta: {source: 'workspace/manual-verification/project.ts'}
};

export default project;
```

## スプライトモジュールの形（`build<Sprite>(): Builder`）

```ts
// src/stage.ts
import {makeBuilder, type Builder} from './builder.ts';
import {bcast, keyHat, setv} from './helpers.ts';

const KEYMAP: Array<[string, string]> = [
    ['1', 'go-motion'], ['2', 'go-looks'] /* … */
];

export const buildStage = (): Builder => {
    const stage = makeBuilder('st');                       // prefix を固定
    stage.addScript({hat: {op: 'event_whenflagclicked'}, body: [
        setv('mode', 'menu'), {op: 'looks_switchbackdropto', inputs: {BACKDROP: 'Beach'}}
    ]});
    for (const [key, bc] of KEYMAP) stage.addScript({hat: keyHat(key), body: [bcast(bc)]});
    return stage;                                          // {blocks, scripts, addScript}
};
```

`makeBuilder` 本体（metadata 駆動の shadow 解決、`In/Cmd/Hat/Script` 型、`DEFAULTS`）は
`VIBE_CODING_REFERENCE.md` §4 にそのまま貼れる形で載っている。それを `src/builder.ts`
に置き、各スプライトモジュールから import する。

## 分割が挙動不変かの確認（回帰レシピ）

分割は「整理しただけで出力は同じ」が理想。生成物のバイト一致で機械的に確認できる:

```bash
# 1) 分割前にベースラインを取る
npm run sb3 -- <name>
unzip -p workspace/<name>/output/<name>.sb3 project.json | md5sum   # ← 控える

# 2) 分割後に再生成して比較
npm run sb3 -- <name>                                               # scratch-parser: pass
unzip -p workspace/<name>/output/<name>.sb3 project.json | md5sum   # ← 一致すれば挙動不変
```

manual-verification ではこの手順で分割前後の `project.json` が一致することを確認済み。
（リファクタの過程で意図せず ID 採番がずれた場合はここで MD5 が変わるので気付ける。）
