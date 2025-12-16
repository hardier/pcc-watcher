import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DateCheckResult, AvailabilityStatus, CheckConfiguration } from './types';
import { checkDateAvailability } from './services/scraperService';
import { requestNotificationPermission, sendNotification } from './services/notificationService';
import { DEFAULT_CONFIG } from './constants';
import StatusCard from './components/StatusCard';
import { BellAlertIcon, BellSlashIcon, Cog6ToothIcon, ArrowPathIcon, EnvelopeIcon } from '@heroicons/react/24/solid';

const App: React.FC = () => {
  // Config State
  const [config, setConfig] = useState<CheckConfiguration>({
    startDate: DEFAULT_CONFIG.START_DATE,
    endDate: DEFAULT_CONFIG.END_DATE,
    partySize: DEFAULT_CONFIG.PARTY_SIZE
  });

  // App State
  const [isMonitoring, setIsMonitoring] = useState(false);
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

  /**
   * Main Check Logic
   * @param notifyIfSuccess If true, sends desktop notification on success.
   */
  const runCheckCycle = useCallback(async (notifyIfSuccess: boolean = false) => {
    const dates = getDatesToCheck(config.startDate, config.endDate);
    setLastCheckTime(new Date().toLocaleTimeString());

    // NOTE: We don't map results to "CHECKING" here because we want to preserve 
    // the previous state while the background refresh happens, unless it's the very first load.
    
    for (const dateStr of dates) {
      // Perform check
      const result = await checkDateAvailability(dateStr, config.partySize);
      
      // Update result state immediately
      setResults(prev => prev.map(r => r.dateStr === dateStr ? result : r));

      // Notify if requested (Monitoring mode)
      if (notifyIfSuccess && (result.status === AvailabilityStatus.AVAILABLE || result.status === AvailabilityStatus.LIMITED_HIGH)) {
        sendNotification(
          "Tickets Found!", 
          `${result.message} for ${dateStr}`, 
          result.url
        );
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }, [config.startDate, config.endDate, config.partySize]);

  const testEmailConfig = async () => {
    const originalText = "Test Email";
    // Simple feedback mechanism
    try {
       const res = await fetch('/api/test-email');
       const data = await res.json();
       if (res.ok) {
         alert("✅ Success: " + data.message);
       } else {
         alert("❌ Error: " + (data.error || "Failed to send email. Check server console."));
       }
    } catch (e) {
      alert("❌ Network Error: Could not reach server to test email.");
    }
  };

  // --- Effect: Auto-Fetch on Mount or Config Change ---
  useEffect(() => {
    const dates = getDatesToCheck(config.startDate, config.endDate);
    
    // 1. Initialize empty/loading state immediately
    setResults(dates.map(dateStr => ({
      dateStr,
      status: AvailabilityStatus.CHECKING,
      message: 'Loading data...',
      timestamp: Date.now(),
      url: ''
    })));

    // 2. Fetch data (without notifications)
    runCheckCycle(false);

  }, [config.startDate, config.endDate, config.partySize]); // Only re-run if dates change

  // --- Effect: Monitoring Loop ---
  useEffect(() => {
    if (isMonitoring) {
      // Run immediately when enabled
      runCheckCycle(true);
      
      // Setup interval (e.g. every 60s)
      intervalRef.current = setInterval(() => {
        runCheckCycle(true);
      }, 60000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isMonitoring, runCheckCycle]);

  const toggleMonitoring = async () => {
    if (!isMonitoring) {
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        alert("Please enable notifications to receive alerts when tickets are found.");
      }
    }
    setIsMonitoring(!isMonitoring);
  };

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
             <p className="text-xs text-teal-200">Server: Active (5m Refresh)</p>
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
                  value={config.startDate}
                  onChange={(e) => setConfig({...config, startDate: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">End Date</label>
                <input 
                  type="date" 
                  value={config.endDate}
                  onChange={(e) => setConfig({...config, endDate: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="w-full md:w-32">
               <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Party Size</label>
                <input 
                  type="number" 
                  min={1}
                  value={config.partySize}
                  onChange={(e) => setConfig({...config, partySize: parseInt(e.target.value) || 1})}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
            </div>

            <button
              onClick={toggleMonitoring}
              className={`w-full md:w-auto flex items-center justify-center space-x-2 px-6 py-2.5 rounded-lg font-bold text-white transition-colors shadow-md ${
                isMonitoring 
                  ? 'bg-slate-500 hover:bg-slate-600' 
                  : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              {isMonitoring ? <BellSlashIcon className="w-5 h-5"/> : <BellAlertIcon className="w-5 h-5"/>}
              <span>{isMonitoring ? 'Stop Alerts' : 'Notify Me'}</span>
            </button>
          </div>
          
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-400 gap-2">
             <div className="flex items-center gap-1">
               <Cog6ToothIcon className="w-3 h-3"/>
               <span>Server automatically refreshes status every 5 minutes.</span>
             </div>
             
             <div className="flex space-x-4">
                <button 
                  onClick={testEmailConfig}
                  className="flex items-center gap-1 hover:text-teal-600 transition-colors"
                  title="Send a test email to verify credentials"
                >
                  <EnvelopeIcon className="w-3 h-3" />
                  <span>Test Email</span>
                </button>
                <button 
                    onClick={() => runCheckCycle(false)} 
                    className="flex items-center gap-1 hover:text-teal-600 transition-colors"
                >
                    <ArrowPathIcon className="w-3 h-3" />
                    <span>Force Refresh Now</span>
                </button>
             </div>
          </div>
        </div>

        {/* Results Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 flex justify-between">
            <span>Availability Status</span>
            {isMonitoring && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Monitoring for changes...</span>}
          </h2>
          {results.length === 0 ? (
             <div className="text-center py-10 text-gray-400 italic">Select dates to view availability.</div>
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