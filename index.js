const express = require("express");
const cors = require("cors");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const ALLOWED_HOSTS = ['cv-sable-seven.vercel.app'];

app.use(cors({
  origin: ALLOWED_HOSTS,
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// обробка preflight
app.options("/api/track", (req, res) => res.sendStatus(204));

app.post("/api/track", async (req, res) => {
  const { to, label } = req.body; // POST тепер використовує body
  if (!to) return res.status(400).send('Missing "to" parameter');

  try {
    const url = new URL(to);
    const host = url.hostname.replace(/^www\./,'').toLowerCase();
    if (!ALLOWED_HOSTS.includes(host)) return res.status(403).send('Redirect target not allowed');
  } catch {
    return res.status(400).send('Invalid "to" URL');
  }

  const xff = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const ip = Array.isArray(xff) ? xff[0] : String(xff).split(',')[0].trim();

  let city = 'Unknown';
  try {
    const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,regionName,country`);
    const geo = await geoRes.json();
    if (geo.status === 'success') city = geo.city || geo.regionName || geo.country || 'Unknown';
  } catch (err) {
    console.error("Geo error:", err);
  }

  const text = `${city} - ${label || to}`;

  const BOT = process.env.BOT_TOKEN;
  const CHAT = process.env.CHAT_ID;
  if (BOT && CHAT) {
    try {
      await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ chat_id: CHAT, text })
      });
    } catch (err) {
      console.error("Telegram error:", err);
    }
  }

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.writeHead(302, { Location: to });
  res.end();
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
