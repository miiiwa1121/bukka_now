# 生成データ投入スクリプト（scripts/synthetic-data）

架空の回答者の回答を生成し、D1 に投入・削除するためのスクリプトです。
生成データは実ユーザーと同じテーブルに入り、画面の集計（回答者数・世間平均・分布）にも含まれます。区別は `quiz_submissions.source = 'synthetic'`（ID は `syn_` で始まる）。仕様は [docs/design/database.md](../../docs/design/database.md) の「5. 生成データ」を参照。

## 使い方

```bash
# 1. 生成（scripts/synthetic-data/out/insert.sql に書き出す。git 管理外）
npm run synthetic:generate                              # 既定: 500人 × 全100問、seed はランダム
npm run synthetic:generate -- --count 200 --seed 42     # 人数と seed を指定

# 2. 投入
npm run synthetic:insert:local
npm run synthetic:insert:remote    # 本番

# 作り直し（既存の生成データの行を残し、回答の値・総合スコアなどを上書きする。seed は npm script で固定）
npm run synthetic:regenerate:local
npm run synthetic:regenerate:remote  # 本番
npm run synthetic:regenerate:local -- --dry-run   # SQL と分布の表示だけ

# 生成データをすべて削除（実ユーザーの回答は残る）
npm run synthetic:delete:local
npm run synthetic:delete:remote    # 本番
```

- 事前に `0003_in_range_and_score_counts.sql` までのマイグレーションを適用しておくこと（`source`・`in_range` 列と `score_counts` が必要）。
- **書き込み量に注意**: 500人 × 100問の投入・削除は、どちらも約15万行の書き込みになる（回答1件 = 本体＋インデックス2つ）。D1 無料プランの上限は1日10万行。
- 投入は追記。2回投入すると2倍になる。作り直すときは `synthetic:regenerate` を使う（書き込みは回答1件1行。インデックスのある列は変えない）。
- 作り直しは、まず D1 から生成データの回答の行番号を読み（約5万行の読み取り）、行番号で500行ずつまとめて更新する。診断ID＋設問IDで1行ずつ探すと、1行ごとにその診断の100行を読むので、合計約500万行の読み取りになる。
- 同じ `--seed` なら同じ回答値が生成される（ID の時刻部分だけ変わる）。

## ファイル構成

| ファイル | 役割 |
| :--- | :--- |
| `generate.ts` | 回答を生成して採点し、INSERT 文（500行ごと。集計対象の印 `in_range` 付き）と、集計の作り直し（`scripts/db/rebuild_aggregates.sql`）を書き出す |
| `delete.sql` | `quiz_answers` → `quiz_submissions` の順に生成データを削除する。`npm run synthetic:delete:*` は続けて `scripts/db/rebuild_aggregates.sql` を実行する |
| `out/insert.sql` | 生成結果（git 管理外） |

## 回答の作り方

回答者ごとに傾向（ペルソナ）と、相場感の確かさ（ばらつきに掛ける倍率 0.6〜1.5）を決め、設問ごとに `基準価格 × exp(偏り + ばらつき × 正規乱数)` で値を作ります。
実ユーザーの回答（2026-10-11 時点の11件）に合わせて調整しています: 誤差 `|ln(回答/正解)|` の中央値は約0.43（正解の約1.5倍・3分の2）、11件中8件が正解より安い。

| ペルソナ | 割合 | 基準価格 | 偏り（対数） | ばらつき（対数） |
| :--- | :--- | :--- | :--- | :--- |
| accurate（正確） | 10% | 正解（2025年平均） | ほぼ 0 | 0.20 |
| average（ふつう） | 35% | 正解 | −0.3 前後（安め） | 0.55 |
| timeslip（昔の感覚） | 30% | 10〜35年前の価格（推移がない年は最も古い年） | −0.1 前後 | 0.45 |
| panic（高く見積もる） | 10% | 正解 | +0.15〜+0.45 | 0.45 |
| rough（大ざっぱ） | 15% | 正解 | −0.2 前後 | 0.90 |

seed 20261012 の結果: 誤差の中央値 0.41、正解より安い回答 61%、総合スコアの平均 55.9点（10〜90%点で 41〜77点）。タイプは timeslip 339 / panic 68 / rough 49 / master 44（80点以上は9%）。

- **人が入力しそうな数字に丸める**: キリの良い数（440 / 450）、値札風（438 / 4,580）、有効数字3桁のいずれか。
- **明らかにおかしい値も混ぜる**: 回答者の9割は 0〜1%、残りは 3〜10% の確率で、0 を1つ多く打つ（×10）、1桁足りない（÷10）、当てずっぽう（×0.05〜×30）、ふざけた値（1 / 9999 / 12345）のどれかに置き換える。
- 値は API の入力制限と同じく 1〜99,999,999 の整数に収める。
- スコア・誤差率・タイプは `server/scoring.ts` の `calculateQuizResult` で計算する（実ユーザーと同じ採点）。
- 2026-10-11 の最初の投入は、今より正確なペルソナ（誤差の中央値 約0.2）だった。新しい採点式で生成データの平均が約80点、実ユーザーが約40〜50点となり、実ユーザーの多くが「上位90%」前後になったため作り直した。
