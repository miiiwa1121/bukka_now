// server/types.ts: サーバー側の環境定義

export interface Env {
  DB?: D1Database;
  // 回答送信の回数制限（IP ごと。wrangler.toml の ratelimits）。npm run dev では存在しない
  SUBMIT_RATE_LIMITER?: RateLimit;
  // 出題・統計 API の回数制限（IP ごと）
  READ_RATE_LIMITER?: RateLimit;
}
