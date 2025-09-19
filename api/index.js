const express = require("express");
const cors = require("cors");

const app = express();

// CORS конфігурація для Vercel
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://cv-sable-seven.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    // Дозволяємо запити без origin (наприклад, мобільні додатки або Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200 // для підтримки legacy браузерів
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Додаткові заголовки для Vercel
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

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