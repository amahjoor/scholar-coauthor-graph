// The current page has a conflict between "use client" and server-side functions
// Let's create a separate client component for the visualization

// Remove the "use client" directive and the generateStaticParams export from this file
// Instead, we'll make the main page a server component and use a client component for the visualization

import { Suspense } from "react";
import ScholarGraphWrapper from "../components/ScholarGraphWrapper";

// This is now a server component (no "use client" directive)
export default function Home() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <Suspense fallback={<div className="w-full h-screen flex items-center justify-center bg-white">Loading Scholar Graph...</div>}>
        <ScholarGraphWrapper key="scholar-graph" />
      </Suspense>
    </div>
  );
}
