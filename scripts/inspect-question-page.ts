/**
 * Inspect a question page to understand its structure
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { readFile, writeFile } from 'fs/promises';

puppeteer.use(StealthPlugin());

async function inspectQuestionPage() {
  const url = 'https://quantguide.io/questions/rubiks-cube-stickers'; // From your screenshot
  
  console.log(`🔍 Inspecting: ${url}\n`);

  // Load cookies
  const cookiesData = await readFile('cookies.json', 'utf-8');
  const cookies = JSON.parse(cookiesData);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();

  // Set cookies
  for (const cookie of cookies) {
    try {
      await page.setCookie({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        expires: cookie.expirationDate,
        httpOnly: cookie.httpOnly || false,
        secure: cookie.secure || cookie.name.startsWith('__Secure-') || cookie.name.startsWith('__Host-'),
        sameSite: cookie.sameSite || 'Lax',
      });
    } catch (error) {
      // Ignore cookie errors
    }
  }

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Save full page HTML
  const html = await page.content();
  await writeFile('question-page-full.html', html, 'utf-8');
  console.log('✅ Saved full HTML to: question-page-full.html\n');

  // Analyze page structure
  const analysis = await page.evaluate(() => {
    const results: any = {
      title: document.title,
      allText: document.body.innerText.substring(0, 500),
      possibleQuestionContainers: [],
    };

    // Look for elements that might contain the question
    const selectors = [
      'main',
      'article',
      '[class*="question"]',
      '[class*="problem"]',
      '[class*="content"]',
      '[role="main"]',
      'div[class*="container"]',
    ];

    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el, idx) => {
        const text = el.textContent || '';
        if (text.length > 100 && text.length < 5000) {
          results.possibleQuestionContainers.push({
            selector: `${selector}[${idx}]`,
            className: el.className,
            textLength: text.length,
            textPreview: text.substring(0, 200).replace(/\s+/g, ' '),
          });
        }
      });
    });

    // Look for LaTeX/Math elements
    const mathElements = document.querySelectorAll('[class*="math"], [class*="katex"], [class*="latex"]');
    results.hasMathElements = mathElements.length > 0;
    results.mathElementCount = mathElements.length;

    return results;
  });

  console.log('📊 Page Analysis:');
  console.log('='.repeat(60));
  console.log(`Title: ${analysis.title}`);
  console.log(`\nFirst 500 chars of body text:`);
  console.log(analysis.allText);
  console.log(`\nMath elements found: ${analysis.mathElementCount}`);
  console.log(`\nPossible question containers: ${analysis.possibleQuestionContainers.length}`);
  
  if (analysis.possibleQuestionContainers.length > 0) {
    console.log('\nTop candidates:');
    analysis.possibleQuestionContainers.slice(0, 5).forEach((container: any, i: number) => {
      console.log(`\n${i + 1}. ${container.selector}`);
      console.log(`   Class: ${container.className}`);
      console.log(`   Length: ${container.textLength} chars`);
      console.log(`   Preview: ${container.textPreview}...`);
    });
  }

  console.log('\n⏸️  Browser will stay open for 30 seconds for manual inspection...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
}

inspectQuestionPage();






