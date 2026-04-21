import { FormEvent, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';

interface RepoInputFormProps {
  loading: boolean;
  onAnalyze: (repo: string) => Promise<void>;
}

export const RepoInputForm = ({ loading, onAnalyze }: RepoInputFormProps) => {
  const [repo, setRepo] = useState('facebook/react');
  const [validationError, setValidationError] = useState<string | null>(null);

  const isValidRepo = useMemo(() => /^[\w.-]+\/[\w.-]+$/.test(repo.trim()), [repo]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isValidRepo) {
      setValidationError('Please enter repository in owner/repo format.');
      return;
    }
    setValidationError(null);
    await onAnalyze(repo.trim());
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Enter GitHub Repo (owner/repo)
          </span>
          <input
            value={repo}
            onChange={(event) => setRepo(event.target.value)}
            placeholder="owner/repo"
            className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none ring-0 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-blue-400 dark:focus:ring-blue-900"
          />
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70 lg:w-auto"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Analyze
          </button>
        </div>
      </div>

      {validationError && <p className="mt-3 text-sm text-rose-500">{validationError}</p>}
    </form>
  );
};

