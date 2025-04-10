"use client";

import dynamic from "next/dynamic";
import { memo, useState } from 'react';

// Use dynamic import with ssr: false in a client component
const ScholarGraph = dynamic(() => import('./ScholarGraph'), {
  ssr: false,
  loading: () => <div className="w-full h-screen flex items-center justify-center bg-white">Loading Scholar Graph...</div>
});

// This wrapper is a client component that can use ssr: false
// Memoize the component to prevent unnecessary re-renders
const ScholarGraphWrapper = () => {
  const [graphType, setGraphType] = useState<'author' | 'institution'>('author');

  return (
    <div className="flex flex-col w-full h-screen">
      <div className="flex justify-center p-2 bg-gray-100 border-b">
        <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm">
          <button 
            className={`px-4 py-2 rounded-md transition-colors ${
              graphType === 'author' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            onClick={() => setGraphType('author')}
          >
            Author Network
          </button>
          <button 
            className={`px-4 py-2 rounded-md transition-colors ${
              graphType === 'institution' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            onClick={() => setGraphType('institution')}
          >
            Institution Network
          </button>
        </div>
      </div>
      <div className="flex-grow">
        <ScholarGraph graphType={graphType} />
      </div>
    </div>
  );
}

export default memo(ScholarGraphWrapper); 