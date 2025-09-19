export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://cv-sable-seven.vercel.app'); 
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // preflight
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  // parse JSON body
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

  // Тут код для редіректу, Telegram, geo і т.д.
  res.writeHead(302, { Location: to });
  return res.end();
}
