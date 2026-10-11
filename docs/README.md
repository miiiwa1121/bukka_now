# ドキュメント一覧

`bukka_now`（物価意識調査WEBサービス）の仕様・設計・開発ログ等のドキュメント管理ディレクトリです。

## ディレクトリ構成

- [requirements/](requirements/README.md): 要件定義・決定事項
- [design/](design/README.md): 詳細設計（アーキテクチャ・DB・API・クイズデータ）
- [guide/](guide/README.md): セットアップ・開発・デプロイ運用ガイド
- [devlog/](devlog/README.md): 日々の作業・思考ログ

## 読む順番（初めての人向け）

1. [requirements/overview.md](requirements/overview.md) — 何を作っているか（現行仕様）
2. [design/architecture.md](design/architecture.md) — どう動いているか
3. [guide/setup.md](guide/setup.md) — 手元で動かす
4. [requirements/decisions.md](requirements/decisions.md) — なぜそうなったか（決定の履歴）

## 記述ルール

- 現行仕様は `requirements/overview.md` と `design/` 配下に書く。仕様が変わったらこれらを**上書き**して常に実装と一致させる。
- 決定の経緯は `requirements/decisions.md` に**追記**していく（過去の決定は消さず、置き換えられた場合は注記する）。
- ドキュメント間のリンクは相対パスで書く。
