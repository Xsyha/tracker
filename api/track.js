// api/track.js
export default async function handler(req, res) {
  // CORS — дозволити ваш фронт (замість '*' вкажіть домен)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const { to, label } = req.query;
  if (!to) return res.status(400).send('Missing "to"');

  // validate host whitelisted
  const ALLOWED = (process.env.ALLOWED_HOSTS || '').split(',').map(s=>s.trim().toLowerCase());
  try {
    const url = new URL(to);
    const host = url.hostname.replace(/^www\./,'').toLowerCase();
    if (!ALLOWED.includes(host)) return res.status(403).send('Redirect target not allowed');
  } catch (e) {
    return res.status(400).send('Bad "to" URL');
  }

  // get client IP (Vercel passes x-forwarded-for)
  const xff = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const ip = Array.isArray(xff) ? xff[0] : String(xff).split(',')[0].trim();

  // geo lookup (ip-api.com)
  let city = 'Unknown';
  try {
    const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,regionName,country`);
    const geo = await geoRes.json();
    if (geo && geo.status === 'success') city = geo.city || geo.regionName || geo.country || 'Unknown';
  } catch (e) { /* ignore */ }

  const text = `${city} - ${label || to}`;

  // send to Telegram
  try {
    const BOT = process.env.BOT_TOKEN;
    const CHAT = process.env.CHAT_ID;
    await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ chat_id: CHAT, text })
    });
  } catch (e) {
    console.error('TG error', e);
  }

  // redirect
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.writeHead(302, { Location: to });
  return res.end();
}
