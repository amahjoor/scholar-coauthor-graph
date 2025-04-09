import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Force static generation for this route
export const dynamic = 'force-static';

// Generate static params for the API route
export function generateStaticParams() {
  return [
    { 
      endpoint: 'coauthors',
      maxNodes: '200',
      minWeight: '1'
    }
  ];
}

// Define types for the coauthor data structure
interface Coauthor {
  name: string;
  scholar_id: string;
  affiliation: string;
}

interface Node {
  id: string;
  label: string;
  size: number;
  color: string;
  x?: number;
  y?: number;
  type: 'primary' | 'secondary';  // Primary = authors we have data for, secondary = only coauthors
  community?: number;
  affiliation?: string;
  coauthor_count?: number;
  degree?: number;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  size: number;
  color: string;
  weight: number;
}

/**
 * GET handler for all API requests
 * Uses query parameter 'endpoint' to determine which data to return
 * Example: /api?endpoint=coauthors
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const endpoint = searchParams.get('endpoint');
  
  // Parse additional query parameters for customization
  const maxNodes = searchParams.get('maxNodes') ? parseInt(searchParams.get('maxNodes')!) : 100;
  const minWeight = searchParams.get('minWeight') ? parseInt(searchParams.get('minWeight')!) : 1;
  
  // Handle different endpoints
  switch (endpoint) {
    case 'coauthors':
      return getCoauthorsData(maxNodes, minWeight);
    // Add more endpoints as needed
    // case 'papers':
    //   return getPapersData();
    default:
      return NextResponse.json(
        { error: 'Invalid endpoint specified' },
        { status: 400 }
      );
  }
}

/**
 * Get coauthors network data
 */
async function getCoauthorsData(maxNodes = 100, minWeight = 1) {
  try {
    // Use the correct relative path from the frontend directory to the data
    const dataDir = path.join(process.cwd(), '../backend/data/coauthors');
    
    console.log("Looking for data at:", dataDir);
    
    // Read all files in the directory
    const files = fs.readdirSync(dataDir);
    
    // Filter for JSON files
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    console.log(`Found ${jsonFiles.length} coauthor files`);
    
    // Initialize data structures for our graph
    const nodes = new Map<string, Node>();
    const edgeMap = new Map<string, Edge>();
    
    // Keep track of connections between nodes (for weighting)
    const connections: Record<string, Record<string, number>> = {};
    
    // Process each file (restrict to maxNodes if specified)
    const filesToProcess = jsonFiles.slice(0, Math.min(maxNodes, jsonFiles.length));
    
    // Process each file
    for (const file of filesToProcess) {
      const filePath = path.join(dataDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const coauthors = JSON.parse(fileContent) as Coauthor[];
      
      // Extract author ID from filename
      const authorId = file.replace('_coauthors.json', '');
      
      // Initialize connections for this author
      if (!connections[authorId]) {
        connections[authorId] = {};
      }
      
      // Add the main author to nodes if not already present
      if (!nodes.has(authorId)) {
        // We don't have the main author's name in the file, so use ID as placeholder
        // Or try to find author name in coauthors if it exists
        let authorName = authorId.substring(0, 8);
        
        // Try to find author name in their own coauthor list
        for (const coauthor of coauthors) {
          if (coauthor.scholar_id === authorId) {
            authorName = coauthor.name;
            break;
          }
        }
        
        nodes.set(authorId, {
          id: authorId,
          label: authorName.split(' ').slice(-1)[0], // Use last name for label
          size: 10,
          color: '#4169E1', // Main authors in blue
          type: 'primary',
          coauthor_count: coauthors.length
        });
      }
      
      // Process each coauthor
      coauthors.forEach((coauthor: Coauthor) => {
        const coauthorId = coauthor.scholar_id;
        if (!coauthorId) return;
        
        // Skip self-loops
        if (coauthorId === authorId) return;
        
        // Add coauthor to nodes if not already present
        if (!nodes.has(coauthorId)) {
          nodes.set(coauthorId, {
            id: coauthorId,
            label: coauthor.name.split(' ').slice(-1)[0], // Use last name for label
            size: 5,
            color: '#DC143C', // Coauthors in red
            type: 'secondary',
            affiliation: coauthor.affiliation
          });
        }
        
        // Track connection weight (increment if exists)
        if (!connections[authorId][coauthorId]) {
          connections[authorId][coauthorId] = 0;
        }
        if (!connections[coauthorId]) {
          connections[coauthorId] = {};
        }
        if (!connections[coauthorId][authorId]) {
          connections[coauthorId][authorId] = 0;
        }
        
        connections[authorId][coauthorId]++;
        connections[coauthorId][authorId]++;
        
        // Create edge ID (sort IDs to avoid duplicates)
        const edgeId = [authorId, coauthorId].sort().join('_');
        
        // Add or update edge
        if (!edgeMap.has(edgeId)) {
          edgeMap.set(edgeId, {
            id: edgeId,
            source: authorId,
            target: coauthorId,
            size: 1,
            color: '#9370DB', // Edges in purple
            weight: 1
          });
        } else {
          const edge = edgeMap.get(edgeId)!;
          edge.weight++;
          edge.size = Math.sqrt(edge.weight) * 0.5; // Scale size based on weight
        }
      });
    }
    
    // Filter edges by minimum weight
    const filteredEdges = Array.from(edgeMap.values()).filter(edge => edge.weight >= minWeight);
    
    // Calculate degree for each node (number of connections)
    nodes.forEach((node, nodeId) => {
      const nodeConnections = connections[nodeId] || {};
      const degree = Object.keys(nodeConnections).length;
      node.degree = degree;
      
      // Adjust node size based on degree
      node.size = Math.max(3, Math.sqrt(degree) * 2);
      
      // Make primary authors a bit larger
      if (node.type === 'primary') {
        node.size = node.size * 1.5;
      }
    });
    
    // Apply community detection (simple version)
    // This is a simplification of the Louvain algorithm used in the Python code
    // For a full implementation, you might need a dedicated JS library
    applySimpleCommunityDetection(nodes, filteredEdges);
    
    // Convert to arrays for JSON
    const graphData = {
      nodes: Array.from(nodes.values()),
      edges: filteredEdges
    };
    
    return NextResponse.json(graphData);
  } catch (error) {
    console.error('Error fetching coauthor data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coauthor data' },
      { status: 500 }
    );
  }
}

/**
 * Apply a simplified community detection algorithm
 * This is a basic approach - for production use a more sophisticated algorithm
 */
function applySimpleCommunityDetection(
  nodes: Map<string, Node>,
  edges: Edge[]
) {
  // Build an adjacency list representation of the graph
  const adjacencyList: Record<string, string[]> = {};
  
  // Initialize the adjacency list
  nodes.forEach((_, nodeId) => {
    adjacencyList[nodeId] = [];
  });
  
  // Add edges to the adjacency list
  edges.forEach(edge => {
    adjacencyList[edge.source].push(edge.target);
    adjacencyList[edge.target].push(edge.source);
  });
  
  // Assign initial communities (each node in its own community)
  let communityId = 0;
  const communities: Record<string, number> = {};
  
  // Group nodes by their neighbors (a simple heuristic)
  // This is much simpler than true Louvain method but gives reasonable results
  const visited = new Set<string>();
  
  // Process nodes in order of degree (highest first)
  const nodeEntries = Array.from(nodes.entries())
    .sort((a, b) => (b[1].degree || 0) - (a[1].degree || 0));
  
  for (const [nodeId, node] of nodeEntries) {
    if (visited.has(nodeId)) continue;
    
    // Start a new community
    const community = communityId++;
    communities[nodeId] = community;
    visited.add(nodeId);
    
    // Find neighbors and add them to the same community
    const neighbors = adjacencyList[nodeId] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        communities[neighbor] = community;
        visited.add(neighbor);
      }
    }
  }
  
  // Assign community to each node
  nodes.forEach((node, nodeId) => {
    node.community = communities[nodeId] || 0;
    
    // Assign color based on community
    const hue = (node.community * 137) % 360; // Golden ratio to get good color distribution
    node.color = `hsl(${hue}, 70%, 60%)`;
  });
} 