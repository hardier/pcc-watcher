export enum AvailabilityStatus {
  IDLE = 'IDLE',
  CHECKING = 'CHECKING',
  AVAILABLE = 'AVAILABLE',
  LIMITED_HIGH = 'LIMITED_HIGH', // Good (>= party size)
  LIMITED_LOW = 'LIMITED_LOW',   // Bad (< party size)
  SOLD_OUT = 'SOLD_OUT',
  ERROR = 'ERROR',
  UNKNOWN = 'UNKNOWN'
}

export interface DateCheckResult {
  dateStr: string; // MM/DD/YYYY
  status: AvailabilityStatus;
  message: string;
  ticketsLeft?: number;
  timestamp: number;
  url: string;
}

export interface CheckConfiguration {
  startDate: string; // YYYY-MM-DD for input
  endDate: string;   // YYYY-MM-DD for input
  partySize: number;
}