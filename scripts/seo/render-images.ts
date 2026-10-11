// scripts/seo/render-images.ts: OGP 画像とアイコン（PNG / ICO）を Google Chrome（headless）で書き出す
// 使い方: npm run seo:images   （macOS の Google Chrome が必要。出力は public/ にコミットする）

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PUBLIC_DIR = resolve('public');
const workDir = mkdtempSync(join(tmpdir(), 'bukka-now-seo-'));

/**
 * HTML を指定サイズで撮影して PNG に保存する
 */
function screenshot(htmlPath: string, width: number, height: number, outPath: string, transparent = false): void {
  execFileSync(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${width},${height}`,
    // Google Fonts の読み込みを待つ
    '--virtual-time-budget=10000',
    ...(transparent ? ['--default-background-color=00000000'] : []),
    `--screenshot=${outPath}`,
    pathToFileURL(htmlPath).href,
  ], { stdio: 'ignore' });
  console.log(`written: ${outPath}`);
}

/**
 * favicon.svg を背景付き / 透過で指定サイズに描いた HTML を作る
 */
function iconHtml(size: number, background: string | null, iconRatio: number): string {
  const svg = readFileSync(join(PUBLIC_DIR, 'favicon.svg'), 'utf8');
  const iconSize = Math.round(size * iconRatio);
  const path = join(workDir, `icon-${size}.html`);
  writeFileSync(path, `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${background ?? 'transparent'}">
<div style="width:${iconSize}px;height:${iconSize}px">${svg.replace('<svg ', `<svg width="${iconSize}" height="${iconSize}" `)}</div>
</body></html>`);
  return path;
}

/**
 * PNG 1枚を格納した ICO を作る（Windows Vista 以降・主要ブラウザは PNG 格納の ICO を読める）
 */
function pngToIco(pngPath: string, size: number, outPath: string): void {
  const png = readFileSync(pngPath);
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // 画像数
  header.writeUInt8(size >= 256 ? 0 : size, 6); // 幅
  header.writeUInt8(size >= 256 ? 0 : size, 7); // 高さ
  header.writeUInt8(0, 8); // パレット数
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // カラープレーン
  header.writeUInt16LE(32, 12); // ビット深度
  header.writeUInt32LE(png.length, 14); // 画像データのバイト数
  header.writeUInt32LE(6 + 16, 18); // 画像データの開始位置
  writeFileSync(outPath, Buffer.concat([header, png]));
  console.log(`written: ${outPath}`);
}

// OGP 画像（1200×630）
screenshot(resolve('scripts/seo/ogp.html'), 1200, 630, join(PUBLIC_DIR, 'ogp.png'));

// iOS ホーム画面アイコン（180×180・不透明。角丸は iOS 側で付く）
screenshot(iconHtml(180, '#f5f2eb', 0.8), 180, 180, join(PUBLIC_DIR, 'apple-touch-icon.png'));

// /favicon.ico（48×48・透過）。SVG に対応しないクローラーや古いブラウザ向け
const faviconPng = join(workDir, 'favicon-48.png');
screenshot(iconHtml(48, null, 1), 48, 48, faviconPng, true);
pngToIco(faviconPng, 48, join(PUBLIC_DIR, 'favicon.ico'));
