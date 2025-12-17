import { AvailabilityStatus, DateCheckResult } from '../types';
import { BASE_URL, CORS_PROXY_URL } from '../constants';

const SOLD_OUT_TEXT = "The package you’ve selected is sold out. Please select a different date.";

/**
 * Fallback: Scrapes directly from the browser using a CORS proxy.
 */
async function scrapeDateClientSide(dateStr: string, adults: number, children: number): Promise<DateCheckResult> {
  const targetUrl = `${BASE_URL}&DateVisited=${dateStr}&Qty1=${adults}&Qty2=${children}`;
  const proxyUrl = `${CORS_PROXY_URL}${encodeURIComponent(targetUrl)}`;
  
  const result: DateCheckResult = {
    dateStr,
    status: AvailabilityStatus.UNKNOWN,
    message: 'Checking...',
    timestamp: Date.now(),
    url: targetUrl,
    adults,
    children
  };

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`Network error: ${response.status}`);
    
    const pageText = await response.text();

    if (pageText.includes(SOLD_OUT_TEXT)) {
      result.status = AvailabilityStatus.SOLD_OUT;
      result.message = "Sold Out";
    } else if (pageText.includes("Your Order Summary") || pageText.includes("Proceed To checkout") || pageText.includes("BundleSelect")) {
      // If we don't see the sold out message and see order elements, it's likely available
      result.status = AvailabilityStatus.AVAILABLE;
      result.message = "Available! (Real-time check)";
    } else {
      result.status = AvailabilityStatus.UNKNOWN;
      result.message = "Ambiguous status - check manually";
    }
  } catch (error: any) {
    result.status = AvailabilityStatus.ERROR;
    result.message = error.message || "Scrape Error";
  }
  return result;
}

export const checkDateAvailability = async (
  dateStr: string,
  adults: number,
  children: number
): Promise<DateCheckResult> => {
  const apiTargetUrl = `/api/check?date=${encodeURIComponent(dateStr)}&adults=${adults}&children=${children}`;

  try {
    const response = await fetch(apiTargetUrl);
    if (response.status === 404) {
      return scrapeDateClientSide(dateStr, adults, children);
    }
    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.json();
    return {
      ...data,
      status: data.status as AvailabilityStatus
    };
  } catch (error: any) {
    return scrapeDateClientSide(dateStr, adults, children);
  }
};