#!/usr/bin/env python3
import argparse
import json
import os
import time
import pandas as pd
from scholarly import scholarly
import random
from tqdm import tqdm
import logging

# Import functionality from our scrapers (commenting out since we'll redefine the functions)
# from scholar_scraper import get_coauthors, save_coauthors_to_json

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("data/pipeline.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def get_coauthors(author_name=None, author_id=None):
    """
    Extract coauthors for a Google Scholar profile using either name or ID.
    Returns a list of coauthor information dictionaries.
    """
    try:
        if author_id:
            logger.info(f"Searching for author with ID: {author_id}")
            author = scholarly.search_author_id(author_id)
        elif author_name:
            logger.info(f"Searching for author: {author_name}")
            search_query = scholarly.search_author(author_name)
            author = next(search_query)
            logger.info(f"Found author: {author['name']}")
        else:
            raise ValueError("Either author_name or author_id must be provided")

        # Fill in the author details to get coauthors
        author = scholarly.fill(author, sections=['coauthors'])
        
        if 'coauthors' not in author:
            logger.info("No coauthors found for this author")
            return []
            
        logger.info(f"Found {len(author['coauthors'])} coauthors")
        
        # Extract coauthor details
        coauthors = []
        for coauthor in author['coauthors']:
            coauthor_info = {
                'name': coauthor.get('name', 'Unknown'),
                'scholar_id': coauthor.get('scholar_id', 'Unknown'),
                'affiliation': coauthor.get('affiliation', 'Unknown')
            }
            coauthors.append(coauthor_info)
            
        return coauthors
        
    except Exception as e:
        logger.error(f"Error occurred: {str(e)}")
        return []

def save_coauthors_to_json(coauthors, output_file):
    """Save coauthors list to a JSON file"""
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    with open(output_file, 'w') as f:
        json.dump(coauthors, f, indent=2)
    logger.info(f"Coauthors saved to {output_file}")

def load_csrankings_data(file_path):
    """
    Load researcher data from CSRankings JSON file
    
    Args:
        file_path (str): Path to the CSRankings data JSON file
        
    Returns:
        list: List of researcher dictionaries
    """
    try:
        with open(file_path, 'r') as f:
            researchers = json.load(f)
        logger.info(f"Loaded {len(researchers)} researchers from {file_path}")
        return researchers
    except Exception as e:
        logger.error(f"Error loading CSRankings data: {str(e)}")
        return []

def process_researchers(researchers, output_dir, delay_range=(2, 5), max_researchers=None):
    """
    Process each researcher and extract their coauthors
    
    Args:
        researchers (list): List of researcher dictionaries from CSRankings
        output_dir (str): Directory to save coauthor data
        delay_range (tuple): Range for random delay between requests (min, max) in seconds
        max_researchers (int, optional): Maximum number of researchers to process
        
    Returns:
        dict: Dictionary mapping researcher IDs to their coauthors
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Filter researchers with Google Scholar IDs
    researchers_with_ids = [r for r in researchers if r.get('google_scholar_id')]
    logger.info(f"Found {len(researchers_with_ids)} researchers with Google Scholar IDs")
    
    # Limit number of researchers if specified
    if max_researchers and max_researchers < len(researchers_with_ids):
        researchers_to_process = researchers_with_ids[:max_researchers]
        logger.info(f"Processing {max_researchers} out of {len(researchers_with_ids)} researchers")
    else:
        researchers_to_process = researchers_with_ids
    
    # Dictionary to store results
    results = {}
    
    # Process each researcher
    for i, researcher in enumerate(tqdm(researchers_to_process, desc="Processing researchers")):
        name = researcher['name']
        scholar_id = researcher['google_scholar_id']
        
        if not scholar_id:
            logger.warning(f"Skipping {name} - no Google Scholar ID")
            continue
        
        logger.info(f"Processing researcher {i+1}/{len(researchers_to_process)}: {name} (ID: {scholar_id})")
        
        try:
            # Get coauthors
            coauthors = get_coauthors(author_id=scholar_id)
            
            if coauthors:
                # Save to individual JSON file
                output_file = os.path.join(output_dir, f"{scholar_id}_coauthors.json")
                save_coauthors_to_json(coauthors, output_file)
                
                # Store in results dictionary
                results[scholar_id] = {
                    "name": name,
                    "institution": researcher.get('institution', 'Unknown'),
                    "coauthors": coauthors
                }
                
                logger.info(f"Found {len(coauthors)} coauthors for {name}")
            else:
                logger.warning(f"No coauthors found for {name}")
            
            # Random delay to avoid rate limiting
            if i < len(researchers_to_process) - 1:  # No need to wait after the last researcher
                delay = random.uniform(delay_range[0], delay_range[1])
                logger.debug(f"Waiting {delay:.2f} seconds before next request")
                time.sleep(delay)
                
        except Exception as e:
            logger.error(f"Error processing {name}: {str(e)}")
    
    return results

def save_aggregated_results(results, output_file):
    """
    Save aggregated results to a single JSON file
    
    Args:
        results (dict): Dictionary of results
        output_file (str): Output file path
    """
    try:
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)
        logger.info(f"Aggregated results saved to {output_file}")
    except Exception as e:
        logger.error(f"Error saving aggregated results: {str(e)}")

def create_coauthor_network(results, output_file):
    """
    Create a network representation of the coauthor relationships
    
    Args:
        results (dict): Dictionary of results
        output_file (str): Output file path for the network data
    """
    try:
        # Create edges list (source, target)
        edges = []
        
        for scholar_id, data in results.items():
            source_name = data['name']
            for coauthor in data['coauthors']:
                target_id = coauthor['scholar_id']
                target_name = coauthor['name']
                
                edges.append({
                    'source_id': scholar_id,
                    'source_name': source_name,
                    'target_id': target_id,
                    'target_name': target_name
                })
        
        # Save as CSV
        df = pd.DataFrame(edges)
        df.to_csv(output_file, index=False)
        logger.info(f"Coauthor network saved to {output_file} with {len(edges)} connections")
    except Exception as e:
        logger.error(f"Error creating coauthor network: {str(e)}")

def main():
    parser = argparse.ArgumentParser(description='Pipeline connecting CSRankings and Google Scholar data')
    parser.add_argument('--input', default='data/csrankings_data.json', 
                        help='Input JSON file with CSRankings data (default: data/csrankings_data.json)')
    parser.add_argument('--output-dir', default='data/coauthors', 
                        help='Output directory for individual coauthor files (default: data/coauthors)')
    parser.add_argument('--output-agg', default='data/aggregated_coauthors.json',
                        help='Output file for aggregated coauthor data (default: data/aggregated_coauthors.json)')
    parser.add_argument('--network-output', default='data/coauthor_network.csv',
                        help='Output file for coauthor network data (default: data/coauthor_network.csv)')
    parser.add_argument('--max', type=int, 
                        help='Maximum number of researchers to process (for testing)')
    parser.add_argument('--min-delay', type=float, default=2.0,
                        help='Minimum delay between requests in seconds (default: 2.0)')
    parser.add_argument('--max-delay', type=float, default=5.0,
                        help='Maximum delay between requests in seconds (default: 5.0)')
    
    args = parser.parse_args()
    
    # Load CSRankings data
    researchers = load_csrankings_data(args.input)
    
    if not researchers:
        logger.error("No researchers loaded from CSRankings data")
        return
    
    # Process researchers and get coauthors
    results = process_researchers(
        researchers, 
        args.output_dir, 
        delay_range=(args.min_delay, args.max_delay),
        max_researchers=args.max
    )
    
    # Save aggregated results
    save_aggregated_results(results, args.output_agg)
    
    # Create network representation
    create_coauthor_network(results, args.network_output)
    
    logger.info("Pipeline completed successfully")

if __name__ == "__main__":
    main() 