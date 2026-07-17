#!/usr/bin/env node
"use strict";

const { analyzeProfile, toMarkdown } = require("../public/audit-core");

const args = process.argv.slice(2);
const username = args.find((arg) => !arg.startsWith("--"));
const outputJson = args.includes("--json");
const outputMarkdown = args.includes("--markdown") || args.includes("--md");
const help = args.includes("--help") || args.includes("-h");
const tokenArg = args.find((arg) => arg.startsWith("--token="));
const token = tokenArg ? tokenArg.slice("--token=".length) : process.env.GITHUB_TOKEN;

const usage = "Usage: node src/cli.js <github-username> [--json] [--markdown] [--token=github_pat]";

if (help) {
  console.log(usage);
  process.exit(0);
}

if (!username) {
  console.error(usage);
  process.exit(1);
}

function headers() {
  const base = { Accept: "application/vnd.github+json" };
  if (token) base.Authorization = `Bearer ${token}`;
  return base;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: headers() });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status}: ${body.slice(0, 160)}`);
  }
  return response.json();
}

function oneYearAgoIso() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().slice(0, 10);
}

async function fetchMergedExternalPrs(login) {
  const query = [
    `author:${login}`,
    "type:pr",
    "is:merged",
    `created:>=${oneYearAgoIso()}`,
    `-user:${login}`
  ].join(" ");
  try {
    const data = await fetchJson(
      `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=1`
    );
    return Number(data.total_count || 0);
  } catch (_error) {
    return 0;
  }
}

async function main() {
  const login = username.replace(/^@/, "");
  const profile = await fetchJson(`https://api.github.com/users/${encodeURIComponent(login)}`);
  const repos = await fetchJson(
    `https://api.github.com/users/${encodeURIComponent(login)}/repos?per_page=100&sort=updated&type=owner`
  );
  const mergedExternalPrsLast12Months = await fetchMergedExternalPrs(login);
  const audit = analyzeProfile({
    profile,
    repos,
    metrics: {
      mergedExternalPrsLast12Months
    }
  });

  if (outputJson) {
    console.log(JSON.stringify(audit, null, 2));
    return;
  }

  if (outputMarkdown) {
    console.log(toMarkdown(audit));
    return;
  }

  console.log(`${profile.login}: ${audit.score}/100 - ${audit.verdict.title}`);
  console.log(audit.verdict.body);
  console.log("");
  console.log("Top actions:");
  audit.nextActions.forEach((action, index) => {
    console.log(`${index + 1}. ${action}`);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
