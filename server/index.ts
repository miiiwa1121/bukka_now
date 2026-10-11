// server/index.ts: Cloudflare Workers エントリポイント
// /api/* だけがこの Worker に届く（wrangler.toml の assets.run_worker_first）。それ以外は静的アセットとして dist/ から配信される。

import { app } from './app';

export default app;
