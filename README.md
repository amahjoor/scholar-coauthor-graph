# ScholarMap - Google Scholar Coauthor Scraper

This tool extracts coauthor information from Google Scholar profile pages.

## Installation

1. Clone this repository
2. Install the required dependencies:
```
pip install -r requirements.txt
```

## Usage

### Primary Scraper (using scholarly library)

You can run the scraper with either an author's name or their Google Scholar ID:

#### Search by name:
```
python scholar_scraper.py --name "Albert Einstein"
```

#### Search by Google Scholar ID:
```
python scholar_scraper.py --id "EmD_lTEAAAAJ"
```

#### Custom output file:
```
python scholar_scraper.py --name "Albert Einstein" --output einstein_coauthors.json
```

### Alternative Direct Scraper

If the scholarly library isn't working, you can use the direct scraper which uses BeautifulSoup:

```
python direct_scraper.py --id "EmD_lTEAAAAJ"
```

```
python direct_scraper.py --id "EmD_lTEAAAAJ" --output einstein_direct.json
```

## Finding a Google Scholar ID

1. Go to a researcher's Google Scholar profile
2. Look at the URL, which will have a format like: `https://scholar.google.com/citations?user=EmD_lTEAAAAJ`
3. The part after `user=` is the ID (in this example, `EmD_lTEAAAAJ`)

## Output

The script generates a JSON file containing coauthor information with these details:
- Name
- Google Scholar ID
- Affiliation (scholarly method only)
- URL (direct scraper method only)

## Notes

- Google Scholar has rate limiting, so making too many requests might trigger CAPTCHA challenges
- The scholarly library helps manage this, but if you need to extract data for many authors, consider adding delays
- If you repeatedly get errors, Google may have temporarily blocked your IP 