# セットアップ・開発ガイド（Setup & Development Guide）

`bukka_now` のローカル開発環境の構築手順、データベースマイグレーション、および Cloudflare へのデプロイ方法を解説します。

---

## 1. 必要要件

- **Node.js**: v20 以上（推奨 v22+、検証環境: v24.18.0）
- **npm**: v10 以上
- **Wrangler**: Cloudflare CLI（`package.json` に同梱）

---

## 2. セットアップ手順

### 2.1 リポジトリクローンと依存関係インストール
```bash
git clone <repository_url>
cd bukka_now
npm install
```

### 2.2 Cloudflare D1 ローカルデータベースのマイグレーション
ローカル開発用の SQLite データベースに初期テーブルおよびマスターシードデータを投入します。

```bash
npm run db:migrate:local
```

マイグレーションファイルは `migrations/0001_initial_schema.sql` に定義されており、`.wrangler/state/v3/d1` 配下にローカルDBファイルが作成されます。

---

## 3. ローカル開発サーバー起動

```bash
npm run dev
```

- Vite 開発サーバーおよび Hono API サーバーが起動します。
- ブラウザで `http://localhost:5173/` にアクセスしてください。
- API は `/api/quiz`, `/api/quiz/submit`, `/api/stats` で直接動作します。

---

## 4. プロダクトビルドとプレビュー

### 4.1 プロダクションビルド
TypeScript の型チェック（`tsc -b`）と Vite による静的アセット最適化ビルドを実行します。

```bash
npm run build
```

成果物は `dist/` ディレクトリに出力されます。

### 4.2 Cloudflare Pages プレビュー
Wrangler を用いて Cloudflare Pages および Functions の本番同等エッジ環境をローカルでプレビューします。

```bash
npm run preview
```

---

## 5. Cloudflare への本番デプロイ

### 5.1 Cloudflare D1 本番データベースの作成
初回のみ、Cloudflare ダッシュボードまたは Wrangler CLI で D1 データベースを作成します。

```bash
npx wrangler d1 create bukka-now-db
```

発行された `database_id` を `wrangler.toml` の `database_id` に設定します。

### 5.2 本番 D1 マイグレーション適用
```bash
npx wrangler d1 migrations apply bukka-now-db --remote
```

### 5.3 Cloudflare Pages へのデプロイ
```bash
npm run build
npx wrangler pages deploy dist --project-name bukka-now
```
