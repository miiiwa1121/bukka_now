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

# 生成データをすべて削除（実ユーザーの回答は残る）
npm run synthetic:delete:local
npm run synthetic:delete:remote    # 本番
```

- 事前に `0003_in_range_and_score_counts.sql` までのマイグレーションを適用しておくこと（`source`・`in_range` 列と `score_counts` が必要）。
- **書き込み量に注意**: 500人 × 100問の投入・削除は、どちらも約15万行の書き込みになる（回答1件 = 本体＋インデックス2つ）。D1 無料プランの上限は1日10万行。
- 投入は追記。2回投入すると2倍になる。作り直すときは、先に delete を実行してから投入する。
- 同じ `--seed` なら同じ回答値が生成される（ID の時刻部分だけ変わる）。

## ファイル構成

| ファイル | 役割 |
| :--- | :--- |
| `generate.ts` | 回答を生成して採点し、INSERT 文（500行ごと。集計対象の印 `in_range` 付き）と、集計の作り直し（`scripts/db/rebuild_aggregates.sql`）を書き出す |
| `delete.sql` | `quiz_answers` → `quiz_submissions` の順に生成データを削除する。`npm run synthetic:delete:*` は続けて `scripts/db/rebuild_aggregates.sql` を実行する |
| `out/insert.sql` | 生成結果（git 管理外） |

## 回答の作り方

回答者ごとに傾向（ペルソナ）を決め、設問ごとに `基準価格 × exp(偏り + ばらつき × 正規乱数)` で値を作ります。

| ペルソナ | 割合 | 基準価格 | 偏り | ばらつき（対数） |
| :--- | :--- | :--- | :--- | :--- |
| accurate（正確） | 20% | 正解（2025年平均） | ほぼ 0 | 0.10 |
| average（ふつう） | 35% | 正解 | ±6% 程度 | 0.22 |
| timeslip（昔の感覚） | 20% | 5〜20年前の価格（推移がない年は最も古い年） | ほぼ 0 | 0.15 |
| panic（高く見積もる） | 15% | 正解 | +12〜35% | 0.20 |
| rough（大ざっぱ） | 10% | 正解 | ±10% 程度 | 0.50 |

- **人が入力しそうな数字に丸める**: キリの良い数（440 / 450）、値札風（438 / 4,580）、有効数字3桁のいずれか。
- **明らかにおかしい値も混ぜる**: 回答者の9割は 0〜1%、残りは 3〜10% の確率で、0 を1つ多く打つ（×10）、1桁足りない（÷10）、当てずっぽう（×0.05〜×30）、ふざけた値（1 / 9999 / 12345）のどれかに置き換える。
- 値は API の入力制限と同じく 1〜99,999,999 の整数に収める。
- スコア・誤差率・タイプは `server/scoring.ts` の `calculateQuizResult` で計算する（実ユーザーと同じ採点）。
