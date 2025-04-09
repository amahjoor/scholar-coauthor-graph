#!/bin/bash

# Create various visualizations of the coauthor network
# Usage: ./create_visualizations.sh [output_dir] [max_nodes]

# Set defaults
OUTPUT_DIR=${1:-"data/network_viz"}
MAX_NODES=${2:-300}
MIN_WEIGHT=1

echo "Creating visualizations in $OUTPUT_DIR with max $MAX_NODES nodes..."

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# 1. Create static visualization with spring layout
echo "Creating static visualization with spring layout..."
python visualize_coauthor_network.py \
  --input data/coauthors \
  --output-dir "$OUTPUT_DIR/static_spring" \
  --min-weight $MIN_WEIGHT \
  --viz-max-nodes $MAX_NODES \
  --layout spring

# 2. Create static visualization with kamada kawai layout
echo "Creating static visualization with Kamada-Kawai layout..."
python visualize_coauthor_network.py \
  --input data/coauthors \
  --output-dir "$OUTPUT_DIR/static_kamada" \
  --min-weight $MIN_WEIGHT \
  --viz-max-nodes $MAX_NODES \
  --layout kamada_kawai

# 3. Create static visualization with circular layout
echo "Creating static visualization with circular layout..."
python visualize_coauthor_network.py \
  --input data/coauthors \
  --output-dir "$OUTPUT_DIR/static_circular" \
  --min-weight $MIN_WEIGHT \
  --viz-max-nodes $MAX_NODES \
  --layout circular

# 4. Create interactive coauthor network visualization
echo "Creating interactive coauthor network visualization..."
python interactive_coauthor_viz.py \
  --input data/coauthors \
  --output "$OUTPUT_DIR/interactive_coauthor_network.html" \
  --min-weight $MIN_WEIGHT \
  --viz-max-nodes $MAX_NODES \
  --title "Interactive Scholar Coauthor Network"

# 5. Create institution network visualization
echo "Creating institution network visualization..."
python institution_network_viz.py \
  --input data/coauthors \
  --output "$OUTPUT_DIR/institution_network.html" \
  --data-output "$OUTPUT_DIR/institution_data.csv" \
  --min-weight 2 \
  --min-authors 2 \
  --max-nodes $MAX_NODES \
  --title "Institution Collaboration Network"

echo "All visualizations completed!"
echo "Results saved to $OUTPUT_DIR" 