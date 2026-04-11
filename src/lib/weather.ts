import type { RawGitHubData } from './github';
import type { ConditionCode, WeatherData, WeekForecast } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function lerp(val: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = clamp((val - inMin) / (inMax - inMin), 0, 1);
  return Math.round(outMin + t * (outMax - outMin));
}

function daysSince(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function conditionFromScore(score: number): { conditionCode: ConditionCode; condition: string } {
  if (score >= 85) return { conditionCode: 'clear',       condition: 'Clear Skies' };
  if (score >= 70) return { conditionCode: 'sunny',       condition: 'Mostly Sunny' };
  if (score >= 55) return { conditionCode: 'partlyCloudy',condition: 'Partly Cloudy' };
  if (score >= 40) return { conditionCode: 'cloudy',      condition: 'Overcast' };
  if (score >= 25) return { conditionCode: 'overcast',    condition: 'Heavy Clouds' };
  if (score >= 10) return { conditionCode: 'stormy',      condition: 'Stormy' };
  return             { conditionCode: 'frozen',       condition: 'Permafrost Warning' };
}

// ── Individual metric mappers ─────────────────────────────────────────────────

/** Commit count last 30 days → °F (32 frozen … 95 hot) */
function calcTemperature(commits: RawGitHubData['commits']): { temp: number; label: string } {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = commits.filter((c) => new Date(c.commit.author.date).getTime() > cutoff).length;
  const temp = lerp(recent, 0, 80, 32, 95);
  let label = 'Frozen';
  if (recent >= 60) label = 'Scorching';
  else if (recent >= 30) label = 'Hot';
  else if (recent >= 15) label = 'Warm';
  else if (recent >= 5)  label = 'Cool';
  else if (recent >= 1)  label = 'Cold';
  return { temp, label };
}

/** Open issues / max(stars,1) → cloud cover % */
function calcCloudCover(openIssues: number, stars: number): number {
  const ratio = openIssues / Math.max(stars, 1);
  return lerp(ratio, 0, 0.2, 5, 95);
}

/** Open PR count → wind speed mph */
function calcWindSpeed(openPRs: number): number {
  return lerp(openPRs, 0, 25, 0, 50);
}

/** Contributor count → UV index 0–10 (more contributors = safer = higher UV) */
function calcUvIndex(contributors: RawGitHubData['contributors']): number {
  const count = Array.isArray(contributors) ? contributors.length : 0;
  return clamp(Math.round(lerp(count, 1, 15, 1, 10)), 1, 10);
}

/** Days since last release → humidity % (older = stickier = higher humidity) */
function calcHumidity(releases: RawGitHubData['releases']): number {
  if (!releases.length) return 90;
  const days = daysSince(releases[0].published_at);
  return lerp(days, 0, 365, 10, 95);
}

/** Documentation signals → visibility 0–10 */
function calcVisibility(repoData: RawGitHubData['repoData']): number {
  let score = 0;
  if (repoData.description)       score += 3;
  if (repoData.has_wiki)          score += 1;
  if (repoData.homepage)          score += 2;
  if (repoData.topics?.length)    score += 2;
  if (repoData.license)           score += 2;
  return clamp(score, 0, 10);
}

// ── 5-week forecast ───────────────────────────────────────────────────────────

function buildForecast(commits: RawGitHubData['commits']): WeekForecast[] {
  const now = Date.now();
  const weeks: WeekForecast[] = [];

  for (let i = 4; i >= 0; i--) {
    const start = now - (i + 1) * 7 * 24 * 60 * 60 * 1000;
    const end   = now - i       * 7 * 24 * 60 * 60 * 1000;
    const count = commits.filter((c) => {
      const t = new Date(c.commit.author.date).getTime();
      return t >= start && t < end;
    }).length;

    // Score a single week: 10+ commits = healthy, scale down from there
    const weekScore = clamp(lerp(count, 0, 15, 0, 100), 0, 100);
    const { conditionCode } = conditionFromScore(weekScore);

    weeks.push({
      label: `W${5 - i}`,
      commits: count,
      conditionCode,
    });
  }

  return weeks;
}

// ── Composite score ───────────────────────────────────────────────────────────

function compositeScore(
  temp: number,
  cloudCover: number,
  windSpeed: number,
  uvIndex: number,
  humidity: number,
  visibility: number,
): number {
  // Normalize each to 0–100 (higher = healthier)
  const tempScore       = lerp(temp, 32, 95, 0, 100);         // hot = active = good
  const issueScore      = 100 - cloudCover;                   // fewer issues = better
  const prScore         = 100 - lerp(windSpeed, 0, 50, 0, 60); // some PRs ok, too many = bad
  const busFactorScore  = lerp(uvIndex, 0, 10, 0, 100);
  const releaseScore    = 100 - humidity;
  const docsScore       = lerp(visibility, 0, 10, 0, 100);

  const weights = [
    [tempScore,      0.30],
    [issueScore,     0.20],
    [prScore,        0.15],
    [busFactorScore, 0.15],
    [releaseScore,   0.10],
    [docsScore,      0.10],
  ] as const;

  return Math.round(weights.reduce((sum, [s, w]) => sum + s * w, 0));
}

// ── feelsLike text ────────────────────────────────────────────────────────────

function buildFeelsLike(
  score: number,
  conditionCode: ConditionCode,
  temp: number,
  openPRs: number,
  openIssues: number,
): string {
  if (conditionCode === 'frozen') {
    return `Abandoned territory. No recent activity detected — proceed with caution.`;
  }
  if (conditionCode === 'stormy') {
    return `${openIssues} open issues and ${openPRs} unmerged PRs — turbulence ahead.`;
  }
  if (score >= 70) {
    return `Active and well-maintained. ${temp}°F — perfect coding weather.`;
  }
  if (score >= 40) {
    return `Moderate activity. Some ${openIssues > 10 ? 'issue buildup' : 'quiet stretches'} on the horizon.`;
  }
  return `Low activity lately. ${openIssues} open issues sitting unresolved.`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function mapToWeather(raw: RawGitHubData): WeatherData {
  const { repoData, commits, pulls, releases, contributors } = raw;

  const { temp, label: temperatureLabel } = calcTemperature(commits);
  const cloudCover  = calcCloudCover(repoData.open_issues_count, repoData.stargazers_count);
  const windSpeed   = calcWindSpeed(pulls.length);
  const uvIndex     = calcUvIndex(contributors);
  const humidity    = calcHumidity(releases);
  const visibility  = calcVisibility(repoData);

  const score = compositeScore(temp, cloudCover, windSpeed, uvIndex, humidity, visibility);
  const { conditionCode, condition } = conditionFromScore(score);
  const forecast = buildForecast(commits);
  const feelsLike = buildFeelsLike(score, conditionCode, temp, pulls.length, repoData.open_issues_count);

  return {
    owner: repoData.owner.login,
    repo: repoData.name,
    description: repoData.description,
    stars: repoData.stargazers_count,
    language: repoData.language,
    score,
    conditionCode,
    condition,
    temperature: temp,
    temperatureLabel,
    cloudCover,
    windSpeed,
    uvIndex,
    humidity,
    visibility,
    feelsLike,
    forecast,
  };
}
