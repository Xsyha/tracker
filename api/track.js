// api/track.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const ALLOWED_HOSTS = ['cv-sable-seven.vercel.app'];

export default async function handler(req, res) {
  // Логування для діагностики
  console.log('Method:', req.method);
  console.log('Origin:', req.headers.origin);
  console.log('Headers:', req.headers);

  // Встановлюємо CORS заголовки для ВСІХ відповідей
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // Обробка OPTIONS запиту (preflight)
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return res.status(200).json({ 
      message: 'CORS preflight OK',
      allowedOrigin: '*',
      allowedMethods: 'GET, POST, OPTIONS'
    });
  }
  
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'Track API working', 
      method: 'GET',
      cors: 'enabled'
    });
  }
  
  if (req.method === 'POST') {
    try {
      console.log('Handling POST request');
      console.log('Body:', req.body);
      
      const { to, label } = req.body;
      
      if (!to) {
        return res.status(400).json({ error: 'Missing "to" parameter' });
      }

      // Валідація URL
      let parsedUrl;
      try {
        parsedUrl = new URL(to);
      } catch {
        return res.status(400).json({ error: 'Invalid "to" URL' });
      }

      const host = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();
      if (!ALLOWED_HOSTS.includes(host)) {
        return res.status(403).json({ error: 'Redirect target not allowed' });
      }

      // IP адреса
      const xff = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '';
      const ip = Array.isArray(xff) ? xff[0] : String(xff).split(',')[0].trim();

      // Геолокація
      let city = 'Unknown';
      if (ip && ip !== '127.0.0.1' && ip !== '::1') {
        try {
          const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,regionName,country`);
          if (geoRes.ok) {
            const geo = await geoRes.json();
            if (geo.status === 'success') {
              city = geo.city || geo.regionName || geo.country || 'Unknown';
            }
          }
        } catch (err) {
          console.error("Geo error:", err);
        }
      }

      // Telegram
      const text = `${city} - ${label || to}`;
      const BOT = process.env.BOT_TOKEN;
      const CHAT = process.env.CHAT_ID;
      
      if (BOT && CHAT) {
        try {
          await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              chat_id: CHAT, 
              text,
              disable_web_page_preview: true 
            })
          });
          console.log('Telegram message sent');
        } catch (err) {
          console.error("Telegram error:", err);
        }
      }

      // Редирект
      res.setHeader('Location', to);
      return res.status(302).end();
      
    } catch (error) {
      console.error('API error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}