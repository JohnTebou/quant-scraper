/**
 * Diagnose pagination issue
 */

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

async function diagnosePagination() {
  console.log("🔍 Diagnosing pagination...\n");

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

    // Click login
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const loginBtn = buttons.find(btn => btn.textContent?.toLowerCase().includes('log in'));
      if (loginBtn) (loginBtn as HTMLElement).click();
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click Google
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const googleBtn = buttons.find(btn => btn.textContent?.toLowerCase().includes('google'));
      if (googleBtn) (googleBtn as HTMLElement).click();
    });

    console.log("\n⏸️  PLEASE LOG IN AND NAVIGATE TO QUESTIONS PAGE");
    console.log("   Press ENTER when ready\n");
    
    await new Promise<void>((resolve) => {
      process.stdin.once('data', () => resolve());
    });

    console.log("\n✅ Starting diagnosis...\n");

    // Get page info
    const pageInfo = await page.evaluate(() => {
      const pageText = document.body.innerText.match(/Page\s+(\d+)\s*\/\s*(\d+)/);
      const resultsText = document.body.innerText.match(/Results:\s*(\d+)/);
      const questionLinks = document.querySelectorAll('a[href^="/questions/"]').length;
      
      // Find pagination buttons
      const allButtons = Array.from(document.querySelectorAll('button'));
      const buttonInfo = allButtons.map(btn => ({
        text: btn.textContent?.trim() || '',
        disabled: btn.hasAttribute('disabled'),
        hasSVG: !!btn.querySelector('svg'),
        classes: btn.className,
      }));
      
      return {
        currentPage: pageText ? parseInt(pageText[1]) : null,
        totalPages: pageText ? parseInt(pageText[2]) : null,
        totalResults: resultsText ? parseInt(resultsText[1]) : null,
        questionsOnPage: questionLinks,
        totalButtons: allButtons.length,
        buttons: buttonInfo,
      };
    });

    console.log("📊 Current Page State:");
    console.log(`   Page: ${pageInfo.currentPage} / ${pageInfo.totalPages}`);
    console.log(`   Total Results: ${pageInfo.totalResults}`);
    console.log(`   Questions visible: ${pageInfo.questionsOnPage}`);
    console.log(`   Total buttons: ${pageInfo.totalButtons}\n`);

    console.log("🔘 Button Analysis:");
    pageInfo.buttons.forEach((btn, i) => {
      if (btn.hasSVG || btn.text.includes('→') || btn.text.includes('←')) {
        console.log(`   ${i}: "${btn.text}" | Disabled: ${btn.disabled} | Has SVG: ${btn.hasSVG}`);
      }
    });

    // Get first question
    const firstQuestion = await page.evaluate(() => {
      const firstLink = document.querySelector('a[href^="/questions/"]');
      return firstLink?.getAttribute('href') || 'none';
    });
    console.log(`\n📝 First question: ${firstQuestion}`);

    // Try to click next button
    console.log("\n🔘 Attempting to click next button...");
    
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      
      // Strategy 1: Find by SVG path
      for (const btn of buttons) {
        const svg = btn.querySelector('svg');
        if (svg) {
          const path = svg.querySelector('path');
          const d = path?.getAttribute('d');
          if (d && d.includes('16.28 11.47')) {
            console.log('Found next button by SVG path');
            if (!btn.hasAttribute('disabled')) {
              (btn as HTMLElement).click();
              return { success: true, method: 'SVG path' };
            } else {
              return { success: false, method: 'SVG path', reason: 'disabled' };
            }
          }
        }
      }
      
      // Strategy 2: Find pagination container
      const pageTexts = Array.from(document.querySelectorAll('p'));
      const paginationPara = pageTexts.find(p => p.textContent?.match(/Page\s+\d+\s*\/\s*\d+/));
      
      if (paginationPara) {
        let container = paginationPara.parentElement;
        while (container && !container.querySelector('button')) {
          container = container.parentElement;
        }
        
        if (container) {
          const containerButtons = Array.from(container.querySelectorAll('button'));
          console.log(`Found ${containerButtons.length} buttons in pagination container`);
          
          // Last button should be next
          const lastBtn = containerButtons[containerButtons.length - 1];
          if (lastBtn && !lastBtn.hasAttribute('disabled')) {
            (lastBtn as HTMLElement).click();
            return { success: true, method: 'Last button in container' };
          }
        }
      }
      
      return { success: false, method: 'none', reason: 'not found' };
    });

    console.log(`   Result: ${clicked.success ? '✅ Clicked' : '❌ Failed'}`);
    console.log(`   Method: ${clicked.method}`);
    if (!clicked.success) {
      console.log(`   Reason: ${clicked.reason || 'unknown'}`);
    }

    if (clicked.success) {
      console.log("\n⏳ Waiting 5 seconds for page to change...");
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if page changed
      const firstQuestionAfter = await page.evaluate(() => {
        const firstLink = document.querySelector('a[href^="/questions/"]');
        return firstLink?.getAttribute('href') || 'none';
      });

      const pageInfoAfter = await page.evaluate(() => {
        const pageText = document.body.innerText.match(/Page\s+(\d+)\s*\/\s*(\d+)/);
        return pageText ? parseInt(pageText[1]) : null;
      });

      console.log(`\n📝 First question after: ${firstQuestionAfter}`);
      console.log(`📊 Page number after: ${pageInfoAfter}`);
      
      if (firstQuestion !== firstQuestionAfter) {
        console.log("\n✅ SUCCESS! Page changed!");
      } else {
        console.log("\n❌ FAILED! Page did NOT change!");
        console.log("   Same first question before and after click");
      }
    }

    console.log("\n\n⏸️  Browser will stay open for inspection. Press ENTER to close.");
    await new Promise<void>((resolve) => {
      process.stdin.once('data', () => resolve());
    });

  } finally {
    await browser.close();
  }
}

diagnosePagination();






