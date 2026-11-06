// node devtools/shot.js <url> <out.png> [width=1280] [height=800] [full=0] [parentToken] [click-selector,...]
// Takes a screenshot (optionally logged in as parent via sessionStorage token, optionally clicking things first).
// Prints console errors / page errors so you can spot runtime problems.
const { chromium } = require('playwright');
(async () => {
  const [, , url, out, w = '1280', h = '800', full = '0', token = '', clicks = ''] = process.argv;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  if (token) await ctx.addInitScript((t) => sessionStorage.setItem('mallow.parentToken', t), token);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
  await p.goto(url, { waitUntil: 'networkidle' });
  for (const sel of clicks.split(',').filter(Boolean)) { await p.click(sel); await p.waitForTimeout(500); }
  await p.waitForTimeout(500);
  await p.screenshot({ path: out, fullPage: full === '1' });
  await b.close();
})();
