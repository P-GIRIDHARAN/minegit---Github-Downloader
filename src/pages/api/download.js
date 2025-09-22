import { https } from 'follow-redirects';
import AdmZip from 'adm-zip';
import fetch from 'node-fetch';
import { Buffer } from 'buffer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { repo: repoUrl } = req.query;
  if (!repoUrl) return res.status(400).json({ error: 'Missing repo parameter' });

  // Parse GitHub URL
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)\/(.+))?/);
  if (!match) return res.status(400).json({ error: 'Invalid GitHub URL' });

  const user = match[1];
  const repoName = match[2].replace(/\.git$/, '');
  const folder = match[4] ? decodeURIComponent(match[4]) : '';

  try {
    // Detect default branch if not provided
    const apiUrl = `https://api.github.com/repos/${user}/${repoName}`;
    const repoResp = await fetch(apiUrl, { headers: { 'User-Agent': 'Node.js' } });
    if (!repoResp.ok) throw new Error('Repo not found');

    const repoData = await repoResp.json();
    const branch = match[3] || repoData.default_branch || 'main';

    // Download ZIP of the branch
    const zipUrl = `https://github.com/${user}/${repoName}/archive/refs/heads/${branch}.zip`;
    const options = { headers: { 'User-Agent': 'Mozilla/5.0' } };

    https.get(zipUrl, options, (gitRes) => {
      if (gitRes.statusCode !== 200) {
        return res.status(gitRes.statusCode).json({ error: 'Failed to download ZIP. Check branch or repo.' });
      }

      const chunks = [];
      gitRes.on('data', chunk => chunks.push(chunk));
      gitRes.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const zip = new AdmZip(buffer);

          // Normalize folder path for ZIP entries
          const folderPath = folder ? `${repoName}-${branch}/${folder.replace(/\\/g, '/')}/` : '';
          const newZip = new AdmZip();

          zip.getEntries().forEach(entry => {
            if (!folderPath || entry.entryName.startsWith(folderPath)) {
              const relativeName = entry.entryName.slice(folderPath.length);
              if (relativeName) newZip.addFile(relativeName, entry.getData());
            }
          });

          const zipFileName = folder ? folder.split('/').pop() : repoName;
          res.setHeader('Content-Disposition', `attachment; filename=${zipFileName}.zip`);
          res.setHeader('Content-Type', 'application/zip');
          res.send(newZip.toBuffer());
        } catch (err) {
          console.error('ZIP processing error:', err);
          res.status(500).json({ error: 'Failed to process ZIP' });
        }
      });
    }).on('error', err => {
      console.error('HTTPS error:', err);
      res.status(500).json({ error: 'Error fetching from GitHub' });
    });
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: 'Error accessing GitHub API' });
  }
}
