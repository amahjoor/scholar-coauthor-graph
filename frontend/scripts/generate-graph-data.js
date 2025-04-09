const fs = require('fs');
const path = require('path');

/**
 * Script to pre-generate graph data and save it to the public directory
 * Run during build process
 */

// Function to generate a distinct color for each community using HSL
// HSL ensures good color separation and consistent brightness/saturation
function getColorForCommunity(communityId, totalCommunities) {
  // Use golden ratio to create well-distributed hues
  const goldenRatioConjugate = 0.618033988749895;
  
  // Generate a hue by using the golden ratio
  // This creates an aesthetically pleasing distribution of colors
  let hue = (communityId * goldenRatioConjugate) % 1;
  hue = Math.round(hue * 360);
  
  // Use high saturation and medium lightness for vibrant but distinguishable colors
  const saturation = 85;
  const lightness = 60;
  
  // Convert HSL to RGB hex
  return hslToHex(hue, saturation, lightness);
}

// Function to convert HSL to hex color code
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  
  let r, g, b;
  
  if (0 <= h && h < 60) {
    [r, g, b] = [c, x, 0];
  } else if (60 <= h && h < 120) {
    [r, g, b] = [x, c, 0];
  } else if (120 <= h && h < 180) {
    [r, g, b] = [0, c, x];
  } else if (180 <= h && h < 240) {
    [r, g, b] = [0, x, c];
  } else if (240 <= h && h < 300) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }
  
  // Convert to hex
  const toHex = (c) => Math.round((c + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Function to lighten a color (for secondary nodes)
function lightenColor(color, factor = 0.3) {
  // Remove the # and convert to RGB
  const hex = color.replace('#', '');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  
  // Lighten the color
  r = Math.min(255, r + Math.floor((255 - r) * factor));
  g = Math.min(255, g + Math.floor((255 - g) * factor));
  b = Math.min(255, b + Math.floor((255 - b) * factor));
  
  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

async function generateGraphData() {
  console.log('Generating static graph data...');
  
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
    const nodes = new Map();
    const edgeMap = new Map();
    
    // Keep track of connections between nodes (for weighting)
    const connections = {};
    
    // Define the max number of nodes to process
    const maxNodes = 200; // Use a high value to get the full dataset
    
    // Process each file (restrict to maxNodes if specified)
    const filesToProcess = jsonFiles.slice(0, Math.min(maxNodes, jsonFiles.length));
    
    // Process each file
    for (const file of filesToProcess) {
      const filePath = path.join(dataDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const coauthors = JSON.parse(fileContent);
      
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
          // Color will be assigned later based on community
          type: 'primary',
          coauthor_count: coauthors.length
        });
      }
      
      // Process each coauthor
      coauthors.forEach((coauthor) => {
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
            // Color will be assigned later based on community
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
            color: '#9370DB', // Default edge color
            weight: 1
          });
        } else {
          const edge = edgeMap.get(edgeId);
          edge.weight++;
          edge.size = Math.sqrt(edge.weight) * 0.5; // Scale size based on weight
        }
      });
    }
    
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
    
    // Apply community detection
    applySimpleCommunityDetection(nodes, edgeMap, connections);
    
    // Count total communities for color distribution
    const communityCounts = new Map();
    nodes.forEach(node => {
      if (!communityCounts.has(node.community)) {
        communityCounts.set(node.community, 1);
      } else {
        communityCounts.set(node.community, communityCounts.get(node.community) + 1);
      }
    });
    
    const totalCommunities = communityCounts.size;
    console.log(`Detected ${totalCommunities} communities`);
    
    // Apply coloring based on communities and node type
    nodes.forEach((node) => {
      // Assign color based on community
      if (node.type === 'primary') {
        // Primary authors use full community color
        node.color = getColorForCommunity(node.community, totalCommunities);
      } else {
        // Secondary authors use a lighter version of their community color
        node.color = lightenColor(getColorForCommunity(node.community, totalCommunities));
      }
    });
    
    // Color edges based on the nodes they connect
    edgeMap.forEach(edge => {
      const sourceNode = nodes.get(edge.source);
      const targetNode = nodes.get(edge.target);
      
      // Set edge color based on weight
      const intensity = Math.min(1, edge.weight / 5); // Normalize weight to max 1
      const alpha = Math.max(0.2, intensity).toFixed(2); // At least 20% opacity
      
      // Use a semitransparent dark color for edges
      edge.color = `rgba(80, 80, 80, ${alpha})`;
      
      // Scale edge size more dramatically with weight
      edge.size = 0.3 + Math.sqrt(edge.weight) * 0.6;
    });
    
    // Convert to arrays for JSON
    const graphData = {
      nodes: Array.from(nodes.values()),
      edges: Array.from(edgeMap.values())
    };
    
    // Create the output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), 'public/data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write to file
    const outputPath = path.join(outputDir, 'graph-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(graphData, null, 2));
    
    console.log(`Static graph data generated successfully at ${outputPath}`);
    console.log(`Total nodes: ${graphData.nodes.length}, Total edges: ${graphData.edges.length}`);
    
    return graphData;
  } catch (error) {
    console.error('Error generating graph data:', error);
    process.exit(1);
  }
}

/**
 * Simple community detection algorithm
 */
function applySimpleCommunityDetection(nodes, edgeMap, connections) {
  // Build an adjacency list representation of the graph
  const adjacencyList = {};
  
  // Initialize the adjacency list
  nodes.forEach((_, nodeId) => {
    adjacencyList[nodeId] = [];
  });
  
  // Add edges to the adjacency list
  edgeMap.forEach(edge => {
    adjacencyList[edge.source].push(edge.target);
    adjacencyList[edge.target].push(edge.source);
  });
  
  // Assign initial communities (each node in its own community)
  let communityId = 0;
  const communities = {};
  
  // Group nodes by their neighbors (a simple heuristic)
  const visited = new Set();
  
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
  });
}

// Run the script
generateGraphData(); 