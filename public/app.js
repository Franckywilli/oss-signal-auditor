(function () {
  "use strict";

  var form = document.querySelector("[data-audit-form]");
  var usernameInput = document.querySelector("[data-username]");
  var tokenInput = document.querySelector("[data-token]");
  var sampleButton = document.querySelector("[data-sample]");
  var statusNode = document.querySelector("[data-status]");
  var resultsNode = document.querySelector("[data-results]");
  var dependentRepositories = document.querySelector("[data-metric='dependentRepositories']");
  var dependentPackages = document.querySelector("[data-metric='dependentPackages']");
  var monthlyDownloads = document.querySelector("[data-metric='monthlyDownloads']");
  var externalContributors = document.querySelector("[data-metric='externalContributorsLast12Months']");
  var openSsfCriticality = document.querySelector("[data-metric='openSsfCriticality']");
  var lastAudit = null;

  var sample = {
    profile: {
      login: "sample-maintainer",
      name: "Sample Maintainer",
      bio: "Maintains developer tools for small open source teams.",
      created_at: "2021-04-10T00:00:00Z",
      html_url: "https://github.com/sample-maintainer"
    },
    repos: [
      {
        name: "release-notes-lab",
        html_url: "https://github.com/sample-maintainer/release-notes-lab",
        description: "Generate readable release notes from merged pull requests.",
        language: "JavaScript",
        private: false,
        fork: false,
        size: 420,
        stargazers_count: 38,
        forks_count: 9,
        pushed_at: new Date().toISOString(),
        license: { key: "mit" }
      },
      {
        name: "tiny-ci-dashboard",
        html_url: "https://github.com/sample-maintainer/tiny-ci-dashboard",
        description: "Small dashboard for GitHub Actions health.",
        language: "TypeScript",
        private: false,
        fork: false,
        size: 200,
        stargazers_count: 12,
        forks_count: 2,
        pushed_at: "2025-02-02T00:00:00Z",
        license: { key: "apache-2.0" }
      }
    ],
    metrics: {
      dependentRepositories: 81,
      dependentPackages: 12,
      monthlyDownloads: 34000,
      mergedExternalPrsLast12Months: 18,
      externalContributorsLast12Months: 4,
      openSsfCriticality: 0.11
    }
  };

  function setStatus(message, tone) {
    statusNode.textContent = message || "";
    statusNode.dataset.tone = tone || "neutral";
  }

  function metricInputs() {
    return {
      dependentRepositories: Number(dependentRepositories.value || 0),
      dependentPackages: Number(dependentPackages.value || 0),
      monthlyDownloads: Number(monthlyDownloads.value || 0),
      externalContributorsLast12Months: Number(externalContributors.value || 0),
      openSsfCriticality: Number(openSsfCriticality.value || 0)
    };
  }

  function githubHeaders() {
    var headers = {
      Accept: "application/vnd.github+json"
    };
    var token = tokenInput.value.trim();
    if (token) headers.Authorization = "Bearer " + token;
    return headers;
  }

  function oneYearAgoIso() {
    var date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    return date.toISOString().slice(0, 10);
  }

  function fetchJson(url) {
    return fetch(url, { headers: githubHeaders() }).then(function (response) {
      if (!response.ok) {
        return response.text().then(function (body) {
          throw new Error("GitHub API " + response.status + ": " + body.slice(0, 140));
        });
      }
      return response.json();
    });
  }

  function fetchAllRepos(username) {
    var encoded = encodeURIComponent(username);
    return fetchJson("https://api.github.com/users/" + encoded + "/repos?per_page=100&sort=updated&type=owner");
  }

  function fetchMergedExternalPrs(username) {
    var query = [
      "author:" + username,
      "type:pr",
      "is:merged",
      "created:>=" + oneYearAgoIso(),
      "-user:" + username
    ].join(" ");
    return fetchJson(
      "https://api.github.com/search/issues?q=" + encodeURIComponent(query) + "&per_page=1"
    )
      .then(function (data) {
        return Number(data.total_count || 0);
      })
      .catch(function () {
        return 0;
      });
  }

  function loadGithubProfile(username) {
    var encoded = encodeURIComponent(username);
    return Promise.all([
      fetchJson("https://api.github.com/users/" + encoded),
      fetchAllRepos(username),
      fetchMergedExternalPrs(username)
    ]).then(function (parts) {
      var metrics = metricInputs();
      metrics.mergedExternalPrsLast12Months = parts[2];
      return {
        profile: parts[0],
        repos: parts[1],
        metrics: metrics
      };
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pct(value) {
    return Math.round(value * 100);
  }

  function renderChecklist(checklist) {
    return checklist
      .map(function (item) {
        return (
          '<li class="check-item ' +
          (item.passed ? "passed" : "failed") +
          '">' +
          '<span class="check-dot">' +
          (item.passed ? "✓" : "!") +
          "</span>" +
          "<div>" +
          "<strong>" +
          escapeHtml(item.label) +
          "</strong>" +
          "<p>" +
          escapeHtml(item.detail) +
          "</p>" +
          "<small>" +
          escapeHtml(item.action) +
          "</small>" +
          "</div>" +
          "</li>"
        );
      })
      .join("");
  }

  function renderSignals(signals) {
    return signals
      .map(function (signal) {
        return (
          '<li class="signal-item">' +
          '<div class="signal-top"><span>' +
          escapeHtml(signal.label) +
          "</span><strong>" +
          escapeHtml(signal.value) +
          "/" +
          escapeHtml(signal.threshold) +
          "</strong></div>" +
          '<div class="bar"><span style="width:' +
          pct(signal.ratio) +
          '%"></span></div>' +
          "</li>"
        );
      })
      .join("");
  }

  function renderRepos(repos) {
    if (!repos.length) {
      return '<p class="empty">Aucun depot public non fork detecte.</p>';
    }
    return repos
      .map(function (repo) {
        return (
          '<a class="repo-row" href="' +
          escapeHtml(repo.html_url || "#") +
          '" target="_blank" rel="noreferrer">' +
          "<span>" +
          escapeHtml(repo.name) +
          "</span>" +
          "<small>" +
          escapeHtml(repo.language || "No language") +
          " · ★ " +
          escapeHtml(repo.stargazers_count || 0) +
          "</small>" +
          "</a>"
        );
      })
      .join("");
  }

  function renderActions(actions) {
    return actions
      .map(function (action) {
        return "<li>" + escapeHtml(action) + "</li>";
      })
      .join("");
  }

  function downloadMarkdown(markdown, filename) {
    var blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function render(data) {
    var audit = window.OssAudit.analyzeProfile(data);
    var profile = audit.profile;
    var url = profile.html_url || ("https://github.com/" + profile.login);
    lastAudit = audit;
    resultsNode.hidden = false;
    resultsNode.innerHTML =
      '<section class="score-card ' +
      audit.verdict.level +
      '">' +
      '<div class="score-ring" style="--score:' +
      audit.score +
      '"><strong>' +
      audit.score +
      "</strong><span>/100</span></div>" +
      "<div>" +
      '<p class="eyebrow">' +
      escapeHtml(profile.login || "profil") +
      "</p>" +
      "<h2>" +
      escapeHtml(audit.verdict.title) +
      "</h2>" +
      "<p>" +
      escapeHtml(audit.verdict.body) +
      "</p>" +
      '<div class="actions">' +
      '<a class="profile-link" href="' +
      escapeHtml(url) +
      '" target="_blank" rel="noreferrer">Ouvrir le profil GitHub</a>' +
      '<button class="button secondary" type="button" data-export-markdown>Exporter en Markdown</button>' +
      "</div>" +
      "</div>" +
      "</section>" +
      '<section class="grid two">' +
      '<div class="panel"><h3>Checklist</h3><ul class="check-list">' +
      renderChecklist(audit.checklist) +
      "</ul></div>" +
      '<div class="panel"><h3>Seuils forts</h3><ul class="signal-list">' +
      renderSignals(audit.programSignals) +
      "</ul></div>" +
      "</section>" +
      '<section class="grid two">' +
      '<div class="panel"><h3>Depots visibles</h3><div class="repo-list">' +
      renderRepos(audit.repoSummary.bestRepos) +
      "</div></div>" +
      '<div class="panel"><h3>Prochaines actions</h3><ol class="action-list">' +
      renderActions(audit.nextActions) +
      "</ol></div>" +
      "</section>";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var username = usernameInput.value.trim().replace(/^@/, "");
    if (!username) {
      setStatus("Entre un nom GitHub.", "warn");
      usernameInput.focus();
      return;
    }
    setStatus("Analyse de " + username + " en cours...", "neutral");
    resultsNode.hidden = true;
    loadGithubProfile(username)
      .then(function (data) {
        render(data);
        setStatus("Analyse terminee.", "ok");
      })
      .catch(function (error) {
        setStatus(error.message, "bad");
      });
  });

  resultsNode.addEventListener("click", function (event) {
    var trigger = event.target.closest("[data-export-markdown]");
    if (!trigger || !lastAudit) return;
    var markdown = window.OssAudit.toMarkdown(lastAudit);
    var login = lastAudit.profile.login || "profil";
    downloadMarkdown(markdown, "oss-signal-audit-" + login + ".md");
  });

  sampleButton.addEventListener("click", function () {
    dependentRepositories.value = sample.metrics.dependentRepositories;
    dependentPackages.value = sample.metrics.dependentPackages;
    monthlyDownloads.value = sample.metrics.monthlyDownloads;
    externalContributors.value = sample.metrics.externalContributorsLast12Months;
    openSsfCriticality.value = sample.metrics.openSsfCriticality;
    render(sample);
    setStatus("Exemple charge.", "ok");
  });
})();
