/**
 * Scrape question content with automated Google login
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { readFile, writeFile } from 'fs/promises';
import type { ScrapedProblem } from '../src/lib/scraper';

puppeteer.use(StealthPlugin());

interface QuestionContent {
  name: string;
  link: string;
  difficulty: string;
  tags: string[];
  questionText: string;
  questionHtml: string;
  hasLatex: boolean;
  scrapedAt: string;
}

// Load credentials from environment variables
import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });

const GOOGLE_EMAIL = process.env.GOOGLE_EMAIL;
const GOOGLE_PASSWORD = process.env.GOOGLE_PASSWORD;

if (!GOOGLE_EMAIL || !GOOGLE_PASSWORD) {
  console.error('❌ Missing GOOGLE_EMAIL or GOOGLE_PASSWORD in .env.local');
  process.exit(1);
}

async function scrapeWithLogin(limit: number = 5) {
  console.log(`🔍 Scraping question content with Google login...\n`);

  // Load existing scraped problems
  const data = await readFile('scraped-problems.json', 'utf-8');
  const problems: ScrapedProblem[] = JSON.parse(data);
  
  const questionsToScrape = problems.slice(0, limit);
  console.log(`📋 Will scrape ${questionsToScrape.length} questions\n`);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Step 1: Go to QuantGuide and click "Log In"
  console.log('🔐 Step 1: Navigating to QuantGuide...');
  await page.goto('https://quantguide.io', { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('🔐 Step 2: Clicking "Log In" button...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a'));
    const loginButton = buttons.find(btn => 
      btn.textContent?.trim() === 'Log In'
    );
    if (loginButton) {
      (loginButton as HTMLElement).click();
    }
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('🔐 Step 3: Clicking "Continue with Google"...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
    const googleButton = buttons.find(btn => 
      btn.textContent?.includes('Continue with Google') || 
      btn.textContent?.includes('Google')
    );
    if (googleButton) {
      (googleButton as HTMLElement).click();
    }
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Step 4: Handle Google login popup
  const pages = await browser.pages();
  const googlePage = pages[pages.length - 1]; // Get the popup window

  console.log('🔐 Step 4: Entering email...');
  await googlePage.waitForSelector('input[type="email"]', { timeout: 10000 });
  await googlePage.type('input[type="email"]', GOOGLE_EMAIL, { delay: 100 });
  await googlePage.keyboard.press('Enter');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('🔐 Step 5: Entering password...');
  await googlePage.waitForSelector('input[type="password"]', { timeout: 10000 });
  await googlePage.type('input[type="password"]', GOOGLE_PASSWORD, { delay: 100 });
  await googlePage.keyboard.press('Enter');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('✅ Login complete! Waiting for redirect...');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n📥 Starting question scraping...\n');

  const results: QuestionContent[] = [];

  for (let i = 0; i < questionsToScrape.length; i++) {
    const problem = questionsToScrape[i];
    console.log(`[${i + 1}/${questionsToScrape.length}] Scraping: ${problem.name}`);
    console.log(`   URL: ${problem.link}`);

    try {
      await page.goto(problem.link, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Extract question content - look for the actual question text
      const questionData = await page.evaluate(() => {
        // Try to find the question text in the __Latex__ span
        const latexSpan = document.querySelector('span.__Latex__');
        
        if (latexSpan) {
          const html = latexSpan.innerHTML;
          const text = latexSpan.textContent || '';
          
          // Check for LaTeX/Math
          const hasLatex = html.includes('katex') || 
                          html.includes('mathjax') ||
                          html.includes('math-inline') ||
                          html.includes('math-display');

          return {
            html,
            text: text.trim(),
            hasLatex,
          };
        }

        // Fallback: look for the main question div
        const questionDiv = document.querySelector('div.mb-8');
        if (questionDiv) {
          const html = questionDiv.innerHTML;
          const text = questionDiv.textContent || '';
          const hasLatex = html.includes('katex');
          
          return {
            html,
            text: text.trim(),
            hasLatex,
          };
        }

        // Last resort: return error
        return {
          html: '',
          text: 'ERROR: Could not find question content',
          hasLatex: false,
        };
      });

      results.push({
        name: problem.name,
        link: problem.link,
        difficulty: problem.difficulty,
        tags: problem.tags || [],
        questionText: questionData.text,
        questionHtml: questionData.html,
        hasLatex: questionData.hasLatex,
        scrapedAt: new Date().toISOString(),
      });

      console.log(`   ✅ Scraped (${questionData.text.length} chars, LaTeX: ${questionData.hasLatex})`);
      
      await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (error) {
      console.error(`   ❌ Error: ${error}`);
      results.push({
        name: problem.name,
        link: problem.link,
        difficulty: problem.difficulty,
        tags: problem.tags || [],
        questionText: 'ERROR: Could not scrape',
        questionHtml: '',
        hasLatex: false,
        scrapedAt: new Date().toISOString(),
      });
    }
  }

  await browser.close();

  // Save results
  await writeFile(
    'question-content-with-login.json',
    JSON.stringify(results, null, 2),
    'utf-8'
  );

  console.log('\n' + '='.repeat(60));
  console.log('✅ Scraping complete!');
  console.log('='.repeat(60));
  console.log(`📊 Questions scraped: ${results.length}`);
  console.log(`📄 Saved to: question-content-with-login.json`);
  console.log('='.repeat(60));

  // Show summary
  console.log('\n📊 Summary:');
  results.forEach((q, i) => {
    console.log(`\n${i + 1}. ${q.name}`);
    console.log(`   Difficulty: ${q.difficulty}`);
    console.log(`   Tags: ${q.tags.join(', ')}`);
    console.log(`   Text length: ${q.questionText.length} chars`);
    console.log(`   Has LaTeX: ${q.hasLatex}`);
    if (q.questionText.length > 0 && !q.questionText.includes('ERROR')) {
      console.log(`   Preview: ${q.questionText.substring(0, 150)}...`);
    }
  });
}

scrapeWithLogin(5);

