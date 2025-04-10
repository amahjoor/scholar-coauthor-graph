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
  stats: {
    nodeCount: number;
    edgeCount: number;
    communityCount: number;
  };
}

function Controls({ 
  minWeight, 
  setMinWeight, 
  onApply, 
  isLoading,
  stats
}: ControlsProps) {
  return (
    <div className="flex items-center flex-wrap gap-4 w-full">
      {/* Filter controls */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <label htmlFor="minWeight" className="text-sm font-medium text-gray-700">Connection Strength Filter</label>
          <div className="flex items-center gap-3">
            <input
              id="minWeightSlider"
              type="range"
              min="1"
              max="10"
              value={minWeight}
              onChange={(e) => setMinWeight(Number(e.target.value))}
              className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex items-center gap-1">
              <input
                id="minWeight"
                type="number"
                min="1"
                max="10"
                value={minWeight}
                onChange={(e) => setMinWeight(Number(e.target.value))}
                className="border border-gray-300 rounded px-2 py-1 w-14 text-center"
              />
              <span className="text-xs text-gray-700 whitespace-nowrap">min papers</span>
            </div>
            <button 
              onClick={onApply} 
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:bg-blue-300 text-sm flex items-center gap-1"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </span>
              ) : (
                <span className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  Apply
                </span>
              )}
            </button>
          </div>
          <div className="text-xs text-gray-700 mt-1 max-w-xs">
            Shows connections with at least {minWeight} paper{minWeight > 1 ? 's' : ''} together
          </div>
        </div>
      </div>
      
      {/* Divider */}
      <div className="h-8 w-px bg-gray-300"></div>
      
      {/* Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 group relative" title="Total number of authors in the network">
          <div className="flex items-center justify-center w-5 h-5">
            <div className="w-4 h-4 rounded-full border border-gray-300 bg-gradient-to-b from-blue-500 via-purple-500 to-red-500 shadow-sm"></div>
          </div>
          <span className="text-sm font-medium text-gray-700">{stats.nodeCount.toLocaleString()} Authors</span>
          <div className="absolute bottom-full left-0 mb-1 w-48 bg-gray-800 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg">
            Authors are represented as nodes in the graph
          </div>
        </div>
        <div className="flex items-center gap-1 group relative" title="Total number of co-authorship connections">
          <div className="flex items-center justify-center w-5 h-5">
            <div className="w-5 h-0.5 bg-gray-300"></div>
          </div>
          <span className="text-sm font-medium text-gray-700">{stats.edgeCount.toLocaleString()} Connections</span>
          <div className="absolute bottom-full left-0 mb-1 w-48 bg-gray-800 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg">
            Lines connecting authors who have published together
          </div>
        </div>
        <div className="flex items-center gap-1 relative group" title="Number of detected research communities">
          <div className="w-7 h-5 relative">
            <div className="absolute w-2.5 h-2.5 rounded-full bg-blue-500 top-0 left-0 shadow-sm"></div>
            <div className="absolute w-2.5 h-2.5 rounded-full bg-purple-500 top-2 left-2 shadow-sm"></div>
            <div className="absolute w-2.5 h-2.5 rounded-full bg-green-500 top-0 left-4 shadow-sm"></div>
          </div>
          <span className="text-sm font-medium text-gray-700">{stats.communityCount.toLocaleString()} Communities</span>
          <div className="absolute bottom-full left-0 mb-1 w-48 bg-gray-800 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg">
            Groups of authors who frequently collaborate (color-coded)
          </div>
        </div>
      </div>
      
      {/* Divider */}
      <div className="h-8 w-px bg-gray-300"></div>
      
      {/* Legend */}
      <div className="flex items-center">
        <details className="cursor-pointer group">
          <summary className="font-medium text-sm flex items-center gap-1 marker:content-none text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4"/>
              <path d="M12 8h.01"/>
            </svg>
            Legend
          </summary>
          <div className="absolute mt-2 p-3 bg-white rounded-lg shadow-lg border z-50 grid grid-cols-2 gap-3 w-[600px]">
            <div className="p-2 rounded-lg border bg-gray-50">
              <h3 className="font-bold text-sm flex items-center gap-1 text-gray-800">
                <span className="inline-block w-3 h-3 bg-blue-600 rounded-full"></span> Color Coding
              </h3>
              <p className="text-xs text-gray-700">Each community has a unique color. Main authors have vibrant colors while co-authors have lighter shades.</p>
            </div>
            <div className="p-2 rounded-lg border bg-gray-50">
              <h3 className="font-bold text-sm flex items-center gap-1 text-gray-800">
                <span className="inline-block w-4 h-4 border border-gray-500 rounded-full"></span> Node Size
              </h3>
              <p className="text-xs text-gray-700">Node size represents the number of connections.</p>
            </div>
            <div className="p-2 rounded-lg border bg-gray-50 col-span-2">
              <h3 className="font-bold text-sm flex items-center gap-1 text-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg> Interaction
              </h3>
              <p className="text-xs text-gray-700">Click on any author to show only their direct collaborations. Click again to reset.</p>
            </div>
          </div>
        </details>
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

// Global constants for styling
const EDGE_COLOR = "rgba(150, 150, 150, 0.7)"; // Medium gray with less transparency for default state
const HIGHLIGHTED_EDGE_COLOR = "rgba(80, 80, 80, 0.9)"; // Darker gray with minimal transparency for highlighted state

export default function ScholarGraph({ graphType = 'author' }: { graphType?: 'author' | 'institution' }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Graph configuration state
  const [minWeight, setMinWeight] = useState(1);
  
  // Full dataset reference (loaded once for each graph type)
  const [authorGraphData, setAuthorGraphData] = useState<any | null>(null);
  const [institutionGraphData, setInstitutionGraphData] = useState<any | null>(null);
  
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

  // Load graph data based on the selected graph type
  useEffect(() => {
    // Clean up any existing renderer when graph type changes
    if (sigmaRef.current) {
      cleanupRenderer();
    }
    
    // Reset state
    setLoading(true);
    setError(null);
    setHighlightedNode(null);
    
    // Load the appropriate data file
    const loadGraphData = async () => {
      try {
        // Determine file path based on graph type
        const dataPath = graphType === 'author' 
          ? '/data/graph-data.gexf'
          : '/data/institution-graph-data.gexf';
        
        console.log(`Loading ${graphType} graph data from ${dataPath}`);
        
        // Import parsers and parse GEXF
        const parsers = await import("graphology-gexf/browser");
        const response = await fetch(dataPath);
        
        if (!response.ok) {
          throw new Error(`Failed to load ${graphType} graph data: ${response.statusText}`);
        }
        
        const gexfContent = await response.text();
        
        // Parse GEXF to graph
        const graphology = await import("graphology");
        const Graph = graphology.default;
        const graph = parsers.parse(Graph, gexfContent);
        
        // Store the full dataset in state
        if (graphType === 'author') {
          setAuthorGraphData(graph);
        } else {
          setInstitutionGraphData(graph);
        }
        
        // Apply filters and render
        applyFilters(graph);
      } catch (err) {
        console.error("Error loading graph data:", err);
        setError(err instanceof Error ? err.message : "Failed to load graph data");
        setLoading(false);
      }
    };
    
    // Load graph data
    loadGraphData();
  }, [graphType]); // Re-run when graph type changes
  
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

      // Ensure all edges have consistent color
      graph.forEachEdge((edge: string, attributes: any) => {
        // Store the original color in case we need it
        attributes.originalColor = attributes.color;
        // Set a consistent color for all edges
        attributes.color = EDGE_COLOR;
        // Keep the original size which is based on weight (collaboration strength)
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
      tooltipDiv.className = 'absolute hidden bg-white p-3 rounded shadow-lg text-sm z-10 border border-gray-200';
      containerRef.current.appendChild(tooltipDiv);
      
      renderer.on('enterNode', ({ node }) => {
        const nodeData = graph.getNodeAttributes(node);
        
        // Access nodeType attribute from GEXF
        // If nodeType is not available, fall back to type for compatibility
        const authorType = nodeData.nodeType || nodeData.type || 'secondary';
        
        tooltipDiv.innerHTML = `
          <div class="font-bold text-gray-900">${nodeData.label}</div>
          <div class="text-gray-800">Type: ${authorType === 'primary' ? 'Main Author' : 'Co-Author'}</div>
          <div class="text-gray-800">Community: ${nodeData.community || 0}</div>
          <div class="text-gray-800">Connections: ${nodeData.degree || 0}</div>
          ${nodeData.affiliation ? `<div class="text-gray-800">Affiliation: ${nodeData.affiliation}</div>` : ''}
          <div class="text-xs text-blue-600 mt-1">Click to view connections only (click again to reset)</div>
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
          attributes.color = EDGE_COLOR; // Keep consistent edge color
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
            // Highlight edges connected to the clicked node with darker color
            attributes.color = HIGHLIGHTED_EDGE_COLOR;
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
      attributes.color = EDGE_COLOR; // Keep consistent edge color
      
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

  // Function to apply filters to the graph
  const applyFilters = (sourceGraph?: any) => {
    setLoading(true);
    
    // Reset any existing highlighting when filters are applied
    setHighlightedNode(null);
    
    setTimeout(async () => {
      try {
        // Use provided graph or get the correct stored data based on graph type
        let graph = sourceGraph;
        if (!graph) {
          graph = graphType === 'author' ? authorGraphData : institutionGraphData;
        }
        
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

  return (
    <div className="relative w-full h-screen">
      {/* Navbar */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-gray-100 to-white shadow-md p-2 px-4 border-b">
        {/* Controls for the graph */}
        <Controls 
          minWeight={minWeight}
          setMinWeight={setMinWeight}
          onApply={() => applyFilters()}
          isLoading={loading}
          stats={stats}
        />
      </div>
      
      {/* Sigma.js container - Take full screen */}
      <div className="absolute inset-0 bg-gray-50 pt-12" style={{ minWidth: '100px', minHeight: '100px' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-10">
            <div className="text-xl font-semibold text-gray-800">Loading co-author network...</div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10">
            <div className="text-xl font-semibold text-red-700 p-4 bg-red-50 rounded-lg border border-red-200 shadow-md">
              Error: {error}
            </div>
          </div>
        )}
        
        <div 
          ref={containerRef}
          className="w-full h-full"
          id="sigma-container"
        ></div>
      </div>
    </div>
  );
} 