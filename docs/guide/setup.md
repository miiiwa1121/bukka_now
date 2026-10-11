# セットアップ・開発ガイド（Setup & Development Guide）

`bukka_now` のローカル開発環境の構築手順、データベースマイグレーション、および Cloudflare へのデプロイ方法を解説します。

---

## 1. 必要要件

- **Node.js**: v20 以上（推奨 v22+、検証環境: v24.18.0）
- **npm**: v10 以上
- **Wrangler**: Cloudflare CLI（`devDependencies` に同梱。`npx wrangler` で実行）
- 本番操作をする場合は、`npx wrangler login` で Cloudflare アカウントにログインしておく

---

## 2. npm scripts 一覧

| コマンド | 内容 |
| :--- | :--- |
| `npm run dev` | Vite 開発サーバー＋Hono API（`@hono/vite-dev-server`）。**D1 なし** |
| `npm run build` | `tsc -b`（型チェック）＋ `vite build` → `dist/`、最後に `scripts/seo/prerender.ts` でトップ画面の HTML を `dist/index.html` に書き込む |
| `npm run preview` | `wrangler dev`（`dist/` を Static Assets として配信し、`wrangler.toml` の D1 バインディングでローカル D1 に接続して本番同等に動かす） |
| `npm run deploy` | build のあと `wrangler deploy`（本番反映） |
| `npm run db:migrate:local` | ローカル D1 にマイグレーションを適用 |
| `npm run db:migrate:remote` | 本番 D1 にマイグレーションを適用 |
| `npm run db:rescore:local` / `:remote` | 全診断の総合スコア・タイプを現在の採点式で計算し直し、スコア分布を作り直す（採点式や正解価格を変えたとき。`-- --dry-run` で集計の表示だけ） |
| `npm run db:refresh:local` / `:remote` | 回答ログの集計対象（`in_range`）を付け直し、設問別集計とスコア分布を作り直す（migration 0003 の適用直後や、集計対象の範囲・正解価格を変えたとき） |
| `npm run synthetic:generate` | 生成データ（架空の回答者の回答）の投入 SQL を `scripts/synthetic-data/out/insert.sql` に書き出す |
| `npm run synthetic:insert:local` / `:remote` | 生成データをローカル / 本番 D1 に投入 |
| `npm run synthetic:regenerate:local` / `:remote` | 既存の生成データの回答の値を上書きして作り直す（行は残すので書き込みは約5万行。削除して入れ直すと約30万行） |
| `npm run synthetic:delete:local` / `:remote` | 生成データをローカル / 本番 D1 から削除（実ユーザーの回答は残る） |
| `npm run seo:images` | OGP 画像とアイコンを `public/` に書き出す（Google Chrome が必要。[scripts/seo/README.md](../../scripts/seo/README.md)） |
| `npm run lint` | oxlint |

---

## 3. セットアップ手順

```bash
git clone <repository_url>
cd bukka_now
npm install
npm run db:migrate:local   # preview で D1 を使う場合のみ必要
```

ローカル DB は `.wrangler/state/v3/d1` 配下に作られる（git 管理外）。

---

## 4. ローカル開発

### 4.1 UI 開発（`npm run dev`）

```bash
npm run dev
```

- ブラウザで `http://localhost:5173/` を開く。
- `/api/*` は `server/app.ts` が直接処理する。
- **D1 バインディングがないため、回答は保存されない**。累計回答者数と設問別回答者数は0のまま、世間平均は正解価格と同じ値になる。UI と採点ロジックの確認に使う。

### 4.2 DB 込みの確認（`npm run preview`）

```bash
npm run build
npm run preview
```

- Wrangler が表示する URL（通常は `http://localhost:8787/`）を開く。
- Worker とローカル D1 を使って、本番と同じ流れ（保存・集計・分布）を確認できる。
- フロントを変更したら、再度 `npm run build` が必要（`dist/` を配信するため）。`server/` の変更は `wrangler dev` が自動で再読み込みする。

### 4.3 ローカル D1 の中身を見る

```bash
npx wrangler d1 execute bukka-now-db --local --command "SELECT source, COUNT(*) FROM quiz_submissions GROUP BY source"
```

### 4.4 生成データを入れる

ローカル D1 は空なので、分布や世間平均を確認したいときは生成データを入れる。詳細は [scripts/synthetic-data/README.md](../../scripts/synthetic-data/README.md)。

```bash
npm run db:migrate:local
npm run synthetic:generate
npm run synthetic:insert:local
```

---

## 5. 本番デプロイ

本番は **Cloudflare Workers**（Static Assets 付き）。`npm run deploy` で手動反映する（Git 連携による自動デプロイではない）。

| 項目 | 値 |
| :--- | :--- |
| Worker | `bukka-now` |
| URL | https://bukka-now.miiiwa.com （Custom Domain）/ https://bukka-now.miiiwa.workers.dev |
| D1 | `bukka-now-db`（ID は `wrangler.toml` に記載） |

### 5.1 通常のデプロイ

```bash
npm run deploy
```

### 5.2 スキーマ変更を含むデプロイ

1. `migrations/` に新しいファイル（例: `0002_add_xxx.sql`）を追加する。
2. `npm run db:migrate:local` を実行し、`npm run preview` で動作を確認する。
3. `npm run db:migrate:remote` を実行する。
4. `npm run deploy` を実行する。

### 5.3 回答集計・採点式の改修（migration 0003）の反映手順

未回答の除去・集計対象（`in_range`）・スコア分布（`score_counts`）・出題数（`question_count`）・新しい採点式・生成データの作り直しを入れた変更（2026-10-11）を本番に出すときは、**D1 の書き込み上限がリセットされた日に**、次の順に行う。書き込みは合計約5.5万行（無料プランの上限は1日10万行。うち約5万行が 3）。

1. `npm run db:migrate:remote`（0003: 出題数の記録・0円の行の削除・列とテーブルの追加・集計の作り直し）
2. `npm run deploy`（新しい API と画面・採点式。`wrangler.toml` の回数制限も反映される）
3. `npm run synthetic:regenerate:remote`（生成データの回答を、実ユーザーに近い外れ方で上書きする。総合スコア・タイプ・集計対象も新しい式で入る）
4. `npm run db:refresh:remote`（実ユーザーの回答に集計対象の印を付け、集計を作り直す）
5. `npm run db:rescore:remote`（実ユーザーの診断の総合スコア・バイアス・タイプを新しい採点式で計算し直し、スコア分布を作り直す）

- 1 と 2 の間は、旧 API が新しい列を使わずに動く（`question_count` は空、`in_range` は既定値の 1）。計算し直し（5）は `question_count` が空なら回答ログの行数を出題数とみなす。
- 5 をデプロイ（2）より後にするのは、その間に旧 API が旧い採点式で採点した診断も含めて計算し直すため。
- 3 は 4・5 より前に行う（3 が生成データの集計対象の印を入れるので、4 で書き換える行が少なくなる）。

### 5.4 初回構築（参考）

D1 を新しく作る場合の手順:

```bash
npx wrangler d1 create bukka-now-db
# 発行された database_id を wrangler.toml に設定
npm run db:migrate:remote
npm run deploy
```

Worker の D1 バインディング（`DB` → `bukka-now-db`）と Custom Domain は、`wrangler.toml` から反映される。

### 5.5 Pages からの移行時のドメイン付け替え（2026-10-11 に実施済み。記録として残す）

`bukka-now.miiiwa.com` が Pages プロジェクトに接続されたままだと、DNS レコードが残っているため `wrangler deploy` での Custom Domain 作成が失敗する。次の順で付け替える。

1. Cloudflare ダッシュボード → Workers & Pages → Pages プロジェクト `bukka-now` → Custom domains から `bukka-now.miiiwa.com` を削除する。
2. DNS（`miiiwa.com` ゾーン）に `bukka-now` の CNAME（`bukka-now.pages.dev` 向き）が残っていれば削除する。
3. `npm run deploy` を実行する。Worker に Custom Domain が作られる。
4. `https://bukka-now.miiiwa.com/` と `/api/quiz` `/api/stats` が応答することを確認する。
5. 問題がなければ、旧 Pages プロジェクト `bukka-now`（`bukka-now.pages.dev`）を削除する。D1 は独立したリソースなので消えない。

---

## 6. 作業完了の定義

[AGENTS.md](../../AGENTS.md) のルールに従い、次の4つが揃って「完了」とする。

1. 実装し、`npm run build` が通っている
2. 仕様が変わったなら、`docs/requirements/overview.md` と `docs/design/` を更新した
3. 決定事項を `docs/requirements/decisions.md` に追記した
4. `docs/devlog/yyyymmdd.md` に作業ログを追記した
