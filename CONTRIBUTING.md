# Contributing

Bugs and pull requests are welcome.

The frontend already has a graph in `frontend/public/data/`. Use that for UI work:

```bash
cd frontend
npm install
npm run dev
```

## Scraper changes

Run a short pull before opening a pull request:

```bash
python scrapers/csrankings_scraper.py --browser chrome --output data/csrankings_data.json --max-researchers 5
python scrapers/scraping_pipeline.py --input data/csrankings_data.json --output-dir data/coauthors --max 5
```

Run those from `backend/`. If Google Scholar shows a CAPTCHA, stop.

## What not to commit

- `backend/data/`, `node_modules/`, `.venv/`, `frontend/.next/`
- `.DS_Store`
- cookies or a logged-in browser profile

## Pull requests

1. Say whether you changed the Next.js app, a scraper, or a visualization script.
2. For a selector or layout change, name the screen you clicked through.
3. This project is [MIT](LICENSE). Your contribution is licensed the same way.
