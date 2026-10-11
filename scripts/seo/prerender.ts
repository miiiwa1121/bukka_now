// scripts/seo/prerender.ts: ビルド後の dist/index.html に、トップ画面（App の初期表示）の HTML を書き込む
// JavaScript を実行しないクローラーや SNS のプレビューにも本文が見えるようにする。npm run build の最後に実行される
// クライアントは src/main.tsx で、書き込まれた HTML を hydrateRoot で引き継ぐ

import { readFileSync, writeFileSync } from 'node:fs';
import { createElement, StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import App from '../../src/App';

const INDEX_PATH = 'dist/index.html';
const ROOT_MARKER = '<div id="root"></div>';

const html = readFileSync(INDEX_PATH, 'utf8');
if (!html.includes(ROOT_MARKER)) {
  throw new Error(`${INDEX_PATH} に ${ROOT_MARKER} が見つからない（プリレンダー済み、または index.html の構造が変わった）`);
}

// src/main.tsx と同じツリー（StrictMode > App）で描画する
const appHtml = renderToString(createElement(StrictMode, null, createElement(App)));

writeFileSync(INDEX_PATH, html.replace(ROOT_MARKER, `<div id="root">${appHtml}</div>`));
console.log(`prerendered: ${INDEX_PATH} (${appHtml.length} bytes)`);
