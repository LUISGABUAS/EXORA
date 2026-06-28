import React, { useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Avatar } from '../components/Avatar';
import { ScreenContainer } from '../components/ScreenContainer';
import { supabase, updateProfile } from '../lib/supabase';
import { RootStackParamList } from '../navigation/AppNavigator';
import { parseConstanciaText, readPdfText, validateIsConstancia } from '../services/constanciaService';
import { pickPdfFile, pickProfilePhoto, takeProfilePhoto, uploadAvatarToSupabase } from '../services/fileService';
import { useAuthStore } from '../store/useAuthStore';
import { FiscalRegime, usePremiumStore } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';
import { FISCAL_REGIME_DISPLAY } from '../types/fiscal';

const PRIMARY_REGIMES = FISCAL_REGIME_DISPLAY.filter(r => r.isPrimary);
const SECONDARY_REGIMES = FISCAL_REGIME_DISPLAY.filter(r => !r.isPrimary);

export function ProfileEditScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const session = useAuthStore(state => state.session);
  const fiscalRegime = usePremiumStore(state => state.fiscalRegime);
  const setFiscalRegime = usePremiumStore(state => state.setFiscalRegime);
  const setFiscalProfile = usePremiumStore(state => state.setFiscalProfile);
  const clearConstancia = usePremiumStore(state => state.clearConstancia);
  const storeRazonSocial = usePremiumStore(state => state.razonSocial);
  const storeConstanciaUri = usePremiumStore(state => state.constanciaUri);
  const storeConstanciaDate = usePremiumStore(state => state.constanciaUploadDate);
  const allFiscalRegimes = usePremiumStore(state => state.allFiscalRegimes);
  const actividadEconomica = usePremiumStore(state => state.actividadEconomica);
  const setAvatarUri = usePremiumStore(state => state.setAvatarUri);

  const hasConstancia = !!storeConstanciaUri;
  const currentName = session?.user?.user_metadata?.full_name || '';
  const userEmail = session?.user?.email || '';
  const isRelayEmail = userEmail.endsWith('@privaterelay.appleid.com');

  const [name, setName] = useState(currentName);
  const [selectedRegime, setSelectedRegime] = useState<FiscalRegime>(fiscalRegime);
  const [rfc, setRfc] = useState(session?.user?.user_metadata?.rfc || '');
  const [razonSocial] = useState(storeRazonSocial || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showMoreRegimes, setShowMoreRegimes] = useState(
    () => !PRIMARY_REGIMES.some(r => r.value === fiscalRegime),
  );

  React.useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    const localUri = usePremiumStore.getState().avatarUri;
    if (localUri) return;
    supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single()
      .then(({ data }) => { if (data?.avatar_url) setAvatarUri(data.avatar_url); });
  }, [session?.user?.id]);

  const handleAvatarPress = () => {
    const options = ['Tomar foto', 'Elegir de galería', 'Cancelar'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2 },
        async idx => {
          if (idx === 0) await handleTakePhoto();
          else if (idx === 1) await handlePickPhoto();
        },
      );
    } else {
      Alert.alert('Foto de perfil', 'Elige una opción', [
        { text: 'Tomar foto', onPress: handleTakePhoto },
        { text: 'Elegir de galería', onPress: handlePickPhoto },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
  };

  const saveAvatar = async (result: { uri: string; base64?: string }) => {
    let permanentUri = result.uri;
    try {
      const RNFS = require('react-native-fs').default;
      const destPath = `${RNFS.DocumentDirectoryPath}/profile_avatar.jpg`;
      const srcPath = result.uri.startsWith('file://') ? result.uri.slice(7) : result.uri;
      await RNFS.copyFile(srcPath, destPath);
      permanentUri = `file://${destPath}`;
    } catch {}
    await setAvatarUri(permanentUri);
    const userId = session?.user?.id;
    if (!userId || !result.base64) return;
    try {
      const publicUrl = await uploadAvatarToSupabase(result.base64, userId);
      await setAvatarUri(publicUrl);
      await supabase.from('profiles').upsert({ id: userId, avatar_url: publicUrl });
    } catch {}
  };

  const handleTakePhoto = async () => {
    try {
      const result = await takeProfilePhoto();
      if (result) await saveAvatar(result);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo tomar la foto.');
    }
  };

  const handlePickPhoto = async () => {
    try {
      const result = await pickProfilePhoto();
      if (result) await saveAvatar(result);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo seleccionar la foto.');
    }
  };

  const handleUploadConstancia = async () => {
    setUploading(true);
    try {
      const file = await pickPdfFile();
      if (!file) { setUploading(false); return; }

      const text = await readPdfText(file.uri);
      if (!text) {
        Alert.alert('No se pudo leer', 'No se pudo extraer texto del PDF.');
        setUploading(false);
        return;
      }
      if (!validateIsConstancia(text)) {
        Alert.alert('Documento no válido', 'El archivo no parece ser una Constancia de Situación Fiscal del SAT.');
        setUploading(false);
        return;
      }

      const parsed = parseConstanciaText(text);
      if (!parsed.success) {
        Alert.alert('Error al procesar', parsed.error || 'No se pudieron extraer los datos.');
        setUploading(false);
        return;
      }

      if (parsed.rfc) setRfc(parsed.rfc);
      if (parsed.fiscalRegime) {
        setSelectedRegime(parsed.fiscalRegime);
        if (!PRIMARY_REGIMES.some(r => r.value === parsed.fiscalRegime)) setShowMoreRegimes(true);
      }

      const today = new Date().toISOString().slice(0, 10);
      await setFiscalProfile({
        constanciaUri: file.uri,
        constanciaUploadDate: today,
        ...(parsed.razonSocial && { razonSocial: parsed.razonSocial }),
        ...(parsed.fiscalRegime && { fiscalRegime: parsed.fiscalRegime }),
        ...(parsed.allFiscalRegimes && { allFiscalRegimes: parsed.allFiscalRegimes }),
        ...(parsed.actividadEconomica && { actividadEconomica: parsed.actividadEconomica }),
      });

      Alert.alert(
        '✓ Constancia procesada',
        [
          parsed.rfc && `RFC: ${parsed.rfc}`,
          parsed.razonSocial && `Nombre: ${parsed.razonSocial}`,
          parsed.regimeLabel && `Régimen: ${parsed.regimeLabel}`,
        ].filter(Boolean).join('\n') || 'Datos extraídos correctamente.',
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Error al procesar el archivo.');
    } finally {
      setUploading(false);
    }
  };

  const handleClearConstancia = () => {
    Alert.alert('Eliminar constancia', '¿Deseas eliminar la constancia y los datos fiscales detectados?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await clearConstancia(); } },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const userId = session?.user?.id;
      const rfcClean = rfc.trim().toUpperCase();
      const updateData: Record<string, string> = { full_name: name.trim() };
      if (selectedRegime !== 'no_facturo' && rfcClean) updateData.rfc = rfcClean;

      const { error } = await supabase.auth.updateUser({ data: updateData });
      if (error) { Alert.alert('Error', error.message); return; }

      if (userId) {
        await updateProfile(userId, {
          full_name: name.trim(),
          rfc: rfcClean || undefined,
          razon_social: razonSocial.trim() || undefined,
          fiscal_regime: selectedRegime,
        });
      }

      await setFiscalRegime(selectedRegime);
      Alert.alert('Listo', 'Perfil actualizado.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar tu perfil.');
    } finally {
      setSaving(false);
    }
  };

  const needsFiscalData = selectedRegime !== 'no_facturo';
  const displayRegimes = allFiscalRegimes.length > 0 ? allFiscalRegimes : [selectedRegime];

  return (
    <ScreenContainer>
      {/* Avatar + nombre */}
      <View style={s.topRow}>
        <Avatar size={64} name={name} showEdit onPress={handleAvatarPress} />
        <View style={s.topFields}>
          <TextInput
            style={s.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Tu nombre"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />
          {!isRelayEmail && (
            <Text style={s.emailText} numberOfLines={1}>{userEmail}</Text>
          )}
        </View>
      </View>

      {/* Datos fiscales */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Datos fiscales</Text>

        {hasConstancia ? (
          /* ── Constancia cargada: mostrar datos detectados ── */
          <View style={s.constanciaBox}>
            <View style={s.constanciaHeader}>
              <View style={s.constanciaHeaderLeft}>
                <Icon name="check-circle" size={18} color={colors.primary} />
                <Text style={s.constanciaHeaderTitle}>Constancia del SAT verificada</Text>
              </View>
              <Pressable onPress={handleClearConstancia} hitSlop={10}>
                <Icon name="close-circle-outline" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            {storeConstanciaDate && (
              <Text style={s.constanciaDate}>Subida el {storeConstanciaDate}</Text>
            )}

            {/* Regímenes detectados */}
            <View style={s.detectedRegimes}>
              {displayRegimes.map(r => {
                const d = [...PRIMARY_REGIMES, ...SECONDARY_REGIMES].find(x => x.value === r);
                return (
                  <View key={r} style={s.detectedRegimeRow}>
                    <Icon name={d?.icon ?? 'file-document-outline'} size={16} color={colors.primary} />
                    <Text style={s.detectedRegimeText}>{d?.title ?? r}</Text>
                  </View>
                );
              })}
            </View>

            {/* RFC y Razón Social */}
            {(rfc || razonSocial || actividadEconomica) && (
              <View style={s.fiscalDataRow}>
                {rfc ? (
                  <View style={s.fiscalDataItem}>
                    <Text style={s.fiscalDataLabel}>RFC</Text>
                    <Text style={s.fiscalDataValue}>{rfc}</Text>
                  </View>
                ) : null}
                {razonSocial ? (
                  <View style={s.fiscalDataItem}>
                    <Text style={s.fiscalDataLabel}>Razón social</Text>
                    <Text style={s.fiscalDataValue}>{razonSocial}</Text>
                  </View>
                ) : null}
              </View>
            )}

            <Pressable style={s.changeConstanciaBtn} onPress={handleUploadConstancia} disabled={uploading}>
              <Icon name="file-replace-outline" size={16} color={colors.primary} />
              <Text style={s.changeConstanciaText}>{uploading ? 'Procesando...' : 'Subir nueva constancia'}</Text>
            </Pressable>
          </View>
        ) : (
          /* ── Sin constancia: CSF primero, régimen manual secundario ── */
          <>
            {/* CSF Upload — acción principal */}
            <Pressable
              style={[s.uploadCard, uploading && { opacity: 0.6 }]}
              onPress={handleUploadConstancia}
              disabled={uploading}
            >
              <View style={s.uploadIconWrap}>
                <Icon name="file-pdf-box" size={28} color={colors.primary} />
              </View>
              <View style={s.uploadInfo}>
                <Text style={s.uploadTitle}>
                  {uploading ? 'Procesando...' : 'Subir Constancia del SAT'}
                </Text>
                <Text style={s.uploadHint}>Detecta RFC y régimen automáticamente</Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.primary} />
            </Pressable>

            {/* Separador */}
            <View style={s.orRow}>
              <View style={s.orLine} />
              <Text style={s.orText}>o selecciona manualmente</Text>
              <View style={s.orLine} />
            </View>

            {/* Selector de régimen — compacto */}
            <View style={s.regimeGrid}>
              {PRIMARY_REGIMES.map(r => (
                <Pressable
                  key={r.value}
                  style={[s.regimeChip, selectedRegime === r.value && s.regimeChipActive]}
                  onPress={() => setSelectedRegime(r.value)}
                >
                  <Icon name={r.icon} size={16} color={selectedRegime === r.value ? '#fff' : colors.primary} />
                  <View>
                    <Text style={[s.regimeChipTitle, selectedRegime === r.value && s.regimeChipTitleActive]}>
                      {r.title}
                    </Text>
                    <Text style={[s.regimeChipDesc, selectedRegime === r.value && s.regimeChipDescActive]}>
                      {r.desc}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {/* Más regímenes */}
            <Pressable style={s.moreBtn} onPress={() => setShowMoreRegimes(v => !v)}>
              <Icon name={showMoreRegimes ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
              <Text style={s.moreBtnText}>{showMoreRegimes ? 'Menos regímenes' : 'Más regímenes'}</Text>
            </Pressable>

            {showMoreRegimes && (
              <View style={s.secondaryChips}>
                {SECONDARY_REGIMES.map(r => (
                  <Pressable
                    key={r.value}
                    style={[s.secondaryChip, selectedRegime === r.value && s.secondaryChipActive]}
                    onPress={() => setSelectedRegime(r.value)}
                  >
                    <Icon name={r.icon} size={14} color={selectedRegime === r.value ? '#fff' : colors.textMuted} />
                    <Text style={[s.secondaryChipText, selectedRegime === r.value && s.secondaryChipTextActive]}>
                      {r.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* RFC — solo si el régimen lo requiere */}
            {needsFiscalData && (
              <View style={s.rfcRow}>
                <View style={s.rfcInputWrap}>
                  <Text style={s.rfcLabel}>RFC</Text>
                  <TextInput
                    style={s.rfcInput}
                    value={rfc}
                    onChangeText={setRfc}
                    placeholder="XAXX010101000"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    maxLength={13}
                  />
                </View>
              </View>
            )}
          </>
        )}
      </View>

      {/* Guardar */}
      <Pressable
        style={[s.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={s.saveBtnText}>{saving ? 'Guardando...' : 'Guardar'}</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    // Top
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 4 },
    topFields: { flex: 1, gap: 6 },
    nameInput: {
      backgroundColor: isDark ? '#1A1A1A' : colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      fontFamily: font.semibold,
      color: colors.text,
    },
    emailText: { color: colors.textMuted, fontSize: 13, marginLeft: 4 },

    // Section
    section: { gap: 12 },
    sectionTitle: { color: colors.text, fontSize: 16, fontFamily: font.bold, letterSpacing: -0.2 },

    // Constancia loaded
    constanciaBox: {
      backgroundColor: isDark ? '#0F1A12' : colors.primary + '08',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.primary + '30',
      padding: 16,
      gap: 12,
    },
    constanciaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    constanciaHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    constanciaHeaderTitle: { color: colors.primary, fontSize: 14, fontFamily: font.bold },
    constanciaDate: { color: colors.textMuted, fontSize: 12 },
    detectedRegimes: { gap: 6 },
    detectedRegimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary + '10',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    detectedRegimeText: { color: colors.text, fontSize: 14, fontFamily: font.semibold },
    fiscalDataRow: { gap: 8 },
    fiscalDataItem: { gap: 2 },
    fiscalDataLabel: { color: colors.textMuted, fontSize: 11, fontFamily: font.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
    fiscalDataValue: { color: colors.text, fontSize: 15, fontFamily: font.semibold },
    changeConstanciaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingVertical: 6,
    },
    changeConstanciaText: { color: colors.primary, fontSize: 13, fontFamily: font.semibold },

    // Upload
    uploadCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: isDark ? '#111111' : colors.surface,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.primary + '40',
      borderStyle: 'dashed',
      padding: 16,
    },
    uploadIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.primary + '14',
      alignItems: 'center',
      justifyContent: 'center',
    },
    uploadInfo: { flex: 1, gap: 3 },
    uploadTitle: { color: colors.text, fontSize: 15, fontFamily: font.bold },
    uploadHint: { color: colors.textMuted, fontSize: 12 },

    // Or separator
    orRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    orText: { color: colors.textMuted, fontSize: 12, fontFamily: font.medium },

    // Regime grid
    regimeGrid: { gap: 8 },
    regimeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: isDark ? '#111111' : colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    regimeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    regimeChipTitle: { color: colors.text, fontSize: 14, fontFamily: font.bold },
    regimeChipTitleActive: { color: '#fff' },
    regimeChipDesc: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
    regimeChipDescActive: { color: 'rgba(255,255,255,0.75)' },

    // More button
    moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
    moreBtnText: { color: colors.primary, fontSize: 13, fontFamily: font.semibold },

    // Secondary chips
    secondaryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    secondaryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? '#1A1A1A' : colors.surfaceAlt,
      borderRadius: 10,
      paddingVertical: 9,
      paddingHorizontal: 12,
    },
    secondaryChipActive: { backgroundColor: colors.primary },
    secondaryChipText: { color: colors.textMuted, fontSize: 13, fontFamily: font.medium },
    secondaryChipTextActive: { color: '#fff', fontFamily: font.semibold },

    // RFC
    rfcRow: { marginTop: 4 },
    rfcInputWrap: { gap: 6 },
    rfcLabel: { color: colors.textMuted, fontSize: 12, fontFamily: font.semibold, textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 4 },
    rfcInput: {
      backgroundColor: isDark ? '#111111' : colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 16,
      fontFamily: font.semibold,
      color: colors.text,
      letterSpacing: 1,
    },

    // Save
    saveBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
    },
    saveBtnText: { color: '#fff', fontSize: 16, fontFamily: font.extrabold },
  });
