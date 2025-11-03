/**
 * Scrape using keyboard navigation (arrow keys) instead of clicking
 */

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFile } from "fs/promises";
import * as cheerio from "cheerio";

puppeteer.use(StealthPlugin());

interface ScrapedProblem {
  name: string;
  link: string;
  difficulty: "Easy" | "Medium" | "Hard" | "Unknown";
  tags?: string[];
}

async function scrapeWithKeyboard() {
  console.log("🔐 Starting scraper with keyboard navigation...\n");

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log("📱 Opening QuantGuide...");
    await page.goto("https://quantguide.io", { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Auto-login
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const loginBtn = buttons.find(btn => btn.textContent?.toLowerCase().includes('log in'));
      if (loginBtn) (loginBtn as HTMLElement).click();
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const googleBtn = buttons.find(btn => btn.textContent?.toLowerCase().includes('google'));
      if (googleBtn) (googleBtn as HTMLElement).click();
    });

    console.log("\n⏸️  PLEASE LOG IN AND GO TO QUESTIONS PAGE");
    console.log("   Press ENTER when ready\n");
    
    await new Promise<void>((resolve) => {
      process.stdin.once('data', () => resolve());
    });

    console.log("\n✅ Starting scraping with keyboard navigation...\n");
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get page info
    const pageInfo = await page.evaluate(() => {
      const pageText = document.body.innerText.match(/Page\s+(\d+)\s*\/\s*(\d+)/);
      const resultsText = document.body.innerText.match(/Results:\s*(\d+)/);
      return {
        currentPage: pageText ? parseInt(pageText[1]) : 1,
        totalPages: pageText ? parseInt(pageText[2]) : 1,
        totalResults: resultsText ? parseInt(resultsText[1]) : 0,
      };
    });

    console.log("📊 Page Info:");
    console.log(`   Total Results: ${pageInfo.totalResults}`);
    console.log(`   Pages: ${pageInfo.currentPage} / ${pageInfo.totalPages}\n`);

    const allProblems: ScrapedProblem[] = [];
    let currentPage = pageInfo.currentPage;
    const totalPages = pageInfo.totalPages;

    while (currentPage <= totalPages) {
      console.log(`\n📖 Scraping page ${currentPage}/${totalPages}...`);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Extract questions
      const html = await page.content();
      const $ = cheerio.load(html);
      const pageProblems: ScrapedProblem[] = [];
      const seenUrls = new Set<string>();

      $('a[href^="/questions/"]').each((_i, el) => {
        const $el = $(el);
        const href = $el.attr('href');
        if (!href || seenUrls.has(href)) return;
        seenUrls.add(href);

        const urlEnding = href.split('/').pop() || '';
        if (!urlEnding || urlEnding.length < 3) return;

        const paragraphs = $el.find('p');
        let name = paragraphs.eq(0).text().trim();
        const topic = paragraphs.eq(1).text().trim();
        const difficultyText = paragraphs.eq(2).text().trim().toLowerCase();

        const navWords = ['log in', 'sign up', 'questions', 'mental math'];
        if (navWords.some(w => name.toLowerCase().includes(w))) return;

        let difficulty: "Easy" | "Medium" | "Hard" | "Unknown" = "Unknown";
        if (difficultyText.includes('easy')) difficulty = "Easy";
        else if (difficultyText.includes('medium')) difficulty = "Medium";
        else if (difficultyText.includes('hard')) difficulty = "Hard";

        if (!name || name.length < 2) {
          name = urlEnding.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }

        pageProblems.push({
          name,
          link: `https://quantguide.io${href}`,
          difficulty,
          tags: topic ? [topic] : undefined,
        });
      });

      console.log(`   ✅ Found ${pageProblems.length} questions`);
      allProblems.push(...pageProblems);

      // Navigate to next page - EXACT SAME LOGIC THAT WORKED BEFORE
      if (currentPage < totalPages) {
        try {
          // Get the current question IDs to verify page change
          const questionsBefore = pageProblems.map(q => q.link);
          
          // Click the next button using EXACT same logic from scraper.ts
          const navigationResult = await page.evaluate(() => {
            // Find pagination container by looking for "Page X / Y" text
            const pageTexts = Array.from(document.querySelectorAll('p'));
            const paginationPara = pageTexts.find(p => {
              const text = p.textContent || '';
              return text.match(/Page\s+\d+\s*\/\s*\d+/);
            });
            
            if (!paginationPara) {
              return { success: false, reason: 'No pagination text found' };
            }
            
            // Get the parent container that has the pagination buttons
            let container = paginationPara.parentElement;
            while (container && !container.querySelector('button')) {
              container = container.parentElement;
            }
            
            if (!container) {
              return { success: false, reason: 'No pagination container found' };
            }
            
            // Get all buttons in the pagination container
            const buttons = Array.from(container.querySelectorAll('button'));
            
            // The next button should be the last non-disabled button with a right arrow
            let nextButton = null;
            
            for (let i = buttons.length - 1; i >= 0; i--) {
              const btn = buttons[i];
              if (btn.hasAttribute('disabled')) continue;
              
              const svg = btn.querySelector('svg');
              if (svg) {
                const path = svg.querySelector('path');
                if (path) {
                  const d = path.getAttribute('d');
                  // Right arrow has this specific path
                  if (d && d.includes('16.28 11.47')) {
                    nextButton = btn;
                    break;
                  }
                }
              }
            }
            
            if (!nextButton && buttons.length >= 2) {
              // Fallback: assume last button is next
              nextButton = buttons[buttons.length - 1];
              if (nextButton.hasAttribute('disabled')) {
                return { success: false, reason: 'Next button is disabled' };
              }
            }
            
            if (nextButton) {
              (nextButton as HTMLElement).click();
              return { success: true, reason: 'Clicked next button' };
            }
            
            return { success: false, reason: 'Could not find next button' };
          });
          
          console.log(`   🔘 Navigation attempt: ${navigationResult.reason}`);
          
          if (navigationResult.success) {
            // Wait for the page to update
            await new Promise(resolve => setTimeout(resolve, 4000));
            
            // Verify the page actually changed by checking question IDs
            const htmlAfter = await page.content();
            const $after = cheerio.load(htmlAfter);
            const questionsAfter: string[] = [];
            
            $after('a[href^="/questions/"]').each((_i, el) => {
              const href = $after(el).attr('href');
              if (href) questionsAfter.push(`https://quantguide.io${href}`);
            });
            
            // Check if we have different questions
            const hasNewQuestions = questionsAfter.some(q => !questionsBefore.includes(q));
            
            // Debug: Show which questions we're seeing
            console.log(`   📋 Before: ${questionsBefore.slice(0, 3).map(q => q.split('/').pop()).join(', ')}...`);
            console.log(`   📋 After:  ${questionsAfter.slice(0, 3).map(q => q.split('/').pop()).join(', ')}...`);
            console.log(`   🔍 Has new questions: ${hasNewQuestions}`);
            
            if (hasNewQuestions && questionsAfter.length > 0) {
              currentPage++;
              console.log(`   ✅ Successfully navigated to page ${currentPage}`);
            } else {
              console.warn(`   ⚠️  Page didn't change (same questions), stopping pagination`);
              console.warn(`   Questions before: ${questionsBefore.length}, after: ${questionsAfter.length}`);
              break;
            }
          } else {
            console.warn(`   ⚠️  Could not navigate: ${navigationResult.reason}`);
            break;
          }
        } catch (e) {
          console.error(`   ❌ Error during navigation:`, e);
          break;
        }
      } else {
        break;
      }
    }

    // Save results
    await writeFile('scraped-problems.json', JSON.stringify(allProblems, null, 2));

    console.log("\n" + "=".repeat(60));
    console.log("✅ Scraping complete!");
    console.log("=".repeat(60));
    console.log(`📊 Total questions scraped: ${allProblems.length}`);
    console.log(`📄 Saved to: scraped-problems.json`);
    console.log("=".repeat(60));

    console.log("\n✨ Browser will close in 5 seconds...");
    await new Promise(resolve => setTimeout(resolve, 5000));

  } finally {
    await browser.close();
  }
}

scrapeWithKeyboard();

