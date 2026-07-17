(function (global) {
  "use strict";

  var OSI_LICENSES = {
    "apache-2.0": "Apache-2.0",
    "bsd-2-clause": "BSD-2-Clause",
    "bsd-3-clause": "BSD-3-Clause",
    gpl: "GPL",
    "gpl-2.0": "GPL-2.0",
    "gpl-3.0": "GPL-3.0",
    isc: "ISC",
    lgpl: "LGPL",
    "lgpl-2.1": "LGPL-2.1",
    "lgpl-3.0": "LGPL-3.0",
    mit: "MIT",
    "mpl-2.0": "MPL-2.0",
    unlicense: "Unlicense"
  };

  var THRESHOLDS = {
    accountAgeYears: 2,
    recentActivityDays: 90,
    dependentRepositories: 500,
    dependentPackages: 100,
    monthlyDownloads: 200000,
    mergedExternalPrsLast12Months: 100,
    externalContributorsLast12Months: 20,
    openSsfCriticality: 0.4
  };

  function daysBetween(fromDate, toDate) {
    var from = new Date(fromDate);
    var to = toDate ? new Date(toDate) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
    return Math.floor((to.getTime() - from.getTime()) / 86400000);
  }

  function yearsBetween(fromDate, toDate) {
    var days = daysBetween(fromDate, toDate);
    if (days === null) return null;
    return days / 365.25;
  }

  function hasOsiLicense(repo) {
    if (!repo || !repo.license) return false;
    var key = repo.license.key || repo.license.spdx_id || repo.license;
    if (!key) return false;
    key = String(key).toLowerCase();
    return Boolean(OSI_LICENSES[key]);
  }

  function normalizeMetrics(metrics) {
    metrics = metrics || {};
    return {
      dependentRepositories: Number(metrics.dependentRepositories || 0),
      dependentPackages: Number(metrics.dependentPackages || 0),
      monthlyDownloads: Number(metrics.monthlyDownloads || 0),
      mergedExternalPrsLast12Months: Number(metrics.mergedExternalPrsLast12Months || 0),
      externalContributorsLast12Months: Number(metrics.externalContributorsLast12Months || 0),
      openSsfCriticality: Number(metrics.openSsfCriticality || 0)
    };
  }

  function summarizeRepos(repos, now) {
    repos = Array.isArray(repos) ? repos : [];
    var publicRepos = repos.filter(function (repo) {
      return !repo.private;
    });
    var nonForkRepos = publicRepos.filter(function (repo) {
      return !repo.fork;
    });
    var nonEmptyRepos = nonForkRepos.filter(function (repo) {
      return Number(repo.size || 0) > 0;
    });
    var licensedRepos = nonForkRepos.filter(hasOsiLicense);
    var recentRepos = nonForkRepos.filter(function (repo) {
      var date = repo.pushed_at || repo.updated_at || repo.created_at;
      var age = daysBetween(date, now);
      return age !== null && age <= THRESHOLDS.recentActivityDays;
    });
    var stars = nonForkRepos.reduce(function (sum, repo) {
      return sum + Number(repo.stargazers_count || 0);
    }, 0);
    var forks = nonForkRepos.reduce(function (sum, repo) {
      return sum + Number(repo.forks_count || 0);
    }, 0);
    var languages = {};
    nonForkRepos.forEach(function (repo) {
      if (repo.language) languages[repo.language] = (languages[repo.language] || 0) + 1;
    });
    return {
      total: repos.length,
      public: publicRepos.length,
      ownedPublic: nonForkRepos.length,
      nonEmpty: nonEmptyRepos.length,
      licensed: licensedRepos.length,
      recent: recentRepos.length,
      stars: stars,
      forks: forks,
      languages: languages,
      bestRepos: nonForkRepos
        .slice()
        .sort(function (a, b) {
          return Number(b.stargazers_count || 0) - Number(a.stargazers_count || 0);
        })
        .slice(0, 5)
    };
  }

  function pass(label, passed, detail, action, weight) {
    return {
      label: label,
      passed: Boolean(passed),
      detail: detail,
      action: action,
      weight: weight || 1
    };
  }

  function buildChecklist(profile, repoSummary, metrics, now) {
    var accountAge = profile && profile.created_at ? yearsBetween(profile.created_at, now) : null;
    var profileName = profile && (profile.name || profile.login);
    var hasProfileBasics = Boolean(profileName && profile.bio);
    var maintenanceSignals = [
      metrics.dependentRepositories >= THRESHOLDS.dependentRepositories,
      metrics.dependentPackages >= THRESHOLDS.dependentPackages,
      metrics.monthlyDownloads >= THRESHOLDS.monthlyDownloads,
      metrics.mergedExternalPrsLast12Months >= THRESHOLDS.mergedExternalPrsLast12Months,
      metrics.externalContributorsLast12Months >= THRESHOLDS.externalContributorsLast12Months,
      metrics.openSsfCriticality >= THRESHOLDS.openSsfCriticality
    ];
    var hasMaintenanceSignal = maintenanceSignals.some(Boolean);

    return [
      pass(
        "Compte GitHub mature",
        accountAge !== null && accountAge >= THRESHOLDS.accountAgeYears,
        accountAge === null
          ? "Date de creation inconnue."
          : accountAge.toFixed(1) + " ans d'anciennete.",
        "Continuer a construire sur le meme compte pour garder l'historique.",
        2
      ),
      pass(
        "Activite publique recente",
        repoSummary.recent > 0 || metrics.mergedExternalPrsLast12Months > 0,
        repoSummary.recent + " depot(s) public(s) actif(s) sur les " + THRESHOLDS.recentActivityDays + " derniers jours.",
        "Faire des commits ou PR utiles sur un projet public cette semaine.",
        2
      ),
      pass(
        "Projet open source licencie",
        repoSummary.licensed > 0,
        repoSummary.licensed + " depot(s) avec licence OSI detectee.",
        "Ajouter une licence MIT ou Apache-2.0 a au moins un depot public utile.",
        2
      ),
      pass(
        "Depot public non vide",
        repoSummary.nonEmpty > 0,
        repoSummary.nonEmpty + " depot(s) public(s) non vide(s).",
        "Publier un projet avec code, README, licence et instructions de lancement.",
        2
      ),
      pass(
        "Profil lisible",
        hasProfileBasics,
        hasProfileBasics ? "Nom et bio detectes." : "Nom ou bio manquant.",
        "Ajouter une bio courte: role, stack, type de projets, ville ou lien portfolio.",
        1
      ),
      pass(
        "Signal de maintenance OSS",
        hasMaintenanceSignal,
        hasMaintenanceSignal
          ? "Au moins un seuil fort est atteint."
          : "Aucun seuil fort n'est encore atteint.",
        "Contribuer a des depots externes ou maintenir un paquet reellement utilise.",
        4
      )
    ];
  }

  function buildProgramSignals(metrics) {
    return [
      {
        label: "Depots dependants",
        value: metrics.dependentRepositories,
        threshold: THRESHOLDS.dependentRepositories,
        unit: "repos"
      },
      {
        label: "Paquets dependants",
        value: metrics.dependentPackages,
        threshold: THRESHOLDS.dependentPackages,
        unit: "packages"
      },
      {
        label: "Telechargements mensuels",
        value: metrics.monthlyDownloads,
        threshold: THRESHOLDS.monthlyDownloads,
        unit: "downloads"
      },
      {
        label: "PR mergees hors depots perso",
        value: metrics.mergedExternalPrsLast12Months,
        threshold: THRESHOLDS.mergedExternalPrsLast12Months,
        unit: "PR"
      },
      {
        label: "Contributeurs externes",
        value: metrics.externalContributorsLast12Months,
        threshold: THRESHOLDS.externalContributorsLast12Months,
        unit: "contributors"
      },
      {
        label: "OpenSSF criticality",
        value: metrics.openSsfCriticality,
        threshold: THRESHOLDS.openSsfCriticality,
        unit: "score"
      }
    ].map(function (signal) {
      signal.ratio = signal.threshold === 0 ? 0 : Math.min(signal.value / signal.threshold, 1);
      signal.passed = signal.value >= signal.threshold;
      return signal;
    });
  }

  function scoreChecklist(checklist) {
    var max = checklist.reduce(function (sum, item) {
      return sum + item.weight;
    }, 0);
    var got = checklist.reduce(function (sum, item) {
      return sum + (item.passed ? item.weight : 0);
    }, 0);
    return Math.round((got / max) * 100);
  }

  function nextActions(checklist, programSignals) {
    var actions = checklist
      .filter(function (item) {
        return !item.passed;
      })
      .sort(function (a, b) {
        return b.weight - a.weight;
      })
      .map(function (item) {
        return item.action;
      });

    var closestProgramSignal = programSignals
      .slice()
      .filter(function (signal) {
        return !signal.passed && signal.value > 0;
      })
      .sort(function (a, b) {
        return b.ratio - a.ratio;
      })[0];

    if (closestProgramSignal) {
      actions.unshift(
        "Renforcer le signal le plus proche: " +
          closestProgramSignal.label.toLowerCase() +
          " (" +
          closestProgramSignal.value +
          "/" +
          closestProgramSignal.threshold +
          ")."
      );
    }

    return actions.slice(0, 5);
  }

  function verdict(score, checklist, programSignals) {
    var hasProgramThreshold = programSignals.some(function (signal) {
      return signal.passed;
    });
    var basicsPassed = checklist.slice(0, 4).every(function (item) {
      return item.passed;
    });
    if (hasProgramThreshold && basicsPassed) {
      return {
        level: "strong",
        title: "Dossier credible",
        body: "Le profil montre deja un signal open source solide. Il faut maintenant soigner la candidature."
      };
    }
    if (score >= 65) {
      return {
        level: "building",
        title: "Bonne base, pas encore assez forte",
        body: "Le profil commence a raconter quelque chose, mais il manque un signal de maintenance difficile a ignorer."
      };
    }
    return {
      level: "early",
      title: "Trop tot pour candidater",
      body: "Le profil doit d'abord prouver une activite open source visible, utile et recente."
    };
  }

  function toMarkdown(audit) {
    var profile = audit.profile || {};
    var login = profile.login || "profil";
    var lines = [];
    lines.push("# Audit de signal open source — " + login);
    lines.push("");
    lines.push("Score: " + audit.score + "/100 — " + audit.verdict.title);
    lines.push("");
    lines.push(audit.verdict.body);
    lines.push("");
    lines.push("## Checklist");
    audit.checklist.forEach(function (item) {
      lines.push("- [" + (item.passed ? "x" : " ") + "] " + item.label + " — " + item.detail);
    });
    lines.push("");
    lines.push("## Seuils forts");
    audit.programSignals.forEach(function (signal) {
      lines.push(
        "- " + signal.label + ": " + signal.value + "/" + signal.threshold + (signal.passed ? " (atteint)" : "")
      );
    });
    lines.push("");
    lines.push("## Prochaines actions");
    audit.nextActions.forEach(function (action, index) {
      lines.push(index + 1 + ". " + action);
    });
    lines.push("");
    lines.push("_Genere le " + audit.generatedAt + " par OSS Signal Auditor._");
    return lines.join("\n") + "\n";
  }

  function analyzeProfile(input, options) {
    options = options || {};
    input = input || {};
    var profile = input.profile || {};
    var repos = input.repos || [];
    var metrics = normalizeMetrics(input.metrics);
    var now = options.now || new Date();
    var repoSummary = summarizeRepos(repos, now);
    var checklist = buildChecklist(profile, repoSummary, metrics, now);
    var programSignals = buildProgramSignals(metrics);
    var score = scoreChecklist(checklist);
    return {
      profile: profile,
      repoSummary: repoSummary,
      checklist: checklist,
      programSignals: programSignals,
      score: score,
      verdict: verdict(score, checklist, programSignals),
      nextActions: nextActions(checklist, programSignals),
      generatedAt: new Date(now).toISOString()
    };
  }

  var api = {
    OSI_LICENSES: OSI_LICENSES,
    THRESHOLDS: THRESHOLDS,
    analyzeProfile: analyzeProfile,
    toMarkdown: toMarkdown,
    daysBetween: daysBetween,
    yearsBetween: yearsBetween,
    hasOsiLicense: hasOsiLicense,
    summarizeRepos: summarizeRepos
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.OssAudit = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
