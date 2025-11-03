/**
 * Try to find ALL questions including premium ones
 */

import puppeteer from "puppeteer";
import { readFile, writeFile } from "fs/promises";

async function findAllQuestions() {
  console.log("🔍 Searching for all questions including premium...\n");

  let cookies: Array<{ name: string; value: string; domain?: string }> = [];
  try {
    const cookiesData = await readFile("cookies.json", "utf-8");
    cookies = JSON.parse(cookiesData);
  } catch (e) {
    console.error("Could not load cookies.json");
    return;
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    );

    // Set cookies
    for (const cookie of cookies) {
      try {
        const cookieData: any = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain || 'quantguide.io',
          path: '/',
        };
        
        if (cookie.name.startsWith('__Secure-') || cookie.name.startsWith('__Host-')) {
          cookieData.secure = true;
          cookieData.url = 'https://quantguide.io';
        }
        
        await page.setCookie(cookieData);
      } catch (e) {
        // Ignore
      }
    }

    // Listen for network requests to find API calls
    const apiCalls: Array<{ url: string; response: any }> = [];
    
    page.on('response', async (response) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      // Look for API calls or JSON responses
      if (url.includes('/api/') || url.includes('questions') && contentType.includes('json')) {
        try {
          const data = await response.json();
          apiCalls.push({ url, response: data });
          console.log(`📡 Found API call: ${url}`);
        } catch (e) {
          // Not JSON
        }
      }
    });

    console.log("Navigating to questions page...\n");
    await page.goto("https://quantguide.io/questions", {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Try to extract from window object or React state
    const allQuestionsData = await page.evaluate(() => {
      // Try to find React Fiber or Next.js data
      const scripts = Array.from(document.querySelectorAll('script'));
      
      // Look for __NEXT_DATA__
      const nextDataScript = document.getElementById('__NEXT_DATA__');
      if (nextDataScript && nextDataScript.textContent) {
        try {
          const data = JSON.parse(nextDataScript.textContent);
          return { source: '__NEXT_DATA__', data };
        } catch (e) {
          // Failed to parse
        }
      }
      
      // Try window.__NEXT_DATA__
      if ((window as any).__NEXT_DATA__) {
        return { source: 'window.__NEXT_DATA__', data: (window as any).__NEXT_DATA__ };
      }
      
      // Try to find React root
      const root = document.getElementById('__next') || document.getElementById('root');
      if (root) {
        const fiberKey = Object.keys(root).find(key => key.startsWith('__reactFiber'));
        if (fiberKey) {
          return { source: 'React Fiber', data: 'Found but cannot serialize' };
        }
      }
      
      return { source: 'none', data: null };
    });

    console.log(`\n📦 Data source: ${allQuestionsData.source}`);
    
    if (allQuestionsData.data) {
      // Save the data for inspection
      await writeFile('next-data-dump.json', JSON.stringify(allQuestionsData.data, null, 2));
      console.log('✅ Saved data to next-data-dump.json');
      
      // Try to find questions in the data
      const findQuestions = (obj: any, path = ''): any[] => {
        if (!obj || typeof obj !== 'object') return [];
        
        if (Array.isArray(obj) && obj.length > 0 && obj[0]?.id && obj[0]?.title) {
          console.log(`\n🎯 Found questions array at: ${path}`);
          console.log(`   Length: ${obj.length}`);
          return obj;
        }
        
        let results: any[] = [];
        for (const key in obj) {
          const found = findQuestions(obj[key], path ? `${path}.${key}` : key);
          if (found.length > 0) results = results.concat(found);
        }
        return results;
      };
      
      const questions = findQuestions(allQuestionsData.data);
      if (questions.length > 0) {
        console.log(`\n✅ Found ${questions.length} questions in data!`);
        console.log('\nSample questions:');
        questions.slice(0, 5).forEach((q: any, i: number) => {
          console.log(`${i + 1}. ${q.title || q.name} (${q.difficulty})`);
        });
      }
    }

    console.log(`\n📡 API calls captured: ${apiCalls.length}`);
    if (apiCalls.length > 0) {
      await writeFile('api-calls.json', JSON.stringify(apiCalls, null, 2));
      console.log('✅ Saved API calls to api-calls.json');
    }

  } finally {
    await browser.close();
  }
}

findAllQuestions();







