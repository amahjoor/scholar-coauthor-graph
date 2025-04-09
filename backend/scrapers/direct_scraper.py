#!/usr/bin/env python3
import argparse
import requests
from bs4 import BeautifulSoup
import json
import re
import time
import urllib.parse

def extract_author_id_from_url(url):
    """Extract the author ID from a Google Scholar URL"""
    pattern = r'user=([^&]+)'
    match = re.search(pattern, url)
    if match:
        return match.group(1)
    return None

def get_coauthors_direct(author_id):
    """
    Extract coauthors directly by scraping the Google Scholar page.
    This is a fallback method if the scholarly library doesn't work.
    """
    base_url = f"https://scholar.google.com/citations?user={author_id}&hl=en"
    
    # Set headers to mimic a browser
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }
    
    try:
        print(f"Fetching page for author ID: {author_id}")
        response = requests.get(base_url, headers=headers)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'lxml')
        
        # Extract author name
        author_name_elem = soup.select_one('#gsc_prf_in')
        author_name = author_name_elem.text if author_name_elem else "Unknown"
        print(f"Found author: {author_name}")
        
        # Find the coauthors section
        coauthor_section = soup.select('#gsc_rsb_co')
        
        if not coauthor_section:
            print("Coauthor section not found on the page")
            return []
        
        # Extract each coauthor
        coauthor_elements = soup.select('#gsc_rsb_co .gsc_rsb_aa')
        coauthors = []
        
        for element in coauthor_elements:
            link = element.get('href', '')
            coauthor_id = extract_author_id_from_url(link) if link else None
            
            coauthor_info = {
                'name': element.text,
                'scholar_id': coauthor_id,
                'url': f"https://scholar.google.com{link}" if link else None
            }
            coauthors.append(coauthor_info)
        
        print(f"Found {len(coauthors)} coauthors")
        return coauthors
        
    except Exception as e:
        print(f"Error occurred during scraping: {str(e)}")
        return []

def save_coauthors_to_json(coauthors, output_file):
    """Save coauthors list to a JSON file"""
    with open(output_file, 'w') as f:
        json.dump(coauthors, f, indent=2)
    print(f"Coauthors saved to {output_file}")

def main():
    parser = argparse.ArgumentParser(description='Extract coauthors from Google Scholar profile using direct scraping')
    parser.add_argument('--id', required=True, help='Google Scholar ID of the author')
    parser.add_argument('--output', default='coauthors_direct.json', help='Output JSON file (default: coauthors_direct.json)')
    
    args = parser.parse_args()
    
    coauthors = get_coauthors_direct(args.id)
    
    if coauthors:
        save_coauthors_to_json(coauthors, args.output)
        print(f"Found {len(coauthors)} coauthors for the specified author")
    else:
        print("No coauthors found or an error occurred")

if __name__ == "__main__":
    main() 