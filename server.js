import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

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

// --- EMAIL CONFIGURATION ---
const TARGET_EMAIL = 'hahardier@gmail.com';

// Credentials provided by user. 
// NOTE: In production, it is safer to use process.env.EMAIL_USER and process.env.EMAIL_PASS
const EMAIL_USER = process.env.EMAIL_USER || 'ethanlinzilllow@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'yoel jnqz lbcu pdcb';

// Optional: Custom SMTP settings (e.g. for Outlook, Yahoo, etc.)
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;

let transporter = null;

if (EMAIL_USER && EMAIL_PASS) {
  let transportConfig;

  if (SMTP_HOST) {
    // Custom SMTP Configuration
    transportConfig = {
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465, // true for 465, false for other ports
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    };
    console.log(`[EMAIL] Configuring custom SMTP transport (${SMTP_HOST})...`);
  } else {
    // Default to Gmail Service
    transportConfig = {
      service: 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    };
    console.log(`[EMAIL] Configuring Gmail transport for ${EMAIL_USER}...`);
  }

  transporter = nodemailer.createTransport(transportConfig);
  
  // Verify connection
  transporter.verify(function (error, success) {
    if (error) {
      console.error('[EMAIL] Connection Error:', error);
      console.warn('[EMAIL] TIP: If using Gmail, ensure 2-Step Verification is ON and you are using an App Password.');
      transporter = null; // Disable if verification fails
    } else {
      console.log(`[EMAIL] System ready to send alerts from ${EMAIL_USER} to ${TARGET_EMAIL}`);
    }
  });
} else {
  console.warn('[EMAIL] WARNING: EMAIL_USER or EMAIL_PASS not set. Email alerts disabled.');
}

async function sendEmailAlert(dateStr, result) {
  if (!transporter) return;

  const mailOptions = {
    from: `"PCC Ticket Watcher" <${EMAIL_USER}>`,
    to: TARGET_EMAIL,
    subject: `🎟️ TICKETS FOUND: ${dateStr}`,
    html: `
      <h2>Tickets Available for ${dateStr}!</h2>
      <p><strong>Status:</strong> ${result.status}</p>
      <p><strong>Message:</strong> ${result.message}</p>
      <p><strong>Party Size Checked:</strong> ${result.partySize || 'N/A'}</p>
      <br/>
      <a href="${result.url}" style="background-color: #0f766e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Book Now</a>
      <p><small>Checking URL: ${result.url}</small></p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Sent alert for ${dateStr}`);
  } catch (error) {
    console.error(`[EMAIL] Failed to send email for ${dateStr}:`, error);
  }
}

// --- CACHE STORE ---
// Format: { '12/25/2025': { data: ResultObject, timestamp: 123456789, partySize: 6, notified: boolean } }
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
    url: targetUrl,
    partySize: partySize
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

// --- API ENDPOINT: CHECK ---
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
    partySize: pSize,
    notified: cache[date] ? cache[date].notified : false 
  };

  res.json(data);
});

// --- API ENDPOINT: TEST EMAIL ---
app.get('/api/test-email', async (req, res) => {
  if (!transporter) {
    return res.status(503).json({ error: 'Email configuration missing or invalid on server.' });
  }
  
  try {
    await transporter.sendMail({
      from: `"PCC Ticket Watcher" <${EMAIL_USER}>`,
      to: TARGET_EMAIL,
      subject: "🔔 PCC Watcher: Test Email",
      text: "This is a test email from your ticket watcher server. If you are reading this, your email configuration is working correctly!",
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #0f766e;">Configuration Success! ✅</h2>
          <p>This is a test email from your <strong>PCC Ticket Watcher</strong>.</p>
          <p>The server is successfully authenticated as <code>${EMAIL_USER}</code>.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
          <p style="font-size: 12px; color: #6b7280;">You will receive future alerts at this address when tickets are found.</p>
        </div>
      `
    });
    console.log(`[EMAIL] Test email sent to ${TARGET_EMAIL}`);
    res.json({ success: true, message: `Test email sent to ${TARGET_EMAIL}` });
  } catch (error) {
    console.error("Test email failed:", error);
    res.status(500).json({ error: error.message || "Failed to send email" });
  }
});

// --- BACKGROUND JOB (Every 5 Minutes) ---
setInterval(async () => {
  console.log('--- STARTING BACKGROUND REFRESH ---');
  const dates = Object.keys(cache);
  
  for (const date of dates) {
    const entry = cache[date];
    // We reuse the last partySize requested for this date
    const newData = await scrapeDate(date, entry.partySize || 1);
    
    const isAvailable = newData.status === 'AVAILABLE' || newData.status === 'LIMITED_HIGH';
    const hasAlreadyNotified = entry.notified || false;

    // Email Logic
    let shouldNotify = false;
    if (isAvailable && !hasAlreadyNotified) {
      shouldNotify = true;
      await sendEmailAlert(date, newData);
    }

    cache[date] = {
      data: newData,
      timestamp: Date.now(),
      partySize: entry.partySize,
      // If we just notified, set true. If it was already true and still available, keep true.
      // If it's no longer available, reset to false.
      notified: isAvailable ? (shouldNotify || hasAlreadyNotified) : false
    };
    
    console.log(`[REFRESHED] ${date} - ${newData.status} (Email sent: ${shouldNotify})`);
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
         partySize: PREWARM_CONFIG.PARTY_SIZE,
         notified: false
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
  console.log(`Test email endpoint: http://localhost:${PORT}/api/test-email`);
  prewarmCache();
});