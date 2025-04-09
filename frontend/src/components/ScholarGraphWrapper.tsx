"use client";

import dynamic from "next/dynamic";
import { memo } from 'react';

// Use dynamic import with ssr: false in a client component
const ScholarGraph = dynamic(() => import('./ScholarGraph'), {
  ssr: false,
  loading: () => <div className="w-full h-[700px] flex items-center justify-center bg-white">Loading Scholar Graph...</div>
});

// This wrapper is a client component that can use ssr: false
// Memoize the component to prevent unnecessary re-renders
const ScholarGraphWrapper = () => {
  return <ScholarGraph />;
}

export default memo(ScholarGraphWrapper); 