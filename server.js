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

// Standard middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

const BASE_TICKETING_URL = "https://ticketing.polynesia.com/BundleSelect.asp";
const SOLD_OUT_TEXT = "The package you’ve selected is sold out. Please select a different date.";

// Email Config - Ensure these are set in Vercel environment variables for production
const TARGET_EMAIL = process.env.TARGET_EMAIL || 'hahardier@gmail.com';
const EMAIL_USER = process.env.EMAIL_USER || 'ethanlinzilllow@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'yoel jnqz lbcu pdcb';

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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 8000 // Ensure we stay under Vercel's timeout
    });

    if (data.includes(SOLD_OUT_TEXT)) {
      result.status = 'SOLD_OUT';
      result.message = "Sold Out (Ticketing System)";
    } else if (data.includes("Proceed To checkout") || data.includes("Your Order Summary") || data.includes("Order Summary")) {
      result.status = 'AVAILABLE';
      result.message = "Real-time Available!";
    } else {
      result.status = 'UNKNOWN';
      result.message = "Ambiguous Layout (Check Link)";
    }
  } catch (error) {
    console.error(`Scrape error for ${dateStr}:`, error.message);
    result.status = 'ERROR';
    result.message = error.message;
  }
  return result;
}

app.get('/api/check', async (req, res) => {
  const { date, adults, children } = req.query;
  const aCount = parseInt(adults) || 0;
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
  if (!transporter) {
    return res.status(503).json({ error: 'Mail transporter not initialized. Check server logs.' });
  }
  try {
    await transporter.sendMail({
      from: EMAIL_USER,
      to: TARGET_EMAIL,
      subject: "PCC Watcher Notification Test",
      text: "The real-time ticketing monitor is functioning correctly. You will receive alerts here when tickets become available."
    });
    res.json({ success: true, message: `Test email sent to ${TARGET_EMAIL}` });
  } catch (e) {
    console.error("Mail Error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Fallback to static index.html for React routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// Required for Vercel to treat this as a serverless function
export default app;