import PushNotification from 'react-native-push-notification';
import { Platform } from 'react-native';
import { FiscalRegime } from '../store/usePremiumStore';

const CHANNEL_ID = 'exora-reminders';

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

export function scheduleDailyReminder(hour = 20) {
  try {
    PushNotification.cancelLocalNotification('1');

    const now = new Date();
    const fireDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
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

export function scheduleStreakReminder(streak: number) {
  try {
    PushNotification.cancelLocalNotification('60');
    if (streak <= 0) return;

    const now = new Date();
    const fireDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      19, 0, 0,
    );

    const messages = [
      `🔥 Llevas ${streak} días seguidos — no lo rompas hoy.`,
      `🔥 Racha de ${streak} días. Abre EXORA para mantenerla viva.`,
      `¡${streak} días de racha! No dejes que se rompa hoy 💪`,
      `Tu racha de ${streak} días te espera. Abre EXORA y sigue cuidando tu dinero.`,
    ];
    const message = messages[streak % messages.length];

    PushNotification.localNotificationSchedule({
      id: '60',
      channelId: CHANNEL_ID,
      title: 'No pierdas tu racha',
      message,
      date: fireDate,
      repeatType: 'day',
      allowWhileIdle: true,
    });
  } catch (e) {
    console.warn('[Notifications] No se pudo agendar recordatorio de racha:', e);
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
        const fireDate = new Date(
          now.getFullYear(),
          now.getMonth() + monthOffset,
          15,
          9,
          0,
          0,
        );
        if (fireDate <= now) continue;
        PushNotification.localNotificationSchedule({
          id: String(notifId++),
          channelId: CHANNEL_ID,
          title: '📅 Tu pago al SAT vence en 2 días',
          message:
            'El 17 vence tu pago mensual. Revisa tus deducciones en EXORA antes de declarar.',
          date: fireDate,
          allowWhileIdle: true,
        });
      }
    }

    if (QUARTERLY_REGIMES.includes(regime)) {
      // Recordatorio trimestral: 5 días antes del 17 de abril, julio, octubre y enero
      QUARTERLY_MONTHS.forEach(month => {
        const year =
          month === 0 && now.getMonth() > 0
            ? now.getFullYear() + 1
            : now.getFullYear();
        const fireDate = new Date(year, month, 12, 9, 0, 0); // día 12 = 5 días antes del 17
        if (fireDate <= now) return;
        PushNotification.localNotificationSchedule({
          id: String(notifId++),
          channelId: CHANNEL_ID,
          title: '📅 Tu declaración trimestral vence pronto',
          message:
            'El 17 vence tu declaración trimestral al SAT. Genera tu reporte fiscal en EXORA.',
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
        message:
          'Tienes hasta el 30 de abril para presentar tu declaración anual. Exporta tu reporte desde EXORA.',
        date: annualReminder,
        allowWhileIdle: true,
      });
    }
  } catch (e) {
    console.warn('[Notifications] No se pudo agendar recordatorios SAT:', e);
  }
}

/**
 * Schedules trial expiry notifications at day 5, 6 and 7.
 * Call once when onboarding completes and trialEndsAt is set.
 */
export function scheduleTrialReminders(trialEndsAt: string) {
  try {
    PushNotification.cancelLocalNotification('50');
    PushNotification.cancelLocalNotification('51');
    PushNotification.cancelLocalNotification('52');

    const end = new Date(trialEndsAt + 'T09:00:00');

    // Day 5 → 2 days left
    const day5 = new Date(end);
    day5.setDate(day5.getDate() - 2);
    if (day5 > new Date()) {
      PushNotification.localNotificationSchedule({
        id: '50',
        channelId: CHANNEL_ID,
        title: '⏳ Te quedan 2 días de Exora Pro',
        message:
          'Sigue escaneando tickets y generando reportes fiscales sin límite. Suscríbete antes de que termine.',
        date: day5,
        allowWhileIdle: true,
      });
    }

    // Day 6 → 1 day left
    const day6 = new Date(end);
    day6.setDate(day6.getDate() - 1);
    if (day6 > new Date()) {
      PushNotification.localNotificationSchedule({
        id: '51',
        channelId: CHANNEL_ID,
        title: '🔔 Mañana termina tu prueba gratuita',
        message:
          'Activa Pro hoy y no pierdas acceso a tus reportes fiscales, escaneos ilimitados e insights de IA.',
        date: day6,
        allowWhileIdle: true,
      });
    }

    // Day 7 → trial expired
    if (end > new Date()) {
      PushNotification.localNotificationSchedule({
        id: '52',
        channelId: CHANNEL_ID,
        title: '🎯 Tu prueba de Exora Pro terminó',
        message:
          'Suscríbete para seguir con escaneos ilimitados, reportes fiscales y deducciones automáticas.',
        date: end,
        allowWhileIdle: true,
      });
    }
  } catch (e) {
    console.warn(
      '[Notifications] No se pudieron agendar recordatorios de trial:',
      e,
    );
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
