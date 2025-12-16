import React from 'react';
import { AvailabilityStatus, DateCheckResult } from '../types';
import { ArrowTopRightOnSquareIcon, ClockIcon, ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

interface StatusCardProps {
  result: DateCheckResult;
}

const StatusCard: React.FC<StatusCardProps> = ({ result }) => {
  
  const getStatusColor = (status: AvailabilityStatus) => {
    switch (status) {
      case AvailabilityStatus.AVAILABLE:
      case AvailabilityStatus.LIMITED_HIGH:
        return 'bg-green-100 border-green-500 text-green-900';
      case AvailabilityStatus.LIMITED_LOW:
        return 'bg-orange-100 border-orange-500 text-orange-900';
      case AvailabilityStatus.SOLD_OUT:
        return 'bg-red-100 border-red-500 text-red-900';
      case AvailabilityStatus.CHECKING:
        return 'bg-blue-50 border-blue-300 text-blue-900';
      case AvailabilityStatus.ERROR:
        return 'bg-gray-200 border-gray-400 text-gray-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-600';
    }
  };

  const getIcon = (status: AvailabilityStatus) => {
    switch (status) {
      case AvailabilityStatus.CHECKING: return <ClockIcon className="w-6 h-6 animate-pulse" />;
      case AvailabilityStatus.AVAILABLE:
      case AvailabilityStatus.LIMITED_HIGH: return <CheckCircleIcon className="w-6 h-6 text-green-600" />;
      case AvailabilityStatus.LIMITED_LOW: return <ExclamationTriangleIcon className="w-6 h-6 text-orange-600" />;
      case AvailabilityStatus.SOLD_OUT: return <XCircleIcon className="w-6 h-6 text-red-600" />;
      default: return <ExclamationTriangleIcon className="w-6 h-6 text-gray-500" />;
    }
  };

  const isSuccess = result.status === AvailabilityStatus.AVAILABLE || result.status === AvailabilityStatus.LIMITED_HIGH;

  return (
    <div className={`relative p-4 rounded-lg border-l-4 shadow-sm transition-all duration-300 ${getStatusColor(result.status)}`}>
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-3">
          {getIcon(result.status)}
          <div>
            <h3 className="font-bold text-lg">{result.dateStr}</h3>
            <p className="text-sm font-medium mt-1">{result.message}</p>
            <p className="text-xs opacity-60 mt-1">Last Checked: {new Date(result.timestamp).toLocaleTimeString()}</p>
          </div>
        </div>
        
        {isSuccess && (
          <a 
            href={result.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center space-x-1 bg-white hover:bg-gray-50 text-gray-800 font-semibold py-2 px-4 border border-gray-300 rounded shadow text-sm"
          >
            <span>Book Now</span>
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
};

export default StatusCard;