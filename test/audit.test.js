"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeProfile, toMarkdown, hasOsiLicense, summarizeRepos } = require("../public/audit-core");

test("detects OSI licenses from GitHub license keys", () => {
  assert.equal(hasOsiLicense({ license: { key: "mit" } }), true);
  assert.equal(hasOsiLicense({ license: { key: "apache-2.0" } }), true);
  assert.equal(hasOsiLicense({ license: { key: "other" } }), false);
  assert.equal(hasOsiLicense({}), false);
});

test("summarizes owned public repositories", () => {
  const summary = summarizeRepos(
    [
      {
        private: false,
        fork: false,
        size: 10,
        stargazers_count: 4,
        forks_count: 1,
        pushed_at: "2026-07-01T00:00:00Z",
        license: { key: "mit" },
        language: "JavaScript"
      },
      {
        private: false,
        fork: true,
        size: 99,
        stargazers_count: 20,
        forks_count: 5,
        pushed_at: "2026-07-01T00:00:00Z",
        license: { key: "mit" }
      }
    ],
    "2026-07-17T00:00:00Z"
  );

  assert.equal(summary.total, 2);
  assert.equal(summary.public, 2);
  assert.equal(summary.ownedPublic, 1);
  assert.equal(summary.nonEmpty, 1);
  assert.equal(summary.licensed, 1);
  assert.equal(summary.recent, 1);
  assert.equal(summary.stars, 4);
});

test("marks an empty young profile as too early", () => {
  const audit = analyzeProfile(
    {
      profile: {
        login: "new-dev",
        created_at: "2026-01-01T00:00:00Z"
      },
      repos: []
    },
    { now: "2026-07-17T00:00:00Z" }
  );

  assert.equal(audit.verdict.level, "early");
  assert.ok(audit.score < 50);
  assert.ok(audit.nextActions.length > 0);
});

test("recognizes a credible maintainer profile", () => {
  const audit = analyzeProfile(
    {
      profile: {
        login: "maintainer",
        name: "OSS Maintainer",
        bio: "Maintains widely used packages.",
        created_at: "2020-01-01T00:00:00Z"
      },
      repos: [
        {
          name: "useful-lib",
          private: false,
          fork: false,
          size: 300,
          stargazers_count: 120,
          forks_count: 44,
          pushed_at: "2026-07-10T00:00:00Z",
          license: { key: "apache-2.0" },
          language: "TypeScript"
        }
      ],
      metrics: {
        monthlyDownloads: 220000
      }
    },
    { now: "2026-07-17T00:00:00Z" }
  );

  assert.equal(audit.verdict.level, "strong");
  assert.ok(audit.score >= 80);
});

test("exports an audit report to markdown", () => {
  const audit = analyzeProfile(
    {
      profile: {
        login: "maintainer",
        name: "OSS Maintainer",
        bio: "Maintains widely used packages.",
        created_at: "2020-01-01T00:00:00Z"
      },
      repos: []
    },
    { now: "2026-07-17T00:00:00Z" }
  );

  const markdown = toMarkdown(audit);

  assert.match(markdown, /^# Audit de signal open source — maintainer/);
  assert.match(markdown, new RegExp("Score: " + audit.score + "/100"));
  assert.match(markdown, /## Checklist/);
  assert.match(markdown, /## Seuils forts/);
  assert.match(markdown, /## Prochaines actions/);
});
