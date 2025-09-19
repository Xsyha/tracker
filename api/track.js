export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://cv-sable-seven.vercel.app'); // не *
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  let body;
  try {
    body = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(JSON.parse(data)));
      req.on('error', err => reject(err));
    });
  } catch (e) {
    return res.status(400).send('Invalid JSON');
  }

  const { to, label } = body;
  if (!to) return res.status(400).send('Missing "to"');

  // validate host whitelisted
  const ALLOWED = (process.env.ALLOWED_HOSTS || '').split(',').map(s=>s.trim().toLowerCase());
  try {
    const url = new URL(to);
    const host = url.hostname.replace(/^www\./,'').toLowerCase();
    if (!ALLOWED.includes(host)) return res.status(403).send('Redirect target not allowed');
  } catch {
    return res.status(400).send('Bad "to" URL');
  }

  // тут твій код для IP, geo, Telegram та редіректу
  res.writeHead(302, { Location: to });
  return res.end();
}
