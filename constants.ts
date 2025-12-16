export const BASE_URL = "https://www.polynesia.com/packages/all/super-ambassador-package?_d=";

// Using a CORS proxy to bypass browser restrictions when fetching external HTML from the client side
// In a production app with a backend, you would fetch directly from the backend.
export const CORS_PROXY_URL = "https://api.allorigins.win/get?url=";

export const PATTERNS = {
  // Matches: "SOLDOUT! Please choose another date!"
  SOLD_OUT: /SOLDOUT! Please choose another date!/i,
  
  // Matches: "Limited Availability! Book Now! X tickets left"
  LOW_COUNT: /Limited Availability! Book Now! ([1-5]) tickets left/i,
  
  // Matches: "Tickets available. Book Now!"
  AVAILABLE: /Tickets available\. Book Now!/i,
  
  // Matches: "Limited Availability! Book Now!" (without the count usually means > 5)
  LIMITED_GENERAL: /Limited Availability! Book Now!/i
};

export const DEFAULT_CONFIG = {
  START_DATE: '2025-12-25',
  END_DATE: '2025-12-29',
  PARTY_SIZE: 6
};