import { https } from 'follow-redirects';
import AdmZip from 'adm-zip';
import { Buffer } from 'buffer';

export default function handler(req, res) {
  const { repo: repoUrl } = req.query;
  if (!repoUrl) return res.status(400).json({ error: 'Missing repo parameter' });

  // Parse repo and optional subfolder
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)\/(.+))?/);
  if (!match) return res.status(400).json({ error: 'Invalid GitHub URL' });

  const user = match[1];
  const repoName = match[2].replace(/\.git$/, '');
  const branch = match[3] || 'master';
  const folder = match[4] || '';

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

        const folderPath = folder ? `${repoName}-${branch}/${folder}/` : '';
        const newZip = new AdmZip();

        zip.getEntries().forEach(entry => {
          if (!folderPath || entry.entryName.startsWith(folderPath)) {
            const relativeName = entry.entryName.replace(folderPath, '');
            if (relativeName) newZip.addFile(relativeName, entry.getData());
          }
        });

        res.setHeader('Content-Disposition', `attachment; filename=${folder || repoName}.zip`);
        res.setHeader('Content-Type', 'application/zip');
        res.send(newZip.toBuffer());
      } catch (err) {
        console.error('ZIP error:', err);
        res.status(500).json({ error: 'Failed to process ZIP' });
      }
    });
  }).on('error', err => {
    console.error('HTTPS error:', err);
    res.status(500).json({ error: 'Error fetching from GitHub' });
  });
}
