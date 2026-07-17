# OSS Signal Auditor

![Tests](https://github.com/Franckywilli/oss-signal-auditor/actions/workflows/test.yml/badge.svg)

OSS Signal Auditor is a small, dependency-free tool that audits a GitHub profile and turns open source readiness gaps into concrete next actions.

It is designed for developers who want a clearer public GitHub portfolio before applying to open source maintainer programs.

## Features

- Browser app that reads public GitHub profile and repository data
- Optional manual metrics for dependent repositories, downloads, external contributors, and OpenSSF criticality
- CLI for quick terminal audits
- Shared scoring engine with Node tests
- No build step and no package dependencies

## Quick Start

Open `public/index.html` directly in a browser, or run the local server:

```bash
npm start
```

Then open:

```text
http://localhost:4173
```

Run a CLI audit:

```bash
npm run audit -- Franckywilli
```

Run checks:

```bash
npm run check
```

## Exporting a Report

The browser app has an "Exporter en Markdown" button on the results screen that downloads the current audit as a `.md` file.

The CLI can print the same report to the terminal:

```bash
npm run audit -- Franckywilli --markdown
```

Redirect it to a file to save it:

```bash
npm run audit -- Franckywilli --markdown > audit-report.md
```

JSON output is also available with `--json`.

## GitHub API Limits

The browser app can work without a token, but GitHub limits anonymous API calls. Add a fine-grained personal access token in the optional token field if you hit rate limits. The token is only used in your browser for requests to GitHub.

For the CLI, set:

```bash
set GITHUB_TOKEN=github_pat_your_token
npm run audit -- Franckywilli
```

On macOS or Linux:

```bash
export GITHUB_TOKEN=github_pat_your_token
npm run audit -- Franckywilli
```

Repository and profile data only cover the first 100 owned repositories returned by the GitHub API (sorted by most recently updated). Profiles with more than 100 public repositories will see the rest omitted from the summary.

## Scoring Model

The score is not an official eligibility decision. It checks visible readiness signals:

- GitHub account age
- recent public activity
- public non-empty repositories
- OSI-approved license presence
- profile readability
- maintainer-level open source signals

The strongest program signals currently tracked are:

- 500 dependent repositories
- 100 dependent packages
- 200,000 monthly package downloads
- 100 merged external pull requests in the last 12 months
- 20 external contributors in the last 12 months
- OpenSSF criticality score of 0.4 or higher

## Project Structure

```text
public/
  index.html       Browser UI
  styles.css       Interface styles
  app.js           GitHub API client and rendering
  audit-core.js    Shared scoring engine
src/
  cli.js           Terminal audit command
scripts/
  serve.js         Small static server
test/
  audit.test.js    Node test suite
.github/workflows/
  test.yml         CI: runs npm run check on push and pull requests
```

## Roadmap

- Add repository README detection
- Add package registry lookups for npm and PyPI downloads
- Paginate repository lookups past 100 owned repos
- Add French and English UI toggle

## License

MIT
