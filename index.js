require('dotenv').config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());

const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || '').split(',').map(s => s.trim().toLowerCase());

// API трекер
app.get("/api/track", async (req, res) => {
  const { to, label } = req.query;
  if (!to) return res.status(400).send('Missing "to" parameter');

  // перевірка хоста
  try {
    const url = new URL(to);
    const host = url.hostname.replace(/^www\./,'').toLowerCase();
    if (!ALLOWED_HOSTS.includes(host)) return res.status(403).send('Redirect target not allowed');
  } catch {
    return res.status(400).send('Invalid "to" URL');
  }

  // IP користувача
  const xff = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const ip = Array.isArray(xff) ? xff[0] : String(xff).split(',')[0].trim();

  // геолокація
  let city = 'Unknown';
  try {
    const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,regionName,country`);
    const geo = await geoRes.json();
    if (geo.status === 'success') city = geo.city || geo.regionName || geo.country || 'Unknown';
  } catch {}

  const text = `${city} - ${label || to}`;

  // Telegram
  try {
    const BOT = process.env.BOT_TOKEN;
    const CHAT = process.env.CHAT_ID;
    await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text })
    });
  } catch (e) { console.error('TG error', e); }

  // редірект
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.writeHead(302, { Location: to });
  res.end();
});

// простий тест
app.get("/", (req, res) => res.send("CV Tracker Server is running."));

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
s