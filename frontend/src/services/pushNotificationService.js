import { Platform, PermissionsAndroid } from 'react-native';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';

export async function setupNotificationChannel() {
  await notifee.requestPermission();
  await notifee.createChannel({
    id: 'high-priority-messages',
    name: 'Messages and Tasks',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });
}

/**
 * Requests notification permissions across iOS and Android (API 33+).
 */
export const requestUserPermission = async () => {
  if (Platform.OS === 'android') {
    if (Platform.Version >= 33) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('[PushNotificationService] Android permission request error:', err);
        return false;
      }
    }
    return true;
  }

  if (Platform.OS === 'ios') {
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus >= 1;
  }

  return true;
};

// Dummy functions to prevent crashes in AuthContext.jsx since we no longer use FCM tokens
export const registerDeviceToken = async () => { return null; };
export const unregisterDeviceToken = async () => { };

/**
 * Deep links to the appropriate screen based on local notification payload data.
 */
export const handleNotificationOpen = (data, navigationRef) => {
  if (!data || !navigationRef?.isReady?.()) {
    return;
  }

  console.log('[PushNotificationService] Handling notification open with data:', data);

  try {
    if (data.type === 'chat' && data.chatId) {
      navigationRef.navigate('Chats', {
        screen: 'ChatRoom',
        params: {
          chat: { _id: data.chatId, isGroup: data.isGroup === 'true', name: data.title },
          title: data.title || 'Chat',
        },
      });
    } else if (data.type === 'task' && data.taskId) {
      navigationRef.navigate('Tasks', {
        screen: 'TaskDetail',
        params: {
          task: { _id: data.taskId, title: data.title },
        },
      });
    } else if (data.type === 'call' && data.chatId) {
      navigationRef.navigate('Chats', {
        screen: 'ChatRoom',
        params: {
          chat: { _id: data.chatId, isGroup: data.isGroup === 'true', name: data.callerName || data.groupName },
          title: data.isGroup === 'true' ? data.groupName : data.callerName,
        },
      });
    }
  } catch (navErr) {
    console.warn('[PushNotificationService] Deep linking error:', navErr.message);
  }
};

/**
 * Triggers a rich local notification banner. Call this from SocketContext.jsx.
 */
export const displayLocalNotification = async ({ title, body, data }) => {
  await notifee.displayNotification({
    title: title || 'TaskChat',
    body: body || '',
    data: data || {},
    android: {
      channelId: 'high-priority-messages',
      importance: AndroidImportance.HIGH,
      smallIcon: 'ic_launcher',
      color: '#6366F1',
      largeIcon: data?.avatar || 'https://via.placeholder.com/150',
      circularLargeIcon: true,
      pressAction: {
        id: 'default'
      },
      actions: [
        {
          title: 'View',
          pressAction: { id: 'default' },
        },
      ],
    },
  });
};

/**
 * Sets up listeners for foreground notification taps and cold-start taps.
 */
export const setupNotificationListeners = (navigationRef) => {
  setupNotificationChannel();

  // 1. Handle tapping a notification while the app is actively running or in background
  const unsubscribeForeground = notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS && detail.notification) {
      handleNotificationOpen(detail.notification.data, navigationRef);
    }
  });

  // 2. Handle tapping a notification that caused the app to cold-start (killed state)
  notifee.getInitialNotification().then(initialNotification => {
    if (initialNotification) {
      setTimeout(() => {
        handleNotificationOpen(initialNotification.notification.data, navigationRef);
      }, 600); // Allow navigation tree to fully mount
    }
  });

  return () => {
    unsubscribeForeground();
  };
};