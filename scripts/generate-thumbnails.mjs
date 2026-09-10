#!/usr/bin/env node
// Renders a static PNG thumbnail for every game page shown on the hub via
// <img src="thumbnails/<path>.png">, mirroring that same relative path
// with .html in place of .png to find the source page to screenshot.
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const INDEX_HTML = join(ROOT, 'index.html');
const THUMBS_DIR = join(ROOT, 'thumbnails');
const VIEWPORT = { width: 1080, height: 600 };
const RENDER_DELAY_MS = 1000;

function findGamePaths(html) {
  const paths = new Set();
  const re = /<img src="thumbnails\/([^"]+)\.png"/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    paths.add(match[1] + '.html');
  }
  return [...paths];
}

async function main() {
  const html = readFileSync(INDEX_HTML, 'utf8');
  const gamePaths = findGamePaths(html);

  if (gamePaths.length === 0) {
    console.log('No thumbnail references found in index.html — nothing to do.');
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.setViewportSize(VIEWPORT);

  for (const relPath of gamePaths) {
    const sourceFile = join(ROOT, relPath);
    if (!existsSync(sourceFile)) {
      console.warn(`Skipping missing file: ${relPath}`);
      continue;
    }

    const thumbPath = join(THUMBS_DIR, relPath.replace(/\.html$/, '.png'));
    mkdirSync(dirname(thumbPath), { recursive: true });

    console.log(`Rendering ${relPath} -> ${thumbPath.replace(ROOT + '/', '')}`);
    await page.goto(`file://${sourceFile}`, { waitUntil: 'load' });
    await page.waitForTimeout(RENDER_DELAY_MS);
    await page.screenshot({ path: thumbPath });
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
