#!/usr/bin/env python3
import os
import json
import glob
import networkx as nx
import matplotlib.pyplot as plt
import pandas as pd
from collections import defaultdict
import argparse
from tqdm import tqdm
import community  # python-louvain package

def load_coauthor_files(folder_path):
    """
    Load all coauthor JSON files from a directory
    
    Args:
        folder_path: Path to the folder containing coauthor JSON files
        
    Returns:
        Dictionary mapping author IDs to their coauthor data
    """
    files = glob.glob(os.path.join(folder_path, "*_coauthors.json"))
    
    coauthor_data = {}
    for file in tqdm(files, desc="Loading coauthor files"):
        try:
            # Extract author ID from filename
            author_id = os.path.basename(file).replace("_coauthors.json", "")
            
            # Load coauthor data
            with open(file, 'r') as f:
                coauthors = json.load(f)
                
            coauthor_data[author_id] = coauthors
        except Exception as e:
            print(f"Error loading {file}: {str(e)}")
    
    return coauthor_data

def build_coauthor_graph(coauthor_data, min_weight=1, max_nodes=None):
    """
    Build a NetworkX graph of coauthors
    
    Args:
        coauthor_data: Dictionary mapping author IDs to their coauthor data
        min_weight: Minimum number of shared coauthors to include an edge
        max_nodes: Maximum number of nodes to include in the graph
        
    Returns:
        NetworkX graph of coauthors
    """
    # Create a directed graph
    G = nx.Graph()
    
    # Keep track of coauthor names for node labels
    author_names = {}
    
    # Keep track of edge weights (number of shared connections)
    edge_weights = defaultdict(int)
    
    # Process each author
    added_authors = set()
    for author_id, coauthors in tqdm(coauthor_data.items(), desc="Building graph"):
        if max_nodes and len(G.nodes()) >= max_nodes:
            break
            
        # Skip if no coauthors (empty list)
        if not coauthors:
            continue
        
        # Add author to graph if not already present
        if author_id not in added_authors:
            # Create a node property dict to store additional info
            node_data = {
                'id': author_id,
                'coauthor_count': len(coauthors),
                'type': 'primary'  # Mark as a primary author (one we have coauthor data for)
            }
            
            # Try to get author name if available
            name = "Unknown"
            for coauthor in coauthors:
                if coauthor.get('scholar_id') == author_id:
                    name = coauthor.get('name', "Unknown")
                    break
            
            node_data['name'] = name
            author_names[author_id] = name
            
            G.add_node(author_id, **node_data)
            added_authors.add(author_id)
        
        # Process each coauthor
        for coauthor in coauthors:
            coauthor_id = coauthor.get('scholar_id')
            if not coauthor_id:
                continue
                
            coauthor_name = coauthor.get('name', "Unknown")
            affiliation = coauthor.get('affiliation', "Unknown")
            
            # Skip self-loops
            if coauthor_id == author_id:
                continue
            
            # Add coauthor to graph if not already present
            if coauthor_id not in added_authors:
                G.add_node(coauthor_id, 
                           id=coauthor_id, 
                           name=coauthor_name, 
                           affiliation=affiliation,
                           type='secondary')  # Mark as a secondary author (one we don't have data for)
                author_names[coauthor_id] = coauthor_name
                added_authors.add(coauthor_id)
            
            # Increment edge weight
            edge_key = tuple(sorted([author_id, coauthor_id]))
            edge_weights[edge_key] += 1
    
    # Add edges with weights
    for (u, v), weight in tqdm(edge_weights.items(), desc="Adding edges"):
        if weight >= min_weight:
            G.add_edge(u, v, weight=weight)
    
    return G, author_names

def apply_community_detection(G):
    """Apply community detection algorithm to the graph"""
    try:
        partition = community.best_partition(G)
        nx.set_node_attributes(G, partition, 'community')
        return True
    except Exception as e:
        print(f"Error applying community detection: {str(e)}")
        return False

def save_graph_to_files(G, author_names, output_dir):
    """Save graph data to various file formats"""
    os.makedirs(output_dir, exist_ok=True)
    
    # Save as GraphML for importing into tools like Gephi
    nx.write_graphml(G, os.path.join(output_dir, "coauthor_network.graphml"))
    
    # Save edge list as CSV
    edges = []
    for u, v, data in G.edges(data=True):
        edges.append({
            'source_id': u,
            'source_name': author_names.get(u, "Unknown"),
            'target_id': v,
            'target_name': author_names.get(v, "Unknown"),
            'weight': data.get('weight', 1)
        })
    
    edge_df = pd.DataFrame(edges)
    edge_df.to_csv(os.path.join(output_dir, "coauthor_edges.csv"), index=False)
    
    # Save node list as CSV
    nodes = []
    for node, data in G.nodes(data=True):
        nodes.append({
            'id': node,
            'name': data.get('name', author_names.get(node, "Unknown")),
            'affiliation': data.get('affiliation', "Unknown"),
            'coauthor_count': data.get('coauthor_count', 0),
            'community': data.get('community', -1),
            'degree': G.degree(node),
            'type': data.get('type', 'unknown')
        })
    
    node_df = pd.DataFrame(nodes)
    node_df.to_csv(os.path.join(output_dir, "coauthor_nodes.csv"), index=False)
    
    print(f"Graph data saved to {output_dir}")

def visualize_graph(G, author_names, output_file=None, 
                    layout='spring', k=None, iterations=100, 
                    node_size_factor=1.0, edge_width_factor=1.0,
                    max_nodes=500):
    """
    Visualize the coauthor graph
    
    Args:
        G: NetworkX graph of coauthors
        author_names: Dictionary mapping author IDs to names
        output_file: Path to save the visualization (if None, show interactively)
        layout: Layout algorithm to use (spring, kamada_kawai, circular)
        k: Spring layout parameter (None for default)
        iterations: Number of iterations for spring layout
        node_size_factor: Factor to scale node sizes
        edge_width_factor: Factor to scale edge widths
        max_nodes: Maximum number of nodes to visualize
    """
    # If graph is too large, take a subgraph 
    if len(G.nodes()) > max_nodes:
        print(f"Graph too large ({len(G.nodes())} nodes), limiting to {max_nodes} nodes with highest degree")
        degrees = dict(G.degree())
        top_nodes = sorted(degrees.items(), key=lambda x: x[1], reverse=True)[:max_nodes]
        top_node_ids = [node for node, _ in top_nodes]
        G = G.subgraph(top_node_ids)
    
    # Compute layout
    if layout == 'spring':
        pos = nx.spring_layout(G, k=k, iterations=iterations)
    elif layout == 'kamada_kawai':
        pos = nx.kamada_kawai_layout(G)
    elif layout == 'circular':
        pos = nx.circular_layout(G)
    else:
        pos = nx.spring_layout(G)
    
    plt.figure(figsize=(20, 20))
    
    # Get node sizes based on degree
    node_sizes = [G.degree(node) * 20 * node_size_factor for node in G.nodes()]
    
    # Get node colors based on community if available
    if 'community' in next(iter(G.nodes(data=True)))[1]:
        communities = nx.get_node_attributes(G, 'community')
        node_colors = [communities[node] for node in G.nodes()]
        # Draw nodes with community colors
        nx.draw_networkx_nodes(G, pos, node_size=node_sizes, node_color=node_colors, alpha=0.8, cmap=plt.cm.rainbow)
    else:
        # Color by node type (primary/secondary)
        node_types = nx.get_node_attributes(G, 'type')
        node_colors = ['blue' if node_types.get(node) == 'primary' else 'green' for node in G.nodes()]
        nx.draw_networkx_nodes(G, pos, node_size=node_sizes, node_color=node_colors, alpha=0.8)
    
    # Draw edges with varying width based on weight
    edge_weights = [G[u][v].get('weight', 1) * edge_width_factor for u, v in G.edges()]
    nx.draw_networkx_edges(G, pos, width=edge_weights, alpha=0.3, edge_color='gray')
    
    # Draw labels only for nodes with degree > threshold
    label_threshold = max(1, G.number_of_nodes() // 20)  # Adjust based on graph size
    label_nodes = {node: author_names.get(node, str(node)) for node in G.nodes() if G.degree(node) > label_threshold}
    nx.draw_networkx_labels(G, pos, labels=label_nodes, font_size=10, font_color='black')
    
    plt.axis('off')
    plt.tight_layout()
    
    if output_file:
        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        print(f"Visualization saved to {output_file}")
    else:
        plt.show()
    
    plt.close()

def main():
    parser = argparse.ArgumentParser(description='Visualize coauthor network')
    parser.add_argument('--input', default='data/coauthors', 
                      help='Input directory containing coauthor JSON files')
    parser.add_argument('--output-dir', default='data/network_viz',
                      help='Output directory for visualization files')
    parser.add_argument('--min-weight', type=int, default=1,
                      help='Minimum edge weight (connections) to include')
    parser.add_argument('--max-nodes', type=int, default=None,
                      help='Maximum number of nodes to include in the graph')
    parser.add_argument('--layout', choices=['spring', 'kamada_kawai', 'circular'], 
                      default='spring', help='Layout algorithm to use')
    parser.add_argument('--k', type=float, default=None,
                      help='Spring layout parameter (strength of repulsive force)')
    parser.add_argument('--iterations', type=int, default=50,
                      help='Number of iterations for spring layout')
    parser.add_argument('--node-size-factor', type=float, default=1.0,
                      help='Factor to scale node sizes')
    parser.add_argument('--edge-width-factor', type=float, default=1.0,
                      help='Factor to scale edge widths')
    parser.add_argument('--viz-max-nodes', type=int, default=500,
                      help='Maximum number of nodes to visualize in the plot')
    
    args = parser.parse_args()
    
    print("Loading coauthor data...")
    coauthor_data = load_coauthor_files(args.input)
    
    print(f"Loaded {len(coauthor_data)} coauthor files")
    
    print("Building coauthor graph...")
    G, author_names = build_coauthor_graph(coauthor_data, args.min_weight, args.max_nodes)
    
    print(f"Graph has {G.number_of_nodes()} nodes and {G.number_of_edges()} edges")
    
    print("Applying community detection...")
    apply_community_detection(G)
    
    print("Saving graph data...")
    save_graph_to_files(G, author_names, args.output_dir)
    
    print("Generating visualization...")
    output_file = os.path.join(args.output_dir, "coauthor_network_viz.png")
    visualize_graph(G, author_names, output_file, 
                   args.layout, args.k, args.iterations, 
                   args.node_size_factor, args.edge_width_factor,
                   args.viz_max_nodes)
    
    print("Done!")

if __name__ == "__main__":
    main() 