import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'dist')));

const BASE_TICKETING_URL = "https://ticketing.polynesia.com/BundleSelect.asp";
const SOLD_OUT_TEXT = "The package you’ve selected is sold out. Please select a different date.";

// Email Config
const TARGET_EMAIL = 'hahardier@gmail.com';
const EMAIL_USER = 'ethanlinzilllow@gmail.com';
const EMAIL_PASS = 'yoel jnqz lbcu pdcb';

let transporter = null;
if (EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
  });
}

const cache = {};
const CACHE_DURATION = 5 * 60 * 1000;

async function scrapeRealtime(dateStr, adults, children) {
  // Construct the URL with parameters. Qty1=1 is enough to check if ANY tickets exist for the date.
  const targetUrl = `${BASE_TICKETING_URL}?BundleID=101&PricingTierID=100&DateVisited=${dateStr}&Qty1=${adults}&Qty2=${children}`;
  
  const result = {
    dateStr,
    status: 'UNKNOWN',
    message: 'Checking...',
    timestamp: Date.now(),
    url: targetUrl,
    adults,
    children
  };

  try {
    const { data } = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000
    });

    if (data.includes(SOLD_OUT_TEXT)) {
      result.status = 'SOLD_OUT';
      result.message = "Sold Out";
    } else if (data.includes("Proceed To checkout") || data.includes("Your Order Summary") || data.includes("Shopping Cart")) {
      result.status = 'AVAILABLE';
      result.message = "Available! Tickets found.";
    } else if (data.includes("select a different date") || data.includes("No available times")) {
      result.status = 'SOLD_OUT';
      result.message = "Sold Out (No times available)";
    } else {
      result.status = 'UNKNOWN';
      result.message = "Check manually (Unexpected page)";
    }
  } catch (error) {
    result.status = 'ERROR';
    result.message = `Network error: ${error.message}`;
  }
  return result;
}

app.get('/api/check', async (req, res) => {
  const { date, adults, children } = req.query;
  const aCount = parseInt(adults) || 1; // Default to 1 to check "any"
  const cCount = parseInt(children) || 0;
  
  const cacheKey = `${date}-${aCount}-${cCount}`;
  const now = Date.now();

  if (cache[cacheKey] && (now - cache[cacheKey].timestamp) < CACHE_DURATION) {
    return res.json(cache[cacheKey].data);
  }

  const data = await scrapeRealtime(date, aCount, cCount);
  cache[cacheKey] = { data, timestamp: now };
  res.json(data);
});

app.get('/api/test-email', async (req, res) => {
  if (!transporter) return res.status(503).json({ error: 'Mail not configured' });
  try {
    await transporter.sendMail({
      from: EMAIL_USER,
      to: TARGET_EMAIL,
      subject: "PCC Watcher Notification Test",
      text: "The Polynesian Cultural Center ticket monitor is active and connected."
    });
    res.json({ success: true, message: `Test email sent to ${TARGET_EMAIL}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));