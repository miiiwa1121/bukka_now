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
| `npm run build` | `tsc -b`（型チェック）＋ `vite build` → `dist/` |
| `npm run preview` | `wrangler pages dev ./dist`（`wrangler.toml` の D1 バインディングでローカル D1 に接続し、本番同等に動かす） |
| `npm run deploy` | build のあと `wrangler pages deploy ./dist --project-name=bukka-now`（本番反映） |
| `npm run db:migrate:local` | ローカル D1 にマイグレーションを適用 |
| `npm run db:migrate:remote` | 本番 D1 にマイグレーションを適用 |
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

- Wrangler が表示する URL（通常は `http://localhost:8788/`）を開く。
- Pages Functions とローカル D1 を使って、本番と同じ流れ（保存・集計・分布）を確認できる。
- ソースを変更したら、再度 `npm run build` が必要。
- `--d1=DB=...` フラグは付けないこと。付けると、マイグレーション済みとは別の空のローカル DB に接続され、`no such table` エラーになる。

### 4.3 ローカル D1 の中身を見る

```bash
npx wrangler d1 execute bukka-now-db --local --command "SELECT COUNT(*) FROM quiz_submissions"
```

---

## 5. 本番デプロイ

本番の運用方式は **Direct Upload**（Git 連携による自動デプロイではない）。

| 項目 | 値 |
| :--- | :--- |
| Pages プロジェクト | `bukka-now` |
| URL | https://bukka-now.pages.dev / https://bukka-now.miiiwa.com |
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

### 5.3 初回構築（参考）

D1 を新しく作る場合の手順:

```bash
npx wrangler d1 create bukka-now-db
# 発行された database_id を wrangler.toml に設定
npm run db:migrate:remote
npm run deploy
```

Pages プロジェクトの D1 バインディング（`DB` → `bukka-now-db`）は、`wrangler.toml` から反映される。

---

## 6. 作業完了の定義

[AGENTS.md](../../AGENTS.md) のルールに従い、次の4つが揃って「完了」とする。

1. 実装し、`npm run build` が通っている
2. 仕様が変わったなら、`docs/requirements/overview.md` と `docs/design/` を更新した
3. 決定事項を `docs/requirements/decisions.md` に追記した
4. `docs/devlog/yyyymmdd.md` に作業ログを追記した
