import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DateCheckResult, AvailabilityStatus, CheckConfiguration } from './types';
import { checkDateAvailability } from './services/scraperService';
import { requestNotificationPermission, sendNotification } from './services/notificationService';
import { DEFAULT_CONFIG, BASE_URL } from './constants';
import StatusCard from './components/StatusCard';
import { BellAlertIcon, BellSlashIcon, Cog6ToothIcon, ArrowPathIcon, EnvelopeIcon, UserIcon, FaceSmileIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/solid';

const App: React.FC = () => {
  const [config, setConfig] = useState<CheckConfiguration>({
    startDate: DEFAULT_CONFIG.START_DATE,
    endDate: DEFAULT_CONFIG.END_DATE,
    adults: DEFAULT_CONFIG.ADULTS,
    children: DEFAULT_CONFIG.CHILDREN
  });

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [results, setResults] = useState<DateCheckResult[]>([]);
  const [lastCheckTime, setLastCheckTime] = useState<string>('-');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getDatesToCheck = (start: string, end: string): string[] => {
    const dateArray: string[] = [];
    let currentDate = new Date(start + 'T00:00:00');
    const stopDate = new Date(end + 'T00:00:00');

    while (currentDate <= stopDate) {
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const year = currentDate.getFullYear();
      dateArray.push(`${month}/${day}/${year}`);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dateArray;
  };

  const runCheckCycle = useCallback(async (notifyIfSuccess: boolean = false) => {
    const dates = getDatesToCheck(config.startDate, config.endDate);
    setLastCheckTime(new Date().toLocaleTimeString());

    for (const dateStr of dates) {
      const result = await checkDateAvailability(dateStr, config.adults, config.children);
      setResults(prev => prev.map(r => r.dateStr === dateStr ? result : r));

      if (notifyIfSuccess && result.status === AvailabilityStatus.AVAILABLE) {
        sendNotification(
          "Real-time Tickets Found!", 
          `PCC has tickets for ${dateStr} (${config.adults} Ad, ${config.children} Ch)`, 
          result.url
        );
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }, [config]);

  const testEmailConfig = async () => {
    try {
       const res = await fetch('/api/test-email');
       const contentType = res.headers.get("content-type");
       
       // Handle case where Vercel returns HTML (like a 404 page) instead of JSON
       if (contentType && contentType.indexOf("application/json") === -1) {
         const text = await res.text();
         console.error("Non-JSON Response from server:", text);
         throw new Error(`Server returned HTML instead of JSON (Status: ${res.status}). This usually means the API route is not correctly configured on Vercel.`);
       }

       const data = await res.json();
       if (res.ok) alert("✅ Success: " + data.message);
       else alert("❌ Server Error: " + (data.error || "Unknown error"));
    } catch (e: any) {
      console.error(e);
      alert("❌ Request Failed: " + (e.message || "Network Error. Check console for details."));
    }
  };

  useEffect(() => {
    const dates = getDatesToCheck(config.startDate, config.endDate);
    setResults(dates.map(dateStr => ({
      dateStr,
      status: AvailabilityStatus.CHECKING,
      message: 'Initial check...',
      timestamp: Date.now(),
      url: `${BASE_URL}&DateVisited=${dateStr}&Qty1=${config.adults}&Qty2=${config.children}`,
      adults: config.adults,
      children: config.children
    })));
    runCheckCycle(false);
  }, [config.startDate, config.endDate, config.adults, config.children]);

  useEffect(() => {
    if (isMonitoring) {
      runCheckCycle(true);
      intervalRef.current = setInterval(() => runCheckCycle(true), 120000); // 2 min refresh
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isMonitoring, runCheckCycle]);

  const toggleMonitoring = async () => {
    if (!isMonitoring) {
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) alert("Please enable notifications.");
    }
    setIsMonitoring(!isMonitoring);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="bg-teal-700 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">PCC Real-time Watcher</h1>
              <a 
                href={BASE_URL} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-teal-200 hover:text-white transition-colors"
                title="Go to official ticketing site"
              >
                <ArrowTopRightOnSquareIcon className="w-5 h-5" />
              </a>
            </div>
            <p className="text-teal-100 text-sm">Direct Ticketing System Monitor</p>
          </div>
          <div className="text-right hidden sm:block">
             <p className="text-xs text-teal-200">Last Sync: {lastCheckTime}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Start</label>
              <input type="date" value={config.startDate} onChange={(e) => setConfig({...config, startDate: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">End</label>
              <input type="date" value={config.endDate} onChange={(e) => setConfig({...config, endDate: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
            </div>
            <div className="md:col-span-1 grid grid-cols-2 gap-2">
              <div>
                <label className="flex items-center text-xs font-bold text-gray-500 mb-1 uppercase">
                  <UserIcon className="w-3 h-3 mr-1"/> Ad
                </label>
                <input type="number" min={0} value={config.adults} onChange={(e) => setConfig({...config, adults: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div>
                <label className="flex items-center text-xs font-bold text-gray-500 mb-1 uppercase">
                  <FaceSmileIcon className="w-3 h-3 mr-1"/> Ch
                </label>
                <input type="number" min={0} value={config.children} onChange={(e) => setConfig({...config, children: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
            </div>
            <button onClick={toggleMonitoring} className={`flex items-center justify-center space-x-2 px-6 py-2.5 rounded-lg font-bold text-white transition-colors shadow-md ${isMonitoring ? 'bg-slate-500 hover:bg-slate-600' : 'bg-teal-600 hover:bg-teal-700'}`}>
              {isMonitoring ? <BellSlashIcon className="w-5 h-5"/> : <BellAlertIcon className="w-5 h-5"/>}
              <span>{isMonitoring ? 'Stop Alerts' : 'Notify Me'}</span>
            </button>
          </div>
          
          <div className="mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-gray-400 gap-3">
             <div className="flex flex-col gap-1">
               <div className="flex items-center gap-1">
                 <Cog6ToothIcon className="w-3 h-3"/>
                 <span>Checking Bundle 101 (Super Ambassador)</span>
               </div>
               <div className="flex items-center gap-1">
                 <ArrowTopRightOnSquareIcon className="w-3 h-3 text-teal-600"/>
                 <a href={BASE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-teal-600 underline">Official Ticketing Page</a>
               </div>
             </div>
             <div className="flex space-x-4 w-full sm:w-auto justify-end">
                <button onClick={testEmailConfig} className="flex items-center gap-1 hover:text-teal-600 transition-colors"><EnvelopeIcon className="w-3 h-3" /> Test Mail</button>
                <button onClick={() => runCheckCycle(false)} className="flex items-center gap-1 hover:text-teal-600 transition-colors"><ArrowPathIcon className="w-3 h-3" /> Refresh</button>
             </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 flex justify-between">
            <span>Live Availability</span>
            {isMonitoring && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full animate-pulse font-medium">Monitoring active</span>}
          </h2>
          {results.length === 0 ? (
            <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-slate-300">
              No dates selected.
            </div>
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