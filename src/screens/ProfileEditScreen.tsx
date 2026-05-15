import React, { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Avatar } from '../components/Avatar';
import { ScreenContainer } from '../components/ScreenContainer';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/AppNavigator';
import { parseConstanciaText, readPdfText, validateIsConstancia } from '../services/constanciaService';
import { pickPdfFile, pickProfilePhoto, takeProfilePhoto } from '../services/fileService';
import { useAuthStore } from '../store/useAuthStore';
import { FiscalRegime, usePremiumStore } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
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

  const currentName = session?.user?.user_metadata?.full_name || '';
  const userEmail = session?.user?.email || '';

  const [name, setName] = useState(currentName);
  const [selectedRegime, setSelectedRegime] = useState<FiscalRegime>(fiscalRegime);
  const [rfc, setRfc] = useState(session?.user?.user_metadata?.rfc || '');
  const [razonSocial, setRazonSocial] = useState(storeRazonSocial || '');
  const [saving, setSaving] = useState(false);
  const [showMoreRegimes, setShowMoreRegimes] = useState(
    () => !PRIMARY_REGIMES.some(r => r.value === fiscalRegime),
  );
  const [uploading, setUploading] = useState(false);
  const setAvatarUri = usePremiumStore(state => state.setAvatarUri);

  const handleAvatarPress = () => {
    const options = ['Tomar foto', 'Elegir de galeria', 'Cancelar'];
    const cancelIndex = 2;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex },
        async idx => {
          if (idx === 0) await handleTakePhoto();
          else if (idx === 1) await handlePickPhoto();
        },
      );
    } else {
      Alert.alert('Foto de perfil', 'Elige una opcion', [
        { text: 'Tomar foto', onPress: handleTakePhoto },
        { text: 'Elegir de galeria', onPress: handlePickPhoto },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const result = await takeProfilePhoto();
      if (result) await setAvatarUri(result.uri);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo tomar la foto.');
    }
  };

  const handlePickPhoto = async () => {
    try {
      const result = await pickProfilePhoto();
      if (result) await setAvatarUri(result.uri);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo seleccionar la foto.');
    }
  };

  const handleUploadConstancia = async () => {
    setUploading(true);
    try {
      const file = await pickPdfFile();
      if (!file) {
        setUploading(false);
        return;
      }

      const text = await readPdfText(file.uri);
      if (!text) {
        Alert.alert(
          'No se pudo leer',
          'No se pudo extraer texto del PDF. Ingresa los datos manualmente.',
        );
        setUploading(false);
        return;
      }

      if (!validateIsConstancia(text)) {
        Alert.alert(
          'Documento no válido',
          'El archivo no parece ser una Constancia de Situación Fiscal del SAT.',
        );
        setUploading(false);
        return;
      }

      const parsed = parseConstanciaText(text);
      if (!parsed.success) {
        Alert.alert(
          'Error al procesar',
          parsed.error || 'No se pudieron extraer los datos. Ingresa los datos manualmente.',
        );
        setUploading(false);
        return;
      }

      // Pre-fill fields
      if (parsed.rfc) setRfc(parsed.rfc);
      if (parsed.razonSocial) setRazonSocial(parsed.razonSocial);
      if (parsed.fiscalRegime) {
        setSelectedRegime(parsed.fiscalRegime);
        if (!PRIMARY_REGIMES.some(r => r.value === parsed.fiscalRegime)) {
          setShowMoreRegimes(true);
        }
      }

      const today = new Date().toISOString().slice(0, 10);
      await setFiscalProfile({
        constanciaUri: file.uri,
        constanciaUploadDate: today,
        ...(parsed.razonSocial && { razonSocial: parsed.razonSocial }),
        ...(parsed.fiscalRegime && { fiscalRegime: parsed.fiscalRegime }),
      });

      const details = [
        parsed.rfc && `RFC: ${parsed.rfc}`,
        parsed.razonSocial && `Nombre: ${parsed.razonSocial}`,
        parsed.regimeLabel && `Régimen: ${parsed.regimeLabel}`,
      ].filter(Boolean).join('\n');

      Alert.alert('Constancia procesada', details || 'Datos extraídos correctamente.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Error al procesar el archivo.');
    } finally {
      setUploading(false);
    }
  };

  const handleClearConstancia = () => {
    Alert.alert('Eliminar constancia', '¿Deseas eliminar la constancia cargada?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await clearConstancia();
          setRazonSocial('');
        },
      },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: Record<string, string> = { full_name: name.trim() };
      if (selectedRegime !== 'no_facturo' && rfc.trim()) {
        updateData.rfc = rfc.trim().toUpperCase();
      }
      const { error } = await supabase.auth.updateUser({ data: updateData });
      if (error) {
        Alert.alert('Error', error.message);
        setSaving(false);
        return;
      }
      await setFiscalRegime(selectedRegime);
      Alert.alert('Listo', 'Tu perfil se actualizó correctamente.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar tu perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      {/* Avatar */}
      <View style={s.avatarRow}>
        <Avatar size={72} name={name} showEdit onPress={handleAvatarPress} />
      </View>

      {/* Name */}
      <View style={s.field}>
        <Text style={s.label}>Nombre</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="Tu nombre"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
        />
      </View>

      {/* Email (readonly) */}
      <View style={s.field}>
        <Text style={s.label}>Email</Text>
        <View style={s.readonlyField}>
          <Text style={s.readonlyText}>{userEmail}</Text>
        </View>
      </View>

      {/* Fiscal Regime — Primary */}
      <View style={s.field}>
        <Text style={s.label}>Régimen fiscal</Text>
        <View style={s.regimeList}>
          {PRIMARY_REGIMES.map(r => (
            <Pressable
              key={r.value}
              style={[s.regimeCard, selectedRegime === r.value && s.regimeCardActive]}
              onPress={() => setSelectedRegime(r.value)}
            >
              <Icon
                name={r.icon}
                size={24}
                color={selectedRegime === r.value ? colors.white : colors.primary}
              />
              <View style={s.regimeInfo}>
                <Text style={[s.regimeTitle, selectedRegime === r.value && s.regimeTitleActive]}>
                  {r.title}
                </Text>
                <Text style={[s.regimeDesc, selectedRegime === r.value && s.regimeDescActive]}>
                  {r.desc}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* More regimes toggle */}
        <Pressable
          style={s.moreRegimesButton}
          onPress={() => setShowMoreRegimes(v => !v)}
        >
          <Icon
            name={showMoreRegimes ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.primary}
          />
          <Text style={s.moreRegimesText}>
            {showMoreRegimes ? 'Menos regímenes' : 'Más regímenes'}
          </Text>
        </Pressable>

        {/* Secondary regimes */}
        {showMoreRegimes ? (
          <View style={s.secondaryRow}>
            {SECONDARY_REGIMES.map(r => (
              <Pressable
                key={r.value}
                style={[
                  s.secondaryChip,
                  selectedRegime === r.value && s.secondaryChipActive,
                ]}
                onPress={() => setSelectedRegime(r.value)}
              >
                <Icon
                  name={r.icon}
                  size={16}
                  color={selectedRegime === r.value ? colors.white : colors.text}
                />
                <Text
                  style={[
                    s.secondaryChipText,
                    selectedRegime === r.value && s.secondaryChipTextActive,
                  ]}
                >
                  {r.title}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* Constancia Upload — only if regime != no_facturo */}
      {selectedRegime !== 'no_facturo' ? (
        <View style={s.field}>
          <Text style={s.label}>Constancia de Situación Fiscal</Text>
          {storeConstanciaUri ? (
            <View style={s.constanciaCard}>
              <Icon name="check-circle" size={24} color={colors.primary} />
              <View style={s.constanciaInfo}>
                <Text style={s.constanciaTitle}>Constancia cargada</Text>
                {storeConstanciaDate ? (
                  <Text style={s.constanciaDate}>Subida el {storeConstanciaDate}</Text>
                ) : null}
              </View>
              <Pressable onPress={handleClearConstancia} hitSlop={8}>
                <Icon name="close-circle" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[s.uploadCard, uploading && s.uploadCardDisabled]}
              onPress={handleUploadConstancia}
              disabled={uploading}
            >
              <Icon name="file-pdf-box" size={32} color={colors.primary} />
              <View style={s.uploadInfo}>
                <Text style={s.uploadTitle}>
                  {uploading ? 'Procesando...' : 'Subir PDF del SAT'}
                </Text>
                <Text style={s.uploadHint}>
                  Extrae automáticamente tu RFC y régimen fiscal
                </Text>
              </View>
            </Pressable>
          )}
        </View>
      ) : null}

      {/* Razón Social (readonly if from constancia) */}
      {razonSocial ? (
        <View style={s.field}>
          <Text style={s.label}>Razón Social</Text>
          <View style={s.readonlyField}>
            <Text style={s.readonlyText}>{razonSocial}</Text>
          </View>
        </View>
      ) : null}

      {/* RFC — only if regime != no_facturo */}
      {selectedRegime !== 'no_facturo' ? (
        <View style={s.field}>
          <Text style={s.label}>RFC</Text>
          <TextInput
            style={s.input}
            value={rfc}
            onChangeText={setRfc}
            placeholder="Ej: XAXX010101000"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            maxLength={13}
          />
        </View>
      ) : null}

      {/* Save Button */}
      <Pressable style={[s.saveButton, saving && s.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={s.saveButtonText}>{saving ? 'Guardando...' : 'Guardar'}</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const useStyles = (colors: ColorPalette, _isDark: boolean) =>
  StyleSheet.create({
    avatarRow: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    field: {
      gap: 6,
    },
    label: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      marginLeft: 4,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      fontSize: 16,
      color: colors.text,
    },
    readonlyField: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    readonlyText: {
      color: colors.textMuted,
      fontSize: 16,
    },
    regimeList: {
      gap: 10,
    },
    regimeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    regimeCardActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    regimeInfo: {
      flex: 1,
      gap: 2,
    },
    regimeTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    regimeTitleActive: {
      color: colors.white,
    },
    regimeDesc: {
      color: colors.textMuted,
      fontSize: 12,
    },
    regimeDescActive: {
      color: colors.white,
      opacity: 0.8,
    },
    moreRegimesButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
    },
    moreRegimesText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    secondaryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    secondaryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    secondaryChipActive: {
      backgroundColor: colors.primary,
    },
    secondaryChipText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
    },
    secondaryChipTextActive: {
      color: colors.white,
    },
    uploadCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: colors.primary + '40',
      borderStyle: 'dashed',
      padding: 16,
    },
    uploadCardDisabled: {
      opacity: 0.6,
    },
    uploadInfo: {
      flex: 1,
      gap: 2,
    },
    uploadTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    uploadHint: {
      color: colors.textMuted,
      fontSize: 12,
    },
    constanciaCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.primary + '14',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.primary + '30',
      padding: 16,
    },
    constanciaInfo: {
      flex: 1,
      gap: 2,
    },
    constanciaTitle: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '700',
    },
    constanciaDate: {
      color: colors.textMuted,
      fontSize: 12,
    },
    saveButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '800',
    },
  });
