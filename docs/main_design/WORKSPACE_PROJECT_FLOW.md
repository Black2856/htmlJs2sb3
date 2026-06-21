# Workspace Project Flow

## 目的

Scratch作品固有のDSL、素材参照、生成SB3をローカル`workspace/`へ集約し、
共通実行・表示・変換機構を本体側へ維持する。

## ディレクトリ

```text
workspace/
  <name>/              作品（workspace/直下に1作品1ディレクトリで並ぶ）
    project.ts
    assets.json
    assets/            この作品のcostume/sound素材
      sprite/ sound_effect/ music/
    output/
preview/
  manual-preview.html
  manual-preview.ts
tools/
  workspaceProject.ts
  previewProject.ts
  exportSb3.ts
  newProject.ts
```

作品は`workspace/`直下に並べ、素材は各作品の`assets/`に同梱する。共有素材
プールは持たない。`workspace/`はGit追跡対象外である。再利用可能なfixtureは
`tests/fixtures/`へ置く。

## 新規作品のscaffold

```powershell
npm run new -- <name>
```

`workspace/<name>/`に最小の有効なDSL（`project.ts`：緑の旗→10歩動く）、
空の`assets.json`、空の`assets/`、`output/`を生成する。既存ディレクトリが
ある名前は上書きせず中止する。名前は英数字始まりで英数字・ハイフン・
アンダースコアのみ許可する。

## project.ts

default exportまたは`project` named exportで`DslProject`を返す。
このDSLがpreviewとSB3 exportの唯一の正本である。

## assets.json

```json
{
  "assets": [
    {
      "assetId": "<MD5>",
      "md5ext": "<MD5>.<format>",
      "dataFormat": "png",
      "kind": "costume",
      "mimeType": "image/png",
      "source": "workspace/<name>/assets/path/to/file.png"
    }
  ]
}
```

`source`はリポジトリルート基準のパスで、`meta.source`・DSLの`assets[].source`と
同じ基準で揃える。loaderはこれをリポジトリルートから解決し、DSL validation、
manifest shape、参照整合、実bytesのMD5を検査する。errorが1件でもあれば
Runtime起動とSB3生成へ進まない。

## Manual preview

```powershell
npm run preview -- <name>
```

preview serverは作品をNode側で読み、DSL JSONと検証済みasset bytesだけを
browserへ配信する。browserは再度validatorを実行し、AssetManager、
CanvasRenderer、DomInputManager、SoundManager、Runtimeを接続する。

緑の旗クリック内でAudioContextをresumeし、sound decode完了後に
`Runtime.greenFlag()`を呼ぶ。`requestAnimationFrame`ごとに`tick()`を実行する。
StopはRuntime thread、clone、soundを停止する。

Projectインスタンスは作品読み込み時に一度だけ生成し、緑の旗の再押下では
再生成せず再利用する。そのためSprite座標は前回実行で移動した位置を保持し、
Scratch同様に現在位置からの相対移動になる（毎回初期座標へリセットしない）。
初期座標へ戻すにはブラウザを再読み込みしてProjectを作り直す。

表示diagnosticはproject、target、thread、block、opcode、asset、pathを
可能な範囲で保持する。

`full-feature-minimal`の手動確認ではpen down後に`motion_movesteps`を実行し、
円形の始点から移動先までの線分を確認する。音声終了後に生成されるcloneは
source Spriteのcostume skinを共有し、fallback四角へ変化しない。

このスプライトを動かしても画面外へ完全に消えないのは、移動量や見た目の
大きさのためではなく、rendererありのときに効くfencing（SCRATCH_RENDER_SPEC
参照）でbounding boxが最低15px程度Stage内に残るためである。headless実行では
fencingが効かない点も含め、挙動はSCRATCH_RUNTIME_SPECの「motion と fencing」に従う。

preview描画ではcostumeなしStageを透明背景として扱う。fallback drawableは
costumeなしSpriteのデバッグ表示に限定する。

## SB3 export

```powershell
npm run sb3 -- <name>
```

CLIは検証済みDSLとasset bytesを`packageSb3()`へ渡し、
`workspace/<name>/output/<name>.sb3`へ保存する。保存後に
`scratch-parser`へ通す。

Runtime内部状態、生成済み`project.json`、SB3 ZIP内部は入力・編集対象にしない。

## 対象外

- 新Runtime/Renderer primitive。
- SB3 import。
- Scratch公式GUI、block editor、paint editor、sound editor。
- Scratch/TurboWarpサイト操作の自動化。
