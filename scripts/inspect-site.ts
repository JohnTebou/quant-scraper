/**
 * Utility script to inspect quantguide.io HTML structure
 * This helps identify the correct selectors for scraping
 * 
 * Run with: npx tsx scripts/inspect-site.ts
 */

async function inspectSite() {
  // Try homepage first, then allow custom URL override
  const defaultUrl = "https://quantguide.io";
  const url = process.argv[2] || defaultUrl;
  
  console.log(`Inspecting: ${url}\n`);
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      console.error(`❌ Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      console.log("\n💡 Suggestions:");
      console.log("1. Try the homepage: npm run inspect https://quantguide.io");
      console.log("2. Check if the site requires authentication");
      console.log("3. Verify the URL in your browser first");
      console.log("4. The site might use JavaScript rendering (try Puppeteer instead)");
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const html = await response.text();
    
    // Save raw HTML for inspection
    const fs = await import("fs/promises");
    await fs.writeFile("site-inspection.html", html);
    
    console.log("✅ HTML saved to site-inspection.html");
    console.log(`📄 HTML length: ${html.length} characters`);
    
    // Check if this is a JavaScript-rendered site
    const isSPA = html.includes("__NEXT_DATA__") || 
                  html.includes("react") || 
                  html.length < 5000 && html.includes("<script");
    
    if (isSPA) {
      console.log("\n⚠️  WARNING: This appears to be a JavaScript-rendered site (SPA)");
      console.log("   Cheerio won't work for dynamic content. Consider using Puppeteer.");
    }
    
    console.log("\n📋 Next steps:");
    console.log("1. Open site-inspection.html in your browser");
    console.log("2. Use browser DevTools to inspect the structure");
    console.log("3. Navigate to the problems page and inspect that URL");
    console.log("4. Identify selectors for:");
    console.log("   - Problem links");
    console.log("   - Problem names");
    console.log("   - Difficulty indicators");
    console.log("5. Update src/lib/scraper.ts with correct selectors and URL");
    
    // Try to find common patterns
    console.log("\n🔍 Quick analysis:");
    
    // Look for various URL patterns
    const allLinks = html.match(/href=["']([^"']+)["']/gi) || [];
    const problemLinks = allLinks.filter(link => 
      /problem|question|challenge|exercise/i.test(link)
    );
    
    if (problemLinks.length > 0) {
      console.log(`Found ${problemLinks.length} potential problem/question links`);
      console.log("Sample links:");
      [...new Set(problemLinks)].slice(0, 10).forEach((link, i) => {
        const cleanLink = link.replace(/href=["']|["']/g, '');
        console.log(`  ${i + 1}. ${cleanLink}`);
      });
    } else {
      console.log("⚠️  No obvious problem links found in HTML");
      console.log("   This might mean:");
      console.log("   - The site uses JavaScript to load content");
      console.log("   - Problems are on a different page");
      console.log("   - Different URL structure");
    }
    
    // Look for navigation links that might lead to problems
    const navLinks = html.match(/href=["']([^"']+)["'][^>]*>([^<]*(?:problem|question|practice|challenge)[^<]*)</gi);
    if (navLinks) {
      console.log(`\nFound ${navLinks.length} navigation links mentioning problems/questions`);
    }
    
    const difficultyMatches = html.match(/(easy|medium|hard|difficulty|beginner|intermediate|advanced|easy|hard)/gi);
    if (difficultyMatches) {
      console.log(`\nFound ${difficultyMatches.length} potential difficulty indicators`);
      const uniqueDifficulties = [...new Set(difficultyMatches)];
      console.log("Unique matches:", uniqueDifficulties.join(", "));
    } else {
      console.log("\n⚠️  No difficulty indicators found in HTML");
    }
    
    // Show page title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      console.log(`\n📄 Page title: ${titleMatch[1]}`);
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

inspectSite();

