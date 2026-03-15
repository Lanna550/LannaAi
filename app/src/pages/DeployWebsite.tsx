import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GitBranch,
  Globe,
  Loader2,
  Rocket,
  Settings2,
  Workflow,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { API_BASE_URL, fetchWithTimeout, readJsonSafely } from '@/lib/api';
import { toast } from 'sonner';

interface DeployWebsiteProps {
  onNavigate: (page: string) => void;
}

type DeployProvider = 'vercel' | 'netlify' | 'github-pages';
type DeployStatus = 'idle' | 'running' | 'success' | 'error';
type DeployMode = 'direct' | 'backend';

type GithubRun = {
  id: number | null;
  status: string;
  conclusion: string | null;
  htmlUrl: string | null;
  event: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type GithubDeployResponse = {
  ok?: boolean;
  error?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  workflow?: string;
  pagesUrl?: string;
  run?: GithubRun | null;
};

type GithubWorkflowPayload = {
  path?: string;
  name?: string;
};

type GithubWorkflowListPayload = {
  workflows?: GithubWorkflowPayload[];
};

type GithubApiRunPayload = {
  id?: number;
  status?: string;
  conclusion?: string | null;
  html_url?: string;
  event?: string;
  created_at?: string;
  updated_at?: string;
  head_branch?: string;
};

type GithubApiRunsPayload = {
  workflow_runs?: GithubApiRunPayload[];
};

const PROVIDER_LABELS: Record<DeployProvider, string> = {
  vercel: 'Vercel',
  netlify: 'Netlify',
  'github-pages': 'GitHub Pages',
};

const GITHUB_API_BASE_URL = 'https://api.github.com';
const STATIC_HOST_SUFFIXES = ['.github.io'];

const DEPLOY_STEPS = [
  'Validasi konfigurasi deploy',
  'Trigger GitHub Actions workflow',
  'Build dan publish ke GitHub Pages',
  'Situs online dan siap diakses',
];

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function parseGitHubRepository(value: string) {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  const ownerRepoMatch = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (ownerRepoMatch) {
    return {
      owner: ownerRepoMatch[1],
      repo: ownerRepoMatch[2],
    };
  }

  try {
    const parsedUrl = new URL(raw);
    const host = String(parsedUrl.hostname || '').toLowerCase();
    if (host !== 'github.com' && host !== 'www.github.com') {
      return null;
    }

    const segments = parsedUrl.pathname
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length < 2) {
      return null;
    }

    return {
      owner: segments[0],
      repo: segments[1].replace(/\.git$/i, ''),
    };
  } catch {
    return null;
  }
}

function mapGithubRun(rawRun?: GithubApiRunPayload | null): GithubRun | null {
  if (!rawRun || typeof rawRun !== 'object') {
    return null;
  }

  return {
    id: Number(rawRun.id) || null,
    status: String(rawRun.status || '').trim() || 'unknown',
    conclusion:
      rawRun.conclusion == null ? null : String(rawRun.conclusion || '').trim() || null,
    htmlUrl: String(rawRun.html_url || '').trim() || null,
    event: String(rawRun.event || '').trim() || null,
    createdAt: String(rawRun.created_at || '').trim() || null,
    updatedAt: String(rawRun.updated_at || '').trim() || null,
  };
}

function resolveActiveStepIndex(status: DeployStatus, run: GithubRun | null) {
  if (status === 'idle') {
    return -1;
  }

  if (!run) {
    return 1;
  }

  const runStatus = String(run.status || '').toLowerCase();
  if (runStatus === 'queued' || runStatus === 'waiting' || runStatus === 'requested') {
    return 1;
  }

  if (runStatus === 'in_progress') {
    return 2;
  }

  if (runStatus === 'completed' && status === 'success') {
    return 3;
  }

  return 2;
}

function getDefaultDeployMode() {
  if (typeof window === 'undefined') {
    return 'backend' as DeployMode;
  }

  const host = String(window.location.hostname || '').toLowerCase();
  const isStaticHost = STATIC_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  return isStaticHost ? 'direct' : 'backend';
}

function resolveGithubApiError(statusCode: number, payload: Record<string, unknown> | null) {
  const rawMessage = String(payload?.message || payload?.error || '').trim();

  if (statusCode === 401) {
    return 'Token GitHub tidak valid. Gunakan PAT yang benar.';
  }

  if (statusCode === 403) {
    if (/rate limit/i.test(rawMessage)) {
      return 'Kena rate limit GitHub API. Tunggu beberapa saat lalu coba lagi.';
    }
    return 'Akses ditolak oleh GitHub API. Pastikan token punya izin workflow dan repo.';
  }

  if (statusCode === 404) {
    return 'Resource tidak ditemukan (404). Kemungkinan repo/private access/workflow file tidak cocok.';
  }

  if (rawMessage) {
    return `${rawMessage} (${statusCode})`;
  }

  return `GitHub API request gagal (${statusCode}).`;
}

async function githubApiRequest<T>(endpoint: string, token: string, init: RequestInit = {}) {
  const response = await fetchWithTimeout(`${GITHUB_API_BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const payload = await readJsonSafely<Record<string, unknown>>(response);
  if (!response.ok) {
    throw new Error(resolveGithubApiError(response.status, payload));
  }

  return (payload || {}) as T;
}

async function listWorkflowPaths(owner: string, repo: string, token: string) {
  const payload = await githubApiRequest<GithubWorkflowListPayload>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows?per_page=50`,
    token,
    { method: 'GET' },
  );

  const workflows = Array.isArray(payload.workflows) ? payload.workflows : [];
  return workflows
    .map((workflow) => String(workflow.path || workflow.name || '').trim())
    .filter(Boolean);
}

export function DeployWebsite({ onNavigate }: DeployWebsiteProps) {
  const [repositoryUrl, setRepositoryUrl] = useState('https://github.com/Lanna550/LannaAi');
  const [branchName, setBranchName] = useState('main');
  const [workflowName, setWorkflowName] = useState('deploy-pages.yml');
  const [provider, setProvider] = useState<DeployProvider>('github-pages');
  const [deployMode, setDeployMode] = useState<DeployMode>(() => getDefaultDeployMode());
  const [githubToken, setGithubToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [autoRedeploy, setAutoRedeploy] = useState(true);
  const [deployStatus, setDeployStatus] = useState<DeployStatus>('idle');
  const [deployError, setDeployError] = useState('');
  const [deployedUrl, setDeployedUrl] = useState('');
  const [currentRun, setCurrentRun] = useState<GithubRun | null>(null);

  const pollingIntervalRef = useRef<number | null>(null);
  const pollingBusyRef = useRef(false);
  const deployContextRef = useRef<{
    owner: string;
    repo: string;
    branch: string;
    workflow: string;
    runId: number | null;
    mode: DeployMode;
    token: string;
  } | null>(null);

  const parsedRepository = useMemo(
    () => parseGitHubRepository(repositoryUrl),
    [repositoryUrl],
  );
  const previewUrl = useMemo(() => {
    if (!parsedRepository) {
      return '';
    }
    return `https://${parsedRepository.owner}.github.io/${parsedRepository.repo}/`;
  }, [parsedRepository]);
  const activeStepIndex = useMemo(
    () => resolveActiveStepIndex(deployStatus, currentRun),
    [deployStatus, currentRun],
  );

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      window.clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const handleCopyUrl = async () => {
    const urlToCopy = (deployedUrl || previewUrl).trim();
    if (!urlToCopy) {
      toast.error('URL deploy belum tersedia.');
      return;
    }

    try {
      if (navigator?.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(urlToCopy);
        toast.success('URL deploy berhasil disalin.');
        return;
      }

      window.prompt('Salin URL deploy:', urlToCopy);
      toast.success('URL deploy berhasil disalin.');
    } catch {
      window.prompt('Salin URL deploy:', urlToCopy);
    }
  };

  const pollDirectGithubStatus = async (context: NonNullable<typeof deployContextRef.current>) => {
    const runPayload = context.runId
      ? await githubApiRequest<GithubApiRunPayload>(
          `/repos/${encodeURIComponent(context.owner)}/${encodeURIComponent(context.repo)}/actions/runs/${encodeURIComponent(String(context.runId))}`,
          context.token,
          { method: 'GET' },
        )
      : await githubApiRequest<GithubApiRunsPayload>(
          `/repos/${encodeURIComponent(context.owner)}/${encodeURIComponent(context.repo)}/actions/workflows/${encodeURIComponent(context.workflow)}/runs?branch=${encodeURIComponent(context.branch)}&event=workflow_dispatch&per_page=5`,
          context.token,
          { method: 'GET' },
        );

    if ('workflow_runs' in runPayload) {
      const runs = Array.isArray(runPayload.workflow_runs) ? runPayload.workflow_runs : [];
      const selectedRun =
        runs.find(
          (run) =>
            String(run?.head_branch || '').trim().toLowerCase() ===
            context.branch.toLowerCase(),
        ) || runs[0] || null;
      return mapGithubRun(selectedRun);
    }

    return mapGithubRun(runPayload as GithubApiRunPayload);
  };

  const pollBackendStatus = async (context: NonNullable<typeof deployContextRef.current>) => {
    const query = new URLSearchParams({
      owner: context.owner,
      repo: context.repo,
      branch: context.branch,
      workflow: context.workflow,
    });
    if (context.runId) {
      query.set('runId', String(context.runId));
    }

    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/deploy/github/status?${query.toString()}`,
      {
        method: 'GET',
      },
    );
    const payload = await readJsonSafely<GithubDeployResponse>(response);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || `Gagal mengecek status deploy (${response.status}).`);
    }

    if (payload.pagesUrl) {
      setDeployedUrl(payload.pagesUrl);
    }
    return payload.run || null;
  };

  const pollGithubDeployStatus = async () => {
    const context = deployContextRef.current;
    if (!context || pollingBusyRef.current) {
      return;
    }

    pollingBusyRef.current = true;
    try {
      const run = context.mode === 'direct'
        ? await pollDirectGithubStatus(context)
        : await pollBackendStatus(context);

      setCurrentRun(run);
      if (run?.id && !context.runId) {
        deployContextRef.current = {
          ...context,
          runId: run.id,
        };
      }

      const status = String(run?.status || '').toLowerCase();
      const conclusion = String(run?.conclusion || '').toLowerCase();

      if (status === 'completed') {
        stopPolling();
        if (conclusion === 'success') {
          setDeployStatus('success');
          setDeployError('');
          toast.success('Deploy GitHub Pages selesai dan berhasil.');
          return;
        }

        setDeployStatus('error');
        setDeployError(
          `Workflow selesai dengan status "${conclusion || 'failed'}". Cek detail di GitHub Actions.`,
        );
        toast.error('Deploy gagal. Cek log GitHub Actions.');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal mengecek status deploy GitHub.';
      setDeployStatus('error');
      setDeployError(message);
      stopPolling();
      toast.error(message);
    } finally {
      pollingBusyRef.current = false;
    }
  };

  const startPolling = () => {
    stopPolling();
    pollingIntervalRef.current = window.setInterval(() => {
      void pollGithubDeployStatus();
    }, 5000);
  };

  const startDirectDeploy = async (
    owner: string,
    repo: string,
    branch: string,
    workflow: string,
  ) => {
    const trimmedToken = githubToken.trim();
    if (!trimmedToken) {
      throw new Error('Mode Direct butuh GitHub Personal Access Token (PAT).');
    }

    try {
      await githubApiRequest(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
        trimmedToken,
        {
          method: 'POST',
          body: JSON.stringify({ ref: branch }),
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memicu workflow.';
      if (/404/.test(message) || /tidak ditemukan/i.test(message)) {
        try {
          const availableWorkflows = await listWorkflowPaths(owner, repo, trimmedToken);
          if (availableWorkflows.length > 0) {
            throw new Error(
              `Workflow "${workflow}" tidak ditemukan. Coba pakai salah satu: ${availableWorkflows.join(', ')}`,
            );
          }
        } catch {
          // ignore secondary error and keep original message
        }
      }
      throw new Error(message);
    }

    await sleep(1300);
    const firstRun = await pollDirectGithubStatus({
      owner,
      repo,
      branch,
      workflow,
      runId: null,
      mode: 'direct',
      token: trimmedToken,
    });

    deployContextRef.current = {
      owner,
      repo,
      branch,
      workflow,
      runId: firstRun?.id || null,
      mode: 'direct',
      token: trimmedToken,
    };

    setCurrentRun(firstRun || null);
    setDeployedUrl(`https://${owner}.github.io/${repo}/`);
    return firstRun;
  };

  const startBackendDeploy = async (
    repository: string,
    branch: string,
    workflow: string,
    owner: string,
    repo: string,
  ) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/deploy/github/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repositoryUrl: repository,
        branch,
        workflow,
        autoRedeploy,
      }),
    });
    const payload = await readJsonSafely<GithubDeployResponse>(response);

    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || `Gagal memulai deploy (${response.status}).`);
    }

    deployContextRef.current = {
      owner: payload.owner || owner,
      repo: payload.repo || repo,
      branch: payload.branch || branch,
      workflow: payload.workflow || workflow,
      runId: payload.run?.id || null,
      mode: 'backend',
      token: '',
    };

    if (payload.pagesUrl) {
      setDeployedUrl(payload.pagesUrl);
    } else {
      setDeployedUrl(`https://${owner}.github.io/${repo}/`);
    }

    setCurrentRun(payload.run || null);
    return payload.run || null;
  };

  const handleAutoDeploy = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedRepositoryUrl = repositoryUrl.trim();
    const trimmedBranchName = branchName.trim();
    const trimmedWorkflowName = workflowName.trim();

    if (!trimmedRepositoryUrl || !trimmedBranchName || !trimmedWorkflowName) {
      toast.error('Repository URL, branch, dan workflow wajib diisi.');
      return;
    }

    if (provider !== 'github-pages') {
      toast.error('Saat ini auto deploy real hanya tersedia untuk GitHub Pages.');
      return;
    }

    const parsedRepo = parseGitHubRepository(trimmedRepositoryUrl);
    if (!parsedRepo) {
      toast.error('Repository harus format owner/repo atau URL GitHub valid.');
      return;
    }

    stopPolling();
    setDeployStatus('running');
    setDeployError('');
    setCurrentRun(null);

    try {
      const run = deployMode === 'direct'
        ? await startDirectDeploy(
            parsedRepo.owner,
            parsedRepo.repo,
            trimmedBranchName,
            trimmedWorkflowName,
          )
        : await startBackendDeploy(
            trimmedRepositoryUrl,
            trimmedBranchName,
            trimmedWorkflowName,
            parsedRepo.owner,
            parsedRepo.repo,
          );

      const runStatus = String(run?.status || '').toLowerCase();
      const runConclusion = String(run?.conclusion || '').toLowerCase();
      if (runStatus === 'completed' && runConclusion === 'success') {
        setDeployStatus('success');
        toast.success('Deploy GitHub Pages selesai dan berhasil.');
        return;
      }

      toast.success('Workflow deploy berhasil dipicu. Menunggu proses build...');
      void pollGithubDeployStatus();
      startPolling();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Terjadi kesalahan saat memulai auto deploy.';
      setDeployStatus('error');
      setDeployError(message);
      toast.error(message);
    }
  };

  return (
    <div className="page-with-navbar pb-12 bg-gradient-to-b from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <button
              onClick={() => onNavigate('tools')}
              className="inline-flex items-center gap-2 text-gray-700 transition-colors hover:text-blue-700 dark:text-gray-300 dark:hover:text-blue-300"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-base font-medium">Kembali ke Tools</span>
            </button>

            <div className="h-12 w-12 min-h-12 min-w-12 shrink-0 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25 sm:h-14 sm:w-14 sm:min-h-14 sm:min-w-14">
              <Rocket className="h-6 w-6 text-white sm:h-7 sm:w-7" />
            </div>
          </div>

          <div className="max-w-2xl mx-auto text-center">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">
              Deployment Tool
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
              Deploy <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">Website</span>
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300 sm:text-base">
              Trigger deploy GitHub Pages langsung dari dashboard ini, lalu pantau status workflow secara real-time.
            </p>
          </div>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
            className="lg:col-span-2"
          >
            <form
              onSubmit={handleAutoDeploy}
              className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card dark:border-gray-700 dark:bg-gray-800 sm:p-8"
            >
              <h2 className="mb-5 text-xl font-bold text-gray-900 dark:text-white">Konfigurasi Auto Deploy (GitHub)</h2>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Repository URL / owner/repo
                  </label>
                  <Input
                    value={repositoryUrl}
                    onChange={(event) => setRepositoryUrl(event.target.value)}
                    placeholder="https://github.com/username/repository"
                    className="h-11"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200">
                      Branch
                    </label>
                    <Input
                      value={branchName}
                      onChange={(event) => setBranchName(event.target.value)}
                      placeholder="main"
                      className="h-11"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200">
                      Provider
                    </label>
                    <select
                      value={provider}
                      onChange={(event) => setProvider(event.target.value as DeployProvider)}
                      className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-white"
                    >
                      <option value="github-pages">GitHub Pages</option>
                      <option value="vercel" disabled>Vercel (Coming Soon)</option>
                      <option value="netlify" disabled>Netlify (Coming Soon)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Workflow File
                  </label>
                  <Input
                    value={workflowName}
                    onChange={(event) => setWorkflowName(event.target.value)}
                    placeholder="deploy-pages.yml"
                    className="h-11"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200">
                      Mode Deploy
                    </label>
                    <select
                      value={deployMode}
                      onChange={(event) => setDeployMode(event.target.value as DeployMode)}
                      className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-white"
                    >
                      <option value="direct">Direct GitHub API (Recommended di GitHub Pages)</option>
                      <option value="backend">Via Backend API</option>
                    </select>
                  </div>
                  {deployMode === 'direct' ? (
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200">
                        GitHub PAT Token
                      </label>
                      <div className="relative">
                        <Input
                          type={showToken ? 'text' : 'password'}
                          value={githubToken}
                          onChange={(event) => setGithubToken(event.target.value)}
                          placeholder="ghp_xxx / github_pat_xxx"
                          className="h-11 pr-11"
                        />
                        <button
                          type="button"
                          onClick={() => setShowToken((prev) => !prev)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                          aria-label={showToken ? 'Sembunyikan token' : 'Tampilkan token'}
                        >
                          {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200">
                        Backend API Target
                      </label>
                      <Input value={API_BASE_URL} disabled className="h-11" />
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-3.5 py-3 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-200">
                  <input
                    type="checkbox"
                    checked={autoRedeploy}
                    onChange={(event) => setAutoRedeploy(event.target.checked)}
                    className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Aktifkan auto redeploy mode (workflow bisa dipicu ulang dari halaman ini).</span>
                </label>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="submit"
                    disabled={deployStatus === 'running'}
                    className="h-11 bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600"
                  >
                    {deployStatus === 'running' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Menjalankan Deploy...
                      </>
                    ) : (
                      <>
                        <Rocket className="h-4 w-4" />
                        {deployStatus === 'success' ? 'Deploy Ulang' : 'Jalankan Auto Deploy'}
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={handleCopyUrl}
                  >
                    <Copy className="h-4 w-4" />
                    Salin URL Deploy
                  </Button>
                </div>
              </div>
            </form>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.16, duration: 0.35 }}
            className="lg:col-span-1"
          >
            <div className="sticky top-24 space-y-4">
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card dark:border-gray-700 dark:bg-gray-800">
                <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Deploy Pipeline</h3>
                <div className="space-y-3">
                  {DEPLOY_STEPS.map((step, stepIndex) => {
                    const isDone = activeStepIndex > stepIndex || (deployStatus === 'success' && activeStepIndex >= stepIndex);
                    const isRunning = deployStatus === 'running' && activeStepIndex === stepIndex;
                    const isError = deployStatus === 'error' && activeStepIndex === stepIndex;

                    return (
                      <div
                        key={step}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                          isDone
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300'
                            : isRunning
                              ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300'
                              : isError
                                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300'
                                : 'border-gray-100 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-700/40 dark:text-gray-300'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : isRunning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isError ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <Clock3 className="h-4 w-4" />
                        )}
                        <span>{step}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card dark:border-gray-700 dark:bg-gray-800">
                <h3 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">Ringkasan Deploy</h3>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-blue-500" />
                    <span>Provider: {PROVIDER_LABELS[provider]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-blue-500" />
                    <span>Branch: {branchName || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Workflow className="h-4 w-4 text-blue-500" />
                    <span>Workflow: {workflowName || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500" />
                    <span className="break-all">Preview URL: {deployedUrl || previewUrl || '-'}</span>
                  </div>
                </div>

                {currentRun?.htmlUrl && (
                  <a
                    href={currentRun.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400"
                  >
                    Buka GitHub Actions Run
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}

                {deployStatus === 'success' && (deployedUrl || previewUrl) && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                    Deploy selesai. Website online di:
                    <a
                      href={deployedUrl || previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block break-all font-semibold underline underline-offset-2"
                    >
                      {deployedUrl || previewUrl}
                    </a>
                  </div>
                )}

                {deployStatus === 'error' && deployError && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                    {deployError}
                  </div>
                )}

                {deployMode === 'direct' ? (
                  <p className="mt-4 text-xs text-blue-700 dark:text-blue-300">
                    Mode direct aktif: deploy dipicu langsung ke GitHub API dari browser.
                  </p>
                ) : (
                  <>
                    <p className="mt-4 text-xs text-blue-700 dark:text-blue-300">
                      Backend butuh env `GITHUB_DEPLOY_TOKEN` dengan akses workflow + repo untuk trigger deploy.
                    </p>
                    <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                      API target sekarang: <span className="font-semibold">{API_BASE_URL}</span>
                    </p>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
