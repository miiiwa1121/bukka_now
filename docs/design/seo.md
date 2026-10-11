# SEO 設計書（SEO）

検索エンジンと SNS のプレビューに向けて、`bukka_now` が何を出しているかをまとめます。
対象 URL は `https://bukka-now.miiiwa.com/` の1ページだけです（画面遷移は URL を変えない SPA）。

---

## 1. 方針

- **インデックスさせるのはトップ（`/`）だけ**。クイズ画面と結果画面は URL を持たない。
- **設問ごとのページは作らない**。正解価格を公開することになり、クイズとして成り立たなくなるため（[カンニング防止](../requirements/decisions.md#2026-10-11-カンニング防止の徹底と回答-api-の堅牢化)）。
- **JavaScript を実行しないクローラーにも本文を見せる**。ビルド時にトップ画面の HTML を書き出す（プリレンダー）。
- **正規 URL は Custom Domain に統一する**。`bukka-now.miiiwa.workers.dev` も同じ内容を返すため、canonical で `https://bukka-now.miiiwa.com/` を指す。

---

## 2. head の内容（`index.html`）

| 項目 | 内容 |
| :--- | :--- |
| `title` | `物価意識スコア診断｜値段当てクイズで物価感覚をチェック - bukka_now` |
| `meta description` | 具体的な設問例（お米5kg・食パン1斤・カップヌードル）、出典（小売物価統計調査）、見られるもの（予想分布・1950年からの推移）を入れた約120字 |
| `link rel="canonical"` | `https://bukka-now.miiiwa.com/` |
| `theme-color` | `#f5f2eb`（ページ背景と同じエクリュ） |
| OGP | `og:type` / `og:site_name` / `og:locale`（`ja_JP`）/ `og:url` / `og:title` / `og:description` / `og:image`（1200×630、幅・高さ・代替テキスト付き） |
| Twitter | `summary_large_image`、`twitter:site`（`@miiiwa3330`）、タイトル・説明・画像 |
| アイコン | `/favicon.ico`（48px）、`/favicon.svg`、`/apple-touch-icon.png`（180px） |
| 構造化データ | JSON-LD の `WebSite` と `WebApplication`（無料・ゲーム・日本語・作者） |

OGP の URL は絶対 URL で書く（SNS のクローラーは相対 URL を解決しないことがある）。

---

## 3. 静的ファイル（`public/`）

| ファイル | 内容 | 作り方 |
| :--- | :--- | :--- |
| `robots.txt` | すべて許可。`/api/` だけ不許可。sitemap の場所 | 手書き |
| `sitemap.xml` | `/` の1件 | 手書き。トップの内容を大きく変えたら `lastmod` を更新する |
| `ogp.png` | OGP 画像（1200×630） | `scripts/seo/ogp.html` を `npm run seo:images` で撮影 |
| `apple-touch-icon.png` | iOS ホーム画面アイコン（180×180、背景あり） | `favicon.svg` から `npm run seo:images` で生成 |
| `favicon.ico` | 48×48（PNG 格納の ICO） | 同上 |
| `favicon.svg` | ヘッダーのロゴと同じラインアート | 手書き |

画像は生成物だが、Chrome がないとビルドできなくなるのを避けるため、コミットする。手順は [scripts/seo/README.md](../../scripts/seo/README.md)。

---

## 4. プリレンダー

`npm run build` の最後に `scripts/seo/prerender.ts` が動き、`App` の初期表示（トップ画面）を `react-dom/server` の `renderToString` で HTML にして、`dist/index.html` の `<div id="root"></div>` の中に書き込む。

- クライアント（`src/main.tsx`）は、`#root` に子要素があれば `hydrateRoot`、なければ `createRoot` を使う。`npm run dev` は Vite が元の `index.html` を返すので、プリレンダーされず `createRoot` になる。
- プリレンダーされる累計回答者数は `0`。読み込み後に `GET /api/quiz` の値に置き換わる。
- `App` の初期表示は、ブラウザ API や乱数・現在時刻に依存してはいけない（サーバーとブラウザで HTML がずれて hydration エラーになる）。ブラウザ API は `useEffect` やイベントハンドラーの中で使う。

---

## 5. やっていないこと・運用

- **Google Search Console / Bing Webmaster Tools への登録**は開発者の作業。登録後に `https://bukka-now.miiiwa.com/sitemap.xml` を送信する。
- **存在しないパスも 200 で `index.html` を返す**（`not_found_handling = "single-page-application"`）。canonical が `/` を指すので、重複としては扱われない想定。
- **Google Fonts の読み込みが重い**（2書体 × 5〜6ウェイト）。表示速度（Core Web Vitals）を詰めるなら、使っているウェイトだけに絞る。→ 2026-10-11 に対応（[6. 表示速度（Web フォント）](#6-表示速度web-フォント)）。

---

## 6. 表示速度（Web フォント）

Google Fonts の CSS は表示前に読み込まれる（レンダリングをブロックする）ので、小さく保つ。

- **太さは範囲で指定する**（`Noto+Sans+JP:wght@400..800`、`Outfit:wght@400..900`）。どちらも可変フォントで、全太さが1つのファイルに入っている。太さを `400;500;600;…` と列挙すると、同じファイルを指す `@font-face` が太さの数だけ並ぶ。
- **太さを減らすことはしない**。CSS では 400〜900 の6段階すべてを使っている（500: 3箇所、600: 4、700: 17、800: 26、900: 13 ＋ 既定の 400）。
- **Noto Sans JP は 800 まで**。CSS の 900 は 800 で表示する（範囲指定より前からこの見え方）。900 まで広げると日本語の見出しが太くなる。

| 指定 | CSS（非圧縮） | 転送量（gzip） | `@font-face` | フォントファイル |
| :--- | ---: | ---: | ---: | ---: |
| 列挙（変更前） | 578KB | 152KB | 632 | 126 |
| 範囲（現在） | 116KB | 30KB | 126 | 126 |

計測は Chrome 141 の User-Agent で `fonts.googleapis.com/css2` を取得した値。フォントファイルの数と中身は変わらず、ブラウザは使っている文字の分割ファイルだけをダウンロードする。
