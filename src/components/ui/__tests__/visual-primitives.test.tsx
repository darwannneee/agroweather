import { fireEvent, render, screen } from '@testing-library/react-native';

import { ActionTile } from '../action-tile';
import { IconBadge } from '../icon-badge';
import { InfoRow } from '../info-row';
import { MetricCard } from '../metric-card';

describe('visual UI primitives', () => {
  const hiddenIcon = { includeHiddenElements: true };

  test('renders decorative icon badges without noisy accessible labels', () => {
    render(<IconBadge icon="🌾" label="Lahan" />);

    expect(screen.queryByLabelText('Ikon Lahan')).toBeNull();
    expect(screen.getByText('🌾', hiddenIcon)).toBeOnTheScreen();
  });

  test('allows semantic icon badges when the icon is meaningful by itself', () => {
    render(<IconBadge icon="⚠️" label="Peringatan" decorative={false} />);

    expect(screen.getByLabelText('Ikon Peringatan')).toBeOnTheScreen();
  });

  test('renders metric cards with icon, value, label, and helper copy', () => {
    render(
      <MetricCard
        icon="📋"
        value="4"
        label="Task hari ini"
        helper="Seluruh status operasional"
      />
    );

    expect(screen.getByText('📋', hiddenIcon)).toBeOnTheScreen();
    expect(screen.getByText('4')).toBeOnTheScreen();
    expect(screen.getByText('Task hari ini')).toBeOnTheScreen();
    expect(screen.getByText('Seluruh status operasional')).toBeOnTheScreen();
  });

  test('renders an action tile that remains a readable button', () => {
    const onPress = jest.fn();
    render(
      <ActionTile
        icon="🗺️"
        title="Kelola Lahan"
        description="Pemetaan dan radius geofence"
        actionLabel="Buka"
        onPress={onPress}
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Kelola Lahan' }));

    expect(screen.getByText('🗺️', hiddenIcon)).toBeOnTheScreen();
    expect(screen.getByText('Pemetaan dan radius geofence')).toBeOnTheScreen();
    expect(screen.getByText('Buka')).toBeOnTheScreen();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('renders compact info rows with icon-led copy', () => {
    render(
      <InfoRow
        icon="📍"
        label="Radius"
        value="1000 meter"
      />
    );

    expect(screen.getByText('📍', hiddenIcon)).toBeOnTheScreen();
    expect(screen.getByText('Radius')).toBeOnTheScreen();
    expect(screen.getByText('1000 meter')).toBeOnTheScreen();
  });
});
