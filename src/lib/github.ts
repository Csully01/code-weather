const BASE = 'https://api.github.com';

function buildHeaders(token?: string): HeadersInit {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

/** Parses "owner/repo", "https://github.com/owner/repo", or "github.com/owner/repo" */
export function parseRepoInput(input: string): { owner: string; repo: string } | null {
  const cleaned = input.trim().replace(/\/$/, '').replace(/\.git$/, '');

  const urlMatch = cleaned.match(/github\.com\/([^/\s]+)\/([^/\s]+)/);
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] };

  const slugMatch = cleaned.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (slugMatch) return { owner: slugMatch[1], repo: slugMatch[2] };

  return null;
}

export interface RawGitHubData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  repoData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  commits: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pulls: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  releases: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contributors: any[];
}

export async function fetchAllRepoData(
  owner: string,
  repo: string,
  token?: string
): Promise<RawGitHubData> {
  const h = buildHeaders(token);

  const [repoRes, commitsRes, pullsRes, releasesRes, contributorsRes] =
    await Promise.all([
      fetch(`${BASE}/repos/${owner}/${repo}`, { headers: h }),
      fetch(`${BASE}/repos/${owner}/${repo}/commits?per_page=100`, { headers: h }),
      fetch(`${BASE}/repos/${owner}/${repo}/pulls?state=open&per_page=100`, { headers: h }),
      fetch(`${BASE}/repos/${owner}/${repo}/releases?per_page=5`, { headers: h }),
      fetch(`${BASE}/repos/${owner}/${repo}/contributors?per_page=20`, { headers: h }),
    ]);

  if (repoRes.status === 404) throw new Error('Repository not found.');
  if (repoRes.status === 403) {
    throw new Error('GitHub rate limit hit. Add a token in settings to continue.');
  }
  if (repoRes.status === 401) throw new Error('Invalid GitHub token.');
  if (!repoRes.ok) throw new Error(`GitHub API error (${repoRes.status})`);

  const [repoData, commits, pulls, releases, contributors] = await Promise.all([
    repoRes.json(),
    commitsRes.ok ? commitsRes.json() : [],
    pullsRes.ok ? pullsRes.json() : [],
    releasesRes.ok ? releasesRes.json() : [],
    contributorsRes.ok ? contributorsRes.json() : [],
  ]);

  return { repoData, commits, pulls, releases, contributors };
}
