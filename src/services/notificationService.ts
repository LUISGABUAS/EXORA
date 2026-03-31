import { Platform } from 'react-native';
import PushNotification from 'react-native-push-notification';

const CHANNEL_ID = 'smartexpense-mx-reminders';

export function configureNotifications() {
  PushNotification.configure({
    onNotification: () => {},
    requestPermissions: Platform.OS === 'ios',
  });

  PushNotification.createChannel(
    {
      channelId: CHANNEL_ID,
      channelName: 'Recordatorios Expensia',
      channelDescription: 'Recordatorios para registrar gastos',
      importance: 4,
      vibrate: true,
    },
    () => {},
  );
}

export function scheduleDailyReminder() {
  PushNotification.cancelAllLocalNotifications();

  const now = new Date();
  const firstFire = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    20,
    0,
    0,
  );
  if (firstFire <= now) {
    firstFire.setDate(firstFire.getDate() + 1);
  }

  PushNotification.localNotificationSchedule({
    channelId: CHANNEL_ID,
    title: 'Registra tus gastos',
    message: 'No olvides registrar los tickets y gastos del dia.',
    date: firstFire,
    repeatType: 'day',
    allowWhileIdle: true,
  });
}

export function scheduleWeeklySummary() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  const firstFire = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + daysUntilSunday,
    10,
    0,
    0,
  );

  PushNotification.localNotificationSchedule({
    channelId: CHANNEL_ID,
    title: 'Resumen semanal',
    message: 'Revisa tu resumen de gastos de la semana en Expensia.',
    date: firstFire,
    repeatType: 'week',
    allowWhileIdle: true,
  });
}

export function cancelAllReminders() {
  PushNotification.cancelAllLocalNotifications();
}
