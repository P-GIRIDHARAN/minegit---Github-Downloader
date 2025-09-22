import { useState } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  const handleDownload = async (e) => {
    e.preventDefault();
    setError('');
    setProgress(0);

    // Simple frontend validation for GitHub URLs
    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+/.test(url)) {
      setError('Please enter a valid GitHub repository URL.');
      return;
    }

    setLoading(true);

    try {
      // Fetch the API as a blob to track progress
      const response = await fetch(`/api/download?repo=${encodeURIComponent(url)}`);
      if (!response.ok) {
        throw new Error(`Failed to download repo: ${response.statusText}`);
      }

      const contentLength = response.headers.get('Content-Length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      const reader = response.body.getReader();
      let receivedLength = 0;
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;
        if (total) setProgress(Math.floor((receivedLength / total) * 100));
      }

      const blob = new Blob(chunks);
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = `${url.split('/').pop()}.zip`;
      downloadLink.click();
      URL.revokeObjectURL(downloadLink.href);
    } catch (err) {
      console.error(err);
      setError('Failed to download the repository. Please check the URL and try again.');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-gray-200 px-4">
      <div className="bg-gray-800 p-10 rounded-2xl shadow-xl w-full max-w-lg">
        <h1 className="text-4xl font-extrabold mb-6 text-yellow-400 text-center">
          GitHub Downloader
        </h1>

        <form onSubmit={handleDownload} className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Enter GitHub repo URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 px-4 py-3 rounded-lg border border-gray-700 bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-yellow-500 text-gray-900 font-semibold px-6 py-3 rounded-lg hover:bg-yellow-600 transition-colors shadow-md disabled:opacity-50"
          >
            {loading ? 'Downloading...' : 'Download'}
          </button>
        </form>

        {/* Error message */}
        {error && (
          <p className="mt-2 text-center text-red-400 font-semibold">{error}</p>
        )}

        <p className="mt-4 text-gray-400 text-sm text-center">
          Example: <span className="font-mono text-yellow-400">https://github.com/vercel/next.js</span>
        </p>
      </div>

      <footer className="mt-8 text-gray-500 text-sm text-center">
        &copy; 2025 GitHub Downloader
      </footer>
    </div>
  );
}
