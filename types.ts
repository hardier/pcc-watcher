
// Fix: Added LIMITED_HIGH and LIMITED_LOW to AvailabilityStatus enum to resolve 
// property access errors in StatusCard component where these statuses were used but not defined.
export enum AvailabilityStatus {
  IDLE = 'IDLE',
  CHECKING = 'CHECKING',
  AVAILABLE = 'AVAILABLE',
  LIMITED_HIGH = 'LIMITED_HIGH',
  LIMITED_LOW = 'LIMITED_LOW',
  SOLD_OUT = 'SOLD_OUT',
  ERROR = 'ERROR',
  UNKNOWN = 'UNKNOWN'
}

export interface DateCheckResult {
  dateStr: string; // MM/DD/YYYY
  status: AvailabilityStatus;
  message: string;
  timestamp: number;
  url: string;
  adults: number;
  children: number;
}

export interface CheckConfiguration {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  adults: number;
  children: number;
}
