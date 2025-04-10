const fs = require('fs');
const path = require('path');
const xmlbuilder = require('xmlbuilder');

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

// Function to generate GEXF XML from the graph data
function generateGexf(nodes, edges) {
  // Create the GEXF document
  const gexf = xmlbuilder.create('gexf', { version: '1.0', encoding: 'UTF-8' })
    .att('version', '1.3')
    .att('xmlns', 'http://www.gexf.net/1.3')
    .att('xmlns:viz', 'http://www.gexf.net/1.3/viz')
    .att('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance')
    .att('xsi:schemaLocation', 'http://www.gexf.net/1.3 http://www.gexf.net/1.3/gexf.xsd');
  
  // Add metadata
  gexf.ele('meta')
    .att('lastmodifieddate', new Date().toISOString().split('T')[0])
    .ele('creator', 'ScholarMap Generator');
  
  // Create graph element
  const graph = gexf.ele('graph')
    .att('mode', 'static')
    .att('defaultedgetype', 'undirected');
  
  // Define node attributes
  const nodeAttrs = graph.ele('attributes')
    .att('class', 'node')
    .att('mode', 'static');
  
  nodeAttrs.ele('attribute')
    .att('id', 'nodeType')
    .att('title', 'NodeType')
    .att('type', 'string');
  
  nodeAttrs.ele('attribute')
    .att('id', 'community')
    .att('title', 'Community')
    .att('type', 'integer');
  
  nodeAttrs.ele('attribute')
    .att('id', 'degree')
    .att('title', 'Degree')
    .att('type', 'integer');
  
  nodeAttrs.ele('attribute')
    .att('id', 'affiliation')
    .att('title', 'Affiliation')
    .att('type', 'string');
  
  // Add nodes
  const nodesElem = graph.ele('nodes');
  
  nodes.forEach(node => {
    const nodeElem = nodesElem.ele('node')
      .att('id', node.id)
      .att('label', node.label);
    
    // Add node visualization attributes
    nodeElem.ele('viz:color')
      .att('r', parseInt(node.color.slice(1, 3), 16))
      .att('g', parseInt(node.color.slice(3, 5), 16))
      .att('b', parseInt(node.color.slice(5, 7), 16));
    
    nodeElem.ele('viz:size')
      .att('value', node.size);
    
    // Add position - ensure all nodes have valid x,y coordinates
    nodeElem.ele('viz:position')
      .att('x', node.x || 0)
      .att('y', node.y || 0)
      .att('z', 0);
    
    // Add node attributes
    const attvalues = nodeElem.ele('attvalues');
    
    attvalues.ele('attvalue')
      .att('for', 'nodeType')
      .att('value', node.type);
    
    attvalues.ele('attvalue')
      .att('for', 'community')
      .att('value', node.community);
    
    if (node.degree !== undefined) {
      attvalues.ele('attvalue')
        .att('for', 'degree')
        .att('value', node.degree);
    }
    
    if (node.affiliation) {
      attvalues.ele('attvalue')
        .att('for', 'affiliation')
        .att('value', node.affiliation);
    }
  });
  
  // Add edges
  const edgesElem = graph.ele('edges');
  
  edges.forEach((edge, index) => {
    const edgeElem = edgesElem.ele('edge')
      .att('id', index)
      .att('source', edge.source)
      .att('target', edge.target)
      .att('weight', edge.weight);
    
    // Check if color is in hex or rgba format
    if (edge.color.startsWith('#')) {
      edgeElem.ele('viz:color')
        .att('r', parseInt(edge.color.slice(1, 3), 16))
        .att('g', parseInt(edge.color.slice(3, 5), 16))
        .att('b', parseInt(edge.color.slice(5, 7), 16));
    } else if (edge.color.startsWith('rgba')) {
      // Parse rgba values
      const rgbaMatch = edge.color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
      if (rgbaMatch) {
        const [_, r, g, b, a] = rgbaMatch;
        edgeElem.ele('viz:color')
          .att('r', r)
          .att('g', g)
          .att('b', b)
          .att('a', parseFloat(a));
      }
    }
    
    edgeElem.ele('viz:thickness')
      .att('value', edge.size);
  });
  
  // Convert to XML string with pretty formatting
  return gexf.end({ pretty: true });
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
      
      // Assign initial random positions to all nodes
      // This ensures all nodes have valid coordinates
      node.x = Math.random() * 100 - 50; // Random between -50 and 50
      node.y = Math.random() * 100 - 50; // Random between -50 and 50
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
    
    // 1. Generate and save JSON format (keep for compatibility)
    const jsonOutputPath = path.join(outputDir, 'graph-data.json');
    fs.writeFileSync(jsonOutputPath, JSON.stringify(graphData, null, 2));
    console.log(`JSON graph data generated at ${jsonOutputPath}`);
    
    // 2. Generate and save GEXF format (for better performance with large graphs)
    console.log('Generating GEXF format...');
    const gexfContent = generateGexf(graphData.nodes, graphData.edges);
    const gexfOutputPath = path.join(outputDir, 'graph-data.gexf');
    fs.writeFileSync(gexfOutputPath, gexfContent);
    console.log(`GEXF graph data generated at ${gexfOutputPath}`);
    
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

/**
 * Generates a graph where nodes are institutions/affiliations instead of authors
 * This connects institutions that have co-authorship relationships
 */
async function generateInstitutionGraphData() {
  console.log('Generating institution network graph data...');
  
  try {
    // Use the correct relative path from the frontend directory to the data
    const dataDir = path.join(process.cwd(), '../backend/data/coauthors');
    
    console.log("Looking for coauthor data at:", dataDir);
    
    // Read all files in the directory
    const files = fs.readdirSync(dataDir);
    
    // Filter for JSON files
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    console.log(`Found ${jsonFiles.length} coauthor files`);
    
    // Initialize data structures
    const authorInstitutions = new Map(); // Maps author IDs to their institutions
    const institutionNodes = new Map(); // Maps institution names to node data
    const institutionEdges = new Map(); // Maps edge IDs to edge data
    const institutionAuthors = new Map(); // Maps institutions to lists of authors
    
    // First pass: collect all author institutions
    console.log("First pass: collecting author institutions...");
    for (const file of jsonFiles) {
      const filePath = path.join(dataDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      let coauthors;
      
      try {
        coauthors = JSON.parse(fileContent);
      } catch (e) {
        console.error(`Error parsing JSON in file ${file}: ${e.message}`);
        continue;
      }
      
      // Extract author ID from filename
      const authorId = file.replace('_coauthors.json', '');
      
      // Find author's institution (if available in their own coauthor list)
      let authorInstitution = "Unknown";
      
      // Look for author in their own coauthor list (where affiliation is often listed)
      for (const coauthor of coauthors) {
        if (coauthor.scholar_id === authorId && coauthor.affiliation) {
          authorInstitution = coauthor.affiliation;
          break;
        }
      }
      
      // Store author's institution
      if (authorInstitution !== "Unknown") {
        authorInstitutions.set(authorId, authorInstitution);
        
        // Update institution_authors map
        if (!institutionAuthors.has(authorInstitution)) {
          institutionAuthors.set(authorInstitution, new Set());
        }
        institutionAuthors.get(authorInstitution).add(authorId);
      }
      
      // Store all coauthors' institutions
      for (const coauthor of coauthors) {
        const coauthorId = coauthor.scholar_id;
        const coauthorInstitution = coauthor.affiliation;
        
        if (coauthorId && coauthorInstitution && coauthorInstitution !== "Unknown") {
          authorInstitutions.set(coauthorId, coauthorInstitution);
          
          // Update institution_authors map
          if (!institutionAuthors.has(coauthorInstitution)) {
            institutionAuthors.set(coauthorInstitution, new Set());
          }
          institutionAuthors.get(coauthorInstitution).add(coauthorId);
        }
      }
    }
    
    // Create nodes for all institutions with more than 1 author
    console.log("Creating institution nodes...");
    for (const [institution, authors] of institutionAuthors.entries()) {
      if (institution !== "Unknown" && authors.size >= 1) {
        // Only create node for institutions with at least one author
        institutionNodes.set(institution, {
          id: institution,
          label: formatInstitutionName(institution),
          size: 5 + Math.sqrt(authors.size) * 2, // Scale by number of authors
          type: 'institution',
          author_count: authors.size
        });
      }
    }
    
    // Second pass: create edges based on coauthorship relationships
    console.log("Second pass: creating institution edges...");
    for (const file of jsonFiles) {
      const filePath = path.join(dataDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      let coauthors;
      
      try {
        coauthors = JSON.parse(fileContent);
      } catch (e) {
        continue; // Skip files with parsing errors
      }
      
      // Extract author ID from filename
      const authorId = file.replace('_coauthors.json', '');
      
      // Get author's institution
      const authorInstitution = authorInstitutions.get(authorId);
      if (!authorInstitution || authorInstitution === "Unknown") {
        continue; // Skip if we don't know the author's institution
      }
      
      // Process each coauthor
      for (const coauthor of coauthors) {
        const coauthorId = coauthor.scholar_id;
        if (!coauthorId || coauthorId === authorId) continue; // Skip self-loops
        
        // Get coauthor's institution
        const coauthorInstitution = authorInstitutions.get(coauthorId);
        if (!coauthorInstitution || coauthorInstitution === "Unknown" || coauthorInstitution === authorInstitution) {
          continue; // Skip unknown institutions or same institution
        }
        
        // Create edge between institutions (if both exist in nodes)
        if (institutionNodes.has(authorInstitution) && institutionNodes.has(coauthorInstitution)) {
          // Create edge ID (sort institution names to avoid duplicates)
          const edgeId = [authorInstitution, coauthorInstitution].sort().join('___');
          
          // Add or update edge weight
          if (!institutionEdges.has(edgeId)) {
            institutionEdges.set(edgeId, {
              id: edgeId,
              source: authorInstitution,
              target: coauthorInstitution,
              size: 1,
              color: '#9370DB', // Default edge color
              weight: 1
            });
          } else {
            const edge = institutionEdges.get(edgeId);
            edge.weight++;
            edge.size = Math.min(5, 0.5 + Math.sqrt(edge.weight) * 0.3); // Scale size based on weight, with max limit
          }
        }
      }
    }
    
    console.log(`Created ${institutionEdges.size} institution edges`);
    
    // Filter small institutions (those with only 1 author) to reduce graph complexity
    const minAuthorsForInstitution = 2;
    const filteredInstitutionNodes = new Map();
    
    for (const [institution, node] of institutionNodes.entries()) {
      if (node.author_count >= minAuthorsForInstitution) {
        filteredInstitutionNodes.set(institution, node);
      }
    }
    
    // Keep only edges between remaining institutions
    const filteredInstitutionEdges = new Map();
    
    for (const [edgeId, edge] of institutionEdges.entries()) {
      if (
        filteredInstitutionNodes.has(edge.source) &&
        filteredInstitutionNodes.has(edge.target)
      ) {
        filteredInstitutionEdges.set(edgeId, edge);
      }
    }
    
    console.log(`Filtered to ${filteredInstitutionNodes.size} institutions with at least ${minAuthorsForInstitution} authors`);
    console.log(`Filtered to ${filteredInstitutionEdges.size} institution edges`);
    
    // Apply community detection to institutions
    const institutionCommunities = detectInstitutionCommunities(
      Array.from(filteredInstitutionNodes.values()),
      Array.from(filteredInstitutionEdges.values())
    );
    
    // Apply community colors
    const totalInstitutionCommunities = 
      Object.values(institutionCommunities).length > 0 
        ? Math.max(...Object.values(institutionCommunities)) + 1 
        : 1;
    
    for (const [institution, node] of filteredInstitutionNodes.entries()) {
      const community = institutionCommunities[institution] || 0;
      node.community = community;
      node.color = getColorForCommunity(community, totalInstitutionCommunities);
      
      // Assign initial random positions to all nodes
      node.x = Math.random() * 100 - 50; // Random between -50 and 50
      node.y = Math.random() * 100 - 50; // Random between -50 and 50
    }
    
    // Color edges based on nodes they connect
    for (const edge of filteredInstitutionEdges.values()) {
      // Set edge color based on weight
      const intensity = Math.min(1, edge.weight / 5); // Normalize weight to max 1
      const alpha = Math.max(0.2, intensity).toFixed(2); // At least 20% opacity
      
      // Use a semitransparent dark color for edges
      edge.color = `rgba(80, 80, 80, ${alpha})`;
    }
    
    // Convert to arrays for JSON
    const institutionGraphData = {
      nodes: Array.from(filteredInstitutionNodes.values()),
      edges: Array.from(filteredInstitutionEdges.values())
    };
    
    // Create the output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), 'public/data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 1. Generate and save JSON format
    const jsonOutputPath = path.join(outputDir, 'institution-graph-data.json');
    fs.writeFileSync(jsonOutputPath, JSON.stringify(institutionGraphData, null, 2));
    console.log(`Institution JSON graph data generated at ${jsonOutputPath}`);
    
    // 2. Generate and save GEXF format
    console.log('Generating Institution GEXF format...');
    const gexfContent = generateGexf(institutionGraphData.nodes, institutionGraphData.edges);
    const gexfOutputPath = path.join(outputDir, 'institution-graph-data.gexf');
    fs.writeFileSync(gexfOutputPath, gexfContent);
    console.log(`Institution GEXF graph data generated at ${gexfOutputPath}`);
    
    console.log(`Total institution nodes: ${institutionGraphData.nodes.length}, Total edges: ${institutionGraphData.edges.length}`);
    
    return institutionGraphData;
  } catch (error) {
    console.error('Error generating institution graph data:', error);
    process.exit(1);
  }
}

/**
 * Helper function to format institution names to be more readable and shorter
 */
function formatInstitutionName(institution) {
  if (!institution) return "Unknown";
  
  let formattedName = institution;
  
  // Try to extract main part of the institution name
  if (institution.includes("University")) {
    const parts = institution.split("University");
    if (parts[0].trim()) {
      formattedName = parts[0].trim() + " Univ.";
    }
  } else if (institution.includes("Institute")) {
    const parts = institution.split("Institute");
    if (parts[0].trim()) {
      formattedName = parts[0].trim() + " Inst.";
    }
  } else if (institution.includes("Lab")) {
    const parts = institution.split("Lab");
    if (parts[0].trim()) {
      formattedName = parts[0].trim() + " Lab";
    }
  }
  
  // Limit length
  if (formattedName.length > 25) {
    formattedName = formattedName.substring(0, 22) + "...";
  }
  
  return formattedName;
}

/**
 * Simplified community detection for institutions
 */
function detectInstitutionCommunities(nodes, edges) {
  // Build an adjacency list
  const adjacencyList = {};
  
  // Initialize adjacency list
  for (const node of nodes) {
    adjacencyList[node.id] = [];
  }
  
  // Add edges to adjacency list
  for (const edge of edges) {
    adjacencyList[edge.source].push({
      target: edge.target,
      weight: edge.weight
    });
    adjacencyList[edge.target].push({
      target: edge.source,
      weight: edge.weight
    });
  }
  
  // Assign initial communities
  let communityId = 0;
  const communities = {};
  const visited = new Set();
  
  // Sort nodes by their connections (degree)
  const sortedNodes = [...nodes].sort((a, b) => {
    const aConnections = adjacencyList[a.id] ? adjacencyList[a.id].length : 0;
    const bConnections = adjacencyList[b.id] ? adjacencyList[b.id].length : 0;
    return bConnections - aConnections;
  });
  
  // Community detection using a greedy approach
  for (const node of sortedNodes) {
    if (visited.has(node.id)) continue;
    
    // Start a new community
    const community = communityId++;
    communities[node.id] = community;
    visited.add(node.id);
    
    // Find neighbors with strong connections and add them to the same community
    const neighbors = adjacencyList[node.id] || [];
    const strongNeighbors = neighbors
      .filter(n => n.weight >= 2) // Only consider stronger connections
      .sort((a, b) => b.weight - a.weight);
    
    for (const neighbor of strongNeighbors) {
      if (!visited.has(neighbor.target)) {
        communities[neighbor.target] = community;
        visited.add(neighbor.target);
      }
    }
  }
  
  // Assign any unvisited nodes to communities
  for (const node of nodes) {
    if (!communities[node.id]) {
      // Find the community most of its neighbors belong to
      const neighborCommunities = {};
      
      for (const neighbor of adjacencyList[node.id] || []) {
        const nCommunity = communities[neighbor.target];
        if (nCommunity !== undefined) {
          neighborCommunities[nCommunity] = (neighborCommunities[nCommunity] || 0) + neighbor.weight;
        }
      }
      
      // Find the community with the highest total weight
      let maxWeight = 0;
      let bestCommunity = communityId; // Default to a new community
      
      for (const [comm, weight] of Object.entries(neighborCommunities)) {
        if (weight > maxWeight) {
          maxWeight = weight;
          bestCommunity = parseInt(comm);
        }
      }
      
      communities[node.id] = bestCommunity;
      if (bestCommunity === communityId) communityId++;
    }
  }
  
  return communities;
}

// Run both graph data generation
async function generateAllGraphData() {
  // Generate author graph data first
  await generateGraphData();
  
  // Then generate institution graph data
  await generateInstitutionGraphData();
  
  console.log("All graph data generation complete!");
}

// Update the execution to run both
generateAllGraphData(); 