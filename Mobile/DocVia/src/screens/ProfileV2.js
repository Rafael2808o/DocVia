/* eslint-disable react-hooks/set-state-in-effect */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Bell, BellRing, ChevronRight, CreditCard, FileText, LockKeyhole, Moon, Trash2 } from 'lucide-react-native';
import { billingApi, documentsApi, userApi } from '../services/api';
import { loadNotificationSettings, requestDeviceNotificationPermission, saveNotificationSettings, scheduleDeadlineAlerts } from '../services/notificationSettings';
import { Button, Card, ErrorState, Input, Sheet, Skeleton } from '../components/ui';
import NotificationCenter from '../components/NotificationCenter';
import { colors, common } from '../theme';

function initials(name) {
  return (name || 'Sua conta').trim().charAt(0).toUpperCase();
}

function Stat({ Icon, value, label, color = '#8B80FF' }) {
  return <Card style={styles.stat}><Icon size={17} color={color} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></Card>;
}

function Setting({ Icon, title, description, value, onValueChange, color = '#8B80FF' }) {
  return <Card style={styles.setting}>
    <View style={[styles.settingIcon, { backgroundColor: `${color}19` }]}><Icon size={18} color={color} /></View>
    <View style={styles.settingCopy}><Text style={styles.settingTitle}>{title}</Text><Text style={styles.settingDescription}>{description}</Text></View>
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={title} onPress={() => onValueChange(!value)} style={({ pressed }) => [styles.toggle, value && styles.toggleActive, pressed && styles.togglePressed]}><View style={[styles.toggleThumb, value && styles.toggleThumbActive]} /></Pressable>
  </Card>;
}

function MenuItem({ Icon, title, onPress, destructive = false, color = '#8B80FF' }) {
  const textColor = destructive ? '#FF7E8A' : '#F0F0F5';
  const iconColor = destructive ? '#FF6F7C' : color;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.menuItem, destructive && styles.menuItemDestructive, pressed && styles.menuPressed]}><View style={[styles.menuIcon, { backgroundColor: `${iconColor}19` }]}><Icon size={18} color={iconColor} /></View><Text style={[styles.menuText, { color: textColor }]}>{title}</Text><ChevronRight size={18} color={destructive ? '#9C414C' : '#77798A'} /></Pressable>;
}

export default function ProfileV2({ user, onLogout, navigate }) {
  const [usage, setUsage] = useState();
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [quietMode, setQuietMode] = useState(false);
  const [sheet, setSheet] = useState();
  const [plan, setPlan] = useState();
  const [deletePassword, setDeletePassword] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const [nextUsage, nextDocuments, nextPlan, settings] = await Promise.all([userApi.usage(), documentsApi.list(), billingApi.plan(), loadNotificationSettings()]);
      setUsage(nextUsage);
      setDocuments(nextDocuments);
      setPlan(nextPlan);
      setAlertsEnabled(settings.alertsEnabled);
      setQuietMode(settings.quietMode);
      await scheduleDeadlineAlerts(nextDocuments, settings);
    } catch (nextError) {
      setError(nextError.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deadlineCount = useMemo(() => documents.reduce((total, document) => total + (document.analysis_deadlines?.length || 0), 0), [documents]);

  const saveAlerts = async (nextSettings) => {
    const settings = await saveNotificationSettings(nextSettings);
    await scheduleDeadlineAlerts(documents, settings);
  };

  const changeAlerts = async (nextValue) => {
    if (nextValue) {
      const permission = await requestDeviceNotificationPermission();
      if (!permission.supported) {
        setAlertsEnabled(nextValue);
        await saveAlerts({ alertsEnabled: nextValue, quietMode });
        Alert.alert('Alertas no Expo Go', 'O app funciona normalmente no Expo Go. Os alertas do aparelho serão ativados na versão instalada do DocVia.');
        return;
      }
      if (!permission.granted) {
        Alert.alert('Permissão necessária', 'Ative as notificações do DocVia nas configurações do aparelho.');
        return;
      }
    }
    setAlertsEnabled(nextValue);
    await saveAlerts({ alertsEnabled: nextValue, quietMode });
  };

  const changeQuietMode = async (nextValue) => {
    setQuietMode(nextValue);
    await saveAlerts({ alertsEnabled, quietMode: nextValue });
  };

  const exportData = async () => {
    try {
      const data = await userApi.exportData();
      await Share.share({ title: 'Dados DocVia', message: JSON.stringify(data, null, 2) });
    } catch (nextError) {
      Alert.alert('Não foi possível exportar', nextError.message);
    }
  };

  const deleteAccount = async () => {
    try {
      if (!deletePassword) return Alert.alert('Digite sua senha', 'Informe sua senha atual para excluir a conta.');
      await userApi.deleteAccount(deletePassword);
      setSheet(undefined);
      setDeletePassword('');
      Alert.alert('Conta excluída', 'Todos os dados foram removidos.');
      onLogout();
    } catch (nextError) {
      Alert.alert('Não foi possível excluir', nextError.message);
    }
  };

  if (error && !usage) return <ScrollView style={common.screen}><ErrorState error={error} retry={load} /></ScrollView>;
  if (!usage) return <ScrollView contentContainerStyle={styles.content}><Skeleton height={72} /><Skeleton height={110} /><Skeleton height={90} /></ScrollView>;

  const planName = plan?.plan_details?.name || usage.plan_details?.name || user?.plan || 'Gratuito';

  return (
    <View style={styles.page}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} />}>
      <View style={styles.heading}><View><Text style={styles.title}>Perfil</Text><Text style={styles.subtitle}>Conta, alertas e privacidade</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Abrir notificações" onPress={() => setNotificationsOpen(true)} style={({ pressed }) => [styles.notification, pressed && styles.menuPressed]}><Bell size={19} color="#9A9CAC" strokeWidth={1.8} /></Pressable></View>

      <Card style={styles.userCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(user?.name)}</Text></View>
        <View style={styles.userCopy}><Text style={styles.name}>{user?.name || 'Sua conta'}</Text><Text style={styles.email}>{user?.email}</Text><View style={styles.planBadge}><Text style={styles.planText}>{planName}</Text></View></View>
      </Card>

      <View style={styles.stats}><Stat Icon={FileText} value={documents.length} label="documentos analisados" /><Stat Icon={BellRing} value={deadlineCount} label="prazos monitorados" color="#24D6AF" /></View>

      <Text style={styles.sectionTitle}>Notificações</Text>
      <Setting Icon={BellRing} title="Alertas de prazo" description="Avisos 7, 3 e 1 dia antes do vencimento" value={alertsEnabled} onValueChange={changeAlerts} />
      <Setting Icon={Moon} title="Modo silencioso" description="Sem alertas entre 22h e 7h" value={quietMode} onValueChange={changeQuietMode} />

      <Text style={styles.sectionTitle}>Conta</Text>
      <MenuItem Icon={CreditCard} title="Plano e pagamento" onPress={() => setSheet('plan')} />
      <MenuItem Icon={LockKeyhole} title="Privacidade e dados" onPress={() => setSheet('privacy')} color="#20B9EF" />
      <MenuItem Icon={Trash2} title="Excluir conta" destructive onPress={() => setSheet('delete')} />
      <Pressable accessibilityRole="button" accessibilityLabel="Sair da conta" onPress={onLogout} style={({ pressed }) => [styles.logoutButton, pressed && styles.menuPressed]}><Text style={styles.logoutText}>Sair da conta</Text></Pressable>

      <Sheet visible={sheet === 'plan'} title="Plano e pagamento" onClose={() => setSheet(undefined)}>
        <Text style={styles.sheetText}>Seu plano atual é {planName}. As cobranças e o histórico da assinatura são processados com segurança.</Text>
        <Button title="Fechar" variant="secondary" onPress={() => setSheet(undefined)} />
      </Sheet>
      <Sheet visible={sheet === 'privacy'} title="Privacidade e dados" onClose={() => setSheet(undefined)}>
        <Text style={styles.sheetText}>Você pode exportar todos os dados da sua conta ou registrar seu consentimento de privacidade.</Text>
        <Button title="Exportar meus dados" onPress={exportData} />
        <Button title="Registrar consentimento" variant="secondary" onPress={() => userApi.consent().then(() => Alert.alert('Consentimento registrado')).catch((nextError) => Alert.alert('Erro', nextError.message))} />
      </Sheet>
      <Sheet visible={sheet === 'delete'} title="Excluir conta" onClose={() => setSheet(undefined)}>
        <Text style={styles.deleteWarning}>Esta ação exclui permanentemente seus documentos, análises e dados de conta.</Text>
        <Input label="Senha atual" value={deletePassword} onChangeText={setDeletePassword} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="Digite sua senha" />
        <Button title="Excluir permanentemente" variant="destructive" onPress={deleteAccount} />
        <Button title="Cancelar" variant="secondary" onPress={() => setSheet(undefined)} />
      </Sheet>
      <NotificationCenter visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} documents={documents} onViewDeadlines={() => navigate?.('deadlines')} />
    </ScrollView>
    <View pointerEvents="none" style={styles.navMask} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#020202' }, scroll: { flex: 1 }, content: { paddingHorizontal: 28, paddingTop: 68, paddingBottom: 210 }, navMask: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 112, backgroundColor: '#020202' },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  title: { color: '#F4F4F8', fontSize: 23, fontWeight: '800' }, subtitle: { color: '#818391', fontSize: 12, marginTop: 7 },
  notification: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#292B35', backgroundColor: '#111219', alignItems: 'center', justifyContent: 'center' },
  userCard: { minHeight: 102, flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: 19, borderColor: '#292B35', backgroundColor: '#111219' },
  avatar: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#6439DF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  userCopy: { flex: 1 }, name: { color: '#F4F4F8', fontSize: 16, fontWeight: '800' }, email: { color: '#818391', marginTop: 4, fontSize: 11 },
  planBadge: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: '#171438', borderWidth: 1, borderColor: '#373081', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }, planText: { color: '#C0B8FF', fontSize: 8, fontWeight: '900', letterSpacing: .9, textTransform: 'uppercase' },
  stats: { flexDirection: 'row', gap: 12, marginTop: 20 }, stat: { flex: 1, minHeight: 108, gap: 5, borderRadius: 18, borderColor: '#292B35', backgroundColor: '#111219', padding: 16 }, statValue: { color: '#F4F4F8', fontSize: 24, fontWeight: '900', marginTop: 3 }, statLabel: { color: '#858795', fontSize: 10, lineHeight: 14 },
  sectionTitle: { color: '#898B9B', fontSize: 9, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase', marginTop: 26, marginBottom: 13 },
  setting: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 10, borderRadius: 18, borderColor: '#292B35', backgroundColor: '#111219' }, settingIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }, settingCopy: { flex: 1 }, settingTitle: { color: '#F1F1F6', fontSize: 13, fontWeight: '800' }, settingDescription: { color: '#858795', fontSize: 10, lineHeight: 14, marginTop: 4 }, toggle: { width: 38, height: 22, borderRadius: 11, backgroundColor: '#30313B', padding: 3, justifyContent: 'center' }, toggleActive: { backgroundColor: '#6657F2' }, togglePressed: { opacity: .82 }, toggleThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF' }, toggleThumbActive: { alignSelf: 'flex-end' },
  menuItem: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, marginBottom: 10, borderRadius: 18, borderWidth: 1, borderColor: '#292B35', backgroundColor: '#111219' }, menuItemDestructive: { borderColor: '#54262F', backgroundColor: '#1B1014' }, menuPressed: { opacity: .78, transform: [{ scale: .99 }] }, menuIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }, menuText: { flex: 1, fontSize: 13, fontWeight: '800' },
  logoutButton: { height: 52, borderRadius: 17, borderWidth: 1, borderColor: '#292B35', backgroundColor: '#0C0D12', alignItems: 'center', justifyContent: 'center', marginTop: 9 }, logoutText: { color: '#B0B1BF', fontSize: 13, fontWeight: '700' }, sheetText: { color: '#A2A4B2', fontSize: 13, lineHeight: 20 }, deleteWarning: { color: '#FF8992', fontSize: 13, lineHeight: 20 },
});
