import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { DashboardWeatherSummary } from '@/lib/farm-types';

import { AppText } from '../ui/app-text';
import { IconBadge } from '../ui/icon-badge';
import { InfoRow } from '../ui/info-row';
import { SurfaceCard } from '../ui/surface-card';

function formatTemperature(value: number): string {
  return `${formatTemperatureValue(value)}°C`;
}

function formatTemperatureValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded)
    ? rounded.toFixed(0)
    : rounded.toFixed(1);
}

function formatRainProbability(value: number | null): string {
  return value === null
    ? 'peluang hujan belum tersedia'
    : `peluang hujan ${Math.round(value * 100)}%`;
}

function formatObservedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Update waktu tidak tersedia';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value: partValue }) => [type, partValue])
  );
  return `Update ${values.hour}:${values.minute} WIB`;
}

function forecastCopy(weather: DashboardWeatherSummary): string {
  const { forecastMinTemperatureC, forecastMaxTemperatureC } = weather;
  if (
    forecastMinTemperatureC === null
    || forecastMaxTemperatureC === null
  ) {
    return `Prakiraan belum tersedia · ${formatRainProbability(
      weather.forecastMaxRainProbability
    )}`;
  }

  return `Prakiraan ${formatTemperatureValue(
    forecastMinTemperatureC
  )}–${formatTemperature(forecastMaxTemperatureC)} · ${formatRainProbability(
    weather.forecastMaxRainProbability
  )}`;
}

export function WeatherSummaryCard({
  weather,
  emptyMessage = 'Belum ada snapshot cuaca dari sistem AI.',
  maxItems = 3,
}: {
  weather: DashboardWeatherSummary[];
  emptyMessage?: string;
  maxItems?: number;
}) {
  const visibleWeather = weather.slice(0, maxItems);

  return (
    <SurfaceCard>
      <View style={styles.header}>
        <IconBadge 
          icon={<Feather name="cloud" size={18} color={Colors.skyText} />} 
          label="Cuaca Lahan" 
          tone="sky" 
        />
        <View style={styles.headerCopy}>
          <AppText variant="subtitle">Cuaca Lahan</AppText>
          <AppText variant="small" color={Colors.muted}>
            Suhu terkini dan prakiraan singkat per lahan.
          </AppText>
        </View>
      </View>
      
      {visibleWeather.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="wind" size={24} color={Colors.border} />
          <AppText variant="small" color={Colors.muted}>
            {emptyMessage}
          </AppText>
        </View>
      ) : (
        <View style={styles.list}>
          {visibleWeather.map((item, index) => (
            <View key={item.plotId}>
              <View style={styles.item}>
                <AppText variant="bodyStrong" style={styles.plotName}>{item.plotName}</AppText>
                <View style={styles.infoGroup}>
                  <InfoRow
                    icon={<Feather name="thermometer" size={14} color={Colors.amberText} />}
                    label="Sekarang"
                    value={`${formatTemperature(item.temperatureC)} · ${item.description}`}
                    tone="amber"
                  />
                  <InfoRow
                    icon={<Feather name="clock" size={14} color={Colors.muted} />}
                    label="Update"
                    value={formatObservedAt(item.observedAt)}
                    tone="neutral"
                  />
                  <InfoRow
                    icon={<Feather name="cloud-rain" size={14} color={Colors.skyText} />}
                    label="Ke depan"
                    value={forecastCopy(item)}
                    tone="sky"
                  />
                </View>
              </View>
              {index < visibleWeather.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
      )}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.three,
  },
  item: {
    gap: Spacing.two,
  },
  plotName: {
    marginBottom: Spacing.one,
  },
  infoGroup: {
    gap: Spacing.one,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.two,
  },
});