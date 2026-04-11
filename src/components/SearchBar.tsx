import { useState, type FormEvent } from 'react';
import { parseRepoInput } from '../lib/github';

interface Props {
  onSearch: (owner: string, repo: string) => void;
  loading: boolean;
}

export function SearchBar({ onSearch, loading }: Props) {
  const [value, setValue] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setParseError(null);

    const parsed = parseRepoInput(value);
    if (!parsed) {
      setParseError('Enter a repo as owner/repo or a full GitHub URL.');
      return;
    }

    onSearch(parsed.owner, parsed.repo);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setParseError(null);
          }}
          placeholder="facebook/react or https://github.com/owner/repo"
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all text-sm"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="px-5 py-3 rounded-xl bg-white/20 hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-all"
        >
          {loading ? 'Fetching…' : 'Forecast'}
        </button>
      </div>
      {parseError && (
        <p className="mt-2 text-sm text-red-300">{parseError}</p>
      )}
    </form>
  );
}
