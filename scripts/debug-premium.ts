/**
 * Debug script to check if premium questions are being detected
 */

import puppeteer from "puppeteer";
import { readFile } from "fs/promises";

async function debugPremium() {
  console.log("Debugging premium question detection...\n");

  let cookies: Array<{ name: string; value: string; domain?: string }> = [];
  try {
    const cookiesData = await readFile("cookies.json", "utf-8");
    cookies = JSON.parse(cookiesData);
  } catch (e) {
    console.error("Could not load cookies.json");
    return;
  }

  const browser = await puppeteer.launch({
    headless: false, // Show browser
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    );

    if (cookies.length > 0) {
      await page.setCookie(...cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain || 'quantguide.io',
        path: '/',
      })));
    }

    await page.goto("https://quantguide.io/questions", {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check for premium indicators
    const premiumInfo = await page.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll('div'));
      const premiumDivs = allDivs.filter(div => {
        const text = div.textContent || '';
        return text.includes('Premium') || div.querySelector('img[alt*="Lock"]') || div.querySelector('img[src*="lock"]');
      });

      const allLinks = Array.from(document.querySelectorAll('a[href^="/questions/"]'));
      
      // Check for divs that have lock icons
      const lockedQuestions = allDivs.filter(div => {
        const hasLock = div.querySelector('img[alt*="Lock"]') || div.querySelector('img[src*="lock"]');
        const hasQuestionLink = div.querySelector('a[href^="/questions/"]');
        return hasLock && hasQuestionLink;
      });

      return {
        totalLinks: allLinks.length,
        premiumDivs: premiumDivs.length,
        lockedQuestions: lockedQuestions.length,
        sampleLocked: lockedQuestions.slice(0, 3).map(div => {
          const link = div.querySelector('a[href^="/questions/"]');
          const paragraphs = div.querySelectorAll('p');
          return {
            href: link?.getAttribute('href'),
            name: paragraphs[0]?.textContent?.trim(),
            topic: paragraphs[1]?.textContent?.trim(),
            difficulty: paragraphs[2]?.textContent?.trim(),
          };
        })
      };
    });

    console.log("Premium Detection Results:");
    console.log("=".repeat(60));
    console.log(`Total question links found: ${premiumInfo.totalLinks}`);
    console.log(`Divs with "Premium" text: ${premiumInfo.premiumDivs}`);
    console.log(`Questions with lock icons: ${premiumInfo.lockedQuestions}`);
    console.log("\nSample locked questions:");
    premiumInfo.sampleLocked.forEach((q, i) => {
      console.log(`\n${i + 1}. ${q.name}`);
      console.log(`   Link: ${q.href}`);
      console.log(`   Topic: ${q.topic}`);
      console.log(`   Difficulty: ${q.difficulty}`);
    });

    console.log("\n\nBrowser will stay open for 30 seconds for manual inspection...");
    await new Promise(resolve => setTimeout(resolve, 30000));

  } finally {
    await browser.close();
  }
}

debugPremium();







