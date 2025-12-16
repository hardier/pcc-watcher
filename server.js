import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'dist')));

// --- CONSTANTS ---
const BASE_URL = "https://www.polynesia.com/packages/all/super-ambassador-package?_d=";

const PATTERNS = {
  SOLD_OUT: /SOLDOUT! Please choose another date!/i,
  LOW_COUNT: /Limited Availability! Book Now! ([1-5]) tickets left/i,
  AVAILABLE: /Tickets available\. Book Now!/i,
  LIMITED_GENERAL: /Limited Availability! Book Now!/i
};

// Default configuration to pre-warm cache
const PREWARM_CONFIG = {
  START: '2025-12-25',
  END: '2025-12-29',
  PARTY_SIZE: 6
};

// --- CACHE STORE ---
// Format: { '12/25/2025': { data: ResultObject, timestamp: 123456789, partySize: 6 } }
const cache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 Minutes

// --- HELPERS ---
function getDatesInRange(startDate, endDate) {
  const dates = [];
  let currentDate = new Date(startDate + 'T00:00:00');
  const stopDate = new Date(endDate + 'T00:00:00');
  while (currentDate <= stopDate) {
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const year = currentDate.getFullYear();
    dates.push(`${month}/${day}/${year}`);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
}

// --- SCRAPING LOGIC ---
async function scrapeDate(dateStr, partySize) {
  const targetUrl = `${BASE_URL}${dateStr}`;
  
  const result = {
    dateStr,
    status: 'UNKNOWN',
    message: 'Initializing...',
    ticketsLeft: undefined,
    timestamp: Date.now(),
    url: targetUrl
  };

  try {
    // Fetch HTML
    const { data } = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Parse HTML
    const $ = cheerio.load(data);
    const pageText = $('body').text().replace(/\s+/g, ' ').trim();

    // Logic ported from frontend
    if (PATTERNS.SOLD_OUT.test(pageText)) {
      result.status = 'SOLD_OUT';
      result.message = "Sold Out";
    } else {
      const lowMatch = pageText.match(PATTERNS.LOW_COUNT);
      if (lowMatch) {
        const ticketsLeft = parseInt(lowMatch[1], 10);
        result.ticketsLeft = ticketsLeft;
        
        if (ticketsLeft < partySize) {
          result.status = 'LIMITED_LOW';
          result.message = `Only ${ticketsLeft} ticket(s) left (Need ${partySize})`;
        } else {
          result.status = 'LIMITED_HIGH';
          result.message = `Available - ${ticketsLeft} tickets left!`;
        }
      } else if (PATTERNS.AVAILABLE.test(pageText)) {
        result.status = 'AVAILABLE';
        result.message = "Available! Book Now!";
      } else if (PATTERNS.LIMITED_GENERAL.test(pageText)) {
        result.status = 'LIMITED_HIGH';
        result.message = "Limited Availability (Likely enough)";
      } else {
        result.status = 'UNKNOWN';
        result.message = "Status text not found on page";
      }
    }

  } catch (error) {
    console.error(`Error scraping ${dateStr}:`, error.message);
    result.status = 'ERROR';
    result.message = error.message || "Server Error";
  }

  return result;
}

// --- API ENDPOINT ---
app.get('/api/check', async (req, res) => {
  const { date, partySize } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Date is required (MM/DD/YYYY)' });
  }

  const pSize = parseInt(partySize) || 1;
  const now = Date.now();

  // 1. Check Cache
  if (cache[date]) {
    const entry = cache[date];
    const isFresh = (now - entry.timestamp) < CACHE_DURATION;
    
    // If fresh, return immediately
    if (isFresh) {
      console.log(`[CACHE HIT] ${date}`);
      return res.json(entry.data);
    }
  }

  // 2. Scrape (Cache Miss or Stale)
  console.log(`[SCRAPING] ${date}`);
  const data = await scrapeDate(date, pSize);
  
  // 3. Update Cache
  cache[date] = {
    data: data,
    timestamp: Date.now(),
    partySize: pSize // Store this to use in background refresh
  };

  res.json(data);
});

// --- BACKGROUND JOB (Every 5 Minutes) ---
setInterval(async () => {
  console.log('--- STARTING BACKGROUND REFRESH ---');
  const dates = Object.keys(cache);
  
  for (const date of dates) {
    const entry = cache[date];
    // We reuse the last partySize requested for this date
    const newData = await scrapeDate(date, entry.partySize || 1);
    
    cache[date] = {
      data: newData,
      timestamp: Date.now(),
      partySize: entry.partySize
    };
    console.log(`[REFRESHED] ${date} - ${newData.status}`);
  }
}, CACHE_DURATION); // Run every 5 minutes

// --- PRE-WARM CACHE ON START ---
async function prewarmCache() {
  console.log('--- PRE-WARMING CACHE ---');
  const dates = getDatesInRange(PREWARM_CONFIG.START, PREWARM_CONFIG.END);
  
  for (const date of dates) {
    // Trigger a scrape without waiting for it, letting the promise resolve in background
    scrapeDate(date, PREWARM_CONFIG.PARTY_SIZE).then(data => {
       cache[date] = {
         data: data,
         timestamp: Date.now(),
         partySize: PREWARM_CONFIG.PARTY_SIZE
       };
       console.log(`[PRE-WARM] Loaded ${date}: ${data.status}`);
    });
  }
}

// Handle React Routing (return index.html for unknown routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  prewarmCache();
});