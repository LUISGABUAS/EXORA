import React, { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Avatar } from '../components/Avatar';
import { ScreenContainer } from '../components/ScreenContainer';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/AppNavigator';
import { pickProfilePhoto, takeProfilePhoto } from '../services/fileService';
import { useAuthStore } from '../store/useAuthStore';
import { FiscalRegime, usePremiumStore } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

const REGIMES: Array<{ value: FiscalRegime; icon: string; title: string; desc: string }> = [
  { value: 'resico', icon: 'account-check', title: 'RESICO', desc: 'Régimen Simplificado de Confianza' },
  { value: 'actividad_empresarial', icon: 'briefcase-outline', title: 'Actividad Empresarial', desc: 'Freelancers y profesionistas independientes' },
  { value: 'no_facturo', icon: 'wallet-outline', title: 'No facturo', desc: 'Solo quiero controlar mis gastos' },
];

export function ProfileEditScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const session = useAuthStore(state => state.session);
  const fiscalRegime = usePremiumStore(state => state.fiscalRegime);
  const setFiscalRegime = usePremiumStore(state => state.setFiscalRegime);

  const currentName = session?.user?.user_metadata?.full_name || '';
  const userEmail = session?.user?.email || '';

  const [name, setName] = useState(currentName);
  const [selectedRegime, setSelectedRegime] = useState<FiscalRegime>(fiscalRegime);
  const [rfc, setRfc] = useState(session?.user?.user_metadata?.rfc || '');
  const [saving, setSaving] = useState(false);
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

      {/* Fiscal Regime */}
      <View style={s.field}>
        <Text style={s.label}>Régimen fiscal</Text>
        <View style={s.regimeList}>
          {REGIMES.map(r => (
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
      </View>

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
