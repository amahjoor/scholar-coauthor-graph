"use client";

import { useEffect, useRef, useState } from "react";

// Declare the global window object with graphology property
declare global {
  interface Window {
    graphology: any;
  }
}

// Simple controls component
interface ControlsProps {
  maxNodes: number;
  setMaxNodes: (value: number) => void;
  minWeight: number;
  setMinWeight: (value: number) => void;
  onApply: () => void;
  isLoading: boolean;
}

function Controls({ 
  maxNodes, 
  setMaxNodes, 
  minWeight, 
  setMinWeight, 
  onApply, 
  isLoading
}: ControlsProps) {
  return (
    <div className="bg-white p-4 rounded-lg shadow mb-4 flex flex-col md:flex-row gap-4">
      <div className="flex flex-col">
        <label htmlFor="maxNodes" className="text-sm font-medium mb-1">Max Authors</label>
        <input
          id="maxNodes"
          type="number"
          min="5"
          max="200"
          value={maxNodes}
          onChange={(e) => setMaxNodes(Number(e.target.value))}
          className="border rounded px-2 py-1"
        />
      </div>
      
      <div className="flex flex-col">
        <label htmlFor="minWeight" className="text-sm font-medium mb-1">Min Connection Strength</label>
        <input
          id="minWeight"
          type="number"
          min="1"
          max="10"
          value={minWeight}
          onChange={(e) => setMinWeight(Number(e.target.value))}
          className="border rounded px-2 py-1"
        />
      </div>
      
      <div className="flex items-end">
        <button 
          onClick={onApply} 
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded disabled:bg-blue-300"
        >
          {isLoading ? 'Loading...' : 'Apply'}
        </button>
      </div>
    </div>
  );
}

// Color palette for communities (predefined to avoid black)
const COLORS = [
  "#4169E1", // Royal Blue
  "#FF6347", // Tomato
  "#32CD32", // Lime Green
  "#FFD700", // Gold
  "#8A2BE2", // Blue Violet
  "#FF4500", // Orange Red
  "#00CED1", // Dark Turquoise
  "#FF1493", // Deep Pink
  "#00FA9A", // Medium Spring Green
  "#9370DB", // Medium Purple
  "#F08080", // Light Coral
  "#1E90FF", // Dodger Blue
  "#FF8C00", // Dark Orange
  "#20B2AA", // Light Sea Green
  "#9932CC", // Dark Orchid
  "#228B22"  // Forest Green
];

export default function ScholarGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Graph configuration state
  const [maxNodes, setMaxNodes] = useState(3);
  const [minWeight, setMinWeight] = useState(1);
  
  // Full dataset reference (loaded once)
  const [fullData, setFullData] = useState<any | null>(null);
  
  // Stats for the graph
  const [stats, setStats] = useState({
    nodeCount: 0,
    edgeCount: 0,
    communityCount: 0
  });

  // Track the active renderer
  const sigmaRef = useRef<any>(null);
  // Add mounting ref to prevent double initialization
  const isMountedRef = useRef<boolean>(false);
  
  // Function to get a color for a community
  const getColorForCommunity = (communityId: number): string => {
    // Use predefined colors to avoid black
    return COLORS[communityId % COLORS.length];
  };

  // Function to clean up any existing renderer
  const cleanupRenderer = () => {
    // Only attempt cleanup if we have a reference and containerRef exists
    if (sigmaRef.current && containerRef.current) {
      try {
        console.log("Cleaning up existing renderer");
        sigmaRef.current.kill();
        sigmaRef.current = null;
        
        // Also completely clear the container
        containerRef.current.innerHTML = '';
      } catch (err) {
        console.error("Error during cleanup:", err);
      }
    }
  };

  // Function to render the graph with GEXF data
  const renderGraph = async (graph: any) => {
    if (!containerRef.current) return;
    
    // First, ensure any existing renderer is cleaned up
    cleanupRenderer();
    
    try {
      // Wait a short delay to ensure DOM is ready after cleanup
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check if container has dimensions
      const containerRect = containerRef.current.getBoundingClientRect();
      console.log("Container dimensions:", containerRect.width, "x", containerRect.height);
      
      if (containerRect.width === 0) {
        console.warn("Container has no width. Waiting for layout to complete...");
        // Add a delay to allow the layout to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Dynamically import libraries
      const Sigma = (await import("sigma")).default;
      const parsers = await import("graphology-gexf/browser");
      const forceAtlas2Default = await import('graphology-layout-forceatlas2');
      
      // ForceAtlas2 is the default export
      const forceAtlas2 = forceAtlas2Default.default;
      
      // Ensure all nodes have valid coordinates before rendering
      // This is a safety check in case some nodes are missing coordinates
      let needsLayout = false;
      
      graph.forEachNode((node: string, attributes: any) => {
        if (typeof attributes.x !== 'number' || typeof attributes.y !== 'number' ||
            isNaN(attributes.x) || isNaN(attributes.y)) {
          needsLayout = true;
          attributes.x = Math.random() * 100 - 50;
          attributes.y = Math.random() * 100 - 50;
        }
        
        // Store the node type as an attribute but ensure all nodes use the same program
        // This prevents the "could not find a suitable program" error
        if (attributes.type !== 'circle') {
          attributes.nodeType = attributes.type || attributes.nodeType; // Store original type
          attributes.type = 'circle';  // Set all nodes to use the circle program
        }
      });
      
      // Only run layout if coordinates are missing or on first load
      if (needsLayout) {
        console.log("Applying layout algorithm...");
        forceAtlas2.assign(graph, {
          iterations: 100,
          settings: {
            gravity: 3,
            scalingRatio: 5,
            strongGravityMode: true,
            slowDown: 5
          }
        });
        console.log("Layout complete");
      }
      
      // Make sure the container is still valid
      if (!containerRef.current) {
        console.error("Container reference lost during rendering");
        return;
      }
      
      // Create Sigma renderer
      console.log("Creating new renderer");
      const renderer = new Sigma(graph, containerRef.current, {
        labelRenderedSizeThreshold: 8,
        labelDensity: 0.07,
        labelGridCellSize: 60,
        renderEdgeLabels: false,
        minCameraRatio: 0.1,
        maxCameraRatio: 10,
        // Use circle as the default node type (this is the Sigma default)
        defaultNodeType: 'circle',
        // Allow rendering even if container is not fully ready
        allowInvalidContainer: true
      });
      
      // Store renderer reference
      sigmaRef.current = renderer;
      
      // Add hover event to display node information
      let timeout: NodeJS.Timeout;
      const tooltipDiv = document.createElement('div');
      tooltipDiv.className = 'absolute hidden bg-white p-2 rounded shadow-lg text-sm z-10';
      containerRef.current.appendChild(tooltipDiv);
      
      renderer.on('enterNode', ({ node }) => {
        const nodeData = graph.getNodeAttributes(node);
        
        // Access nodeType attribute from GEXF
        // If nodeType is not available, fall back to type for compatibility
        const authorType = nodeData.nodeType || nodeData.type || 'secondary';
        
        tooltipDiv.innerHTML = `
          <div class="font-bold">${nodeData.label}</div>
          <div>Type: ${authorType === 'primary' ? 'Main Author' : 'Co-Author'}</div>
          <div>Community: ${nodeData.community || 0}</div>
          <div>Connections: ${nodeData.degree || 0}</div>
          ${nodeData.affiliation ? `<div>Affiliation: ${nodeData.affiliation}</div>` : ''}
        `;
        tooltipDiv.style.display = 'block';
        
        // Position tooltip near the node
        const nodePosition = renderer.graphToViewport({ x: nodeData.x, y: nodeData.y });
        tooltipDiv.style.left = `${nodePosition.x + 10}px`;
        tooltipDiv.style.top = `${nodePosition.y + 10}px`;
        
        clearTimeout(timeout);
      });
      
      renderer.on('leaveNode', () => {
        timeout = setTimeout(() => {
          tooltipDiv.style.display = 'none';
        }, 100);
      });
      
      // Add mouse movement to update tooltip position
      renderer.getMouseCaptor().on('mousemove', (e) => {
        if (tooltipDiv.style.display === 'block') {
          tooltipDiv.style.left = `${e.x + 10}px`;
          tooltipDiv.style.top = `${e.y + 10}px`;
        }
      });
      
      setLoading(false);
    } catch (err) {
      console.error("Error initializing graph:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  // Function to load and parse GEXF data
  const loadGexfData = async () => {
    if (!containerRef.current) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Ensure DOM is fully loaded
      if (document.readyState !== 'complete') {
        console.log("Waiting for document to be fully loaded...");
        await new Promise<void>((resolve) => {
          const checkReadyState = () => {
            if (document.readyState === 'complete') {
              resolve();
            } else {
              setTimeout(checkReadyState, 100);
            }
          };
          checkReadyState();
        });
      }
      
      // Load the GEXF data file
      const response = await fetch('/data/graph-data.gexf');
      if (!response.ok) {
        throw new Error(`Failed to load graph data: ${response.statusText}`);
      }
      
      const gexfData = await response.text();
      
      // Import the GEXF parser and graphology
      const graphology = await import("graphology");
      const parsers = await import("graphology-gexf/browser");
      
      // Parse the GEXF data
      console.log("Parsing GEXF data...");
      const graph = parsers.default.parse(graphology.default, gexfData);
      console.log("GEXF data parsed successfully");
      
      // Store the graph for filtering
      setFullData(graph);
      
      // Update stats
      setStats({
        nodeCount: graph.order,
        edgeCount: graph.size,
        communityCount: new Set(
          graph.nodes().map((n: string) => graph.getNodeAttribute(n, 'community'))
        ).size
      });
      
      // Apply initial filters
      applyFilters(graph);
      
    } catch (err) {
      console.error("Error loading graph data:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };
  
  // Function to apply filters to the graph
  const applyFilters = (sourceGraph?: any) => {
    setLoading(true);
    
    setTimeout(async () => {
      try {
        // Use provided graph or the stored full data
        const graph = sourceGraph || fullData;
        if (!graph) return;
        
        // Import graphology
        const graphology = await import("graphology");
        
        // Create a copy of the graph for filtering
        const filteredGraph = graph.copy();
        
        // Filter by weight
        if (minWeight > 1) {
          // Remove edges with weight less than minWeight
          filteredGraph.forEachEdge((edge: string, attributes: any, source: string, target: string) => {
            if (attributes.weight < minWeight) {
              filteredGraph.dropEdge(edge);
            }
          });
        }
        
        // Filter by max nodes
        if (maxNodes > 0 && maxNodes < filteredGraph.order) {
          // Get all nodes with their degree
          const nodes = filteredGraph.nodes().map((node: string) => ({
            id: node,
            degree: filteredGraph.degree(node)
          }));
          
          // Sort by degree (highest first)
          nodes.sort((a: {id: string, degree: number}, b: {id: string, degree: number}) => b.degree - a.degree);
          
          // Keep only the top maxNodes
          const nodesToKeep = new Set(nodes.slice(0, maxNodes).map((n: {id: string}) => n.id));
          
          // Remove nodes not in the top maxNodes
          filteredGraph.forEachNode((node: string) => {
            if (!nodesToKeep.has(node)) {
              filteredGraph.dropNode(node);
            }
          });
        }
        
        // Update stats
        setStats({
          nodeCount: filteredGraph.order,
          edgeCount: filteredGraph.size,
          communityCount: new Set(
            filteredGraph.nodes().map((n: string) => filteredGraph.getNodeAttribute(n, 'community'))
          ).size
        });
        
        // Render the filtered graph
        await renderGraph(filteredGraph);
      } catch (err) {
        console.error("Error applying filters:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      }
    }, 50);
  };

  // Initial load
  useEffect(() => {
    console.log("Initial component mount");
    
    // Only run once, even in React strict mode which calls effects twice
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      
      // Delay initial load to ensure DOM is ready
      setTimeout(() => {
        loadGexfData();
      }, 200);
    }
    
    // Cleanup function
    return () => {
      console.log("Component unmounting, cleaning up");
      cleanupRenderer();
    };
  }, []);

  return (
    <>
      {/* Controls for the graph */}
      <Controls 
        maxNodes={maxNodes}
        setMaxNodes={setMaxNodes}
        minWeight={minWeight}
        setMinWeight={setMinWeight}
        onApply={() => applyFilters()}
        isLoading={loading}
      />

      {/* Graph stats */}
      <div className="grid grid-cols-3 gap-4 w-full mb-4">
        <div className="bg-blue-50 p-3 rounded-lg text-center">
          <div className="text-lg font-bold">{stats.nodeCount}</div>
          <div className="text-sm">Authors</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg text-center">
          <div className="text-lg font-bold">{stats.edgeCount}</div>
          <div className="text-sm">Connections</div>
        </div>
        <div className="bg-purple-50 p-3 rounded-lg text-center">
          <div className="text-lg font-bold">{stats.communityCount}</div>
          <div className="text-sm">Communities</div>
        </div>
      </div>
      
      {/* Sigma.js container - Add explicit width and height styles */}
      <div className="relative w-full h-[700px] bg-white border border-gray-200 rounded-lg shadow-md" style={{ minWidth: '100px', minHeight: '100px' }}>
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
          id="sigma-container"
        ></div>
      </div>
      
      {/* Legend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-sm mt-4">
        <div className="bg-blue-100 p-4 rounded-lg">
          <h3 className="font-bold mb-2">Color Coding</h3>
          <p>Each community has a unique color. Main authors have vibrant colors while co-authors have lighter shades of the same community color.</p>
        </div>
        
        <div className="bg-amber-100 p-4 rounded-lg">
          <h3 className="font-bold mb-2">Node Size</h3>
          <p>Node size represents the number of connections. Larger nodes have more co-author relationships.</p>
        </div>
        
        <div className="bg-purple-100 p-4 rounded-lg">
          <h3 className="font-bold mb-2">Edge Darkness</h3>
          <p>Darker edges indicate stronger collaborations between authors (more papers together).</p>
        </div>
      </div>
    </>
  );
} 