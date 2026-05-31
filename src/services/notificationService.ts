import PushNotification from 'react-native-push-notification';
import { Platform } from 'react-native';
import { FiscalRegime } from '../store/usePremiumStore';

const CHANNEL_ID = 'expensia-reminders';

export function configureNotifications() {
  try {
    PushNotification.configure({
      onNotification: () => {},
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
        'No olvides registrar los gastos del día para maximizar tus deducciones.',
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

// Regímenes que tienen pago mensual (provisional) el día 17
const MONTHLY_PAYMENT_REGIMES: FiscalRegime[] = [
  'resico',
  'plataformas_digitales',
  'arrendamiento',
];

// Regímenes con declaración trimestral ISR
const QUARTERLY_REGIMES: FiscalRegime[] = [
  'actividad_empresarial',
  'honorarios',
  'incorporacion_fiscal',
  'regimen_general',
  'sueldos_salarios',
];

// Meses de vencimiento trimestral (0-indexed): abril=3, julio=6, octubre=9, enero=0
const QUARTERLY_MONTHS = [0, 3, 6, 9];

export function scheduleSatDeadlines(regime: FiscalRegime) {
  if (regime === 'no_facturo') return;

  try {
    // Cancelar recordatorios SAT previos (IDs 10-30)
    for (let i = 10; i <= 30; i++) {
      PushNotification.cancelLocalNotification(String(i));
    }

    const now = new Date();
    let notifId = 10;

    if (MONTHLY_PAYMENT_REGIMES.includes(regime)) {
      // Recordatorio mensual: día 15 de cada mes (2 días antes del vencimiento día 17)
      for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
        const fireDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 15, 9, 0, 0);
        if (fireDate <= now) continue;
        PushNotification.localNotificationSchedule({
          id: String(notifId++),
          channelId: CHANNEL_ID,
          title: '📅 Tu pago al SAT vence en 2 días',
          message: 'El 17 vence tu pago mensual. Revisa tus deducciones en EXPENSIA antes de declarar.',
          date: fireDate,
          allowWhileIdle: true,
        });
      }
    }

    if (QUARTERLY_REGIMES.includes(regime)) {
      // Recordatorio trimestral: 5 días antes del 17 de abril, julio, octubre y enero
      QUARTERLY_MONTHS.forEach(month => {
        const year = month === 0 && now.getMonth() > 0 ? now.getFullYear() + 1 : now.getFullYear();
        const fireDate = new Date(year, month, 12, 9, 0, 0); // día 12 = 5 días antes del 17
        if (fireDate <= now) return;
        PushNotification.localNotificationSchedule({
          id: String(notifId++),
          channelId: CHANNEL_ID,
          title: '📅 Tu declaración trimestral vence pronto',
          message: 'El 17 vence tu declaración trimestral al SAT. Genera tu reporte fiscal en EXPENSIA.',
          date: fireDate,
          allowWhileIdle: true,
        });
      });
    }

    // Recordatorio declaración anual: 31 de marzo (todos los que facturan)
    const annualReminder = new Date(now.getFullYear(), 2, 31, 9, 0, 0);
    if (annualReminder > now) {
      PushNotification.localNotificationSchedule({
        id: String(notifId++),
        channelId: CHANNEL_ID,
        title: '📊 Declaración anual — último mes',
        message: 'Tienes hasta el 30 de abril para presentar tu declaración anual. Exporta tu reporte desde EXPENSIA.',
        date: annualReminder,
        allowWhileIdle: true,
      });
    }
  } catch (e) {
    console.warn('[Notifications] No se pudo agendar recordatorios SAT:', e);
  }
}

/**
 * Fires an immediate local notification when a budget category reaches a threshold.
 * Call this after saving an expense, passing the category, spent amount, and budget limit.
 */
export function notifyBudgetAlert(
  category: string,
  spent: number,
  limit: number,
) {
  try {
    const pct = (spent / limit) * 100;
    if (pct < 80) return;

    const isOver = pct >= 100;
    const pctLabel = isOver ? '100%' : `${Math.round(pct)}%`;

    PushNotification.localNotification({
      channelId: CHANNEL_ID,
      title: isOver
        ? `Presupuesto de ${category} agotado`
        : `Presupuesto de ${category} al ${pctLabel}`,
      message: isOver
        ? `Ya superaste tu presupuesto mensual de ${category}.`
        : `Llevas el ${pctLabel} de tu presupuesto mensual de ${category}.`,
      smallIcon: 'ic_notification',
      allowWhileIdle: true,
    });
  } catch (e) {
    console.warn('[Notifications] No se pudo enviar alerta de presupuesto:', e);
  }
}
