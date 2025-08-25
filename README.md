# PlexUtils

A comprehensive set of utilities for managing and auditing your Plex Media Server library. These tools help you maintain media quality, detect inconsistencies, and keep your library up to date.

## Features

- **TV Library Management**: Display TV shows with detailed episode information
- **Movie Library Management**: Display movies with comprehensive media details  
- **Quality Auditing**: Detect resolution inconsistencies and filename pattern issues
- **New Season Detection**: Check for new seasons available on TMDB
- **Batch Operations**: Run multiple audits simultaneously

## Prerequisites

- Node.js (ES modules support)
- A running Plex Media Server
- TMDB API token (for new season detection)

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure:

   ```
   TVDB_API_TOKEN=your_tmdb_api_token_here
   # Add your Plex server configuration
   ```

## Available Scripts

### Library Display Scripts

#### `npm run tv-library`

Displays your TV library with detailed information including:

- Season and episode counts
- Resolution, bitrate, and file size for first 3 episodes per season
- Container format, video/audio codecs
- File paths and names

#### `npm run movie-library`  

Displays your movie library with detailed information including:

- Release date and runtime
- Resolution, bitrate, and file size
- Container format, video/audio codecs
- File paths and names

### Audit Scripts

#### `npm run audit-tv-episodes`

Audits TV shows for episode inconsistencies within seasons:

- **Resolution inconsistencies**: Episodes with different resolutions than the season majority
- **Filename pattern inconsistencies**: Episodes not following common naming conventions
- Shows expected vs actual values for easy identification
- Provides file paths for quick navigation to problematic files

#### `npm run audit-movie-quality`

Audits movies released in the last 15 years for quality issues:

- Flags movies not in 1080p or 4K resolution
- Shows current resolution vs expected quality standards
- Provides file paths and TMDB links
- Helps prioritize which movies need quality upgrades

#### `npm run audit-all`

Runs all audit scripts sequentially:

- Executes TV episode consistency audit
- Executes movie quality audit  
- Provides comprehensive summary of all findings
- Shows total execution time and success/failure counts

### New Content Detection

#### `npm run check-new-seasons`

Checks for new TV show seasons using TMDB:

- Compares your Plex library against TMDB's latest season data
- Intelligent show matching with year-based filtering
- Handles show title variations and year appendages automatically
- Excludes ended/canceled shows from new season checks
- Provides TMDB links for easy research
- Rate-limited API calls with exponential backoff retry logic

## Contributing

Feel free to submit issues and pull requests to improve these utilities.

## License

ISC
