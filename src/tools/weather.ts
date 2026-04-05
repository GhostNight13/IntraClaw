import { logger } from '../utils/logger';

// Brussels coordinates
const LATITUDE  = 50.85;
const LONGITUDE = 4.35;

const WMO_DESCRIPTIONS: Record<number, string> = {
  0:   'Ciel dégagé',
  1:   'Principalement dégagé',
  2:   'Partiellement nuageux',
  3:   'Couvert',
  45:  'Brouillard',
  48:  'Brouillard givrant',
  51:  'Bruine légère',
  53:  'Bruine modérée',
  55:  'Bruine dense',
  61:  'Pluie légère',
  63:  'Pluie modérée',
  65:  'Forte pluie',
  71:  'Neige légère',
  73:  'Neige modérée',
  75:  'Forte neige',
  80:  'Averses légères',
  81:  'Averses modérées',
  82:  'Averses violentes',
  95:  'Orage',
  96:  'Orage avec grêle légère',
  99:  'Orage avec forte grêle',
};

export interface WeatherData {
  temperature: number;          // °C
  feelsLike: number;            // °C
  humidity: number;             // %
  windspeed: number;            // km/h
  weatherCode: number;
  description: string;
  isDay: boolean;
  precipitationMm: number;
  fetchedAt: string;
}

export interface WeatherForecastDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  description: string;
  precipitationSum: number;
}

interface OpenMeteoCurrentResponse {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    weather_code: number;
    is_day: number;
    precipitation: number;
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
  };
}

async function fetchWithTimeout(url: string, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch current weather in Brussels from Open-Meteo (free, no API key).
 */
export async function getWeatherBrussels(): Promise<WeatherData> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,` +
    `wind_speed_10m,weather_code,is_day,precipitation` +
    `&timezone=Europe%2FBrussels`;

  logger.info('Weather', 'Fetching Brussels weather');

  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo HTTP ${response.status}`);
  }

  const data = await response.json() as OpenMeteoCurrentResponse;
  const c = data.current;

  const result: WeatherData = {
    temperature:      Math.round(c.temperature_2m * 10) / 10,
    feelsLike:        Math.round(c.apparent_temperature * 10) / 10,
    humidity:         c.relative_humidity_2m,
    windspeed:        Math.round(c.wind_speed_10m),
    weatherCode:      c.weather_code,
    description:      WMO_DESCRIPTIONS[c.weather_code] ?? `Code météo ${c.weather_code}`,
    isDay:            c.is_day === 1,
    precipitationMm:  c.precipitation,
    fetchedAt:        new Date().toISOString(),
  };

  logger.info('Weather', `${result.temperature}°C — ${result.description}`);
  return result;
}

/**
 * Fetch 7-day forecast for Brussels.
 */
export async function getWeatherForecast(): Promise<WeatherForecastDay[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&forecast_days=7` +
    `&timezone=Europe%2FBrussels`;

  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo forecast HTTP ${response.status}`);
  }

  const data = await response.json() as OpenMeteoCurrentResponse;
  const daily = data.daily;
  if (!daily) return [];

  return daily.time.map((date, i) => ({
    date,
    maxTemp:          Math.round(daily.temperature_2m_max[i] * 10) / 10,
    minTemp:          Math.round(daily.temperature_2m_min[i] * 10) / 10,
    description:      WMO_DESCRIPTIONS[daily.weather_code[i]] ?? `Code ${daily.weather_code[i]}`,
    precipitationSum: daily.precipitation_sum[i],
  }));
}

/**
 * Format weather as a human-readable French string (for morning brief injection).
 */
export function formatWeatherFr(w: WeatherData): string {
  const dayNight = w.isDay ? 'Journée' : 'Nuit';
  return `${dayNight} à Bruxelles : ${w.temperature}°C (ressenti ${w.feelsLike}°C), ` +
         `${w.description.toLowerCase()}, humidité ${w.humidity}%, vent ${w.windspeed} km/h.`;
}
