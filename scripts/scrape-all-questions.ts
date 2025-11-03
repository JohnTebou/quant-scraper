// This beast scrapes every single question with Google login
// Grab a coffee - it takes about 1-2 hours for all 1200+ questions

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { readFile, writeFile } from 'fs/promises';
import type { ScrapedProblem } from '../src/lib/scraper';

puppeteer.use(StealthPlugin());

interface QuestionContent {
  name: string;
  link: string;
  url_ending: string;
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

async function scrapeAllQuestions() {
  console.log(`🔍 Scraping ALL question content with Google login...\n`);

  // Load existing scraped problems
  const data = await readFile('scraped-problems.json', 'utf-8');
  const problems: ScrapedProblem[] = JSON.parse(data);
  
  console.log(`📋 Total questions to scrape: ${problems.length}\n`);
  console.log(`⏱️  Estimated time: ${Math.ceil(problems.length * 4.5 / 60)} minutes\n`);

  const browser = await puppeteer.launch({
    headless: false, // Show browser like the working version
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Time to login - first stop is the main page
  console.log('🔐 Step 1: Heading to QuantGuide...');
  await page.goto('https://quantguide.io', { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('🔐 Step 2: Finding that login button...');
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
  const googlePage = pages[pages.length - 1];

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
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    const urlEnding = problem.link.split('/').pop() || '';

    console.log(`[${i + 1}/${problems.length}] Scraping: ${problem.name}`);
    console.log(`   URL: ${problem.link}`);

    if ((i + 1) % 50 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${problems.length} (${Math.round((i + 1) / problems.length * 100)}%)`);
      console.log(`   ✅ Success: ${successCount} | ❌ Errors: ${errorCount}`);
      console.log(`   ⏱️  Estimated time remaining: ${Math.ceil((problems.length - i - 1) * 4.5 / 60)} minutes\n`);
    }

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
        url_ending: urlEnding,
        difficulty: problem.difficulty,
        tags: problem.tags || [],
        questionText: questionData.text,
        questionHtml: questionData.html,
        hasLatex: questionData.hasLatex,
        scrapedAt: new Date().toISOString(),
      });

      console.log(`   ✅ Scraped (${questionData.text.length} chars, LaTeX: ${questionData.hasLatex})`);
      
      successCount++;
      
      await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (error) {
      console.error(`   ❌ Error: ${error}`);
      results.push({
        name: problem.name,
        link: problem.link,
        url_ending: urlEnding,
        difficulty: problem.difficulty,
        tags: problem.tags || [],
        questionText: 'ERROR: Could not scrape',
        questionHtml: '',
        hasLatex: false,
        scrapedAt: new Date().toISOString(),
      });
      errorCount++;
    }

    // Save progress every 100 questions
    if ((i + 1) % 100 === 0) {
      await writeFile(
        'all-questions-content.json',
        JSON.stringify(results, null, 2),
        'utf-8'
      );
      console.log(`   💾 Progress saved to all-questions-content.json`);
    }
  }

  await browser.close();

  // Final save
  await writeFile(
    'all-questions-content.json',
    JSON.stringify(results, null, 2),
    'utf-8'
  );

  console.log('\n' + '='.repeat(60));
  console.log('✅ Scraping complete!');
  console.log('='.repeat(60));
  console.log(`📊 Total questions: ${results.length}`);
  console.log(`✅ Successfully scraped: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📄 Saved to: all-questions-content.json`);
  console.log('='.repeat(60));

  // Statistics
  const withLatex = results.filter(q => q.hasLatex).length;
  const avgLength = Math.round(results.reduce((sum, q) => sum + q.questionText.length, 0) / results.length);
  
  console.log('\n📊 Statistics:');
  console.log(`   Questions with LaTeX: ${withLatex} (${Math.round(withLatex / results.length * 100)}%)`);
  console.log(`   Average question length: ${avgLength} characters`);
}

scrapeAllQuestions();

