/**
 * Detailed debug script to check premium question access
 */

import puppeteer from "puppeteer";
import { readFile } from "fs/promises";
import * as cheerio from "cheerio";

async function debugPremium() {
  console.log("🔍 Debugging premium question access...\n");

  let cookies: Array<{ name: string; value: string; domain?: string }> = [];
  try {
    const cookiesData = await readFile("cookies.json", "utf-8");
    cookies = JSON.parse(cookiesData);
    console.log(`✅ Loaded ${cookies.length} cookies\n`);
  } catch (e) {
    console.error("Could not load cookies.json");
    return;
  }

  const browser = await puppeteer.launch({
    headless: false, // Show browser so you can see what's happening
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    );

    // Set all cookies
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
        console.warn(`   ⚠️  Could not set cookie ${cookie.name}`);
      }
    }

    console.log("Navigating to questions page...\n");
    await page.goto("https://quantguide.io/questions", {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check what we can see
    const pageInfo = await page.evaluate(() => {
      // Count total question links
      const allLinks = Array.from(document.querySelectorAll('a[href^="/questions/"]'));
      const uniqueLinks = new Set(allLinks.map(a => a.getAttribute('href')));
      
      // Look for pagination info
      const paginationText = document.body.innerText.match(/Page\s+(\d+)\s*\/\s*(\d+)/);
      const resultsText = document.body.innerText.match(/Results:\s*(\d+)/);
      
      // Look for premium indicators
      const premiumElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent || '';
        return text.includes('Premium') || text.includes('Upgrade') || text.includes('Pro');
      });
      
      // Check for lock icons
      const lockIcons = document.querySelectorAll('img[alt*="lock"], img[src*="lock"], svg[class*="lock"]');
      
      // Get all visible text to check for premium messaging
      const bodyText = document.body.innerText;
      
      return {
        uniqueQuestionLinks: uniqueLinks.size,
        totalLinks: allLinks.length,
        currentPage: paginationText ? parseInt(paginationText[1]) : null,
        totalPages: paginationText ? parseInt(paginationText[2]) : null,
        totalResults: resultsText ? parseInt(resultsText[1]) : null,
        premiumElementsCount: premiumElements.length,
        lockIconsCount: lockIcons.length,
        hasPremiumText: bodyText.includes('Premium'),
        hasUpgradeText: bodyText.includes('Upgrade'),
      };
    });

    console.log("📊 Page Analysis:");
    console.log("=".repeat(60));
    console.log(`Question links on page: ${pageInfo.uniqueQuestionLinks}`);
    console.log(`Total results shown: ${pageInfo.totalResults || 'Unknown'}`);
    console.log(`Current page: ${pageInfo.currentPage || 1} / ${pageInfo.totalPages || 'Unknown'}`);
    console.log(`Premium elements found: ${pageInfo.premiumElementsCount}`);
    console.log(`Lock icons found: ${pageInfo.lockIconsCount}`);
    console.log(`Has "Premium" text: ${pageInfo.hasPremiumText}`);
    console.log(`Has "Upgrade" text: ${pageInfo.hasUpgradeText}`);

    // Get the HTML to analyze
    const html = await page.content();
    const $ = cheerio.load(html);
    
    // Count different types of question elements
    const allQuestionLinks = $('a[href^="/questions/"]');
    console.log(`\n📋 Question links in HTML: ${allQuestionLinks.length}`);
    
    // Check if there are any elements with "premium" or "locked" classes
    const premiumClasses = $('[class*="premium"], [class*="locked"], [class*="pro"]');
    console.log(`Elements with premium/locked classes: ${premiumClasses.length}`);

    // Sample some question links to see their structure
    console.log("\n📝 Sample question structures:");
    console.log("=".repeat(60));
    allQuestionLinks.slice(0, 10).each((i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const text = $el.text().trim().substring(0, 50);
      const parent = $el.parent();
      const parentClasses = parent.attr('class') || '';
      const hasLockIcon = parent.find('img[alt*="lock"], svg[class*="lock"]').length > 0;
      
      console.log(`\n${i + 1}. ${text}...`);
      console.log(`   Link: ${href}`);
      console.log(`   Parent classes: ${parentClasses}`);
      console.log(`   Has lock icon: ${hasLockIcon}`);
    });

    console.log("\n\n⏳ Browser will stay open for 60 seconds for manual inspection...");
    console.log("   Check if you can see premium questions with lock icons");
    console.log("   Check the pagination - does it show all 1211 results?");
    await new Promise(resolve => setTimeout(resolve, 60000));

  } finally {
    await browser.close();
  }
}

debugPremium();







