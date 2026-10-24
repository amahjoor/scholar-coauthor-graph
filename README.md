# Scholar coauthor graph

An interactive graph of computer science coauthors, plus a second view of the same collaborations grouped by institution. The site is Next.js and sigma.js. It loads a graph that already ships in this repo: 8,118 authors, 10,167 coauthor edges, and 612 institutions.

Python scrapers can rebuild that graph from [CSRankings](https://csrankings.org/) and public Google Scholar profiles. Google Scholar rate-limits requests. The pipeline waits between 2 and 5 seconds. A CAPTCHA or a block means stop and try later. Do not commit scraped output. `backend/data/` is gitignored.

## Quick start

Node.js 18.18 or newer.

```bash
git clone https://github.com/amahjoor/scholar-coauthor-graph.git
cd scholar-coauthor-graph/frontend
npm install
npm run dev
```

Open http://localhost:3000. Author Network is the default. Institution Network is the other button. Click an author to keep only their connections, and click that author again, or empty space, to reset.

`npm run dev` does not need the scrapers. The files it reads are `frontend/public/data/graph-data.gexf` and `frontend/public/data/institution-graph-data.gexf`.

## Rebuild the graph

Python packages are in the root `requirements.txt`: requests, beautifulsoup4, lxml, scholarly, selenium, webdriver-manager, pandas, tqdm, networkx, matplotlib, python-louvain, scipy, and plotly.

```bash
python -m venv .venv
```

Windows: `.venv\Scripts\activate`. macOS and Linux: `source .venv/bin/activate`. Then:

```bash
pip install -r requirements.txt
cd backend
python scrapers/csrankings_scraper.py --browser chrome --output data/csrankings_data.json --max-researchers 20
python scrapers/scraping_pipeline.py --input data/csrankings_data.json --output-dir data/coauthors --max 20
cd ../frontend
node scripts/generate-graph-data.js
npm run dev
```

`--browser` defaults to Safari. Safari needs Develop > Allow Remote Automation. Use `--browser chrome` everywhere else. `--area` and `--country` filter CSRankings, for example `--area AI --country USA`.

`generate-graph-data.js` reads `backend/data/coauthors/*_coauthors.json`, which is why the commands above run from `backend/`.

One profile, without CSRankings:

```bash
cd backend/scrapers
python scholar_scraper.py --id EmD_lTEAAAAJ --output ../data/einstein_coauthors.json
```

`direct_scraper.py --id` is the BeautifulSoup fallback when the `scholarly` package fails. It also takes `--id` and `--output`.

## Static plots

From `backend/`, after `data/coauthors/` exists:

```bash
python visualizations/visualize_coauthor_network.py --input data/coauthors --output-dir data/network_viz
python visualizations/interactive_coauthor_viz.py --input data/coauthors --output data/network_viz/interactive_network.html
python visualizations/institution_network_viz.py --input data/coauthors --output data/network_viz/institution_network.html
```

`visualize_coauthor_network.py` accepts `--layout spring`, `kamada_kawai`, or `circular`, and `--viz-max-nodes` (default 500). The institution plot accepts `--min-authors` (default 2) and `--normalize`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). UI changes can use the graph already in `frontend/public/data/`.

## License

[MIT](LICENSE)
