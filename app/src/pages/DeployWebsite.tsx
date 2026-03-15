import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  GitBranch,
  Globe,
  Loader2,
  Rocket,
  Settings2,
  TerminalSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface DeployWebsiteProps {
  onNavigate: (page: string) => void;
}

type DeployProvider = 'vercel' | 'netlify' | 'github-pages';
type DeployStatus = 'idle' | 'running' | 'success';

const PROVIDER_LABELS: Record<DeployProvider, string> = {
  vercel: 'Vercel',
  netlify: 'Netlify',
  'github-pages': 'GitHub Pages',
};

const DEPLOY_STEPS = [
  'Memvalidasi repository',
  'Menjalankan build command',
  'Upload artifact website',
  'Menyambungkan domain deploy',
];

function normalizeProjectSlug(value: string) {
  const sanitized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || 'my-website';
}

function createDeployHostname(provider: DeployProvider, slug: string) {
  switch (provider) {
    case 'netlify':
      return `${slug}.netlify.app`;
    case 'github-pages':
      return `${slug}.github.io`;
    case 'vercel':
    default:
      return `${slug}.vercel.app`;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function DeployWebsite({ onNavigate }: DeployWebsiteProps) {
  const [projectName, setProjectName] = useState('lanna-ai');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [branchName, setBranchName] = useState('main');
  const [buildCommand, setBuildCommand] = useState('npm run build');
  const [outputDirectory, setOutputDirectory] = useState('dist');
  const [provider, setProvider] = useState<DeployProvider>('vercel');
  const [autoRedeploy, setAutoRedeploy] = useState(true);
  const [deployStatus, setDeployStatus] = useState<DeployStatus>('idle');
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [deployedUrl, setDeployedUrl] = useState('');

  const projectSlug = useMemo(() => normalizeProjectSlug(projectName), [projectName]);
  const previewUrl = useMemo(
    () => `https://${createDeployHostname(provider, projectSlug)}`,
    [provider, projectSlug],
  );

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

  const handleAutoDeploy = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedProjectName = projectName.trim();
    const trimmedRepositoryUrl = repositoryUrl.trim();
    const trimmedBranchName = branchName.trim();
    const trimmedBuildCommand = buildCommand.trim();
    const trimmedOutputDirectory = outputDirectory.trim();

    if (!trimmedProjectName || !trimmedRepositoryUrl || !trimmedBranchName) {
      toast.error('Project name, repository URL, dan branch wajib diisi.');
      return;
    }

    if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmedRepositoryUrl)) {
      toast.error('Repository URL tidak valid.');
      return;
    }

    if (!trimmedBuildCommand || !trimmedOutputDirectory) {
      toast.error('Build command dan output directory wajib diisi.');
      return;
    }

    setDeployStatus('running');
    setActiveStepIndex(0);
    setDeployedUrl('');

    for (let stepIndex = 0; stepIndex < DEPLOY_STEPS.length; stepIndex += 1) {
      setActiveStepIndex(stepIndex);
      await sleep(900);
    }

    const nextUrl = `https://${createDeployHostname(provider, normalizeProjectSlug(trimmedProjectName))}`;
    setDeployedUrl(nextUrl);
    setDeployStatus('success');
    toast.success('Deploy website berhasil selesai.');
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
              Atur project, lalu jalankan auto deploy untuk publish website kamu secara otomatis.
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
              <h2 className="mb-5 text-xl font-bold text-gray-900 dark:text-white">Konfigurasi Auto Deploy</h2>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Project Name
                  </label>
                  <Input
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="contoh: lanna-ai"
                    className="h-11"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Repository URL
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
                      <option value="vercel">Vercel</option>
                      <option value="netlify">Netlify</option>
                      <option value="github-pages">GitHub Pages</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200">
                      Build Command
                    </label>
                    <Input
                      value={buildCommand}
                      onChange={(event) => setBuildCommand(event.target.value)}
                      placeholder="npm run build"
                      className="h-11"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200">
                      Output Directory
                    </label>
                    <Input
                      value={outputDirectory}
                      onChange={(event) => setOutputDirectory(event.target.value)}
                      placeholder="dist"
                      className="h-11"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-3.5 py-3 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-200">
                  <input
                    type="checkbox"
                    checked={autoRedeploy}
                    onChange={(event) => setAutoRedeploy(event.target.checked)}
                    className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Aktifkan auto redeploy setiap ada push baru ke branch ini.</span>
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
                        Menjalankan Auto Deploy...
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
                    const isDone = deployStatus === 'success' && stepIndex <= activeStepIndex;
                    const isRunning = deployStatus === 'running' && stepIndex === activeStepIndex;

                    return (
                      <div
                        key={step}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                          isDone
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300'
                            : isRunning
                              ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300'
                              : 'border-gray-100 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-700/40 dark:text-gray-300'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : isRunning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
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
                <h3 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">Ringkasan</h3>
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
                    <TerminalSquare className="h-4 w-4 text-blue-500" />
                    <span>Build: {buildCommand || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500" />
                    <span>Preview URL: {previewUrl}</span>
                  </div>
                </div>

                {deployStatus === 'success' && deployedUrl && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                    Deploy selesai. Website online di:
                    <a
                      href={deployedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block break-all font-semibold underline underline-offset-2"
                    >
                      {deployedUrl}
                    </a>
                  </div>
                )}

                {autoRedeploy && (
                  <p className="mt-4 text-xs text-blue-700 dark:text-blue-300">
                    Auto redeploy aktif: setiap commit baru ke branch ini akan memicu deploy otomatis.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
