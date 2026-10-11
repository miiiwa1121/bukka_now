# SEO 用スクリプト（scripts/seo）

プリレンダーと、OGP 画像・アイコンの生成スクリプトです。仕様は [docs/design/seo.md](../../docs/design/seo.md) を参照。

## ファイル構成

| ファイル | 役割 |
| :--- | :--- |
| `prerender.ts` | `npm run build` の最後に実行される。`dist/index.html` の `#root` にトップ画面の HTML を書き込む |
| `ogp.html` | OGP 画像（1200×630）の元。文言やデザインを変えるときはここを編集する |
| `render-images.ts` | `ogp.html` と `public/favicon.svg` を Google Chrome（headless）で撮影し、`public/ogp.png`・`public/apple-touch-icon.png`・`public/favicon.ico` を書き出す |

## 画像の作り直し

```bash
npm run seo:images
```

- macOS の Google Chrome（`/Applications/Google Chrome.app`）を使う。別の場所にある場合は `CHROME_PATH` で指定する。
- `ogp.html` は Google Fonts を読み込むため、ネットワークが必要。
- 出力した画像はコミットする（ビルドでは生成しない）。
- SNS は OGP 画像をキャッシュする。差し替えたら、X の Card Validator などでキャッシュを更新する。
