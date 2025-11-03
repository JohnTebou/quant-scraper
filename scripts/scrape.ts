import { scrapeQuantGuideProblems, scrapeProblemDetails } from "../src/lib/scraper";

/**
 * Main scraping script
 * Run with: npm run scrape
 */
async function main() {
  console.log("Starting quantguide.io scraper...\n");

  try {
    // Scrape all problems
    console.log("Fetching problems list...");
    const problems = await scrapeQuantGuideProblems();

    console.log(`Found ${problems.length} problems\n`);

    if (problems.length === 0) {
      console.warn("⚠️  No problems found. You may need to:");
      console.warn("   1. Inspect quantguide.io to find the correct selectors");
      console.warn("   2. Update the scraper.ts file with the correct HTML structure");
      console.warn("   3. Check if the site requires authentication or has rate limiting");
      return;
    }

    // Display first few problems as preview
    console.log("Preview of scraped problems:");
    console.log("=" .repeat(60));
    problems.slice(0, 5).forEach((problem, index) => {
      console.log(`\n${index + 1}. ${problem.name}`);
      console.log(`   Link: ${problem.link}`);
      console.log(`   Difficulty: ${problem.difficulty}`);
    });

    if (problems.length > 5) {
      console.log(`\n... and ${problems.length - 5} more problems`);
    }

    // Optionally scrape details for each problem (this can be slow)
    const scrapeDetails = process.argv.includes("--details");
    if (scrapeDetails) {
      console.log("\n\nScraping detailed information for each problem...");
      const problemsWithDetails = [];

      for (let i = 0; i < problems.length; i++) {
        const problem = problems[i];
        console.log(`Processing ${i + 1}/${problems.length}: ${problem.name}`);
        
        const details = await scrapeProblemDetails(problem.link);
        problemsWithDetails.push({
          ...problem,
          ...details,
        });

        // Be respectful - add a small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log("\n✅ Scraping complete!");
      console.log(`Total problems scraped: ${problemsWithDetails.length}`);
      
      // Save to JSON file for inspection
      const fs = await import("fs/promises");
      await fs.writeFile(
        "scraped-problems.json",
        JSON.stringify(problemsWithDetails, null, 2)
      );
      console.log("📄 Results saved to scraped-problems.json");
    } else {
      // Save basic results
      const fs = await import("fs/promises");
      await fs.writeFile(
        "scraped-problems.json",
        JSON.stringify(problems, null, 2)
      );
      console.log("\n✅ Scraping complete!");
      console.log("📄 Results saved to scraped-problems.json");
      console.log("\n💡 Tip: Run with --details flag to scrape detailed information for each problem");
    }
  } catch (error) {
    console.error("❌ Error during scraping:", error);
    process.exit(1);
  }
}

main();






