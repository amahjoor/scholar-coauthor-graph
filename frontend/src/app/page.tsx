"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let sigmaInstance: any = null;

    const initGraph = async () => {
      if (!containerRef.current) return;
      
      try {
        setLoading(true);
        
        // Dynamically import libraries
        const graphology = await import("graphology");
        const Sigma = (await import("sigma")).default;
        const forceAtlas2Default = await import('graphology-layout-forceatlas2');
        
        // ForceAtlas2 is the default export
        const forceAtlas2 = forceAtlas2Default.default;
        
        // Fetch coauthor data from our consolidated API endpoint
        const response = await fetch('/api?endpoint=coauthors');
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Create graph
        const graph = new graphology.default();
        
        // Add nodes
        data.nodes.forEach((node: any) => {
          graph.addNode(node.id, {
            label: node.label,
            size: node.size,
            color: node.color,
            x: Math.random(), // Random initial positions
            y: Math.random()
          });
        });
        
        // Add edges
        data.edges.forEach((edge: any) => {
          if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
            try {
              graph.addEdge(edge.source, edge.target, {
                size: edge.size,
                color: edge.color
              });
            } catch (e) {
              // Skip duplicate edges
              console.log('Skipping duplicate edge:', edge);
            }
          }
        });
        
        // Run layout algorithm
        console.log("Running layout algorithm...");
        forceAtlas2.assign(graph, {
          iterations: 100,
          settings: {
            gravity: 5,
            scalingRatio: 10,
            strongGravityMode: true,
            slowDown: 10
          }
        });
        console.log("Layout complete");
        
        // Render sigma instance
        sigmaInstance = new Sigma(graph, containerRef.current);
        
        setLoading(false);
      } catch (err) {
        console.error("Error initializing graph:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      }
    };

    initGraph();

    // Cleanup function
    return () => {
      if (sigmaInstance) {
        sigmaInstance.kill();
      }
    };
  }, []);

  return (
    <div className="grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-8 pb-20 gap-8 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <header className="w-full flex flex-col items-center">
        <Image
          className="dark:invert mb-8"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <h1 className="text-3xl font-bold mb-4">Scholar Co-authorship Network</h1>
        <p className="text-gray-500 mb-4">
          Visualization of co-authorship relationships between academic researchers
        </p>
      </header>
      
      <main className="w-full max-w-7xl flex flex-col gap-[32px] items-center">
        {/* Sigma.js container */}
        <div className="relative w-full h-[700px] bg-white border border-gray-200 rounded-lg shadow-md">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
              <div className="text-xl font-semibold">Loading co-author network...</div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
              <div className="text-xl font-semibold text-red-500">Error: {error}</div>
            </div>
          )}
          
          <div 
            ref={containerRef}
            className="w-full h-full"
          ></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-sm">
          <div className="bg-blue-100 p-4 rounded-lg">
            <h3 className="font-bold mb-2">Main Authors</h3>
            <p>Shown in blue, these represent authors whose coauthorship data has been analyzed.</p>
          </div>
          
          <div className="bg-red-100 p-4 rounded-lg">
            <h3 className="font-bold mb-2">Co-authors</h3>
            <p>Shown in red, these represent researchers who have collaborated with the main authors.</p>
          </div>
          
          <div className="bg-purple-100 p-4 rounded-lg">
            <h3 className="font-bold mb-2">Connections</h3>
            <p>Lines connecting nodes represent co-authorship relationships between researchers.</p>
          </div>
        </div>
      </main>
      
      <footer className="flex gap-[24px] flex-wrap items-center justify-center mt-4">
        <p className="text-sm text-gray-500">
          Data from Google Scholar profiles
        </p>
      </footer>
    </div>
  );
}
