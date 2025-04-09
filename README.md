# ScholarMap - Academic Research Tools

ScholarMap is a project for scraping and visualizing academic collaboration networks from Google Scholar data. The project includes tools for scraping researcher information from CS Rankings and Google Scholar, as well as creating various visualizations of the resulting coauthor networks.

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

## Components

### Scrapers

- **csrankings_scraper.py**: Scrapes researcher information from [CSRankings](https://csrankings.org/)
- **scholar_scraper.py**: Scrapes coauthor information from Google Scholar
- **scraping_pipeline.py**: Connects the two scrapers to create a comprehensive dataset

### Visualization Tools

- **visualizations/visualize_coauthor_network.py**: Creates static network visualizations with various layouts
- **visualizations/interactive_coauthor_viz.py**: Creates an interactive HTML visualization of the coauthor network
- **visualizations/institution_network_viz.py**: Creates an interactive visualization of institution collaborations

### Utility Scripts

- **visualizations/create_visualizations.sh**: A shell script to generate all visualization types with a single command

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

## Creating Visualizations

To create all visualization types at once:

```bash
./visualizations/create_visualizations.sh [output_dir] [max_nodes]
```

Or create specific visualizations:

1. Static network visualization:

```bash
python visualizations/visualize_coauthor_network.py --input data/coauthors --output-dir data/network_viz/static
```

2. Interactive coauthor network:

```bash
python visualizations/interactive_coauthor_viz.py --input data/coauthors --output data/network_viz/interactive_network.html
```

3. Institution network:

```bash
python visualizations/institution_network_viz.py --input data/coauthors --output data/network_viz/institution_network.html
```

## Visualization Options

Each visualization script supports various options:

- `--min-weight`: Minimum number of connections for an edge to be included
- `--max-nodes`: Maximum number of nodes to include in the graph
- `--viz-max-nodes`: Maximum number of nodes to show in the visualization
- `--layout`: Layout algorithm to use (spring, kamada_kawai, circular) for static visualizations

For the institution network visualization:
- `--min-authors`: Minimum number of authors for an institution to be included
- `--normalize`: Normalize edge weights by institution size

## Output

The scripts generate JSON and CSV files containing researcher information with these details:
- Name
- Institution
- Research Areas
- Profile URL
- Google Scholar ID (when available)
- Coauthors (when available)

### Data Files

- `data/csrankings_data.json`: Researcher data from CSRankings
- `data/coauthors/`: Directory containing individual coauthor JSON files
- `data/network_viz/`: Directory containing network visualizations

## Notes

- Google Scholar has rate limiting, so making too many requests might trigger CAPTCHA challenges
- The scholarly library helps manage this, but if you need to extract data for many authors, consider adding delays
- If you repeatedly get errors, Google may have temporarily blocked your IP
- For the CSRankings scraper, you need either Safari (with developer options enabled) or Chrome installed
- The institution network visualization attempts to identify institutions from coauthors' affiliations 