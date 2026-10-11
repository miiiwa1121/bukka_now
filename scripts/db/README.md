# DB 保守スクリプト（scripts/db）

D1 の集計（`item_aggregates`・`score_counts`）と、回答ログの集計対象の印（`quiz_answers.in_range`）を作り直すためのファイルです。仕様は [docs/design/database.md](../../docs/design/database.md) の「6. 集計対象と集計の作り直し」を参照。

## 使い方

```bash
npm run db:refresh:local     # ローカル D1
npm run db:refresh:remote    # 本番 D1
```

`refresh.ts` が `out/refresh.sql`（git 管理外）を書き出し、続けて D1 に適用します。

実行が必要なとき:

- migration `0003_in_range_and_score_counts.sql` を適用した直後（既存の回答はすべて `in_range = 1` になっているため）
- 集計対象の範囲（`server/aggregation.ts` の `IN_RANGE_MIN_RATIO` / `IN_RANGE_MAX_RATIO`）を変えたとき
- クイズマスターの正解価格を更新したとき

## ファイル構成

| ファイル | 役割 |
| :--- | :--- |
| `rebuild_aggregates.sql` | `item_aggregates` と `score_counts` を、回答ログ・診断ログから作り直す。生成データの投入・削除でも使う |
| `refresh.ts` | 設問ごとに `in_range` を付け直す UPDATE（判定が変わる行だけ）を生成し、`rebuild_aggregates.sql` を後ろにつなげて `out/refresh.sql` に書き出す |

## 負荷の目安（2026-10-11 時点、回答約5万行）

- 読み取り: 約10万行（付け直しの走査と作り直しの集計）。無料プランの上限は1日500万行。
- 書き込み: 約1,000行（範囲外の約500行＋集計表）。無料プランの上限は1日10万行。
