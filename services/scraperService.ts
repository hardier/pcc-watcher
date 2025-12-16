import { AvailabilityStatus, DateCheckResult } from '../types';

/**
 * Fetches availability from our own Node.js server.
 * The server handles caching and scraping.
 */
export const checkDateAvailability = async (
  dateStr: string, // Format: MM/DD/YYYY
  partySize: number
): Promise<DateCheckResult> => {
  
  // We call our own API endpoint
  const targetUrl = `/api/check?date=${encodeURIComponent(dateStr)}&partySize=${partySize}`;

  try {
    const response = await fetch(targetUrl);
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    
    // Ensure the status comes back as a valid enum type
    return {
      ...data,
      status: data.status as AvailabilityStatus
    };

  } catch (error: any) {
    return {
      dateStr,
      status: AvailabilityStatus.ERROR,
      message: error.message || "Connection Error",
      timestamp: Date.now(),
      url: ''
    };
  }
};