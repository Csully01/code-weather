import { useState } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { SearchBar } from './components/SearchBar';
import { fetchAllRepoData } from './lib/github';
import { mapToWeather } from './lib/weather';
import type { WeatherData } from './types';
import './App.css';

// Sky gradient per condition
const SKY: Record<string, string> = {
  clear:        'from-sky-400 to-blue-600',
  sunny:        'from-yellow-300 to-sky-500',
  partlyCloudy: 'from-slate-400 to-blue-500',
  cloudy:       'from-slate-500 to-slate-700',
  overcast:     'from-slate-600 to-slate-800',
  stormy:       'from-slate-700 to-slate-900',
  frozen:       'from-slate-800 to-indigo-950',
};

const CONDITION_EMOJI: Record<string, string> = {
  clear:        '☀️',
  sunny:        '🌤️',
  partlyCloudy: '⛅',
  cloudy:       '☁️',
  overcast:     '🌥️',
  stormy:       '⛈️',
  frozen:       '🧊',
};

const WEEK_EMOJI: Record<string, string> = {
  clear:        '☀️',
  sunny:        '🌤️',
  partlyCloudy: '⛅',
  cloudy:       '☁️',
  overcast:     '🌥️',
  stormy:       '⛈️',
  frozen:       '🧊',
};

function WeatherCard({ w }: { w: WeatherData }) {
  const sky = SKY[w.conditionCode] ?? SKY.cloudy;
  const emoji = CONDITION_EMOJI[w.conditionCode] ?? '🌡️';

  return (
    <div className={`w-full max-w-md rounded-3xl bg-gradient-to-b ${sky} p-6 shadow-2xl text-white`}>
      {/* Header */}
      <div className="mb-4">
        <p className="text-white/70 text-sm font-mono">
          {w.owner} / {w.repo}
        </p>
        {w.description && (
          <p className="text-white/60 text-xs mt-1 line-clamp-2">{w.description}</p>
        )}
      </div>

      {/* Main condition */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-7xl font-thin">{w.temperature}°</div>
          <div className="text-white/80 text-lg mt-1">{w.condition}</div>
          <div className="text-white/60 text-sm">{w.temperatureLabel}</div>
        </div>
        <div className="text-6xl">{emoji}</div>
      </div>

      {/* Feels like */}
      <p className="text-white/70 text-sm mb-5 italic">"{w.feelsLike}"</p>

      {/* Stat row */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        <StatCell label="💨 Wind" value={`${w.windSpeed} mph`} />
        <StatCell label="💧 Humidity" value={`${w.humidity}%`} />
        <StatCell label="☀️ UV Index" value={`${w.uvIndex}/10`} />
        <StatCell label="👁️ Visibility" value={`${w.visibility}/10`} />
      </div>

      {/* Divider */}
      <div className="border-t border-white/20 mb-4" />

      {/* 5-week forecast */}
      <div>
        <p className="text-white/50 text-xs uppercase tracking-widest mb-3">
          5-Week Forecast
        </p>
        <div className="flex justify-between">
          {w.forecast.map((week) => (
            <div key={week.label} className="flex flex-col items-center gap-1">
              <span className="text-xl">{WEEK_EMOJI[week.conditionCode]}</span>
              <span className="text-white/60 text-xs">{week.commits}</span>
              <span className="text-white/40 text-xs">{week.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 border-t border-white/10 pt-3 flex justify-between text-white/40 text-xs">
        <span>⭐ {w.stars.toLocaleString()}</span>
        {w.language && <span>{w.language}</span>}
        <span>Health: {w.score}/100</span>
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/10 rounded-xl p-2 text-center">
      <div className="text-white/60 text-xs leading-tight">{label}</div>
      <div className="text-white text-sm font-medium mt-1">{value}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="w-full max-w-md rounded-3xl bg-slate-700 p-6 shadow-2xl animate-pulse">
      <div className="h-4 bg-slate-600 rounded w-32 mb-4" />
      <div className="h-16 bg-slate-600 rounded w-24 mb-2" />
      <div className="h-4 bg-slate-600 rounded w-48 mb-1" />
      <div className="h-3 bg-slate-600 rounded w-64 mb-6" />
      <div className="grid grid-cols-4 gap-2 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 bg-slate-600 rounded-xl" />
        ))}
      </div>
      <div className="h-px bg-slate-600 mb-4" />
      <div className="flex justify-between">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 w-8 bg-slate-600 rounded" />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  async function handleSearch(owner: string, repo: string) {
    setLoading(true);
    setError(null);
    setWeather(null);

    try {
      const raw = await fetchAllRepoData(owner, repo);
      const mapped = mapToWeather(raw);
      setWeather(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SpeedInsights />
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 py-12 gap-8">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Code Weather</h1>
          <p className="text-slate-400 text-sm">
            Enter any public GitHub repo to check the forecast
          </p>
        </div>

        {/* Search */}
        <SearchBar onSearch={handleSearch} loading={loading} />

        {/* Error */}
        {error && (
          <div className="w-full max-w-md bg-red-900/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && <LoadingSkeleton />}

        {/* Result */}
        {weather && !loading && <WeatherCard w={weather} />}

        {/* Empty state hint */}
        {!weather && !loading && !error && (
          <p className="text-slate-600 text-xs">
            Try: <span className="text-slate-500 font-mono">facebook/react</span> or{' '}
            <span className="text-slate-500 font-mono">torvalds/linux</span>
          </p>
        )}
      </div>
    </>
  );
}
