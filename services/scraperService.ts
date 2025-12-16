import { AvailabilityStatus, DateCheckResult } from '../types';
import { BASE_URL, CORS_PROXY_URL, PATTERNS } from '../constants';

/**
 * Fetches HTML content via a CORS proxy and parses it using DOMParser.
 */
export const checkDateAvailability = async (
  dateStr: string, // Format: MM/DD/YYYY
  partySize: number
): Promise<DateCheckResult> => {
  const targetUrl = `${BASE_URL}${dateStr}`;
  // We encode the URL component to pass it safely to the proxy
  const proxyUrl = `${CORS_PROXY_URL}${encodeURIComponent(targetUrl)}`;

  const result: DateCheckResult = {
    dateStr,
    status: AvailabilityStatus.CHECKING,
    message: 'Initializing...',
    timestamp: Date.now(),
    url: targetUrl
  };

  try {
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status}`);
    }

    const data = await response.json();
    const htmlContent = data.contents; // allorigins returns content in this field

    if (!htmlContent) {
      throw new Error("Empty content received from proxy");
    }

    // Parse HTML to text
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const pageText = doc.body.textContent || "";
    
    // Clean text (remove extra whitespace)
    const cleanText = pageText.replace(/\s+/g, ' ').trim();

    // --- Logic ported from Python script ---

    // 1. Check SOLD OUT
    if (PATTERNS.SOLD_OUT.test(cleanText)) {
      result.status = AvailabilityStatus.SOLD_OUT;
      result.message = "Sold Out";
      return result;
    }

    // 2. Check Low Count (Specific number of tickets left)
    const lowMatch = cleanText.match(PATTERNS.LOW_COUNT);
    if (lowMatch) {
      const ticketsLeft = parseInt(lowMatch[1], 10);
      result.ticketsLeft = ticketsLeft;
      
      if (ticketsLeft < partySize) {
        result.status = AvailabilityStatus.LIMITED_LOW;
        result.message = `Only ${ticketsLeft} ticket(s) left (Need ${partySize})`;
      } else {
        // Technically this is enough tickets, even if "Limited"
        result.status = AvailabilityStatus.LIMITED_HIGH;
        result.message = `Available - ${ticketsLeft} tickets left!`;
      }
      return result;
    }

    // 3. Check Available
    if (PATTERNS.AVAILABLE.test(cleanText)) {
      result.status = AvailabilityStatus.AVAILABLE;
      result.message = "Available! Book Now!";
      return result;
    }

    // 4. Check Limited General (Potentially Success)
    if (PATTERNS.LIMITED_GENERAL.test(cleanText)) {
      result.status = AvailabilityStatus.LIMITED_HIGH;
      result.message = "Limited Availability (Likely enough)";
      return result;
    }

    // Default
    result.status = AvailabilityStatus.UNKNOWN;
    result.message = "Status text not found on page";
    return result;

  } catch (error: any) {
    result.status = AvailabilityStatus.ERROR;
    result.message = error.message || "Unknown Error";
    return result;
  }
};