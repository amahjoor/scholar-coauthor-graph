// The current page has a conflict between "use client" and server-side functions
// Let's create a separate client component for the visualization

// Remove the "use client" directive and the generateStaticParams export from this file
// Instead, we'll make the main page a server component and use a client component for the visualization

import { Suspense } from "react";
import Image from "next/image";
import ScholarGraphWrapper from "../components/ScholarGraphWrapper";

// This is now a server component (no "use client" directive)
export default function Home() {
  const buildDate = new Date().toLocaleDateString();

  return (
    <div className="grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-4 pb-12 gap-4 sm:p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="w-full flex flex-col items-center">
        <Image
          className="dark:invert mb-4"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <h1 className="text-3xl font-bold mb-2">Scholar Co-authorship Network</h1>
        <p className="text-gray-500 mb-4">
          Visualization of co-authorship relationships between academic researchers
        </p>
      </header>
      
      <main className="w-full max-w-7xl flex flex-col gap-[16px] items-center">
        <Suspense fallback={<div className="w-full h-[700px] flex items-center justify-center bg-white">Loading Scholar Graph...</div>}>
          <ScholarGraphWrapper key="scholar-graph" />
        </Suspense>
        
      </main>
      
      <footer className="flex gap-[24px] flex-wrap items-center justify-center mt-4">
        <div className="flex flex-col items-center text-center">
          <p className="text-sm text-gray-500">
            Data from Google Scholar profiles
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Built: {buildDate} - Data is pre-rendered at build time
          </p>
        </div>
      </footer>
    </div>
  );
}
