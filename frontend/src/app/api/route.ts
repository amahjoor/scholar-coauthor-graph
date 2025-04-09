import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
}

interface Edge {
  id: string;
  source: string;
  target: string;
  size: number;
  color: string;
}

/**
 * GET handler for all API requests
 * Uses query parameter 'endpoint' to determine which data to return
 * Example: /api?endpoint=coauthors
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const endpoint = searchParams.get('endpoint');
  
  // Handle different endpoints
  switch (endpoint) {
    case 'coauthors':
      return getCoauthorsData();
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
async function getCoauthorsData() {
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
    const edges = new Set<Edge>();
    
    // Process each file
    for (const file of jsonFiles.slice(0, 20)) { // Limit to 20 files to prevent overwhelming the graph
      const filePath = path.join(dataDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const coauthors = JSON.parse(fileContent) as Coauthor[];
      
      // Extract author ID from filename
      const authorId = file.replace('_coauthors.json', '');
      
      // Add the main author to nodes if not already present
      if (!nodes.has(authorId)) {
        // We don't have the main author's name in the file, so use ID as placeholder
        nodes.set(authorId, {
          id: authorId,
          label: authorId.substring(0, 8), // Use shorter label for readability
          size: 10,
          color: '#4169E1' // Main authors in blue
        });
      }
      
      // Process each coauthor
      coauthors.forEach((coauthor: Coauthor) => {
        const coauthorId = coauthor.scholar_id;
        
        // Add coauthor to nodes if not already present
        if (!nodes.has(coauthorId)) {
          nodes.set(coauthorId, {
            id: coauthorId,
            label: coauthor.name.split(' ').slice(-1)[0], // Use last name for label
            size: 5,
            color: '#DC143C' // Coauthors in red
          });
        }
        
        // Create edge ID (sort IDs to avoid duplicates)
        const edgeId = [authorId, coauthorId].sort().join('_');
        
        // Add edge if not already present
        edges.add({
          id: edgeId,
          source: authorId,
          target: coauthorId,
          size: 1,
          color: '#9370DB' // Edges in purple
        });
      });
    }
    
    // Convert to arrays for JSON
    const graphData = {
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges)
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