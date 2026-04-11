export type ConditionCode =
  | 'clear'
  | 'sunny'
  | 'partlyCloudy'
  | 'cloudy'
  | 'overcast'
  | 'stormy'
  | 'frozen';

export interface WeekForecast {
  label: string;
  commits: number;
  conditionCode: ConditionCode;
}

export interface WeatherData {
  owner: string;
  repo: string;
  description: string | null;
  stars: number;
  language: string | null;
  // Weather metrics
  score: number;          // 0–100 composite health score
  conditionCode: ConditionCode;
  condition: string;      // human-readable label
  temperature: number;    // °F — commit activity
  temperatureLabel: string;
  cloudCover: number;     // % — issue density
  windSpeed: number;      // mph — open PR count
  uvIndex: number;        // 0–10 — bus factor / contributor count
  humidity: number;       // % — release staleness
  visibility: number;     // 0–10 — documentation quality
  feelsLike: string;      // plain-English summary sentence
  forecast: WeekForecast[]; // last 5 weeks of commit activity
}
