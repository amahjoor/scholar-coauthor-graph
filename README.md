# ScholarMap - Academic Research Tools

This repository contains tools for extracting and analyzing academic research data from Google Scholar and CSRankings.

## Set-Up and Installation

1. Clone this repository
2. Set up a virtual environment:
```
python -m venv venv
source venv/bin/activate # on MacOS. Windows, figure it out (forgot and too lazy to add!)
```
3. Install the required dependencies:
```
pip install -r requirements.txt
```

## Google Scholar Coauthor Scraper

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

## CSRankings Scraper

The CSRankings scraper extracts information about computer science researchers from the CSRankings website.

### Basic Usage

```
python csrankings_scraper.py
```

### Filtering Options

#### Filter by research area:
```
python csrankings_scraper.py --area "AI"
```

#### Filter by country:
```
python csrankings_scraper.py --country "USA"
```

#### Custom output file:
```
python csrankings_scraper.py --area "AI" --country "USA" --output ai_us_researchers.json
```

### Google Scholar ID Extraction

The scraper automatically extracts Google Scholar IDs directly from the CSRankings page when available. These IDs are included in the output data.

### Browser Options

The scraper supports both Safari and Chrome browsers. Safari is the default on macOS:

```
python csrankings_scraper.py --browser safari
```

To use Chrome (if installed):
```
python csrankings_scraper.py --browser chrome
```

#### Safari Setup

Before using Safari with the scraper, you need to enable the developer menu and allow remote automation:

1. Open Safari
2. Go to Safari > Preferences > Advanced
3. Check "Show Develop menu in menu bar"
4. Go to the Develop menu and check "Allow Remote Automation"

## Finding a Google Scholar ID

1. Go to a researcher's Google Scholar profile
2. Look at the URL, which will have a format like: `https://scholar.google.com/citations?user=EmD_lTEAAAAJ`
3. The part after `user=` is the ID (in this example, `EmD_lTEAAAAJ`)

## Output

The scripts generate JSON and CSV files containing researcher information with these details:
- Name
- Institution
- Research Areas
- Profile URL
- Google Scholar ID (when available)
- Coauthors (when available)

## Notes

- Google Scholar has rate limiting, so making too many requests might trigger CAPTCHA challenges
- The scholarly library helps manage this, but if you need to extract data for many authors, consider adding delays
- If you repeatedly get errors, Google may have temporarily blocked your IP
- For the CSRankings scraper, you need either Safari (with developer options enabled) or Chrome installed 