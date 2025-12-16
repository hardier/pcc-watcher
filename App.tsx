import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DateCheckResult, AvailabilityStatus, CheckConfiguration } from './types';
import { checkDateAvailability } from './services/scraperService';
import { requestNotificationPermission, sendNotification } from './services/notificationService';
import { DEFAULT_CONFIG } from './constants';
import StatusCard from './components/StatusCard';
import { PlayIcon, StopIcon, Cog6ToothIcon } from '@heroicons/react/24/solid';

const App: React.FC = () => {
  // Config State
  const [config, setConfig] = useState<CheckConfiguration>({
    startDate: DEFAULT_CONFIG.START_DATE,
    endDate: DEFAULT_CONFIG.END_DATE,
    partySize: DEFAULT_CONFIG.PARTY_SIZE
  });

  // App State
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DateCheckResult[]>([]);
  const [lastCheckTime, setLastCheckTime] = useState<string>('-');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Helper to generate date strings
  const getDatesToCheck = (start: string, end: string): string[] => {
    const dateArray: string[] = [];
    let currentDate = new Date(start + 'T00:00:00'); // Fix TZ issues by appending time
    const stopDate = new Date(end + 'T00:00:00');

    while (currentDate <= stopDate) {
      // Format as MM/DD/YYYY for the URL
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const year = currentDate.getFullYear();
      dateArray.push(`${month}/${day}/${year}`);
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dateArray;
  };

  // Initialize Results List
  useEffect(() => {
    const dates = getDatesToCheck(config.startDate, config.endDate);
    const initialResults: DateCheckResult[] = dates.map(dateStr => ({
      dateStr,
      status: AvailabilityStatus.IDLE,
      message: 'Waiting to start...',
      timestamp: Date.now(),
      url: ''
    }));
    setResults(initialResults);
  }, [config.startDate, config.endDate]);

  const runCheckCycle = useCallback(async () => {
    setLastCheckTime(new Date().toLocaleTimeString());
    
    const dates = getDatesToCheck(config.startDate, config.endDate);
    
    // Process one by one to avoid rate limiting or overwhelming the proxy
    for (const dateStr of dates) {
      // Set status to checking
      setResults(prev => prev.map(r => 
        r.dateStr === dateStr ? { ...r, status: AvailabilityStatus.CHECKING, message: 'Checking...' } : r
      ));

      // Perform check
      const result = await checkDateAvailability(dateStr, config.partySize);
      
      // Update result
      setResults(prev => prev.map(r => r.dateStr === dateStr ? result : r));

      // Notify if success
      if (result.status === AvailabilityStatus.AVAILABLE || result.status === AvailabilityStatus.LIMITED_HIGH) {
        sendNotification(
          "Tickets Found!", 
          `${result.message} for ${dateStr}`, 
          result.url
        );
      }

      // Small delay between requests to be polite
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }, [config.startDate, config.endDate, config.partySize]);

  const toggleMonitoring = async () => {
    if (isRunning) {
      setIsRunning(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } else {
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        alert("Please enable notifications to receive alerts when tickets are found.");
      }
      
      setIsRunning(true);
      // Run immediately
      runCheckCycle();
      // Then run every 60 seconds
      intervalRef.current = setInterval(runCheckCycle, 60000);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Header */}
      <header className="bg-teal-700 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">PCC Ticket Watcher</h1>
            <p className="text-teal-100 text-sm">Super Ambassador Package Availability</p>
          </div>
          <div className="text-right hidden sm:block">
             <p className="text-xs text-teal-200">Last Check: {lastCheckTime}</p>
             <p className="text-xs text-teal-200">Status: {isRunning ? 'Running' : 'Stopped'}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        
        {/* Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
            
            <div className="grid grid-cols-2 gap-4 flex-1 w-full">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Start Date</label>
                <input 
                  type="date" 
                  disabled={isRunning}
                  value={config.startDate}
                  onChange={(e) => setConfig({...config, startDate: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">End Date</label>
                <input 
                  type="date" 
                  disabled={isRunning}
                  value={config.endDate}
                  onChange={(e) => setConfig({...config, endDate: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="w-full md:w-32">
               <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Party Size</label>
                <input 
                  type="number" 
                  min={1}
                  disabled={isRunning}
                  value={config.partySize}
                  onChange={(e) => setConfig({...config, partySize: parseInt(e.target.value) || 1})}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
                />
            </div>

            <button
              onClick={toggleMonitoring}
              className={`w-full md:w-auto flex items-center justify-center space-x-2 px-6 py-2.5 rounded-lg font-bold text-white transition-colors shadow-md ${
                isRunning 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              {isRunning ? <StopIcon className="w-5 h-5"/> : <PlayIcon className="w-5 h-5"/>}
              <span>{isRunning ? 'Stop Monitor' : 'Start Monitor'}</span>
            </button>
          </div>
          
          <div className="mt-4 text-xs text-gray-400 flex items-center gap-1">
             <Cog6ToothIcon className="w-3 h-3"/>
             <span>Uses CORS proxy to scrape polynesia.com directly from browser. Check runs every 60s.</span>
          </div>
        </div>

        {/* Results Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Availability Status</h2>
          {results.length === 0 ? (
             <div className="text-center py-10 text-gray-400 italic">Configure dates above to begin.</div>
          ) : (
            <div className="grid gap-4">
              {results.map((result) => (
                <StatusCard key={result.dateStr} result={result} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;