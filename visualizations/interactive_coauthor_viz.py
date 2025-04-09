#!/usr/bin/env python3
import os
import json
import glob
import networkx as nx
import pandas as pd
import plotly.graph_objects as go
import argparse
from tqdm import tqdm
import community  # python-louvain package
import numpy as np

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
    # Create a graph
    G = nx.Graph()
    
    # Keep track of coauthor names for node labels
    author_names = {}
    author_affiliations = {}
    
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
            affiliation = "Unknown"
            for coauthor in coauthors:
                if coauthor.get('scholar_id') == author_id:
                    name = coauthor.get('name', "Unknown")
                    affiliation = coauthor.get('affiliation', "Unknown")
                    break
            
            node_data['name'] = name
            node_data['affiliation'] = affiliation
            author_names[author_id] = name
            author_affiliations[author_id] = affiliation
            
            G.add_node(author_id, **node_data)
            added_authors.add(author_id)
        
        # Process each coauthor
        for coauthor in coauthors:
            coauthor_id = coauthor.get('scholar_id')
            if not coauthor_id or coauthor_id == "Unknown":
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
                author_affiliations[coauthor_id] = affiliation
                added_authors.add(coauthor_id)
            
            # Increment edge weight
            edge_key = tuple(sorted([author_id, coauthor_id]))
            edge_weights[edge_key] += 1
    
    # Add edges with weights
    for (u, v), weight in tqdm(edge_weights.items(), desc="Adding edges"):
        if weight >= min_weight:
            G.add_edge(u, v, weight=weight)
    
    return G, author_names, author_affiliations

def apply_community_detection(G):
    """Apply community detection algorithm to the graph"""
    try:
        partition = community.best_partition(G)
        nx.set_node_attributes(G, partition, 'community')
        return partition
    except Exception as e:
        print(f"Error applying community detection: {str(e)}")
        return {}

def create_interactive_visualization(G, author_names, author_affiliations, output_file,
                                    max_nodes=500, title="Scholar Coauthor Network"):
    """
    Create an interactive Plotly visualization of the coauthor network
    
    Args:
        G: NetworkX graph of coauthors
        author_names: Dictionary mapping author IDs to names
        author_affiliations: Dictionary mapping author IDs to affiliations
        output_file: Path to save the HTML file
        max_nodes: Maximum number of nodes to visualize
        title: Title for the visualization
    """
    # If graph is too large, take a subgraph with highest degree nodes
    if len(G.nodes()) > max_nodes:
        print(f"Graph too large ({len(G.nodes())} nodes), limiting to {max_nodes} nodes with highest degree")
        degrees = dict(G.degree())
        top_nodes = sorted(degrees.items(), key=lambda x: x[1], reverse=True)[:max_nodes]
        top_node_ids = [node for node, _ in top_nodes]
        G = G.subgraph(top_node_ids)
    
    # Apply spring layout
    pos = nx.spring_layout(G, seed=42)
    
    # Extract positions
    x_values = [pos[node][0] for node in G.nodes()]
    y_values = [pos[node][1] for node in G.nodes()]
    
    # Get node colors based on community if available
    if 'community' in next(iter(G.nodes(data=True)))[1]:
        communities = nx.get_node_attributes(G, 'community')
        community_values = [communities[node] for node in G.nodes()]
        
        # Create color map
        n_communities = len(set(community_values))
        color_scale = px.colors.qualitative.Plotly
        if n_communities > len(color_scale):
            # Use a continuous color scale if we have too many communities
            color_scale = px.colors.sequential.Viridis
            
        node_colors = [color_scale[val % len(color_scale)] for val in community_values]
        community_info = [f"Community: {val}" for val in community_values]
    else:
        # Color by node type (primary/secondary)
        node_types = nx.get_node_attributes(G, 'type')
        node_colors = ['rgba(31, 119, 180, 0.8)' if node_types.get(node) == 'primary' 
                       else 'rgba(44, 160, 44, 0.8)' for node in G.nodes()]
        community_info = ["" for _ in G.nodes()]
    
    # Create hover text
    hovertext = []
    for i, node in enumerate(G.nodes()):
        degree = G.degree(node)
        node_info = G.nodes[node]
        name = node_info.get('name', author_names.get(node, "Unknown"))
        affiliation = node_info.get('affiliation', author_affiliations.get(node, "Unknown"))
        
        text = f"<b>{name}</b><br>"
        text += f"ID: {node}<br>"
        text += f"Affiliation: {affiliation}<br>"
        text += f"Connections: {degree}<br>"
        
        if community_info[i]:
            text += f"{community_info[i]}<br>"
            
        if node_info.get('type') == 'primary':
            text += f"Type: Primary researcher<br>"
        else:
            text += f"Type: Secondary researcher<br>"
            
        hovertext.append(text)
    
    # Calculate node sizes (scaled by degree)
    node_degrees = [G.degree(node) for node in G.nodes()]
    min_size = 5
    max_size = 30
    if max(node_degrees) > min(node_degrees):
        # Scale sizes if we have a range of degrees
        size_scaling = (max_size - min_size) / (max(node_degrees) - min(node_degrees))
        node_sizes = [min_size + (degree - min(node_degrees)) * size_scaling for degree in node_degrees]
    else:
        # Use a default size if all nodes have same degree
        node_sizes = [10 for _ in node_degrees]
    
    # Create edge trace
    edge_x = []
    edge_y = []
    edge_weights = []
    
    for edge in G.edges(data=True):
        x0, y0 = pos[edge[0]]
        x1, y1 = pos[edge[1]]
        
        # Add each line segment with None to create separation between edges
        edge_x.extend([x0, x1, None])
        edge_y.extend([y0, y1, None])
        
        # Use edge weight for width
        weight = edge[2].get('weight', 1)
        edge_weights.append(weight)
    
    # Create edge trace
    edge_trace = go.Scatter(
        x=edge_x, y=edge_y,
        line=dict(width=0.5, color='rgba(150, 150, 150, 0.3)'),
        hoverinfo='none',
        mode='lines')
    
    # Create node trace
    node_trace = go.Scatter(
        x=x_values, y=y_values,
        mode='markers',
        hoverinfo='text',
        hovertext=hovertext,
        marker=dict(
            size=node_sizes,
            color=node_colors,
            line=dict(width=1, color='rgba(50, 50, 50, 0.8)')
        ))
    
    # Create the figure
    fig = go.Figure(data=[edge_trace, node_trace],
                layout=go.Layout(
                    title=title,
                    showlegend=False,
                    hovermode='closest',
                    margin=dict(b=20, l=5, r=5, t=40),
                    xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                    yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                    height=800,
                    width=1000,
                ))
    
    # Add annotations for larger nodes
    annotations = []
    for i, node in enumerate(G.nodes()):
        if G.degree(node) > np.percentile(node_degrees, 90):  # Label top 10% by degree
            name = G.nodes[node].get('name', author_names.get(node, str(node)))
            # Create a shorter display name
            display_name = name.split()[0]  # Just first name
            if len(name.split()) > 1:
                display_name += " " + name.split()[1][0] + "."  # Add initial of last name

            annotations.append(dict(
                x=pos[node][0],
                y=pos[node][1],
                xref="x",
                yref="y",
                text=display_name,
                showarrow=False,
                font=dict(
                    size=10,
                    color="black"
                ),
                bgcolor="rgba(255, 255, 255, 0.5)",
                bordercolor="rgba(0, 0, 0, 0.5)",
                borderwidth=1,
                borderpad=2,
                opacity=0.8
            ))
    
    fig.update_layout(annotations=annotations)
    
    # Save to HTML file
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    fig.write_html(output_file)
    print(f"Interactive visualization saved to {output_file}")
    
    return fig

def main():
    parser = argparse.ArgumentParser(description='Create interactive visualization of coauthor network')
    parser.add_argument('--input', default='data/coauthors', 
                        help='Input directory containing coauthor JSON files')
    parser.add_argument('--output', default='data/network_viz/interactive_network.html',
                        help='Output HTML file for interactive visualization')
    parser.add_argument('--min-weight', type=int, default=1,
                        help='Minimum edge weight (connections) to include')
    parser.add_argument('--max-nodes', type=int, default=None,
                        help='Maximum number of nodes to include in the graph')
    parser.add_argument('--viz-max-nodes', type=int, default=500,
                        help='Maximum number of nodes to visualize')
    parser.add_argument('--title', default='Scholar Coauthor Network',
                        help='Title for the visualization')
    
    args = parser.parse_args()
    
    print("Loading coauthor data...")
    coauthor_data = load_coauthor_files(args.input)
    
    print(f"Loaded {len(coauthor_data)} coauthor files")
    
    print("Building coauthor graph...")
    G, author_names, author_affiliations = build_coauthor_graph(coauthor_data, args.min_weight, args.max_nodes)
    
    print(f"Graph has {G.number_of_nodes()} nodes and {G.number_of_edges()} edges")
    
    print("Applying community detection...")
    apply_community_detection(G)
    
    print("Creating interactive visualization...")
    create_interactive_visualization(
        G, author_names, author_affiliations, args.output, 
        max_nodes=args.viz_max_nodes, title=args.title
    )
    
    print("Done!")

if __name__ == "__main__":
    from collections import defaultdict
    import plotly.express as px
    main() 