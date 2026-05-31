import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform } from 'react-native';

const RATING_COUNT_KEY = '@expensia_expense_count_for_rating';
const RATING_SHOWN_KEY = '@expensia_rating_shown';
const THRESHOLD = 7;

// IDs de las tiendas (reemplazar cuando se publique la app)
const APP_STORE_ID = 'PLACEHOLDER_APP_STORE_ID';
const PLAY_STORE_ID = 'com.smartexpensemx2';

function buildStoreUrl(): string {
  if (Platform.OS === 'ios') {
    return `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
  }
  return `https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}&showAllReviews=true`;
}

async function openStore(): Promise<void> {
  const url = buildStoreUrl();
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  }
}

function showRatingAlert(): void {
  Alert.alert(
    '¿Te está siendo útil Expensia?',
    'Nos ayudaría mucho si nos dejas una reseña en la tienda. ¡Solo toma un momento!',
    [
      {
        text: 'Ahora no',
        style: 'cancel',
      },
      {
        text: '¡Claro que sí!',
        onPress: () => {
          openStore().catch(() => {});
        },
      },
    ],
    { cancelable: true },
  );
}

/**
 * Llama esta función cada vez que el usuario agrega un gasto.
 * Muestra el prompt de calificación después del 7mo gasto, una sola vez.
 */
export async function trackExpenseForRating(): Promise<void> {
  try {
    // Si ya se mostró el prompt, no hacer nada
    const alreadyShown = await AsyncStorage.getItem(RATING_SHOWN_KEY);
    if (alreadyShown === 'true') return;

    // Incrementar el contador
    const raw = await AsyncStorage.getItem(RATING_COUNT_KEY);
    const currentCount = raw !== null ? parseInt(raw, 10) : 0;
    const newCount = currentCount + 1;

    await AsyncStorage.setItem(RATING_COUNT_KEY, String(newCount));

    // Mostrar prompt al llegar al umbral
    if (newCount >= THRESHOLD) {
      await AsyncStorage.setItem(RATING_SHOWN_KEY, 'true');
      // Pequeño delay para no interrumpir la animación de guardado
      setTimeout(() => {
        showRatingAlert();
      }, 1500);
    }
  } catch {
    // Ignorar errores de AsyncStorage — no es crítico
  }
}

/**
 * Resetea el estado del rating (útil para testing o si el usuario
 * reinstala la app y quiere volver a ver el prompt).
 */
export async function resetRatingState(): Promise<void> {
  await AsyncStorage.multiRemove([RATING_COUNT_KEY, RATING_SHOWN_KEY]);
}
