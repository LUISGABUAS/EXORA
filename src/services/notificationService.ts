import PushNotification from 'react-native-push-notification';
import { Platform } from 'react-native';

const CHANNEL_ID = 'expensia-reminders';

export function configureNotifications() {
  try {
    PushNotification.configure({
      onNotification: notification => {
        if (__DEV__) {
          console.log('[Notification]', notification);
        }
      },
      permissions: { alert: true, badge: true, sound: true },
      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: CHANNEL_ID,
          channelName: 'Recordatorios de gastos',
          importance: 4,
          vibrate: true,
        },
        () => {},
      );
    }
  } catch (e) {
    console.warn('[Notifications] No se pudo configurar:', e);
  }
}

export function scheduleDailyReminder() {
  try {
    PushNotification.cancelLocalNotification('1');

    const now = new Date();
    const fireDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      20,
      0,
      0,
    );
    if (fireDate <= now) {
      fireDate.setDate(fireDate.getDate() + 1);
    }

    PushNotification.localNotificationSchedule({
      id: '1',
      channelId: CHANNEL_ID,
      title: 'Registra tus gastos',
      message:
        'No olvides registrar los gastos del dia para maximizar tus deducciones.',
      date: fireDate,
      repeatType: 'day',
      allowWhileIdle: true,
    });
  } catch (e) {
    console.warn('[Notifications] No se pudo agendar recordatorio diario:', e);
  }
}

export function scheduleWeeklySummary() {
  try {
    PushNotification.cancelLocalNotification('2');

    const now = new Date();
    const day = now.getDay();
    const daysUntilSunday = day === 0 ? 7 : 7 - day;
    const fireDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + daysUntilSunday,
      10,
      0,
      0,
    );

    PushNotification.localNotificationSchedule({
      id: '2',
      channelId: CHANNEL_ID,
      title: 'Resumen semanal',
      message: 'Revisa tu resumen de gastos y ahorro fiscal de la semana.',
      date: fireDate,
      repeatType: 'week',
      allowWhileIdle: true,
    });
  } catch (e) {
    console.warn('[Notifications] No se pudo agendar resumen semanal:', e);
  }
}

export function cancelAllReminders() {
  try {
    PushNotification.cancelAllLocalNotifications();
  } catch (e) {
    console.warn('[Notifications] No se pudo cancelar recordatorios:', e);
  }
}
