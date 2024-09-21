# PlexMaintenance

## Scripts

So far there are three scripts that help me manage my Plex libraries:

1. Auditing Duplicate Files
1. Auditing File Bitrates
1. Auditing New Seasons
1. Auditing Everything

### Auditing Duplicate Files

This script is fairly simple - occasionally I end up with duplicate files in my library, and it's to not notice this. This script goes through each library, and checks if any piece of media has multiple underlying files.

### Auditing File Bitrates

This script will go through all of the content on the server and flag anything that doesn't meet a threshold set inside the script. This helps upgrade my library from time to time by finding files in poor quality.

### Auditing New Seasons

This script helps to notify me when tv shows I have copies of have released new seasons. This becomes quite a cumbersome exercise to do manually, but this script cuts down the time spent significantly.

### Auditing Everything

Runs all of the scripts above one after the other :)

## Running

To setup the repo, do the following:

1. Pull the repo
    1. `git clone https://github.com/RyanMKrol/PlexMaintenance`
1. Head to the repo
    1. `cd PlexMaintenance`
1. Install dependencies
    1. `npm install`
1. Pull credentials
    1. `npx dotenv-vault@latest pull`
1. Run a script
    1. `npm run script:auditAll`
    1. `npm run script:auditDuplicateFiles`
    1. `npm run script:auditFileBitrates`
    1. `npm run script:auditNewSeasons`
