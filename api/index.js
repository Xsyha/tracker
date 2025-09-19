const express = require("express");
const cors = require("cors");

const app = express();

// Простий CORS з бібліотекою
app.use(cors({
  origin: '*',
  methods: '*',
  allowedHeaders: '*'
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Імпорт fetch для Node.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const ALLOWED_HOSTS = ['https://cv-sable-seven.vercel.app'];

app.post("/api", async (req, res) => {
  try {
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

    // Отримання IP адреси
    const xff = req.headers['x-forwarded-for'] || 
                req.headers['x-real-ip'] || 
                req.connection?.remoteAddress || 
                req.socket?.remoteAddress ||
                (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
                '';
    
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

    // Відправка в Telegram
    const text = `${city} - ${label || to}`;
    const BOT = process.env.BOT_TOKEN;
    const CHAT = process.env.CHAT_ID;
    
    if (BOT && CHAT) {
      try {
        const telegramRes = await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            chat_id: CHAT, 
            text,
            disable_web_page_preview: true 
          })
        });
        
        if (!telegramRes.ok) {
          console.error("Telegram API error:", await telegramRes.text());
        }
      } catch (err) {
        console.error("Telegram error:", err);
      }
    }

    // Редирект
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    return res.redirect(302, to);
    
  } catch (error) {
    console.error('Track API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Healthcheck endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Для локального запуску
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Експорт для Vercel
module.exports = app;