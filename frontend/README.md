# ScholarMap Frontend

ScholarMap is a visualization tool for exploring academic collaboration networks. It allows researchers to explore connections between authors and institutions.

## Features

### Author Network Visualization
- Interactive graph of author connections based on co-authorship
- Authors are grouped by communities using graph analysis
- Node sizes are proportional to number of collaborations
- Click on authors to explore their direct connections

### Institution Network Visualization
- Interactive graph of institution connections based on co-authorship relationships
- Institutions are nodes, connected when authors from different institutions have collaborated
- Node sizes reflect the number of authors affiliated with each institution
- Color coding based on detected institutional communities
- Filter connections by collaboration strength

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/scholarmap.git
cd scholarmap/frontend
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Run scrapers
```bash
python backend/scrapers/scraping_pipeline.py
``` 

4. Generate graph data (requires coauthor data in backend/data/coauthors)
```bash
node scripts/generate-graph-data.js
```

5. Start the development server
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Data Format

The visualization expects data in the following formats:
- GEXF files for graph structure (generated from JSON data)
- JSON files with the same structure as a backup
- Both are generated automatically by the `generate-graph-data.js` script

## Development

### Scripts
- `npm run dev` - Start development server
- `npm run build` - Build production version
- `npm run start` - Start production server
- `node scripts/generate-graph-data.js` - Generate graph data for visualizations

## License

This project is licensed under the MIT License

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
