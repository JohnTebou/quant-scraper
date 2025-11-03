/**
 * Check the format of __NEXT_DATA__ in the HTML
 */

async function checkNextData() {
  const html = await fetch("https://quantguide.io/questions", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  }).then(r => r.text());
  
  console.log("Checking for __NEXT_DATA__...\n");
  
  // Try different patterns
  const patterns = [
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
    /<script[^>]*id=['"]__NEXT_DATA__['"][^>]*>([\s\S]*?)<\/script>/,
    /__NEXT_DATA__[^>]*>([^<]+)/,
  ];
  
  for (let i = 0; i < patterns.length; i++) {
    const match = html.match(patterns[i]);
    if (match) {
      console.log(`✅ Pattern ${i + 1} matched!`);
      console.log(`   Length: ${match[1].length} characters`);
      console.log(`   First 200 chars: ${match[1].substring(0, 200)}...`);
      
      // Try to parse JSON
      try {
        const data = JSON.parse(match[1]);
        console.log("\n✅ Successfully parsed JSON!");
        console.log("Top-level keys:", Object.keys(data));
        
        // Try to find questions
        if (data.props?.pageProps) {
          console.log("\nProps.pageProps keys:", Object.keys(data.props.pageProps));
        }
        
        return;
      } catch (e) {
        console.log("❌ Failed to parse JSON:", e);
      }
    }
  }
  
  console.log("❌ No pattern matched");
  console.log("Checking if __NEXT_DATA__ exists at all...");
  if (html.includes("__NEXT_DATA__")) {
    console.log("✅ __NEXT_DATA__ string found in HTML");
    const index = html.indexOf("__NEXT_DATA__");
    console.log(`   Context: ${html.substring(index - 50, index + 200)}`);
  } else {
    console.log("❌ __NEXT_DATA__ not found in HTML");
  }
}

checkNextData();






