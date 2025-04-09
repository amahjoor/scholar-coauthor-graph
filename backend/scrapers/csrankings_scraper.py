#!/usr/bin/env python3
import argparse
import time
import json
import pandas as pd
import re
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.safari.options import Options as SafariOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import os
import requests

def setup_driver(browser="safari", headless=True):
    """
    Set up and return a Selenium WebDriver instance
    
    Args:
        browser (str): Browser to use ('chrome' or 'safari')
        headless (bool): Whether to run in headless mode (only applies to Chrome)
    """
    if browser.lower() == "safari":
        print("Setting up Safari WebDriver...")
        try:
            options = SafariOptions()
            driver = webdriver.Safari(options=options)
            return driver
        except Exception as e:
            print(f"Error setting up Safari WebDriver: {str(e)}")
            print("Make sure Safari's developer menu is enabled and 'Allow Remote Automation' is checked.")
            print("You can enable this in Safari > Preferences > Advanced > 'Show Develop menu in menu bar'")
            print("Then in the Develop menu, check 'Allow Remote Automation'")
            raise
    else:
        print("Setting up Chrome WebDriver...")
        try:
            chrome_options = Options()
            if headless:
                chrome_options.add_argument("--headless")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--window-size=1920,1080")
            
            # Check if Chrome is installed
            chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            if not os.path.exists(chrome_path):
                print(f"Chrome not found at {chrome_path}")
                print("Please install Chrome or use Safari by specifying --browser safari")
                raise FileNotFoundError(f"Chrome not found at {chrome_path}")
            
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=chrome_options)
            return driver
        except Exception as e:
            print(f"Error setting up Chrome WebDriver: {str(e)}")
            print("Please install Chrome or use Safari by specifying --browser safari")
            raise

def extract_scholar_id_from_text(text):
    """
    Extract Google Scholar ID from text
    
    Args:
        text (str): Text that might contain a Google Scholar ID
        
    Returns:
        str: Google Scholar ID if found, None otherwise
    """
    if not text:
        return None
        
    # Look for patterns like "user=XXXXX" in the text
    match = re.search(r'user=([^&\s]+)', text)
    if match:
        return match.group(1)
        
    # Look for patterns like "citations?user=XXXXX" in the text
    match = re.search(r'citations\?user=([^&\s]+)', text)
    if match:
        return match.group(1)
        
    # Look for patterns like "scholar.google.com/citations?user=XXXXX" in the text
    match = re.search(r'scholar\.google\.com/citations\?user=([^&\s]+)', text)
    if match:
        return match.group(1)
        
    return None

def extract_google_scholar_id(href):
    """Extract Google Scholar ID from href URL"""
    if not href:
        return None
    match = re.search(r'user=([^&]+)', href)
    return match.group(1) if match else None

def is_conference_row(name, url, institution):
    """
    Check if the row is a conference-related entry
    
    Args:
        name (str): Name of the entry
        url (str): URL of the entry
        institution (str): Institution of the entry
        
    Returns:
        bool: True if the row is a conference-related entry, False otherwise
    """
    # Common conference-related keywords
    conference_keywords = {
        'sigai', 'sigkdd', 'sigir', 'sigmod', 'sigarch', 'sigcomm', 
        'sigsac', 'sigda', 'sigbed', 'sighpc', 'sigmobile', 'sigops',
        'sigplan', 'iacr', 'siglog', 'siggraph', 'sigcse', 'sigecom',
        'sigchi', 'ieee', 'dblp', 'cvpr', 'eccv', 'iccv'
    }
    
    # Conference domains
    conference_domains = {
        'cv-foundation.org', 'acm.org', 'ieee.org', 'dblp.org',
        'aaai.org', 'ijcai.org', 'kdd.org', 'aclweb.org'
    }
    
    # Check if the name is all uppercase (common for conference names)
    if name.upper() == name and len(name) > 3:
        return True
    
    # Check for conference domains in the URL
    if url:
        for domain in conference_domains:
            if domain in url.lower():
                return True
    
    # Check for common conference names
    conference_names = {'cvpr', 'eccv', 'iccv', 'nips', 'neurips', 'icml', 'aaai', 'ijcai',
                       'kdd', 'acl', 'emnlp', 'naacl', 'sigir', 'www', 'wsdm', 'cikm',
                       'sigmod', 'vldb', 'icde', 'fse', 'icse', 'ase', 'issta', 'focs'}
    
    if name.lower() in conference_names:
        return True
    
    return False

def extract_institution_from_html(soup, researcher_name):
    """
    Extract actual institution information from HTML by finding the researcher in the university listings
    
    Args:
        soup (BeautifulSoup): Parsed HTML
        researcher_name (str): Name of the researcher
        
    Returns:
        str: Institution name if found, None otherwise
    """
    try:
        # Find all university divs that contain faculty listings
        university_divs = soup.select("div[id$='-faculty']")
        
        for div in university_divs:
            # Extract the university name from the div id
            university_id = div.get('id', '')
            if university_id and university_id.endswith('-faculty'):
                university_name = university_id[:-8]  # Remove '-faculty' suffix
                university_name = university_name.replace('%20', ' ')  # Replace URL encoding
                
                # Look for the researcher in this university's faculty list
                researcher_link = div.find("a", text=lambda text: text and researcher_name in text)
                if researcher_link:
                    return university_name
        
        return None
    except Exception as e:
        print(f"Error extracting institution for researcher {researcher_name}: {str(e)}")
        return None

def scrape_csrankings(area=None, country=None, output_file="csrankings_data.json", browser="safari", max_researchers=None):
    """
    Scrape researcher information from CSRankings website
    
    Args:
        area (str): Research area to filter by (e.g., 'AI', 'Systems', 'Theory')
        country (str): Country to filter by (e.g., 'USA', 'China')
        output_file (str): Output JSON file path
        browser (str): Browser to use ('chrome' or 'safari')
        max_researchers (int, optional): Maximum number of researchers to extract (for testing)
    """
    print("Initializing web driver...")
    driver = setup_driver(browser=browser)
    
    try:
        # Navigate to CSRankings
        print("Navigating to CSRankings...")
        driver.get("https://csrankings.org/#/index?all")
        
        # Wait for the page to load and table to be populated
        print("Waiting for page to load...")
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "table.table-sm"))
        )
        
        # Additional wait for table rows to be populated
        print("Waiting for table data to load...")
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "table.table-sm tbody tr td"))
        )
        
        # Small delay to ensure JavaScript rendering is complete
        time.sleep(5)
        
        # If area is specified, click on the area
        if area:
            print(f"Filtering by area: {area}")
            try:
                area_element = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, f"//div[contains(text(), '{area}')]"))
                )
                area_element.click()
                time.sleep(2)  # Wait for the filter to apply
            except Exception as e:
                print(f"Could not filter by area {area}: {str(e)}")
        
        # If country is specified, click on the country
        if country:
            print(f"Filtering by country: {country}")
            try:
                country_element = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, f"//div[contains(text(), '{country}')]"))
                )
                country_element.click()
                time.sleep(2)  # Wait for the filter to apply
            except Exception as e:
                print(f"Could not filter by country {country}: {str(e)}")
        
        # Get the page source after JavaScript has rendered
        print("Extracting data from the page...")
        page_source = driver.page_source
        
        # Save the HTML content to a file for inspection
        html_file = "data/csrankings_page.html"
        os.makedirs(os.path.dirname(html_file), exist_ok=True)
        with open(html_file, "w", encoding="utf-8") as f:
            f.write(page_source)
        print(f"Saved HTML content to {html_file}")
        
        # Parse with BeautifulSoup
        soup = BeautifulSoup(page_source, 'html.parser')
        
        # Create a mapping of researcher names to their institutions
        print("Building researcher-institution mapping...")
        researcher_institutions = {}
        university_divs = soup.select("div[id$='-faculty']")
        
        for div in university_divs:
            # Extract the university name from the div id
            university_id = div.get('id', '')
            if university_id and university_id.endswith('-faculty'):
                university_name = university_id[:-8]  # Remove '-faculty' suffix
                university_name = university_name.replace('%20', ' ')  # Replace URL encoding
                
                # Find all researcher links in this university
                researcher_links = div.select("a[title*='Click for author']")
                for link in researcher_links:
                    name = link.text.strip()
                    if name:
                        researcher_institutions[name] = university_name
        
        print(f"Found {len(researcher_institutions)} researchers with institution mapping")
        
        # Extract researcher data
        researchers = []
        
        # Direct approach to find researcher entries
        print("Extracting researchers directly from name mapping...")
        
        # Use the researcher institution mapping to extract researchers directly
        processed_count = 0
        
        # Get all researcher links in the table for Google Scholar IDs
        scholar_links = {}
        profile_links = {}
        area_mappings = {}
        
        # Find all researcher links and scholar links in the page
        print("Gathering researcher links and scholar information...")
        for row in soup.select("table.table-sm tr"):
            # Look for name and Google Scholar info
            name_link = row.select_one("td:nth-child(1) a")
            if name_link and name_link.get('title') and 'Click for author' in name_link.get('title'):
                name = name_link.text.strip()
                profile_url = name_link.get('href', '').lower()
                
                # Skip if this is a conference row
                if is_conference_row(name, profile_url, ""):
                    continue
                
                profile_links[name] = profile_url
                
                # Look for Google Scholar link
                scholar_link = row.select_one("a[title*='Google Scholar']")
                if scholar_link:
                    href = scholar_link.get('href', '')
                    scholar_id = extract_google_scholar_id(href)
                    if scholar_id:
                        scholar_links[name] = scholar_id
                
                # Try to extract areas
                area_cells = row.select("td:nth-child(3) span.hovertip")
                if area_cells:
                    areas = [area.text.strip() for area in area_cells if area.text.strip()]
                    area_mappings[name] = areas
        
        print(f"Found {len(profile_links)} researcher profiles and {len(scholar_links)} Google Scholar IDs")
        
        # Create researcher entries from the institution mapping
        for name, institution in researcher_institutions.items():
            # Skip if we've reached the max researchers limit
            if max_researchers is not None and processed_count >= max_researchers:
                print(f"Reached maximum researchers limit ({max_researchers})")
                break
                
            try:
                # Skip if this researcher doesn't have a profile link
                if name not in profile_links:
                    continue
                
                profile_url = profile_links[name]
                scholar_id = scholar_links.get(name)
                areas = area_mappings.get(name, [])
                
                researcher = {
                    'name': name,
                    'institution': institution,
                    'areas': areas,
                    'profile_url': profile_url,
                    'google_scholar_id': scholar_id
                }
                
                researchers.append(researcher)
                processed_count += 1
                print(f"Added researcher #{processed_count}: {name} from {institution}")
                
            except Exception as e:
                print(f"Error extracting data for {name}: {str(e)}")
        
        print(f"Successfully extracted {len(researchers)} researchers")
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        # Save to JSON
        with open(output_file, 'w') as f:
            json.dump(researchers, f, indent=2)
        
        print(f"Data saved to {output_file}")
        
        # Also save as CSV for easier viewing
        csv_file = output_file.replace('.json', '.csv')
        df = pd.DataFrame(researchers)
        df.to_csv(csv_file, index=False)
        print(f"Data also saved to {csv_file}")
        
        return researchers
        
    except Exception as e:
        print(f"Error during scraping: {str(e)}")
        return []
        
    finally:
        print("Closing web driver...")
        driver.quit()

def main():
    parser = argparse.ArgumentParser(description='Scrape researcher information from CSRankings')
    parser.add_argument('--area', help='Research area to filter by (e.g., AI, Systems, Theory)')
    parser.add_argument('--country', help='Country to filter by (e.g., USA, China)')
    parser.add_argument('--output', default='data/csrankings_data.json', help='Output JSON file (default: data/csrankings_data.json)')
    parser.add_argument('--browser', choices=['chrome', 'safari'], default='safari', help='Browser to use (default: safari)')
    parser.add_argument('--max-researchers', type=int, help='Maximum number of researchers to extract (for testing)')
    
    args = parser.parse_args()
    
    scrape_csrankings(
        area=args.area, 
        country=args.country, 
        output_file=args.output, 
        browser=args.browser,
        max_researchers=args.max_researchers
    )

if __name__ == "__main__":
    main() 