import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useSocket } from '../context/SocketContext';
import { colors, spacing, fontSizes } from '../theme/theme';

// Renders a stack of dismissible banners for task reminders / salary penalty alerts.
// Mount this once near the root of the app (e.g. inside the tab navigator screen wrapper).
const ReminderBanner = () => {
  const { notifications, dismissNotification } = useSocket();

  if (!notifications?.length) return null;

  return (
    <FlatList
      data={notifications}
      keyExtractor={(item) => String(item.id)}
      style={styles.container}
      renderItem={({ item }) => (
        <View style={[styles.banner, item.urgent && styles.urgentBanner]}>
          <Text style={styles.text}>{item.message}</Text>
          <TouchableOpacity onPress={() => dismissNotification(item.id)}>
            <Text style={styles.dismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  banner: {
    backgroundColor: colors.warning,
    padding: spacing.sm,
    marginHorizontal: spacing.sm,
    marginTop: spacing.sm,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  urgentBanner: { backgroundColor: colors.danger },
  text: { color: colors.white, fontSize: fontSizes.md, flex: 1, marginRight: spacing.sm },
  dismiss: { color: colors.white, fontSize: fontSizes.lg, fontWeight: 'bold' },
});

export default ReminderBanner;
