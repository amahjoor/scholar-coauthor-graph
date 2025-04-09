#!/usr/bin/env python3
import argparse
from scholarly import scholarly
import json
import time
import os

def get_coauthors(author_name=None, author_id=None):
    """
    Extract coauthors for a Google Scholar profile using either name or ID.
    Returns a list of coauthor information dictionaries.
    """
    try:
        if author_id:
            print(f"Searching for author with ID: {author_id}")
            author = scholarly.get_author_by_id(author_id)
        elif author_name:
            print(f"Searching for author: {author_name}")
            search_query = scholarly.search_author(author_name)
            author = next(search_query)
            print(f"Found author: {author['name']}")
        else:
            raise ValueError("Either author_name or author_id must be provided")

        # Fill in the author details to get coauthors
        author = scholarly.fill(author, sections=['coauthors'])
        
        if 'coauthors' not in author:
            print("No coauthors found for this author")
            return []
            
        print(f"Found {len(author['coauthors'])} coauthors")
        
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
        print(f"Error occurred: {str(e)}")
        return []

def save_coauthors_to_json(coauthors, output_file):
    """Save coauthors list to a JSON file"""
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    with open(output_file, 'w') as f:
        json.dump(coauthors, f, indent=2)
    print(f"Coauthors saved to {output_file}")

def main():
    parser = argparse.ArgumentParser(description='Extract coauthors from Google Scholar profile')
    parser.add_argument('--name', help='Name of the author to search for')
    parser.add_argument('--id', help='Google Scholar ID of the author')
    parser.add_argument('--output', default='data/coauthors.json', help='Output JSON file (default: data/coauthors.json)')
    
    args = parser.parse_args()
    
    if not args.name and not args.id:
        parser.error("Either --name or --id must be provided")
    
    coauthors = get_coauthors(author_name=args.name, author_id=args.id)
    
    if coauthors:
        save_coauthors_to_json(coauthors, args.output)
        print(f"Found {len(coauthors)} coauthors for the specified author")
    else:
        print("No coauthors found or an error occurred")

if __name__ == "__main__":
    main() 