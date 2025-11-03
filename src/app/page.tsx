export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Quant Scraper
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Scrapes quant interview questions and categorizes them with AI
        </p>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Getting Started</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Run the scraper: <code className="bg-gray-100 px-2 py-1 rounded">npm run scrape</code></li>
            <li>Or use the API endpoint: <code className="bg-gray-100 px-2 py-1 rounded">GET /api/scrape</code></li>
            <li>Inspect the site structure and update scraper.ts with correct selectors</li>
            <li>Set up Supabase connection (coming next)</li>
          </ol>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Next Steps
          </h3>
          <ul className="list-disc list-inside space-y-1 text-blue-800">
            <li>Inspect quantguide.io to identify correct HTML selectors</li>
            <li>Update the scraper with accurate selectors</li>
            <li>Test the scraper and verify data extraction</li>
            <li>Set up Supabase database schema</li>
            <li>Integrate Gemini for categorization</li>
          </ul>
        </div>
      </div>
    </div>
  );
}






