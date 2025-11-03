// Scrapes questions after logging in with Google
// Uses stealth mode to avoid getting blocked

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { writeFile } from "fs/promises";
import * as cheerio from "cheerio";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../.env.local' });

// Stealth mode activated - we're going incognito
puppeteer.use(StealthPlugin());

interface ScrapedProblem {
  name: string;
  link: string;
  difficulty: "Easy" | "Medium" | "Hard" | "Unknown";
  tags?: string[];
}

async function scrapeWithLogin() {
  console.log("🔐 Starting scraper with login...\n");

  const browser = await puppeteer.launch({
    headless: false, // Show browser so you can log in
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    console.log("📱 Opening QuantGuide...");
    await page.goto("https://quantguide.io", {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("🔍 Looking for login button...");
    
    // Try to find and click login/sign in button
    try {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const loginBtn = buttons.find(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          return text.includes('log in') || text.includes('sign in');
        });
        if (loginBtn) {
          (loginBtn as HTMLElement).click();
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log("✅ Clicked login button");
    } catch (e) {
      console.log("⚠️  Could not find login button automatically");
    }

    // Look for "Continue with Google" button
    console.log("🔍 Looking for 'Continue with Google' button...");
    try {
      const googleButtonClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const googleBtn = buttons.find(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          return text.includes('google') || text.includes('continue with google');
        });
        if (googleBtn) {
          (googleBtn as HTMLElement).click();
          return true;
        }
        return false;
      });

      if (googleButtonClicked) {
        console.log("✅ Clicked 'Continue with Google'");
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Wait for Google login page or account selector
        console.log("⏳ Waiting for Google login/account selection...");
        
        // Check if we need to select the account
        try {
          // Look for your email in the account list
          const accountSelected = await page.evaluate((email: string) => {
            const divs = Array.from(document.querySelectorAll('div'));
            const accountDiv = divs.find(div => 
              div.textContent?.includes(email)
            );
            if (accountDiv) {
              (accountDiv as HTMLElement).click();
              return true;
            }
            return false;
          }, process.env.GOOGLE_EMAIL || 'your-email@gmail.com');

          if (accountSelected) {
            console.log(`✅ Selected account: ${process.env.GOOGLE_EMAIL}`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          } else {
            console.log("\n⏸️  PLEASE SELECT YOUR GOOGLE ACCOUNT IN THE BROWSER");
            console.log(`   Select: ${process.env.GOOGLE_EMAIL}`);
            console.log("   Press ENTER here when logged in\n");
            
            await new Promise<void>((resolve) => {
              process.stdin.once('data', () => resolve());
            });
          }
        } catch (e) {
          console.log("\n⏸️  PLEASE COMPLETE GOOGLE LOGIN IN THE BROWSER");
          console.log("   Press ENTER here when logged in\n");
          
          await new Promise<void>((resolve) => {
            process.stdin.once('data', () => resolve());
          });
        }
      } else {
        console.log("\n⏸️  PLEASE LOG IN MANUALLY IN THE BROWSER");
        console.log("   1. Click 'Continue with Google'");
        console.log(`   2. Select ${process.env.GOOGLE_EMAIL}`);
        console.log("   3. Press ENTER here when logged in\n");
        
        await new Promise<void>((resolve) => {
          process.stdin.once('data', () => resolve());
        });
      }
    } catch (e) {
      console.log("\n⏸️  PLEASE LOG IN MANUALLY IN THE BROWSER");
      console.log("   Press ENTER here when logged in\n");
      
      await new Promise<void>((resolve) => {
        process.stdin.once('data', () => resolve());
      });
    }

    console.log("\n✅ Continuing with scraping...\n");

    // Navigate to questions page if not already there
    const currentUrl = page.url();
    if (!currentUrl.includes('/questions')) {
      console.log("Navigating to questions page...");
      await page.goto("https://quantguide.io/questions", {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check pagination
    const pageInfo = await page.evaluate(() => {
      const pageText = document.body.innerText.match(/Page\s+(\d+)\s*\/\s*(\d+)/);
      const resultsText = document.body.innerText.match(/Results:\s*(\d+)/);
      const questionLinks = document.querySelectorAll('a[href^="/questions/"]').length;
      
      return {
        currentPage: pageText ? parseInt(pageText[1]) : 1,
        totalPages: pageText ? parseInt(pageText[2]) : 1,
        totalResults: resultsText ? parseInt(resultsText[1]) : 0,
        questionsOnPage: questionLinks,
      };
    });

    console.log("📊 Page Info:");
    console.log(`   Total Results: ${pageInfo.totalResults}`);
    console.log(`   Pages: ${pageInfo.currentPage} / ${pageInfo.totalPages}`);
    console.log(`   Questions on current page: ${pageInfo.questionsOnPage}\n`);

    if (pageInfo.questionsOnPage < 40) {
      console.warn("⚠️  Warning: Only seeing", pageInfo.questionsOnPage, "questions per page");
      console.warn("   Expected ~50 per page with premium access");
      console.warn("   Make sure you're logged in with a premium account\n");
    }

    // Scrape all pages
    const allProblems: ScrapedProblem[] = [];
    let currentPage = pageInfo.currentPage;
    const totalPages = pageInfo.totalPages;

    while (currentPage <= totalPages) {
      console.log(`\n📖 Scraping page ${currentPage}/${totalPages}...`);

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract questions from current page
      const html = await page.content();
      const $ = cheerio.load(html);
      const pageProblems: ScrapedProblem[] = [];
      const seenUrls = new Set<string>();

      // Find all question links
      $('a[href^="/questions/"]').each((_i, el) => {
        const $el = $(el);
        const href = $el.attr('href');
        if (!href || seenUrls.has(href)) return;
        seenUrls.add(href);

        const urlEnding = href.split('/').pop() || '';
        if (!urlEnding || urlEnding.length < 3) return;

        // Get question details
        const paragraphs = $el.find('p');
        let name = paragraphs.eq(0).text().trim();
        const topic = paragraphs.eq(1).text().trim();
        const difficultyText = paragraphs.eq(2).text().trim().toLowerCase();

        // Skip navigation links
        const navWords = ['log in', 'sign up', 'questions', 'mental math'];
        if (navWords.some(w => name.toLowerCase().includes(w))) return;

        // Parse difficulty
        let difficulty: "Easy" | "Medium" | "Hard" | "Unknown" = "Unknown";
        if (difficultyText.includes('easy')) difficulty = "Easy";
        else if (difficultyText.includes('medium')) difficulty = "Medium";
        else if (difficultyText.includes('hard')) difficulty = "Hard";

        // If no name, generate from URL
        if (!name || name.length < 2) {
          name = urlEnding.split('-').map(w => 
            w.charAt(0).toUpperCase() + w.slice(1)
          ).join(' ');
        }

        const problem: ScrapedProblem = {
          name,
          link: `https://quantguide.io${href}`,
          difficulty,
          tags: topic ? [topic] : undefined,
        };

        pageProblems.push(problem);
      });

      console.log(`   ✅ Found ${pageProblems.length} questions`);
      allProblems.push(...pageProblems);

      // Navigate to next page
      if (currentPage < totalPages) {
        try {
          // Get first question ID before clicking
          const firstQuestionBefore = pageProblems[0]?.link || '';
          
          const clicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const nextBtn = buttons.find(btn => {
              const svg = btn.querySelector('svg');
              if (!svg) return false;
              const path = svg.querySelector('path');
              return path?.getAttribute('d')?.includes('16.28 11.47');
            });
            
            if (nextBtn && !nextBtn.hasAttribute('disabled')) {
              (nextBtn as HTMLElement).click();
              return true;
            }
            return false;
          });

          if (clicked) {
            // Wait for page to change
            await new Promise(resolve => setTimeout(resolve, 4000));
            
            // Verify page changed by checking first question
            const htmlAfter = await page.content();
            const $after = cheerio.load(htmlAfter);
            const firstLinkAfter = $after('a[href^="/questions/"]').first().attr('href');
            const firstQuestionAfter = firstLinkAfter ? `https://quantguide.io${firstLinkAfter}` : '';
            
            if (firstQuestionAfter && firstQuestionAfter !== firstQuestionBefore) {
              currentPage++;
              console.log(`   ✅ Navigated to page ${currentPage}`);
              // Continue to next iteration
            } else {
              console.warn(`   ⚠️  Page didn't change (still showing: ${firstQuestionBefore.split('/').pop()})`);
              console.warn("   Retrying once more...");
              
              // Try clicking again
              await new Promise(resolve => setTimeout(resolve, 2000));
              await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const nextBtn = buttons.find(btn => {
                  const svg = btn.querySelector('svg');
                  if (!svg) return false;
                  const path = svg.querySelector('path');
                  return path?.getAttribute('d')?.includes('16.28 11.47');
                });
                if (nextBtn && !nextBtn.hasAttribute('disabled')) {
                  (nextBtn as HTMLElement).click();
                }
              });
              
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              // Check again
              const htmlRetry = await page.content();
              const $retry = cheerio.load(htmlRetry);
              const firstLinkRetry = $retry('a[href^="/questions/"]').first().attr('href');
              const firstQuestionRetry = firstLinkRetry ? `https://quantguide.io${firstLinkRetry}` : '';
              
              if (firstQuestionRetry && firstQuestionRetry !== firstQuestionBefore) {
                currentPage++;
                console.log(`   ✅ Retry successful! Navigated to page ${currentPage}`);
              } else {
                console.warn("   ❌ Retry failed. Stopping pagination.");
                break;
              }
            }
          } else {
            console.warn("   ⚠️  Could not find next button");
            break;
          }
        } catch (e) {
          console.error("   ❌ Error navigating:", e);
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

    if (allProblems.length < 1000) {
      console.warn("\n⚠️  Warning: Expected ~1211 questions");
      console.warn(`   Only got ${allProblems.length}`);
      console.warn("   This might indicate:");
      console.warn("   - Not all pages were scraped");
      console.warn("   - Premium access issue");
      console.warn("   - Some questions are hidden/locked");
    }

    console.log("\n✨ Browser will close in 5 seconds...");
    await new Promise(resolve => setTimeout(resolve, 5000));

  } finally {
    await browser.close();
  }
}

scrapeWithLogin();

