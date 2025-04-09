#!/usr/bin/env python3
import os
import json
import glob
import networkx as nx
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import argparse
from tqdm import tqdm
from collections import defaultdict
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

def extract_institution_data(coauthor_data):
    """
    Extract institution data from coauthor data
    
    Args:
        coauthor_data: Dictionary mapping author IDs to their coauthor data
        
    Returns:
        primary_authors: Dictionary mapping author IDs to their information
        institution_authors: Dictionary mapping institutions to lists of author IDs
        author_institutions: Dictionary mapping author IDs to their institutions
    """
    # Map to store primary author data (those we have direct information for)
    primary_authors = {}
    
    # Maps for institution relationships
    institution_authors = defaultdict(list)
    author_institutions = {}
    
    # Process each author
    for author_id, coauthors in tqdm(coauthor_data.items(), desc="Extracting institution data"):
        # Skip if no coauthors
        if not coauthors:
            continue
        
        # Find author information in coauthors list (if available)
        author_name = "Unknown"
        author_institution = "Unknown"
        
        # Check if author itself appears in the coauthor list (sometimes happens)
        for coauthor in coauthors:
            if coauthor.get('scholar_id') == author_id:
                author_name = coauthor.get('name', "Unknown")
                author_institution = coauthor.get('affiliation', "Unknown")
                break
        
        # Store primary author information
        primary_authors[author_id] = {
            'id': author_id,
            'name': author_name,
            'institution': author_institution,
            'coauthor_count': len(coauthors)
        }
        
        # Update institution maps
        if author_institution != "Unknown":
            institution_authors[author_institution].append(author_id)
            author_institutions[author_id] = author_institution
        
        # Process each coauthor's institution
        for coauthor in coauthors:
            coauthor_id = coauthor.get('scholar_id')
            if not coauthor_id or coauthor_id == "Unknown":
                continue
                
            coauthor_institution = coauthor.get('affiliation', "Unknown")
            
            # Skip unknown affiliations
            if coauthor_institution == "Unknown":
                continue
                
            # Update institution maps
            author_institutions[coauthor_id] = coauthor_institution
    
    return primary_authors, institution_authors, author_institutions

def build_institution_graph(coauthor_data, author_institutions, min_weight=1, normalize=True):
    """
    Build a graph of institution connections based on coauthor relationships
    
    Args:
        coauthor_data: Dictionary mapping author IDs to their coauthor data
        author_institutions: Dictionary mapping author IDs to their institutions
        min_weight: Minimum weight for edges
        normalize: Whether to normalize edge weights
        
    Returns:
        NetworkX graph of institutions
    """
    # Create a graph for institutions
    G = nx.Graph()
    
    # Keep track of edge weights
    edge_weights = defaultdict(int)
    
    # Process each author
    for author_id, coauthors in tqdm(coauthor_data.items(), desc="Building institution graph"):
        # Skip if no coauthors
        if not coauthors:
            continue
        
        # Get author's institution
        author_institution = author_institutions.get(author_id, "Unknown")
        if author_institution == "Unknown":
            continue
        
        # Process each coauthor
        for coauthor in coauthors:
            coauthor_id = coauthor.get('scholar_id')
            if not coauthor_id or coauthor_id == "Unknown":
                continue
                
            # Get coauthor's institution
            coauthor_institution = author_institutions.get(coauthor_id, coauthor.get('affiliation', "Unknown"))
            if coauthor_institution == "Unknown" or coauthor_institution == author_institution:
                continue
            
            # Create an edge between the institutions
            edge_key = tuple(sorted([author_institution, coauthor_institution]))
            edge_weights[edge_key] += 1
    
    # Add nodes for each institution
    institution_counts = defaultdict(int)
    for institution in author_institutions.values():
        institution_counts[institution] += 1
    
    for institution, count in institution_counts.items():
        if institution != "Unknown":
            G.add_node(institution, name=institution, author_count=count)
    
    # Add edges with weights
    for (inst1, inst2), weight in tqdm(edge_weights.items(), desc="Adding edges"):
        if weight >= min_weight and inst1 != "Unknown" and inst2 != "Unknown":
            # Add the edge with the raw weight
            if normalize:
                # Normalize the weight by the number of authors at each institution
                norm_weight = weight / (institution_counts[inst1] + institution_counts[inst2])
            else:
                norm_weight = weight
                
            G.add_edge(inst1, inst2, weight=weight, norm_weight=norm_weight)
    
    return G

def create_interactive_institution_viz(G, output_file, max_nodes=100, min_authors=2, title="Institution Collaboration Network"):
    """
    Create an interactive visualization of the institution network
    
    Args:
        G: NetworkX graph of institutions
        output_file: Path to save the HTML file
        max_nodes: Maximum number of nodes to include in the visualization
        min_authors: Minimum number of authors for an institution to be included
        title: Title for the visualization
    """
    # Filter institutions with too few authors
    if min_authors > 1:
        institutions_to_keep = [node for node in G.nodes() if G.nodes[node].get('author_count', 0) >= min_authors]
        G = G.subgraph(institutions_to_keep)
    
    # If still too many nodes, filter by degree
    if len(G.nodes()) > max_nodes:
        print(f"Graph too large ({len(G.nodes())} nodes), limiting to {max_nodes} nodes with highest degree")
        degrees = dict(G.degree())
        top_nodes = sorted(degrees.items(), key=lambda x: x[1], reverse=True)[:max_nodes]
        top_node_ids = [node for node, _ in top_nodes]
        G = G.subgraph(top_node_ids)
    
    # Apply community detection
    try:
        partition = community.best_partition(G)
        nx.set_node_attributes(G, partition, 'community')
    except Exception as e:
        print(f"Error applying community detection: {str(e)}")
        partition = {}
    
    # Apply spring layout
    pos = nx.spring_layout(G, seed=42)
    
    # Extract positions
    x_values = [pos[node][0] for node in G.nodes()]
    y_values = [pos[node][1] for node in G.nodes()]
    
    # Get node sizes (based on number of authors)
    author_counts = [G.nodes[node].get('author_count', 1) for node in G.nodes()]
    
    # Scale node sizes for better visualization
    min_size = 10
    max_size = 50
    min_count = min(author_counts) if author_counts else 1
    max_count = max(author_counts) if author_counts else 2
    
    if max_count > min_count:
        size_range = max_size - min_size
        count_range = max_count - min_count
        node_sizes = [min_size + (count - min_count) * size_range / count_range for count in author_counts]
    else:
        node_sizes = [20 for _ in author_counts]
    
    # Get node colors based on community
    if partition:
        communities = nx.get_node_attributes(G, 'community')
        community_values = [communities.get(node, 0) for node in G.nodes()]
        
        # Create color map
        n_communities = len(set(community_values))
        color_scale = px.colors.qualitative.Plotly
        if n_communities > len(color_scale):
            color_scale = px.colors.qualitative.Alphabet  # Larger color set
            
        node_colors = [color_scale[val % len(color_scale)] for val in community_values]
    else:
        # Default colors if no community data
        node_colors = ['rgba(31, 119, 180, 0.8)' for _ in G.nodes()]
    
    # Create hover text
    hovertext = []
    for node in G.nodes():
        author_count = G.nodes[node].get('author_count', 0)
        connections = G.degree(node)
        
        text = f"<b>{node}</b><br>"
        text += f"Authors: {author_count}<br>"
        text += f"Connections: {connections}<br>"
        
        # Add top connected institutions
        neighbors = list(G.neighbors(node))
        if neighbors:
            text += "<br>Top connections:<br>"
            # Sort neighbors by edge weight
            weighted_neighbors = [(n, G[node][n].get('weight', 0)) for n in neighbors]
            weighted_neighbors.sort(key=lambda x: x[1], reverse=True)
            # Show top 5 connections
            for i, (neighbor, weight) in enumerate(weighted_neighbors[:5]):
                text += f"{neighbor} ({weight})<br>"
            
        hovertext.append(text)
    
    # Create edge traces with varying widths
    edge_traces = []
    
    # Get max weight for scaling
    max_weight = max([G[u][v].get('weight', 1) for u, v in G.edges()]) if G.edges() else 1
    min_weight = min([G[u][v].get('weight', 1) for u, v in G.edges()]) if G.edges() else 1
    
    # Create separate traces for different widths
    for u, v, data in G.edges(data=True):
        x0, y0 = pos[u]
        x1, y1 = pos[v]
        
        weight = data.get('weight', 1)
        # Scale width between 0.5 and 5
        width = 0.5 + 4.5 * (weight - min_weight) / (max_weight - min_weight) if max_weight > min_weight else 1
        
        # Create a trace for this edge
        edge_trace = go.Scatter(
            x=[x0, x1, None],
            y=[y0, y1, None],
            line=dict(width=width, color='rgba(150, 150, 150, 0.4)'),
            hoverinfo='none',
            mode='lines')
        
        edge_traces.append(edge_trace)
    
    # Create node trace
    node_trace = go.Scatter(
        x=x_values,
        y=y_values,
        mode='markers',
        hoverinfo='text',
        hovertext=hovertext,
        marker=dict(
            size=node_sizes,
            color=node_colors,
            line=dict(width=1, color='rgba(50, 50, 50, 0.8)')
        ))
    
    # Combine all traces
    traces = edge_traces + [node_trace]
    
    # Create the figure
    fig = go.Figure(data=traces,
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
    for node in G.nodes():
        author_count = G.nodes[node].get('author_count', 0)
        if author_count > 5:  # Only label nodes with several authors
            # Shorten institution name for display
            name = node
            
            # Try to extract main part of the institution name
            if "University" in name:
                parts = name.split("University")
                if parts[0].strip():
                    name = parts[0].strip()
                    name += " Univ."
            elif "Institute" in name:
                parts = name.split("Institute")
                if parts[0].strip():
                    name = parts[0].strip() + " Inst."
            elif "Lab" in name:
                parts = name.split("Lab")
                if parts[0].strip():
                    name = parts[0].strip() + " Lab"
            
            # Limit to 20 characters
            if len(name) > 25:
                name = name[:22] + "..."
            
            annotations.append(dict(
                x=pos[node][0],
                y=pos[node][1],
                xref="x",
                yref="y",
                text=name,
                showarrow=False,
                font=dict(
                    size=10,
                    color="black"
                ),
                bgcolor="rgba(255, 255, 255, 0.7)",
                bordercolor="rgba(0, 0, 0, 0.5)",
                borderwidth=1,
                borderpad=3,
                opacity=0.9
            ))
    
    fig.update_layout(annotations=annotations)
    
    # Save to HTML file
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    fig.write_html(output_file)
    print(f"Interactive institution visualization saved to {output_file}")
    
    return fig

def save_institution_data(G, output_file):
    """
    Save institution graph data to CSV
    
    Args:
        G: NetworkX graph of institutions
        output_file: Path to save the CSV file
    """
    # Extract node data
    nodes = []
    for node in G.nodes(data=True):
        nodes.append({
            'institution': node[0],
            'author_count': node[1].get('author_count', 0),
            'degree': G.degree(node[0]),
            'community': node[1].get('community', -1)
        })
    
    # Extract edge data
    edges = []
    for u, v, data in G.edges(data=True):
        edges.append({
            'institution1': u,
            'institution2': v,
            'weight': data.get('weight', 0),
            'norm_weight': data.get('norm_weight', 0)
        })
    
    # Convert to DataFrame and save
    nodes_df = pd.DataFrame(nodes)
    edges_df = pd.DataFrame(edges)
    
    # Save to CSV
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    nodes_file = output_file.replace('.csv', '_nodes.csv')
    edges_file = output_file.replace('.csv', '_edges.csv')
    
    nodes_df.to_csv(nodes_file, index=False)
    edges_df.to_csv(edges_file, index=False)
    
    print(f"Institution nodes saved to {nodes_file}")
    print(f"Institution edges saved to {edges_file}")

def main():
    parser = argparse.ArgumentParser(description='Create interactive visualization of institution network')
    parser.add_argument('--input', default='data/coauthors', 
                        help='Input directory containing coauthor JSON files')
    parser.add_argument('--output', default='data/network_viz/institution_network.html',
                        help='Output HTML file for interactive visualization')
    parser.add_argument('--data-output', default='data/network_viz/institution_data.csv',
                        help='Output CSV file for institution data')
    parser.add_argument('--min-weight', type=int, default=2,
                        help='Minimum edge weight to include')
    parser.add_argument('--min-authors', type=int, default=2,
                        help='Minimum number of authors for an institution to be included')
    parser.add_argument('--max-nodes', type=int, default=100,
                        help='Maximum number of nodes to visualize')
    parser.add_argument('--title', default='Institution Collaboration Network',
                        help='Title for the visualization')
    parser.add_argument('--normalize', action='store_true',
                        help='Normalize edge weights by institution size')
    
    args = parser.parse_args()
    
    print("Loading coauthor data...")
    coauthor_data = load_coauthor_files(args.input)
    
    print(f"Loaded {len(coauthor_data)} coauthor files")
    
    print("Extracting institution data...")
    primary_authors, institution_authors, author_institutions = extract_institution_data(coauthor_data)
    
    print(f"Found {len(institution_authors)} institutions")
    
    print("Building institution graph...")
    G = build_institution_graph(coauthor_data, author_institutions, 
                               min_weight=args.min_weight, normalize=args.normalize)
    
    print(f"Institution graph has {G.number_of_nodes()} nodes and {G.number_of_edges()} edges")
    
    print("Saving institution data...")
    save_institution_data(G, args.data_output)
    
    print("Creating interactive visualization...")
    create_interactive_institution_viz(
        G, args.output, max_nodes=args.max_nodes, 
        min_authors=args.min_authors, title=args.title
    )
    
    print("Done!")

if __name__ == "__main__":
    main() 