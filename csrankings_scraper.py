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
        
        # Direct approach: Find all rows in the main tbody that contains the ranking table
        # This is usually the tbody with the most rows
        print("Locating researcher table...")
        
        # Get all tbody elements
        tbodies = soup.select("table.table-sm tbody")
        
        # Find the tbody with the most rows (likely the main ranking table)
        main_tbody = None
        max_rows = 0
        for i, tbody in enumerate(tbodies):
            rows = tbody.select("tr")
            print(f"  tbody #{i+1} has {len(rows)} rows")
            if len(rows) > max_rows:
                max_rows = len(rows)
                main_tbody = tbody
        
        if main_tbody:
            print(f"Found main tbody with {max_rows} rows")
            
            # Get all rows in the main tbody
            researcher_rows = main_tbody.select("tr")
            
            # Optional limit for testing
            if max_researchers:
                researcher_rows = researcher_rows[:max_researchers]
                print(f"Limiting to {max_researchers} researchers for testing")
            
            # Process each row
            for row in researcher_rows:
                try:
                    # Get all cells in the row
                    cells = row.select("td")
                    
                    # Skip rows that don't have enough cells
                    if len(cells) < 3:  # We need at least name, institution, and areas
                        continue
                    
                    # Extract researcher information
                    name_cell = cells[0]
                    institution_cell = cells[1]
                    
                    name_element = name_cell.select_one("a")
                    
                    # Skip non-researcher entries
                    if not name_element:
                        continue
                    
                    name = name_element.text.strip()
                    profile_url = name_element.get('href', '').lower()
                    institution = institution_cell.text.strip()
                    
                    # Remove any newlines and extra whitespace
                    institution = ' '.join(institution.split())
                    
                    # Skip if this is a conference row
                    if is_conference_row(name, profile_url, institution):
                        print(f"Skipping conference-related entry: {name}")
                        continue
                    
                    # Look for Google Scholar link in the row
                    scholar_link = row.select_one("a[title*='Google Scholar']")
                    scholar_id = None
                    
                    if scholar_link:
                        href = scholar_link.get('href', '')
                        scholar_id = extract_google_scholar_id(href)
                    
                    # Extract research areas
                    area_elements = cells[2].select("span.hovertip")
                    areas = [area.text.strip() for area in area_elements if area.text.strip()]
                    
                    # If the institution is just "Faculty", look up in our mapping
                    if institution.lower() == "faculty":
                        if name in researcher_institutions:
                            institution = researcher_institutions[name]
                        else:
                            # Fallback: try to find by processing the div structure
                            actual_institution = extract_institution_from_html(soup, name)
                            if actual_institution:
                                institution = actual_institution
                    
                    researcher = {
                        'name': name,
                        'institution': institution,
                        'areas': areas,
                        'profile_url': profile_url,
                        'google_scholar_id': scholar_id
                    }
                    
                    researchers.append(researcher)
                    print(f"Added researcher: {name} from {institution}")
                    
                except Exception as e:
                    print(f"Error extracting researcher data: {str(e)}")
        else:
            print("ERROR: Could not find main researcher table")
            
        print(f"Successfully extracted {len(researchers)} researchers")
        
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