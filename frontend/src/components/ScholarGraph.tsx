"use client";

import { useEffect, useRef, useState } from "react";

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
  const [fullData, setFullData] = useState<{nodes: any[], edges: any[]} | null>(null);
  
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

  // Function to render the graph
  const renderGraph = async (data: {nodes: any[], edges: any[]}) => {
    if (!containerRef.current) return;
    
    // First, ensure any existing renderer is cleaned up
    cleanupRenderer();
    
    try {
      // Wait a short delay to ensure DOM is ready after cleanup
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Dynamically import libraries
      const graphology = await import("graphology");
      const Sigma = (await import("sigma")).default;
      const forceAtlas2Default = await import('graphology-layout-forceatlas2');
      
      // ForceAtlas2 is the default export
      const forceAtlas2 = forceAtlas2Default.default;
      
      // Create graph
      const graph = new graphology.default();
      
      // Process the data to ensure communities have distinct colors
      const processedNodes = data.nodes.map(node => ({
        ...node,
        color: getColorForCommunity(node.community || 0)
      }));
      
      // Add nodes
      processedNodes.forEach((node) => {
        // Add node with minimal attributes to avoid type issues
        graph.addNode(node.id, {
          label: node.label,
          size: node.size,
          color: node.color,
          x: Math.random() * 2 - 1,
          y: Math.random() * 2 - 1
        });
      });
      
      // Add edges
      data.edges.forEach((edge) => {
        if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
          try {
            graph.addEdge(edge.source, edge.target, {
              size: edge.size,
              color: "#9370DB",
              weight: edge.weight
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
        iterations: 200,
        settings: {
          gravity: 3,
          scalingRatio: 5,
          strongGravityMode: true,
          slowDown: 5
        }
      });
      console.log("Layout complete");
      
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
        maxCameraRatio: 10
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
        const originalNode = processedNodes.find((n) => n.id === node);
        
        tooltipDiv.innerHTML = `
          <div class="font-bold">${nodeData.label}</div>
          <div>Type: ${originalNode?.type === 'primary' ? 'Main Author' : 'Co-Author'}</div>
          <div>Community: ${originalNode?.community || 0}</div>
          <div>Connections: ${originalNode?.degree || 0}</div>
          ${originalNode?.affiliation ? `<div>Affiliation: ${originalNode.affiliation}</div>` : ''}
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

  // Function to load static data and filter
  const loadStaticData = async () => {
    if (!containerRef.current) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Load the static JSON data
      const response = await fetch('/data/graph-data.json');
      if (!response.ok) {
        throw new Error(`Failed to load graph data: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Store the full dataset
      setFullData(data);
      
      // Apply filters
      applyFilters(data);
      
    } catch (err) {
      console.error("Error loading graph data:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };
  
  // Function to apply filters to dataset
  const applyFilters = (sourceData?: {nodes: any[], edges: any[]}) => {
    setLoading(true);
    
    // Use provided data or the stored full data
    const data = sourceData || fullData;
    if (!data) return;
    
    // Apply filters to the data
    let filteredNodes = [...data.nodes];
    
    // Filter by max nodes (keep the largest ones by size/degree)
    if (maxNodes > 0 && maxNodes < filteredNodes.length) {
      filteredNodes = filteredNodes
        .sort((a, b) => (b.size || 0) - (a.size || 0))
        .slice(0, maxNodes);
    }
    
    // Get IDs of nodes that passed the filter
    const filteredNodeIds = new Set(filteredNodes.map(node => node.id));
    
    // Filter edges - keep only edges where both source and target are in filtered nodes
    // and where the weight meets the minimum threshold
    const filteredEdges = data.edges.filter(edge => 
      filteredNodeIds.has(edge.source) && 
      filteredNodeIds.has(edge.target) &&
      edge.weight >= minWeight
    );
    
    // Update stats
    setStats({
      nodeCount: filteredNodes.length,
      edgeCount: filteredEdges.length,
      communityCount: new Set(filteredNodes.map(n => n.community)).size
    });
    
    // Render the filtered graph
    renderGraph({nodes: filteredNodes, edges: filteredEdges});
  };

  // Initial load
  useEffect(() => {
    console.log("Initial component mount");
    // Only run once, even in React strict mode which calls effects twice
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      loadStaticData();
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