import { AvailabilityStatus, DateCheckResult } from '../types';
import { BASE_URL, CORS_PROXY_URL } from '../constants';

const PATTERNS = {
  SOLD_OUT: /SOLDOUT! Please choose another date!/i,
  LOW_COUNT: /Limited Availability! Book Now! ([1-5]) tickets left/i,
  AVAILABLE: /Tickets available\. Book Now!/i,
  LIMITED_GENERAL: /Limited Availability! Book Now!/i
};

/**
 * Fallback: Scrapes directly from the browser using a CORS proxy.
 * Used when the local Node.js server is not running or unreachable.
 */
async function scrapeDateClientSide(dateStr: string, partySize: number): Promise<DateCheckResult> {
  const targetUrl = `${BASE_URL}${dateStr}`;
  // Construct proxy URL
  const proxyUrl = `${CORS_PROXY_URL}${encodeURIComponent(targetUrl)}`;
  
  const result: DateCheckResult = {
    dateStr,
    status: AvailabilityStatus.UNKNOWN,
    message: 'Initializing...',
    timestamp: Date.now(),
    url: targetUrl
  };

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
    
    const pageText = await response.text();

    if (PATTERNS.SOLD_OUT.test(pageText)) {
      result.status = AvailabilityStatus.SOLD_OUT;
      result.message = "Sold Out";
    } else {
      const lowMatch = pageText.match(PATTERNS.LOW_COUNT);
      if (lowMatch) {
        const ticketsLeft = parseInt(lowMatch[1], 10);
        result.ticketsLeft = ticketsLeft;
        
        if (ticketsLeft < partySize) {
          result.status = AvailabilityStatus.LIMITED_LOW;
          result.message = `Only ${ticketsLeft} ticket(s) left (Need ${partySize})`;
        } else {
          result.status = AvailabilityStatus.LIMITED_HIGH;
          result.message = `Available - ${ticketsLeft} tickets left!`;
        }
      } else if (PATTERNS.AVAILABLE.test(pageText)) {
        result.status = AvailabilityStatus.AVAILABLE;
        result.message = "Available! Book Now!";
      } else if (PATTERNS.LIMITED_GENERAL.test(pageText)) {
        result.status = AvailabilityStatus.LIMITED_HIGH;
        result.message = "Limited Availability";
      } else {
        result.status = AvailabilityStatus.UNKNOWN;
        result.message = "Status text not found";
      }
    }
  } catch (error: any) {
    console.error("Client side scrape error:", error);
    result.status = AvailabilityStatus.ERROR;
    result.message = error.message || "Client Scrape Error";
  }
  return result;
}

/**
 * Main check function.
 * Tries Server API -> Falls back to Client Proxy.
 */
export const checkDateAvailability = async (
  dateStr: string, // Format: MM/DD/YYYY
  partySize: number
): Promise<DateCheckResult> => {
  
  // 1. Try Local Node.js Server API (Good for caching)
  const apiTargetUrl = `/api/check?date=${encodeURIComponent(dateStr)}&partySize=${partySize}`;

  try {
    const response = await fetch(apiTargetUrl);
    
    // If 404, the server endpoint doesn't exist (e.g., only Vite dev server is running, or static deploy)
    if (response.status === 404) {
      console.warn("Server API not found (404). Falling back to client-side proxy.");
      return scrapeDateClientSide(dateStr, partySize);
    }

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      ...data,
      status: data.status as AvailabilityStatus
    };

  } catch (error: any) {
    // If fetch failed completely (e.g. connection refused), fallback to client side
    console.warn("Could not reach server API. Falling back to client-side proxy.", error);
    return scrapeDateClientSide(dateStr, partySize);
  }
};