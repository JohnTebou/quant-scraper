/**
 * Scrape actual question content from QuantGuide question pages
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

async function scrapeQuestionContent(limit: number = 5) {
  console.log(`🔍 Scraping question content for first ${limit} questions...\n`);

  // Load existing scraped problems
  const data = await readFile('scraped-problems.json', 'utf-8');
  const problems: ScrapedProblem[] = JSON.parse(data);
  
  const questionsToScrape = problems.slice(0, limit);
  console.log(`📋 Will scrape ${questionsToScrape.length} questions\n`);

  // Load cookies
  const cookiesData = await readFile('cookies.json', 'utf-8');
  const cookies = JSON.parse(cookiesData);

  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    defaultViewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();

  // Set cookies for authentication
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
      console.log(`⚠️  Could not set cookie ${cookie.name}`);
    }
  }

  const results: QuestionContent[] = [];

  for (let i = 0; i < questionsToScrape.length; i++) {
    const problem = questionsToScrape[i];
    console.log(`\n[${i + 1}/${questionsToScrape.length}] Scraping: ${problem.name}`);
    console.log(`   URL: ${problem.link}`);

    try {
      await page.goto(problem.link, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for question content to load
      await page.waitForSelector('body', { timeout: 5000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract question content
      const questionData = await page.evaluate(() => {
        // Try to find the question content container
        // Common selectors for question content
        const selectors = [
          '[class*="question"]',
          '[class*="problem"]',
          '[class*="content"]',
          'main',
          'article',
        ];

        let questionElement = null;
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.textContent || '';
            // Look for substantial content (more than 50 chars)
            if (text.length > 50 && !text.includes('Log In') && !text.includes('Sign Up')) {
              questionElement = el;
              break;
            }
          }
          if (questionElement) break;
        }

        if (!questionElement) {
          questionElement = document.querySelector('body');
        }

        const html = questionElement?.innerHTML || '';
        const text = questionElement?.textContent || '';

        // Check for LaTeX indicators
        const hasLatex = html.includes('\\') || 
                        html.includes('katex') || 
                        html.includes('mathjax') ||
                        html.includes('math-inline') ||
                        html.includes('math-display');

        return {
          html,
          text: text.trim(),
          hasLatex,
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
      
      // Brief pause between requests
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`   ❌ Error scraping ${problem.name}:`, error);
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
    'question-content-sample.json',
    JSON.stringify(results, null, 2),
    'utf-8'
  );

  console.log('\n' + '='.repeat(60));
  console.log('✅ Scraping complete!');
  console.log('='.repeat(60));
  console.log(`📊 Questions scraped: ${results.length}`);
  console.log(`📄 Saved to: question-content-sample.json`);
  console.log('='.repeat(60));

  // Show summary
  console.log('\n📊 Summary:');
  results.forEach((q, i) => {
    console.log(`\n${i + 1}. ${q.name}`);
    console.log(`   Difficulty: ${q.difficulty}`);
    console.log(`   Tags: ${q.tags.join(', ')}`);
    console.log(`   Text length: ${q.questionText.length} chars`);
    console.log(`   Has LaTeX: ${q.hasLatex}`);
    console.log(`   Preview: ${q.questionText.substring(0, 100)}...`);
  });
}

scrapeQuestionContent(5);






