/**
 * Scraping script that loads cookies from a file for authentication
 * 
 * Usage:
 * 1. Export your cookies from browser to cookies.json (see get-cookies.md)
 * 2. Run: npm run scrape:auth
 */

import { scrapeQuantGuideProblems } from "../src/lib/scraper";
import { readFile } from "fs/promises";

async function main() {
  console.log("Starting authenticated scraper...\n");

  let cookies: Array<{ name: string; value: string; domain?: string }> | undefined;

  try {
    // Try to load cookies from file
    const cookiesData = await readFile("cookies.json", "utf-8");
    const parsed = JSON.parse(cookiesData);
    
    // Handle different cookie formats
    if (Array.isArray(parsed)) {
      cookies = parsed;
    } else if (parsed.cookies && Array.isArray(parsed.cookies)) {
      cookies = parsed.cookies;
    } else if (parsed.name && parsed.value) {
      cookies = [parsed];
    }
    
    console.log(`✅ Loaded ${cookies.length} cookies from cookies.json\n`);
  } catch (error) {
    console.warn("⚠️  Could not load cookies.json");
    console.warn("   Continuing without authentication (limited results)\n");
    console.warn("   To get all questions:");
    console.warn("   1. Export your cookies from browser");
    console.warn("   2. Save them as cookies.json in the project root");
    console.warn("   3. See scripts/get-cookies.md for instructions\n");
  }

  try {
    const problems = await scrapeQuantGuideProblems(cookies);

    console.log(`\n✅ Found ${problems.length} problems\n`);

    if (problems.length === 0) {
      console.warn("⚠️  No problems found.");
      return;
    }

    // Display preview
    console.log("Preview of scraped problems:");
    console.log("=".repeat(60));
    problems.slice(0, 5).forEach((problem, index) => {
      console.log(`\n${index + 1}. ${problem.name}`);
      console.log(`   Link: ${problem.link}`);
      console.log(`   Difficulty: ${problem.difficulty}`);
      if (problem.tags && problem.tags.length > 0) {
        console.log(`   Tags: ${problem.tags.join(", ")}`);
      }
    });

    if (problems.length > 5) {
      console.log(`\n... and ${problems.length - 5} more problems`);
    }

    // Save results
    const fs = await import("fs/promises");
    await fs.writeFile(
      "scraped-problems.json",
      JSON.stringify(problems, null, 2)
    );
    console.log("\n✅ Scraping complete!");
    console.log(`📄 Results saved to scraped-problems.json`);
    console.log(`📊 Total: ${problems.length} problems`);
    
    if (problems.length < 1000) {
      console.warn("\n⚠️  Expected ~1211 questions. You may need to:");
      console.warn("   - Provide authentication cookies");
      console.warn("   - Check if cookies are still valid");
      console.warn("   - Ensure you're logged in on quantguide.io");
    }
  } catch (error) {
    console.error("❌ Error during scraping:", error);
    process.exit(1);
  }
}

main();







