"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// Declare the global window object with graphology property
declare global {
  interface Window {
    graphology: any;
  }
}

// Simple controls component
interface ControlsProps {
  minWeight: number;
  setMinWeight: (value: number) => void;
  onApply: () => void;
  isLoading: boolean;
}

function Controls({ 
  minWeight, 
  setMinWeight, 
  onApply, 
  isLoading
}: ControlsProps) {
  return (
    <div className="bg-white bg-opacity-90 p-4 rounded-lg shadow mb-4 flex flex-col md:flex-row gap-4 z-10">
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
  // Track currently highlighted node
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  // Create a ref to track the current highlighted node for access in callbacks
  const highlightedNodeRef = useRef<string | null>(null);
  
  // Update the ref when state changes
  useEffect(() => {
    highlightedNodeRef.current = highlightedNode;
  }, [highlightedNode]);
  
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
        
        // Add highlighting attributes
        attributes.highlighted = false;
        attributes.originalColor = attributes.color;
        attributes.originalSize = attributes.size;
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
          <div class="text-xs text-blue-500 mt-1">Click to view connections only (click again to reset)</div>
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
      
      // Function to reset all highlighting and show all nodes
      const resetAllHighlighting = () => {
        console.log("Clearing all highlighting");
        
        resetHighlighting(graph);
        setHighlightedNode(null);
        highlightedNodeRef.current = null;
        
        // Make sure all nodes and edges are visible again
        graph.forEachNode((n: string, attributes: any) => {
          attributes.hidden = false;
          attributes.color = attributes.originalColor;
          attributes.size = attributes.originalSize;
        });
        
        graph.forEachEdge((e: string, attributes: any) => {
          attributes.hidden = false;
          attributes.color = attributes.originalColor;
          attributes.size = attributes.originalSize;
        });
        
        renderer.refresh();
      };
      
      // Create a dedicated handler for node clicks
      const handleNodeClick = (node: string) => {
        console.log("Node click handler called for:", node);
        console.log("Current highlighted node:", highlightedNodeRef.current);
        
        // If clicking the same node again, reset the view
        if (highlightedNodeRef.current === node) {
          console.log("Same node clicked again, resetting view");
          resetAllHighlighting();
          return;
        }
        
        console.log("New node clicked, showing only its connections");
        
        // Reset previous highlighting if any
        if (highlightedNodeRef.current) {
          resetHighlighting(graph);
        }
        
        // Set the new highlighted node
        setHighlightedNode(node);
        highlightedNodeRef.current = node;  // Also update ref directly for immediate access
        
        // Create a set of nodes to keep visible
        const visibleNodes = new Set<string>([node]);
        
        // Find all connected nodes and add them to the visible set
        graph.forEachNeighbor(node, (neighbor: string) => {
          visibleNodes.add(neighbor);
        });
        
        // Hide all nodes not in the visible set by setting size to 0
        graph.forEachNode((n: string, attributes: any) => {
          if (visibleNodes.has(n)) {
            // For visible nodes, enhance them
            attributes.highlighted = true;
            attributes.color = attributes.originalColor || attributes.color;
            attributes.size = attributes.originalSize || attributes.size;
            
            // Make the clicked node bigger
            if (n === node) {
              attributes.size = (attributes.originalSize || attributes.size) * 1.5;
            }
          } else {
            // Hide nodes not connected to the clicked node
            attributes.highlighted = false;
            attributes.hidden = true;
            attributes.size = 0;
          }
        });
        
        // Hide edges not connected to the clicked node
        graph.forEachEdge((e: string, attributes: any, source: string, target: string) => {
          if (source === node || target === node) {
            // Highlight edges connected to the clicked node
            attributes.color = attributes.originalColor || attributes.color;
            attributes.size = (attributes.originalSize || attributes.size) * 1.5;
          } else {
            // Hide other edges
            attributes.hidden = true;
            attributes.size = 0;
          }
        });
        
        // Refresh the renderer
        renderer.refresh();
      };
      
      // Attach the click handler to the renderer
      renderer.on('clickNode', ({ node }) => {
        handleNodeClick(node);
      });
      
      // Add canvas click event to reset highlighting
      renderer.getMouseCaptor().on('click', (e) => {
        // Only handle clicks on the canvas (not on nodes)
        if (!e.preventSigmaDefault && highlightedNodeRef.current) {
          console.log("Empty space clicked, resetting view");
          resetAllHighlighting();
        }
      });
      
      setLoading(false);
    } catch (err) {
      console.error("Error initializing graph:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  // Function to reset highlighting
  const resetHighlighting = (graph: any) => {
    console.log("Resetting all highlighting");
    
    // Reset all node attributes to original values
    graph.forEachNode((n: string, attributes: any) => {
      attributes.highlighted = false;
      attributes.hidden = false;
      
      // Make sure to restore original color and size
      if (attributes.originalColor) {
        attributes.color = attributes.originalColor;
      }
      
      if (attributes.originalSize) {
        attributes.size = attributes.originalSize;
      }
    });
    
    // Reset all edge attributes
    graph.forEachEdge((e: string, attributes: any) => {
      attributes.hidden = false;
      
      if (attributes.originalColor) {
        attributes.color = attributes.originalColor;
      }
      
      if (attributes.originalSize) {
        attributes.size = attributes.originalSize;
      }
    });
    
    // Clear the highlighted node reference
    highlightedNodeRef.current = null;
  };
  
  // Function to fade a color for non-highlighted nodes
  const fadeColor = (color: string): string => {
    if (color.startsWith('#')) {
      // Convert hex to rgba with transparency
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, 0.3)`;
    } else if (color.startsWith('rgb')) {
      return color.replace('rgb', 'rgba').replace(')', ', 0.3)');
    }
    return color;
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
    
    // Reset any existing highlighting when filters are applied
    setHighlightedNode(null);
    
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
          
          // Remove isolated nodes (no connections after edge filtering)
          filteredGraph.forEachNode((node: string) => {
            if (filteredGraph.degree(node) === 0) {
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
    <div className="relative w-full h-screen">
      {/* Sigma.js container - Take full screen */}
      <div className="absolute inset-0 bg-white" style={{ minWidth: '100px', minHeight: '100px' }}>
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
      
      {/* Overlay controls in the top left */}
      <div className="absolute top-4 left-4 z-20">
        {/* Controls for the graph */}
        <Controls 
          minWeight={minWeight}
          setMinWeight={setMinWeight}
          onApply={() => applyFilters()}
          isLoading={loading}
        />
      </div>
      
      {/* Graph stats as overlay in top right */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-blue-50 bg-opacity-90 p-2 rounded-lg text-center">
            <div className="text-lg font-bold">{stats.nodeCount}</div>
            <div className="text-sm">Authors</div>
          </div>
          <div className="bg-green-50 bg-opacity-90 p-2 rounded-lg text-center">
            <div className="text-lg font-bold">{stats.edgeCount}</div>
            <div className="text-sm">Connections</div>
          </div>
          <div className="bg-purple-50 bg-opacity-90 p-2 rounded-lg text-center">
            <div className="text-lg font-bold">{stats.communityCount}</div>
            <div className="text-sm">Communities</div>
          </div>
        </div>
        
        {/* Legend as info icon that displays info on hover */}
        <div className="bg-white bg-opacity-90 p-3 rounded-lg text-sm">
          <details className="cursor-pointer">
            <summary className="font-bold">Display Legend</summary>
            <div className="mt-2 grid grid-cols-1 gap-2">
              <div className="bg-blue-100 p-2 rounded-lg">
                <h3 className="font-bold">Color Coding</h3>
                <p>Each community has a unique color. Main authors have vibrant colors while co-authors have lighter shades.</p>
              </div>
              <div className="bg-amber-100 p-2 rounded-lg">
                <h3 className="font-bold">Node Size</h3>
                <p>Node size represents the number of connections.</p>
              </div>
              <div className="bg-purple-100 p-2 rounded-lg">
                <h3 className="font-bold">Edge Darkness</h3>
                <p>Darker edges indicate stronger collaborations.</p>
              </div>
              <div className="bg-gray-100 p-2 rounded-lg">
                <h3 className="font-bold">Interaction</h3>
                <p>Click on any author to show only their direct collaborations. Click again to reset.</p>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
} 