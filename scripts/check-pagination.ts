/**
 * Check if quantguide.io has pagination or loads more content dynamically
 */

async function checkPagination() {
  const url = "https://quantguide.io/questions";
  
  console.log("Checking pagination and content loading...\n");
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const html = await response.text();
    
    // Check for __NEXT_DATA__ (Next.js data)
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
    if (nextDataMatch) {
      try {
        const data = JSON.parse(nextDataMatch[1]);
        console.log("✅ Found __NEXT_DATA__");
        console.log("Checking for questions data...\n");
        
        // Try to find questions in the data structure
        const dataStr = JSON.stringify(data);
        const questionMatches = dataStr.match(/questions[^"]*"/gi);
        if (questionMatches) {
          console.log("Found question-related keys:", questionMatches.slice(0, 10));
        }
        
        // Look for pagination info
        if (data.props?.pageProps) {
          console.log("\nPage props structure:", Object.keys(data.props.pageProps));
        }
      } catch (e) {
        console.log("Could not parse __NEXT_DATA__");
      }
    }
    
    // Count question links in HTML
    const questionLinks = html.match(/href=["']\/questions\/[^"']+["']/g) || [];
    const uniqueLinks = [...new Set(questionLinks.map(link => link.match(/\/questions\/[^"']+/)?.[0]))];
    
    console.log(`\n📊 Found ${uniqueLinks.length} unique question links in initial HTML`);
    
    // Check for pagination indicators
    const paginationPatterns = [
      /page[\s=]*\d+/gi,
      /pagination/gi,
      /load\s+more/gi,
      /show\s+more/gi,
      /next\s+page/gi,
      /previous/gi,
      /total.*\d+/gi,
      /showing.*\d+.*of.*\d+/gi,
    ];
    
    console.log("\n🔍 Checking for pagination indicators:");
    paginationPatterns.forEach(pattern => {
      const matches = html.match(pattern);
      if (matches) {
        console.log(`  Found: ${pattern.source} - ${matches.length} matches`);
        console.log(`    Examples: ${matches.slice(0, 3).join(", ")}`);
      }
    });
    
    // Check for API endpoints
    const apiPatterns = [
      /\/api\/[^"'\s]+/gi,
      /\/_next\/data\/[^"'\s]+/gi,
    ];
    
    console.log("\n🔍 Checking for API endpoints:");
    apiPatterns.forEach(pattern => {
      const matches = html.match(pattern);
      if (matches) {
        const unique = [...new Set(matches)];
        console.log(`  Found ${unique.length} potential API endpoints:`);
        unique.slice(0, 10).forEach(endpoint => {
          console.log(`    ${endpoint}`);
        });
      }
    });
    
    // Save sample of HTML for manual inspection
    const fs = await import("fs/promises");
    await fs.writeFile("pagination-check.html", html.substring(0, 50000));
    console.log("\n✅ Saved first 50KB of HTML to pagination-check.html for inspection");
    
  } catch (error) {
    console.error("Error:", error);
  }
}

checkPagination();






