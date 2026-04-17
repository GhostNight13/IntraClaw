const { chromium } = require('playwright');
const path = require('path');

const banners = [
  { file: 'github-banner.html',    width: 1280, height: 640  },
  { file: 'twitter-banner.html',   width: 1500, height: 500  },
  { file: 'instagram-banner.html', width: 1080, height: 1080 },
];

(async () => {
  const browser = await chromium.launch();
  for (const b of banners) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: b.width, height: b.height });
    const filePath = path.resolve(__dirname, b.file);
    await page.goto(`file://${filePath}`);
    await page.waitForTimeout(300);
    const outFile = b.file.replace('.html', '.png');
    await page.screenshot({ path: path.resolve(__dirname, outFile), fullPage: false });
    console.log(`✓ ${outFile} (${b.width}x${b.height})`);
    await page.close();
  }
  await browser.close();
})();
