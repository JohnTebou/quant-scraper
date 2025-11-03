/**
 * Quick script to help extract cookies
 * 
 * Instructions:
 * 1. Open https://quantguide.io/questions in your browser (logged in)
 * 2. Open DevTools (F12)
 * 3. Go to Console tab
 * 4. Copy and paste this entire script into the console
 * 5. It will output cookies in the format needed
 * 6. Copy the output and save it as cookies.json
 */

(function() {
  const cookies = document.cookie.split(';').map(c => {
    const [name, ...valueParts] = c.trim().split('=');
    const value = valueParts.join('=');
    return {
      name: name.trim(),
      value: value.trim(),
      domain: 'quantguide.io'
    };
  }).filter(c => c.name && c.value);

  console.log('\n=== COPY THIS OUTPUT TO cookies.json ===\n');
  console.log(JSON.stringify(cookies, null, 2));
  console.log('\n=== END ===\n');
  
  return cookies;
})();







