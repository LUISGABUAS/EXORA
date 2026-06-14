import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import RNFS from 'react-native-fs';
import { PaywallModal } from '../components/PaywallModal';
import { ScreenContainer } from '../components/ScreenContainer';
import {
  CFDIRecord,
  FiscalAlert,
  FiscalScore,
  getCFDIsConProblemas,
  getCFDIsEstesMes,
  getFiscalScore,
  getAlertasAbiertas,
  labelEstado,
  labelRisk,
  labelTipoComprobante,
  resolverAlerta,
  uploadCFDI,
} from '../services/fiscalRiskService';
import { pickXMLFile } from '../services/fileService';
import { useAuthStore } from '../store/useAuthStore';
import { usePremiumStore } from '../store/usePremiumStore';
import { useTheme } from '../theme/ThemeContext';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';

// Estilos de texto inline (sin depender del export 'type' reservado)
const TX = {
  h3:      { fontFamily: font.bold,     fontSize: 22, letterSpacing: -0.3 } as TextStyle,
  h4:      { fontFamily: font.bold,     fontSize: 18, letterSpacing: -0.2 } as TextStyle,
  title:   { fontFamily: font.semibold, fontSize: 16 } as TextStyle,
  body:    { fontFamily: font.regular,  fontSize: 15, lineHeight: 22 } as TextStyle,
  caption: { fontFamily: font.medium,   fontSize: 13 } as TextStyle,
  small:   { fontFamily: font.medium,   fontSize: 11 } as TextStyle,
};
import { formatCurrency } from '../utils/format';

// ── Constantes ────────────────────────────────────────────────────────────────

const FREE_LIMIT = 3; // CFDIs por mes en plan gratuito

// ── Componente principal ──────────────────────────────────────────────────────

export function MisFacturasScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const session = useAuthStore(state => state.session);
  const hasFullAccess = usePremiumStore(state => state.hasFullAccess);
  const rfc = usePremiumStore(state => state.razonSocial);
  const isPremium = hasFullAccess();

  const [tab, setTab] = useState<'alertas' | 'facturas'>('alertas');
  const [alertas, setAlertas] = useState<FiscalAlert[]>([]);
  const [cfdis, setCfdis] = useState<CFDIRecord[]>([]);
  const [fiscalScore, setFiscalScore] = useState<FiscalScore | null>(null);
  const [cfdisEstesMes, setCfdisEstesMes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const userId = session?.user?.id;
  const authToken = session?.access_token;

  // ── Cargar datos ────────────────────────────────────────────────────────────

  const cargarDatos = useCallback(async () => {
    if (!userId) return;
    try {
      const [score, alertasData, cfdisData, mesCount] = await Promise.all([
        getFiscalScore(userId),
        getAlertasAbiertas(userId),
        getCFDIsConProblemas(userId),
        getCFDIsEstesMes(userId),
      ]);
      setFiscalScore(score);
      setAlertas(alertasData);
      setCfdis(cfdisData);
      setCfdisEstesMes(mesCount);
    } catch {
      // silencioso — puede que aún no haya tablas si no se aplicó la migración
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const onRefresh = () => { setRefreshing(true); cargarDatos(); };

  // ── Subir XML ───────────────────────────────────────────────────────────────

  const handleSubirXML = async () => {
    if (!authToken || !userId) return;

    // Verificar límite free antes de abrir el picker
    if (!isPremium && cfdisEstesMes >= FREE_LIMIT) {
      setPaywallVisible(true);
      return;
    }

    try {
      const file = await pickXMLFile();
      if (!file) return;

      setUploading(true);

      // Leer contenido del XML
      const xmlString = await RNFS.readFile(file.uri, 'utf8');

      const result = await uploadCFDI(xmlString, rfc ?? '', isPremium, authToken);

      if (result.limite_alcanzado) {
        setPaywallVisible(true);
        return;
      }

      if (!result.success) {
        Alert.alert(
          'No se pudo procesar',
          result.error ?? 'Verifica que el archivo sea una factura XML válida.',
        );
        return;
      }

      // Mostrar resultado al usuario
      const alertas_count = result.alertas_count ?? 0;
      const score = result.score;

      if (alertas_count === 0) {
        Alert.alert('¡Factura guardada! ✅', 'Tu factura está en orden y fue guardada correctamente.');
      } else {
        Alert.alert(
          score?.color === 'red' ? 'Esta factura tiene un problema 🔴' : 'Revisa esta factura 🟡',
          result.errors?.[0]?.que_hacer ?? 'Ve a la sección de alertas para ver los detalles.',
        );
      }

      // Recargar datos
      await cargarDatos();
      setCfdisEstesMes(prev => prev + 1);
    } catch (err: unknown) {
      const e = err as { message?: string };
      if (e?.message?.includes('cancel') || e?.message?.includes('Cancel')) return;
      Alert.alert('Error', 'No se pudo leer el archivo. Verifica que sea un XML válido.');
    } finally {
      setUploading(false);
    }
  };

  // ── Resolver alerta ─────────────────────────────────────────────────────────

  const handleResolverAlerta = async (alertaId: string) => {
    try {
      await resolverAlerta(alertaId);
      setAlertas(prev => prev.filter(a => a.id !== alertaId));
      if (fiscalScore) {
        setFiscalScore(prev => prev
          ? { ...prev, excepciones_abiertas: Math.max(0, prev.excepciones_abiertas - 1) }
          : prev,
        );
      }
    } catch {
      Alert.alert('Error', 'No se pudo marcar como resuelta.');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <ScreenContainer>
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* ── Header con score ─────────────────────────────────────────────── */}
        <View style={s.header}>
          <Text style={s.titulo}>Mis Facturas</Text>
          {fiscalScore && (
            <View style={[s.scoreBadge, { backgroundColor: scoreBgColor(fiscalScore.color, isDark) }]}>
              <Text style={[s.scoreLabel, { color: scoreTextColor(fiscalScore.color) }]}>
                {fiscalScore.label}
              </Text>
            </View>
          )}
        </View>

        {/* ── Banner de límite free ─────────────────────────────────────────── */}
        {!isPremium && (
          <View style={s.freeBanner}>
            <Icon name="information-outline" size={16} color={colors.primary} />
            <Text style={s.freeBannerText}>
              Plan gratuito: {cfdisEstesMes}/{FREE_LIMIT} facturas este mes.{' '}
              {cfdisEstesMes >= FREE_LIMIT && (
                <Text style={s.upgradeLink} onPress={() => setPaywallVisible(true)}>
                  Actualizar a Premium
                </Text>
              )}
            </Text>
          </View>
        )}

        {/* ── Botón subir XML ───────────────────────────────────────────────── */}
        <Pressable
          style={({ pressed }) => [s.uploadBtn, pressed && s.uploadBtnPressed]}
          onPress={handleSubirXML}
          disabled={uploading}
        >
          {uploading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Icon name="file-plus-outline" size={20} color="#fff" />}
          <Text style={s.uploadBtnText}>
            {uploading ? 'Revisando tu factura…' : 'Tengo una factura nueva'}
          </Text>
        </Pressable>

        {/* ── Hint de ayuda ────────────────────────────────────────────────── */}
        <View style={s.hintRow}>
          <Icon name="information-outline" size={14} color={colors.textMuted} />
          <Text style={s.hintText}>
            Busca el archivo .xml que te llegó por correo o descárgalo del portal de tu proveedor.
          </Text>
        </View>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <View style={s.tabs}>
          <Pressable
            style={[s.tab, tab === 'alertas' && s.tabActive]}
            onPress={() => setTab('alertas')}
          >
            <Text style={[s.tabText, tab === 'alertas' && s.tabTextActive]}>
              Alertas{alertas.length > 0 ? ` (${alertas.length})` : ''}
            </Text>
          </Pressable>
          <Pressable
            style={[s.tab, tab === 'facturas' && s.tabActive]}
            onPress={() => setTab('facturas')}
          >
            <Text style={[s.tabText, tab === 'facturas' && s.tabTextActive]}>
              Con problemas{cfdis.length > 0 ? ` (${cfdis.length})` : ''}
            </Text>
          </Pressable>
        </View>

        {/* ── Contenido según tab ───────────────────────────────────────────── */}
        {tab === 'alertas' ? (
          <AlertasTab
            alertas={alertas}
            isPremium={isPremium}
            onResolver={handleResolverAlerta}
            onUpgrade={() => setPaywallVisible(true)}
            colors={colors}
            isDark={isDark}
            s={s}
          />
        ) : (
          <FacturasTab
            cfdis={cfdis}
            isPremium={isPremium}
            onUpgrade={() => setPaywallVisible(true)}
            colors={colors}
            isDark={isDark}
            s={s}
          />
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />
    </ScreenContainer>
  );
}

// ── Sub-componente: Tab de Alertas ────────────────────────────────────────────

function AlertasTab({
  alertas, isPremium, onResolver, onUpgrade, colors, isDark, s,
}: {
  alertas: FiscalAlert[];
  isPremium: boolean;
  onResolver: (id: string) => void;
  onUpgrade: () => void;
  colors: ColorPalette;
  isDark: boolean;
  s: ReturnType<typeof useStyles>;
}) {
  // Free users: solo ven alertas críticas
  const alertasVisibles = isPremium
    ? alertas
    : alertas.filter(a => a.nivel === 'critical' || a.nivel === 'error');

  const alertasOcultas = isPremium ? 0 : alertas.filter(a => a.nivel === 'warning' || a.nivel === 'info').length;

  if (alertasVisibles.length === 0 && alertasOcultas === 0) {
    return (
      <View style={s.emptyState}>
        <Text style={s.emptyEmoji}>✅</Text>
        <Text style={s.emptyTitle}>¡Todo está en orden!</Text>
        <Text style={s.emptyDesc}>No hay nada que revisar en tus facturas.</Text>
      </View>
    );
  }

  return (
    <View>
      {alertasVisibles.map(alerta => (
        <AlertaCard
          key={alerta.id}
          alerta={alerta}
          onResolver={onResolver}
          colors={colors}
          isDark={isDark}
          s={s}
        />
      ))}

      {/* Teaser para free: alertas bloqueadas */}
      {!isPremium && alertasOcultas > 0 && (
        <View style={s.lockedCard}>
          <View style={s.lockedCardContent}>
            <Icon name="lock-outline" size={28} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.lockedCardTitle}>
                {alertasOcultas} {alertasOcultas === 1 ? 'aviso más' : 'avisos más'} en Premium
              </Text>
              <Text style={s.lockedCardDesc}>
                Actualiza para ver avisos de facturas con montos grandes y detalles de coherencia fiscal.
              </Text>
            </View>
          </View>
          <Pressable style={s.lockedCardBtn} onPress={onUpgrade}>
            <Text style={s.lockedCardBtnText}>Ver todo con Premium</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── Sub-componente: Card de alerta ────────────────────────────────────────────

function AlertaCard({
  alerta, onResolver, colors, isDark, s,
}: {
  alerta: FiscalAlert;
  onResolver: (id: string) => void;
  colors: ColorPalette;
  isDark: boolean;
  s: ReturnType<typeof useStyles>;
}) {
  const nivelColor = nivelToColor(alerta.nivel);
  const nivelIcon = nivelToIcon(alerta.nivel);

  return (
    <View style={[s.alertaCard, { borderLeftColor: nivelColor }]}>
      <View style={s.alertaHeader}>
        <Icon name={nivelIcon} size={20} color={nivelColor} />
        <Text style={s.alertaTitulo}>{alerta.titulo}</Text>
      </View>
      <Text style={s.alertaDesc}>{alerta.descripcion}</Text>
      {alerta.que_hacer ? (
        <Text style={s.alertaQueHacer}>👉 {alerta.que_hacer}</Text>
      ) : null}
      <Pressable style={s.resolverBtn} onPress={() => onResolver(alerta.id)}>
        <Text style={s.resolverBtnText}>Ya lo resolví</Text>
      </Pressable>
    </View>
  );
}

// ── Sub-componente: Tab de Facturas con problemas ──────────────────────────────

function FacturasTab({
  cfdis, isPremium, onUpgrade, colors, isDark, s,
}: {
  cfdis: CFDIRecord[];
  isPremium: boolean;
  onUpgrade: () => void;
  colors: ColorPalette;
  isDark: boolean;
  s: ReturnType<typeof useStyles>;
}) {
  // Free: solo muestra máximo 1 como preview
  const cfdisVisibles = isPremium ? cfdis : cfdis.slice(0, 1);
  const cfdisOcultos = isPremium ? 0 : Math.max(0, cfdis.length - 1);

  if (cfdis.length === 0) {
    return (
      <View style={s.emptyState}>
        <Text style={s.emptyEmoji}>📋</Text>
        <Text style={s.emptyTitle}>Sin problemas encontrados</Text>
        <Text style={s.emptyDesc}>
          Tus facturas no tienen inconsistencias.{'\n'}Sube más facturas para seguir revisando.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {cfdisVisibles.map(cfdi => (
        <CFDICard key={cfdi.id} cfdi={cfdi} colors={colors} isDark={isDark} s={s} />
      ))}

      {!isPremium && cfdisOcultos > 0 && (
        <View style={s.lockedCard}>
          <View style={s.lockedCardContent}>
            <Icon name="lock-outline" size={28} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.lockedCardTitle}>
                {cfdisOcultos} {cfdisOcultos === 1 ? 'factura más' : 'facturas más'} con detalles
              </Text>
              <Text style={s.lockedCardDesc}>
                Con Premium ves el análisis completo de riesgo de cada factura.
              </Text>
            </View>
          </View>
          <Pressable style={s.lockedCardBtn} onPress={onUpgrade}>
            <Text style={s.lockedCardBtnText}>Desbloquear análisis completo</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── Sub-componente: Card de CFDI ──────────────────────────────────────────────

function CFDICard({
  cfdi, colors, isDark, s,
}: {
  cfdi: CFDIRecord;
  colors: ColorPalette;
  isDark: boolean;
  s: ReturnType<typeof useStyles>;
}) {
  const riskInfo = labelRisk(cfdi.risk_level);
  const estadoInfo = labelEstado(cfdi.estado);
  const tipo = labelTipoComprobante(cfdi.tipo_comprobante);

  return (
    <View style={s.cfdiCard}>
      <View style={s.cfdiHeader}>
        <Text style={s.cfdiEmisora}>
          {cfdi.nombre_emisor || cfdi.rfc_emisor || 'Emisor desconocido'}
        </Text>
        <View style={[s.riskBadge, { backgroundColor: riskInfo.color + '22' }]}>
          <Text style={[s.riskBadgeText, { color: riskInfo.color }]}>
            {riskInfo.emoji} {riskInfo.texto}
          </Text>
        </View>
      </View>
      <View style={s.cfdiMeta}>
        <Text style={s.cfdiMonto}>{formatCurrency(cfdi.total)}</Text>
        <Text style={s.cfdiTipo}>{tipo}</Text>
      </View>
      <View style={s.cfdiFooter}>
        <Text style={s.cfdiDate}>{formatDate(cfdi.fecha)}</Text>
        <View style={[s.estadoBadge, { backgroundColor: estadoInfo.color + '22' }]}>
          <Text style={[s.estadoBadgeText, { color: estadoInfo.color }]}>
            {estadoInfo.texto}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function nivelToColor(nivel: string): string {
  if (nivel === 'critical') return '#EF4444';
  if (nivel === 'error')    return '#F97316';
  if (nivel === 'warning')  return '#F59E0B';
  return '#22C55E';
}

function nivelToIcon(nivel: string): string {
  if (nivel === 'critical') return 'alert-circle';
  if (nivel === 'error')    return 'alert';
  if (nivel === 'warning')  return 'alert-circle-outline';
  return 'information-outline';
}

function scoreBgColor(color: string, isDark: boolean): string {
  if (color === 'red')    return isDark ? '#EF444420' : '#FEE2E2';
  if (color === 'yellow') return isDark ? '#F59E0B20' : '#FEF3C7';
  return isDark ? '#22C55E20' : '#DCFCE7';
}

function scoreTextColor(color: string): string {
  if (color === 'red')    return '#EF4444';
  if (color === 'yellow') return '#D97706';
  return '#16A34A';
}

// ── Estilos ───────────────────────────────────────────────────────────────────

function useStyles(colors: ColorPalette, isDark: boolean) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    titulo: { ...(TX.h3 as TextStyle), color: colors.text },
    scoreBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    scoreLabel: { ...TX.caption as TextStyle, fontWeight: '700' },
    freeBanner: { marginHorizontal: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 10, padding: 12 },
    freeBannerText: { ...(TX.caption as TextStyle), color: colors.textSecondary, flex: 1 },
    upgradeLink: { color: colors.primary, fontWeight: '700' },
    uploadBtn: { marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.primary, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
    uploadBtnPressed: { opacity: 0.8 },
    uploadBtnText: { ...(TX.title as TextStyle), color: '#fff' },
    tabs: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 12, padding: 4, marginBottom: 16 },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
    tabActive: { backgroundColor: colors.primary },
    tabText: { ...(TX.caption as TextStyle), color: colors.textSecondary, fontWeight: '600' },
    tabTextActive: { color: '#fff' },
    emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyTitle: { ...(TX.h4 as TextStyle), color: colors.text, textAlign: 'center', marginBottom: 8 },
    emptyDesc: { ...(TX.body as TextStyle), color: colors.textSecondary, textAlign: 'center' },
    alertaCard: { marginHorizontal: 20, marginBottom: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderLeftWidth: 4 },
    alertaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    alertaTitulo: { ...(TX.title as TextStyle), color: colors.text, flex: 1 },
    alertaDesc: { ...(TX.body as TextStyle), color: colors.textSecondary, marginBottom: 8 },
    alertaQueHacer: { ...(TX.caption as TextStyle), color: colors.text, backgroundColor: colors.primary + '15', borderRadius: 8, padding: 10, marginBottom: 12 },
    resolverBtn: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.primary },
    resolverBtnText: { ...(TX.caption as TextStyle), color: colors.primary, fontWeight: '700' },
    cfdiCard: { marginHorizontal: 20, marginBottom: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 16 },
    cfdiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cfdiEmisora: { ...(TX.title as TextStyle), color: colors.text, flex: 1, marginRight: 8 },
    riskBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    riskBadgeText: { ...(TX.small as TextStyle), fontWeight: '700' },
    cfdiMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    cfdiMonto: { ...(TX.h4 as TextStyle), color: colors.text },
    cfdiTipo: { ...(TX.caption as TextStyle), color: colors.textSecondary },
    cfdiFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cfdiDate: { ...(TX.small as TextStyle), color: colors.textSecondary },
    estadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    estadoBadgeText: { ...(TX.small as TextStyle), fontWeight: '700' },
    lockedCard: { marginHorizontal: 20, marginBottom: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.primary + '40', borderStyle: 'dashed' },
    lockedCardContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    lockedCardTitle: { ...(TX.title as TextStyle), color: colors.text, marginBottom: 4 },
    lockedCardDesc: { ...(TX.caption as TextStyle), color: colors.textSecondary },
    lockedCardBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    lockedCardBtnText: { ...(TX.caption as TextStyle), color: '#fff', fontWeight: '700' },
    hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginHorizontal: 20, marginBottom: 16, marginTop: -4 },
    hintText: { ...(TX.small as TextStyle), color: colors.textMuted, flex: 1, lineHeight: 16 },
  });
}
