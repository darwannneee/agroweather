import { render, screen } from '@testing-library/react-native';

import type { DashboardWeatherSummary } from '@/lib/farm-types';

import { WeatherSummaryCard } from '../weather-summary-card';

const hiddenIcon = { includeHiddenElements: true };

const weather: DashboardWeatherSummary = {
  plotId: 'plot-1',
  plotName: 'Sawah Utara',
  observedAt: '2026-07-30T00:00:00.000Z',
  description: 'cerah berawan',
  temperatureC: 29,
  humidityPercent: 78,
  windSpeedMps: 2,
  rainMm: 0,
  forecastMinTemperatureC: 24,
  forecastMaxTemperatureC: 32,
  forecastMaxRainProbability: 0.35,
};

describe('WeatherSummaryCard', () => {
  test('renders weather with icon-led temperature and forecast cues', () => {
    render(<WeatherSummaryCard weather={[weather]} />);

    expect(screen.getByText('🌤️', hiddenIcon)).toBeOnTheScreen();
    expect(screen.getByText('🌡️', hiddenIcon)).toBeOnTheScreen();
    expect(screen.getByText('☔', hiddenIcon)).toBeOnTheScreen();
    expect(screen.getByText('Cuaca Lahan')).toBeOnTheScreen();
    expect(screen.getByText('29°C sekarang · cerah berawan')).toBeOnTheScreen();
    expect(screen.getByText('Ke depan 24–32°C · peluang hujan 35%')).toBeOnTheScreen();
  });
});
