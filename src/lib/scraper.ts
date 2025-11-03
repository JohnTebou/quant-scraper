import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

export interface ScrapedProblem {
  name: string;
  link: string;
  difficulty: "Easy" | "Medium" | "Hard" | "Unknown";
  tags?: string[];
}

// Grab HTML from any URL - pretty straightforward
async function fetchHTML(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }

  return await response.text();
}

// Figure out if a question is Easy/Medium/Hard from whatever text we can find
function parseDifficulty(text: string | undefined, classes: string | undefined): ScrapedProblem["difficulty"] {
  if (!text && !classes) return "Unknown";

  const combined = `${text || ""} ${classes || ""}`.toLowerCase();

  if (combined.includes("easy") || combined.includes("beginner")) {
    return "Easy";
  }
  if (combined.includes("medium") || combined.includes("intermediate")) {
    return "Medium";
  }
  if (combined.includes("hard") || combined.includes("advanced") || combined.includes("expert")) {
    return "Hard";
  }

  return "Unknown";
}

/**
 * Scrapes problems from quantguide.io
 * This function will need to be adjusted based on the actual HTML structure of the site
 */
interface QuestionData {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  topic: string;
  urlEnding: string;
  tags?: Array<{ tag: string }>;
  isPremium?: boolean;
}

// Pull out all the questions from whatever page we're looking at
async function extractQuestionsFromCurrentPage(page: any): Promise<QuestionData[]> {
  const html = await page.content();
  const $ = cheerio.load(html);
  const questions: QuestionData[] = [];
  const seenIds = new Set<string>();
  
  // We're hunting for question cards, not just links
  // Some premium questions are sneaky and don't have clickable links
  
  // Look for divs that smell like question cards
  // Usually they have a bunch of <p> tags with the good stuff
  $('div').each((_index: number, element: cheerio.Element) => {
    const $element = $(element);
    const paragraphs = $element.find('> p, p');
    
    // Need at least 3 paragraphs to be a real question card
    if (paragraphs.length < 3) return;
    
    // Now let's hunt for the actual link to this question
    let href = $element.find('a[href^="/questions/"]').attr('href');
    
    // If no link, check if this div itself is a link or has a parent link
    if (!href) {
      const parentLink = $element.closest('a[href^="/questions/"]');
      if (parentLink.length > 0) {
        href = parentLink.attr('href');
      }
    }
    
    // If still no link, try to extract from any data attributes or nearby elements
    if (!href) {
      // Look for siblings or nearby elements with links
      const nearbyLink = $element.siblings('a[href^="/questions/"]').first();
      if (nearbyLink.length > 0) {
        href = nearbyLink.attr('href');
      }
    }
    
    if (!href) return;
    
    const urlParts = href.split('/');
    const urlEnding = urlParts[urlParts.length - 1];
    
    // Skip if we've already seen this question
    if (seenIds.has(urlEnding)) return;
    
    // Skip if this looks like a navigation link or empty
    if (!urlEnding || urlEnding.length < 3) return;
    
    seenIds.add(urlEnding);
    
    // Get name from the link - try multiple strategies
    let name = '';
    
    // Strategy 1: Look for <p> tags within the link or parent
    const paragraphs = $element.find('p');
    if (paragraphs.length > 0) {
      // First <p> is usually the name
      name = paragraphs.eq(0).text().trim();
    }
    
    // Strategy 2: If no name, try getting from href
    if (!name || name.length < 2) {
      name = urlEnding.split('-').map((word: string) => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    }
    
    // Skip if name looks like navigation (Log In, Sign Up, etc.)
    const navigationWords = ['log in', 'sign up', 'login', 'signup', 'questions', 'mental math', 'discussion', 'pricing'];
    if (navigationWords.some(word => name.toLowerCase().includes(word))) {
      seenIds.delete(urlEnding); // Remove from seen so we don't skip real questions
      return;
    }
    
    // Get difficulty - it's usually the 3rd <p> or last one
    let difficulty: "easy" | "medium" | "hard" = "easy";
    if (paragraphs.length >= 3) {
      const difficultyText = paragraphs.eq(2).text().trim().toLowerCase();
      if (difficultyText.includes('hard')) difficulty = "hard";
      else if (difficultyText.includes('medium')) difficulty = "medium";
    } else {
      // Try finding difficulty anywhere in the element
      const allText = $element.text().toLowerCase();
      if (allText.includes('hard')) difficulty = "hard";
      else if (allText.includes('medium')) difficulty = "medium";
    }
    
    // Get topic/tag - usually the 2nd <p>
    let topicText = '';
    if (paragraphs.length >= 2) {
      topicText = paragraphs.eq(1).text().trim();
    }
    
    questions.push({
      id: urlEnding,
      title: name,
      difficulty,
      topic: topicText,
      urlEnding,
    });
  });
  
  // Also try extracting from any div containers that might have question data
  $('div').each((_index: number, element: cheerio.Element) => {
    const $element = $(element);
    const link = $element.find('a[href^="/questions/"]').first();
    if (link.length > 0) {
      const href = link.attr('href');
      if (href) {
        const urlParts = href.split('/');
        const urlEnding = urlParts[urlParts.length - 1];
        
        if (!seenIds.has(urlEnding)) {
          seenIds.add(urlEnding);
          
          const paragraphs = $element.find('p');
          let name = paragraphs.eq(0).text().trim();
          if (!name) {
            name = urlEnding.split('-').map((word: string) => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
          }
          
          let difficulty: "easy" | "medium" | "hard" = "easy";
          const allText = $element.text().toLowerCase();
          if (allText.includes('hard')) difficulty = "hard";
          else if (allText.includes('medium')) difficulty = "medium";
          
          const topicText = paragraphs.eq(1).text().trim();
          
          questions.push({
            id: urlEnding,
            title: name,
            difficulty,
            topic: topicText,
            urlEnding,
          });
        }
      }
    }
  });
  
  // Remove duplicates based on id (shouldn't be needed but safety check)
  const uniqueQuestions = Array.from(
    new Map(questions.map(q => [q.id, q])).values()
  );
  
  return uniqueQuestions;
}

/**
 * Extracts questions data directly from the page using Puppeteer
 */
async function extractQuestionsWithPuppeteer(url: string, cookies?: Array<{ name: string; value: string; domain?: string }>): Promise<QuestionData[]> {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );
    
    // Set cookies if provided (for authentication)
    if (cookies && cookies.length > 0) {
      console.log(`Setting ${cookies.length} cookies for authentication...`);
      for (const cookie of cookies) {
        try {
          const cookieData: any = {
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain || 'quantguide.io',
            path: '/',
          };
          
          // Secure cookies need special handling
          if (cookie.name.startsWith('__Secure-') || cookie.name.startsWith('__Host-')) {
            cookieData.secure = true;
            cookieData.url = 'https://quantguide.io';
          }
          
          await page.setCookie(cookieData);
        } catch (e) {
          console.warn(`   ⚠️  Could not set cookie ${cookie.name}:`, e instanceof Error ? e.message : 'Unknown error');
        }
      }
    }
    
    console.log(`Navigating to ${url}...`);
    
    // Listen for ALL network requests - questions might be embedded in JS bundles
    const questionDataRequests: Array<{ url: string; text: string }> = [];
    page.on('response', async (response) => {
      const responseUrl = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      // Check for JSON responses OR large JavaScript files that might contain embedded data
      if (responseUrl.includes('_next/data') || 
          responseUrl.includes('/api/') || 
          contentType.includes('application/json') ||
          (responseUrl.includes('questions') && (contentType.includes('json') || contentType.includes('javascript'))) ||
          (contentType.includes('javascript') && responseUrl.includes('page'))) {
        try {
          const text = await response.text();
          // Look for embedded JSON data in JavaScript - check for questions array pattern
          // The data might be embedded as a string constant in the JS bundle
          if (text.includes('"questions"') || 
              (text.includes('"id"') && text.includes('"title"') && text.includes('"difficulty"') && text.length > 100000)) {
            console.log(`📡 Found potential data in: ${responseUrl}`);
            console.log(`   Size: ${text.length} chars, Content-Type: ${contentType}`);
            questionDataRequests.push({ url: responseUrl, text });
          }
        } catch (e) {
          // Ignore - response might already be consumed
        }
      }
    });
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait longer for API calls to complete - Next.js might load data after initial render
    console.log("Waiting for dynamic content to load...");
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Check for pagination and collect all questions from all pages
    const allQuestions: QuestionData[] = [];
    let currentPage = 1;
    let totalPages = 1;
    
    // Get total pages from the page
    try {
      const pageInfo = await page.evaluate(() => {
        const pageText = document.body.innerText.match(/Page\s+(\d+)\s*\/\s*(\d+)/);
        if (pageText) {
          return { current: parseInt(pageText[1]), total: parseInt(pageText[2]) };
        }
        return null;
      });
      
      if (pageInfo) {
        totalPages = pageInfo.total;
        currentPage = pageInfo.current;
        console.log(`📄 Found pagination: Page ${currentPage} of ${totalPages}`);
      }
    } catch (e) {
      console.warn("Could not detect pagination, assuming single page");
    }
    
    // Collect questions from all pages
    while (currentPage <= totalPages) {
      console.log(`\n📖 Scraping page ${currentPage}/${totalPages}...`);
      
      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Extract questions from current page
      const pageQuestions = await extractQuestionsFromCurrentPage(page);
      if (pageQuestions.length > 0) {
        console.log(`   ✅ Found ${pageQuestions.length} questions on page ${currentPage}`);
        allQuestions.push(...pageQuestions);
      } else {
        console.warn(`   ⚠️  No questions found on page ${currentPage}`);
      }
      
      // If we're not on the last page, navigate to next
      if (currentPage < totalPages) {
        try {
          // Get the current question IDs to verify page change
          const questionsBefore = pageQuestions.map(q => q.id);
          
          // Find and click the next button - be very specific
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
            // or the second button (after the left arrow)
            let nextButton = null;
            
            for (let i = buttons.length - 1; i >= 0; i--) {
              const btn = buttons[i];
              if (btn.disabled) continue;
              
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
              if (nextButton.disabled) {
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
            const questionsAfter = await extractQuestionsFromCurrentPage(page);
            const questionsAfterIds = questionsAfter.map(q => q.id);
            
            // Check if we have different questions
            const hasNewQuestions = questionsAfterIds.some(id => !questionsBefore.includes(id));
            
            // Debug: Show which questions we're seeing
            console.log(`   📋 Before: ${questionsBefore.slice(0, 3).join(', ')}...`);
            console.log(`   📋 After:  ${questionsAfterIds.slice(0, 3).join(', ')}...`);
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
    
    if (allQuestions.length > 0) {
      console.log(`\n✅ Collected ${allQuestions.length} questions from ${currentPage} page(s)`);
      return allQuestions;
    }
    
    // Fallback: Try scrolling to trigger lazy loading if any
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if we got data from network requests first
    console.log(`Checking ${questionDataRequests.length} network responses...`);
    for (const { url: requestUrl, text: dataText } of questionDataRequests) {
      try {
        // First try parsing as pure JSON
        if (!dataText.includes('function') && !dataText.includes('export') && !dataText.includes('=>')) {
          console.log(`   Attempting to parse as JSON: ${requestUrl}`);
          const data = JSON.parse(dataText);
          const findQuestions = (obj: any): QuestionData[] | null => {
            if (Array.isArray(obj) && obj.length > 0 && obj[0]?.id && obj[0]?.title && obj[0]?.difficulty) {
              return obj;
            }
            if (typeof obj === 'object' && obj !== null) {
              if (obj.questions && Array.isArray(obj.questions) && obj.questions.length > 0) {
                return obj.questions;
              }
              if (obj.pageProps?.questions) {
                return obj.pageProps.questions;
              }
              if (obj.props?.pageProps?.questions) {
                return obj.props.pageProps.questions;
              }
              for (const key in obj) {
                const result = findQuestions(obj[key]);
                if (result) return result;
              }
            }
            return null;
          };
          const questions = findQuestions(data);
          if (questions && questions.length > 0) {
            console.log(`✅ Extracted ${questions.length} questions from JSON: ${requestUrl}`);
            return questions;
          }
        }
        
        // Try extracting embedded JSON from JavaScript bundle
        console.log(`   Attempting to extract embedded JSON from JS: ${requestUrl}`);
        // Look for JSON-like patterns in the JavaScript
        // Try to find a large JSON object/array embedded as a string or constant
        const jsonPatterns = [
          /"questions"\s*:\s*\[([\s\S]{100000,}?)\]/g,
          /JSON\.parse\(['"]([\s\S]{100000,}?)['"]\)/g,
          /\{[\s\S]*"questions"[\s\S]{100000,}?\}/g,
        ];
        
        for (const pattern of jsonPatterns) {
          const matches = [...dataText.matchAll(pattern)];
          for (const match of matches) {
            try {
              // Try to extract and parse the JSON
              let jsonStr = match[1] || match[0];
              // If it's escaped, try to unescape
              if (jsonStr.includes('\\"')) {
                jsonStr = jsonStr.replace(/\\"/g, '"').replace(/\\n/g, '\n');
              }
              // Try to find the complete array/object
              const arrayStart = jsonStr.indexOf('[');
              if (arrayStart > -1) {
                let bracketCount = 0;
                let arrayEnd = arrayStart;
                for (let i = arrayStart; i < jsonStr.length; i++) {
                  if (jsonStr[i] === '[') bracketCount++;
                  if (jsonStr[i] === ']') bracketCount--;
                  if (bracketCount === 0) {
                    arrayEnd = i + 1;
                    break;
                  }
                }
                const arrayStr = jsonStr.substring(arrayStart, arrayEnd);
                const questions = JSON.parse(arrayStr);
                if (Array.isArray(questions) && questions.length > 0 && questions[0]?.id) {
                  console.log(`✅ Extracted ${questions.length} questions from embedded JSON in JS: ${requestUrl}`);
                  return questions;
                }
              }
            } catch (e) {
              // Continue trying other patterns
            }
          }
        }
        
        console.log(`   No questions found in: ${requestUrl}`);
      } catch (e) {
        console.log(`   Failed to parse ${requestUrl}:`, e instanceof Error ? e.message : 'Unknown error');
      }
    }
    
    // Try to get the Next.js build ID and fetch the data route directly
    console.log("Attempting to fetch Next.js data route...");
    try {
      const buildId = await page.evaluate(() => {
        // Try to find build ID from script tags or window
        const scripts = document.querySelectorAll('script[src*="_next/static"]');
        if (scripts.length > 0) {
          const src = scripts[0].getAttribute('src') || '';
          const match = src.match(/_next\/static\/([^/]+)/);
          if (match) return match[1];
        }
        return null;
      });
      
      if (buildId) {
        console.log(`Found build ID: ${buildId}`);
        // Try Next.js data route
        const dataUrl = `${url}?_next/data/${buildId}/questions.json`;
        try {
          const response = await fetch(dataUrl);
          if (response.ok) {
            const data = await response.json();
            const findQuestions = (obj: any): QuestionData[] | null => {
              if (Array.isArray(obj) && obj.length > 0 && obj[0]?.id && obj[0]?.title && obj[0]?.difficulty) {
                return obj;
              }
              if (typeof obj === 'object' && obj !== null) {
                if (obj.questions && Array.isArray(obj.questions) && obj.questions.length > 0) {
                  return obj.questions;
                }
                if (obj.pageProps?.questions) {
                  return obj.pageProps.questions;
                }
                for (const key in obj) {
                  const result = findQuestions(obj[key]);
                  if (result) return result;
                }
              }
              return null;
            };
            const questions = findQuestions(data);
            if (questions && questions.length > 0) {
              console.log(`✅ Extracted ${questions.length} questions from Next.js data route`);
              return questions;
            }
          }
        } catch (e) {
          console.warn("Failed to fetch data route:", e);
        }
      }
    } catch (e) {
      console.warn("Failed to get build ID:", e);
    }
    
    // Try to extract from page's script tag after it's loaded
    console.log("Attempting to extract from rendered script tags...");
    try {
      const scriptContent = await page.evaluate(() => {
        const script = document.getElementById('__NEXT_DATA__');
        return script ? script.textContent : null;
      });
      
      if (scriptContent) {
        try {
          const nextData = JSON.parse(scriptContent);
          const findQuestions = (obj: any): QuestionData[] | null => {
            if (Array.isArray(obj) && obj.length > 0 && obj[0]?.id && obj[0]?.title && obj[0]?.difficulty) {
              return obj;
            }
            if (typeof obj === 'object' && obj !== null) {
              if (obj.questions && Array.isArray(obj.questions) && obj.questions.length > 0) {
                return obj.questions;
              }
              if (obj.pageProps?.questions) {
                return obj.pageProps.questions;
              }
              for (const key in obj) {
                const result = findQuestions(obj[key]);
                if (result) return result;
              }
            }
            return null;
          };
          const questions = findQuestions(nextData);
          if (questions && questions.length > 0) {
            console.log(`✅ Extracted ${questions.length} questions from script tag`);
            return questions;
          }
        } catch (e) {
          console.warn("Failed to parse script content:", e);
        }
      }
    } catch (e) {
      console.warn("Failed to get script content:", e);
    }
    
    // Get the rendered HTML and parse it on the Node.js side
    const html = await page.content();
    
    // Debug: Save HTML for inspection
    const fs = await import('fs/promises');
    await fs.writeFile('puppeteer-output.html', html);
    console.log("📄 Saved rendered HTML to puppeteer-output.html for inspection");
    
    // Try multiple patterns to find __NEXT_DATA__
    let nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/);
    
    // Try without quotes
    if (!nextDataMatch) {
      nextDataMatch = html.match(/<script[^>]*id=__NEXT_DATA__[^>]*>([\s\S]*?)<\/script>/);
    }
    
    // Try finding it by searching for the script tag more flexibly
    if (!nextDataMatch) {
      const scriptIdx = html.indexOf('id="__NEXT_DATA__"') || html.indexOf("id='__NEXT_DATA__'") || html.indexOf('id=__NEXT_DATA__');
      if (scriptIdx > -1) {
        const tagStart = html.lastIndexOf('<script', scriptIdx);
        const tagEnd = html.indexOf('</script>', scriptIdx);
        if (tagStart > -1 && tagEnd > -1) {
          const scriptContent = html.substring(tagStart, tagEnd);
          const contentMatch = scriptContent.match(/>([\s\S]+)$/);
          if (contentMatch) {
            nextDataMatch = [null, contentMatch[1]];
          }
        }
      }
    }
    
    // Also try searching for the questions array pattern directly in HTML
    const questionsPattern = /"questions"\s*:\s*\[([\s\S]{50000,}?)\]/;
    const questionsMatch = html.match(questionsPattern);
    
    if (nextDataMatch && nextDataMatch[1]) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        
        // Navigate through the data structure to find questions
        const findQuestions = (obj: any): QuestionData[] | null => {
          if (Array.isArray(obj) && obj.length > 0 && obj[0]?.id && obj[0]?.title && obj[0]?.difficulty) {
            return obj;
          }
          if (typeof obj === 'object' && obj !== null) {
            if (obj.questions && Array.isArray(obj.questions) && obj.questions.length > 0) {
              return obj.questions;
            }
            for (const key in obj) {
              const result = findQuestions(obj[key]);
              if (result) return result;
            }
          }
          return null;
        };
        
        const questions = findQuestions(nextData);
        if (questions && questions.length > 0) {
          console.log(`✅ Extracted ${questions.length} questions from __NEXT_DATA__`);
          return questions;
        }
      } catch (e) {
        console.warn("Failed to parse __NEXT_DATA__:", e);
      }
    }
    
    // Try parsing questions array directly if found
    if (questionsMatch && questionsMatch[1]) {
      try {
        // Try to extract the full array by counting brackets
        const arrayStart = questionsMatch.index! + questionsMatch[0].indexOf('[');
        let bracketCount = 0;
        let arrayEnd = arrayStart;
        for (let i = arrayStart; i < html.length; i++) {
          if (html[i] === '[') bracketCount++;
          if (html[i] === ']') bracketCount--;
          if (bracketCount === 0) {
            arrayEnd = i + 1;
            break;
          }
        }
        const arrayStr = html.substring(arrayStart, arrayEnd);
        const questions = JSON.parse(arrayStr);
        if (Array.isArray(questions) && questions.length > 0 && questions[0]?.id) {
          console.log(`✅ Extracted ${questions.length} questions from direct array match`);
          return questions;
        }
      } catch (e) {
        console.warn("Failed to parse questions array directly:", e);
      }
    }
    
    // Fallback: Return HTML for parsing
    return { html } as unknown as QuestionData[];
  } finally {
    await browser.close();
  }
}

export async function scrapeQuantGuideProblems(cookies?: Array<{ name: string; value: string; domain?: string }>): Promise<ScrapedProblem[]> {
  const baseUrl = "https://quantguide.io";
  const questionsUrl = `${baseUrl}/questions`;
  
  try {
    console.log(`Fetching from: ${questionsUrl}`);
    
    if (!cookies || cookies.length === 0) {
      console.warn("⚠️  No authentication cookies provided.");
      console.warn("    You'll only see public questions (~31).");
      console.warn("    To get all ~1211 questions, provide your session cookies.");
      console.warn("    See scripts/get-cookies.md for instructions.\n");
    } else {
      console.log("✅ Using provided cookies for authentication\n");
    }
    
    console.log("Using Puppeteer to extract questions data...");
    
    const result = await extractQuestionsWithPuppeteer(questionsUrl, cookies);
    
    // Check if we got questions directly
    if (Array.isArray(result) && result.length > 0 && result[0]?.id) {
      return convertQuestionsToProblems(result, baseUrl);
    }
    
    // Fallback: Try HTML parsing
    if (result && (result as any).html) {
      const html = (result as any).html;
      console.warn("⚠️  Could not extract questions from JavaScript context, trying HTML parsing...");
      return scrapeFromHTML(html, baseUrl);
    }
    
    // Last resort: Fetch HTML directly
    console.warn("⚠️  Could not extract questions with Puppeteer, falling back to HTML scraping...");
    const html = await fetchHTML(questionsUrl);
    return scrapeFromHTML(html, baseUrl);
  } catch (error) {
    console.error("Error scraping quantguide.io:", error);
    throw error;
  }
}

/**
 * Convert QuestionData array to ScrapedProblem array
 */
function convertQuestionsToProblems(questions: QuestionData[], baseUrl: string): ScrapedProblem[] {
  return questions.map((q: QuestionData) => {
    // Capitalize difficulty
    const difficultyMap: Record<string, ScrapedProblem["difficulty"]> = {
      easy: "Easy",
      medium: "Medium",
      hard: "Hard",
    };
    
    const difficulty = difficultyMap[q.difficulty.toLowerCase()] || "Unknown";
    
    // Extract tags - topic becomes a tag, plus any additional tags
    const tags: string[] = [];
    
    // Add topic as a tag (capitalize it)
    if (q.topic) {
      const topicTag = q.topic
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
      tags.push(topicTag);
    }
    
    // Add additional tags from the tags array
    if (q.tags && Array.isArray(q.tags)) {
      q.tags.forEach((tagObj) => {
        if (tagObj.tag && !tags.includes(tagObj.tag)) {
          tags.push(tagObj.tag);
        }
      });
    }
    
    return {
      name: q.title,
      link: `${baseUrl}/questions/${q.urlEnding}`,
      difficulty,
      tags: tags.length > 0 ? tags : undefined,
    };
  });
}

/**
 * Fallback function to scrape from HTML if JSON extraction fails
 */
function scrapeFromHTML(html: string, baseUrl: string): ScrapedProblem[] {
  try {
    const $ = cheerio.load(html);
    const problems: ScrapedProblem[] = [];

    // These selectors are placeholders - we'll need to inspect the actual site structure
    // Common patterns to look for:
    // - Problem list containers
    // - Problem links
    // - Difficulty indicators
    
    // Example: Find all problem links (adjust selectors based on actual site structure)
    $("a[href*='/questions/']").each((_index: number, element: cheerio.Element) => {
      const $element = $(element);
      const link = $element.attr("href");
      let name = $element.text().trim();
      
      if (!link || !name) return;

      // Try to find difficulty indicator (could be in parent, sibling, or data attribute)
      const parent = $element.closest("div, li, article");
      const difficultyElement = parent.find("[class*='difficulty'], [class*='level'], [class*='badge']").first();
      let difficultyText = difficultyElement.text().trim();
      const difficultyClasses = difficultyElement.attr("class") || $element.attr("class") || parent.attr("class") || "";

      // Also check parent text for difficulty indicators
      if (!difficultyText) {
        const parentText = parent.text();
        difficultyText = parentText;
      }

      // Extract difficulty and tags from name if it contains it
      // The name format appears to be: "Problem Name Tag/Category Difficulty"
      // Examples: "Place Or Take Probability Hard", "River Length Brainteasers Easy", "Horse Arbitrage Finance Easy"
      const nameParts = name.split(/\s+/);
      let difficultyFromName: ScrapedProblem["difficulty"] = "Unknown";
      const tags: string[] = [];
      
      // Check last part for difficulty
      const lastPart = nameParts[nameParts.length - 1].toLowerCase();
      if (["easy", "medium", "hard"].includes(lastPart)) {
        difficultyFromName = (lastPart.charAt(0).toUpperCase() + lastPart.slice(1)) as "Easy" | "Medium" | "Hard";
        // Remove difficulty from name
        nameParts.pop(); // Remove difficulty
        
        // Extract tags/categories - look for common category words before the difficulty
        // Keep extracting until we hit what looks like the problem name
        const commonCategoryWords = [
          "probability", "statistics", "brainteaser", "brainteasers",
          "pricing", "coding", "finance", "pure", "math"
        ];
        
        // Try to extract category words from the end
        while (nameParts.length > 0) {
          const candidate = nameParts[nameParts.length - 1].toLowerCase();
          
          // Check if it's a known category word
          if (commonCategoryWords.includes(candidate)) {
            const tag = nameParts.pop();
            if (tag) {
              // Handle "Pure Math" as a compound tag
              if (candidate === "math" && nameParts.length > 0 && nameParts[nameParts.length - 1].toLowerCase() === "pure") {
                tags.unshift("Pure Math");
                nameParts.pop();
              } else {
                // Capitalize properly
                const capitalizedTag = tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
                tags.unshift(capitalizedTag);
              }
            }
          } else if (candidate.includes("math") || candidate.includes("finance") || candidate.includes("brainteaser")) {
            // Handle compound words
            const tag = nameParts.pop();
            if (tag) {
              const capitalizedTag = tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
              tags.unshift(capitalizedTag);
            }
          } else {
            // Stop if we hit something that doesn't look like a category
            break;
          }
        }
        
        name = nameParts.join(" ").trim();
      } else {
        // Try parsing from full name text for difficulty
        difficultyFromName = parseDifficulty(name, "");
        
        // Even if difficulty isn't at the end, try to extract tags from the name
        // Look for category words anywhere in the name
        const categoryPattern = /\b(Probability|Statistics|Brainteaser|Brainteasers|Finance|Pure Math|Pricing|Coding)\b/gi;
        const matches = name.match(categoryPattern);
        if (matches) {
          matches.forEach(match => {
            const normalizedTag = match === "Brainteasers" ? "Brainteasers" : 
                                 match === "Pure Math" ? "Pure Math" :
                                 match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
            if (!tags.includes(normalizedTag)) {
              tags.push(normalizedTag);
            }
          });
          // Remove tags from name
          name = name.replace(categoryPattern, "").replace(/\s+/g, " ").trim();
        }
      }

      const fullLink = link.startsWith("http") ? link : `${baseUrl}${link}`;
      const difficulty = difficultyFromName !== "Unknown" 
        ? difficultyFromName 
        : parseDifficulty(difficultyText, difficultyClasses);

      problems.push({
        name,
        link: fullLink,
        difficulty,
        ...(tags.length > 0 && { tags }),
      });
    });

    // Plan B: if we didn't find anything, try some other approaches
    // Sometimes websites are tricky and hide stuff in weird places
    if (problems.length === 0) {
      console.warn("No problems found with primary selector. Trying alternative approach...");
      
      // Let's try looking for anything that smells like a problem
      $("div[class*='problem'], li[class*='problem'], article[class*='problem'], a[href*='/questions/']").each((_index: number, element: cheerio.Element) => {
        const $element = $(element);
        const linkElement = $element.find("a").first();
        const link = linkElement.attr("href");
        const name = linkElement.text().trim() || $element.find("h2, h3, h4").first().text().trim();
        
        if (!link || !name) return;

        const difficultyElement = $element.find("[class*='difficulty'], [class*='badge'], [class*='tag']");
        const difficultyText = difficultyElement.text().trim();
        const difficultyClasses = difficultyElement.attr("class") || "";

        const fullLink = link.startsWith("http") ? link : `${baseUrl}${link}`;
        const difficulty = parseDifficulty(difficultyText, difficultyClasses);

        problems.push({
          name,
          link: fullLink,
          difficulty,
        });
      });
    }

    if (problems.length === 0) {
      console.warn("\n⚠️  No problems found. The site structure might be different.");
      console.warn("Please:");
      console.warn("1. Run: npm run inspect");
      console.warn("2. Check the actual HTML structure");
      console.warn("3. Update the selectors in scraper.ts");
    }

    return problems;
  } catch (error) {
    console.error("Error scraping from HTML:", error);
    return [];
  }
}

/**
 * Scrapes a single problem page for detailed information
 */
export async function scrapeProblemDetails(problemUrl: string): Promise<{
  description?: string;
  tags?: string[];
  difficulty?: ScrapedProblem["difficulty"];
}> {
  try {
    const html = await fetchHTML(problemUrl);
    const $ = cheerio.load(html);

    // Extract problem description
    const description = $("div[class*='description'], div[class*='content'], main p")
      .first()
      .text()
      .trim();

    // Extract tags if they exist
    const tags: string[] = [];
    $("[class*='tag'], [class*='label'], [class*='category']").each((_index: number, element: cheerio.Element) => {
      const tag = $(element).text().trim();
      if (tag) tags.push(tag);
    });

    // Try to extract difficulty from the page
    const difficultyElement = $("[class*='difficulty'], [class*='level']").first();
    const difficultyText = difficultyElement.text().trim();
    const difficultyClasses = difficultyElement.attr("class") || "";
    const difficulty = parseDifficulty(difficultyText, difficultyClasses);

    return {
      description: description || undefined,
      tags: tags.length > 0 ? tags : undefined,
      difficulty: difficulty !== "Unknown" ? difficulty : undefined,
    };
  } catch (error) {
    console.error(`Error scraping problem details from ${problemUrl}:`, error);
    return {};
  }
}

