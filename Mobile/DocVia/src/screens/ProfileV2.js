/* eslint-disable react-hooks/set-state-in-effect */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { BellRing, ChevronRight, CreditCard, FileText, LockKeyhole, Moon, Trash2 } from 'lucide-react-native';
import { billingApi, documentsApi, userApi } from '../services/api';
import { Button, Card, ErrorState, Input, Sheet, Skeleton } from '../components/ui';
import { colors, common, spacing } from '../theme';

function initials(name) {
  return (name || 'Sua conta').split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function Stat({ Icon, value, label }) {
  return <Card style={styles.stat}><Icon size={17} color={colors.success} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></Card>;
}

function Setting({ Icon, title, description, value, onValueChange }) {
  return <Card style={styles.setting}><View style={styles.settingIcon}><Icon size={19} color={colors.success} /></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>{title}</Text><Text style={styles.settingDescription}>{description}</Text></View><Switch value={value} onValueChange={onValueChange} trackColor={{ false: colors.surfaceRaised, true: colors.success }} thumbColor={colors.white} /> </Card>;
}

function MenuItem({ Icon, title, onPress, destructive = false }) {
  const color = destructive ? colors.error : colors.text;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && styles.menuPressed]}><View style={styles.menuIcon}><Icon size={19} color={color} /></View><Text style={[styles.menuText, { color }]}>{title}</Text><ChevronRight size={19} color={colors.tertiary} /></Pressable>;
}

export default function ProfileV2({ user, onLogout }) {
  const [usage, setUsage] = useState();
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [quietMode, setQuietMode] = useState(false);
  const [sheet, setSheet] = useState();
  const [plan, setPlan] = useState();
  const [deletePassword, setDeletePassword] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [nextUsage, nextDocuments, nextPlan] = await Promise.all([userApi.usage(), documentsApi.list(), billingApi.plan()]);
      setUsage(nextUsage);
      setDocuments(nextDocuments);
      setPlan(nextPlan);
    } catch (nextError) {
      setError(nextError.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deadlineCount = useMemo(() => documents.reduce((total, document) => total + (document.analysis_deadlines?.length || 0), 0), [documents]);

  const changeAlerts = async (nextValue) => {
    if (nextValue) {
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão necessária', 'Ative as notificações do DocVia nas configurações do aparelho.');
        return;
      }
    }
    setAlertsEnabled(nextValue);
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
    <ScrollView style={common.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} />}>
      <View style={styles.heading}><View><Text style={common.title}>Perfil</Text><Text style={common.subtitle}>Conta, alertas e privacidade</Text></View><View style={styles.notification}><BellRing size={20} color={colors.muted} /></View></View>

      <Card style={styles.userCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(user?.name)}</Text></View>
        <View style={styles.userCopy}><Text style={styles.name}>{user?.name || 'Sua conta'}</Text><Text style={styles.email}>{user?.email}</Text><View style={styles.planBadge}><Text style={styles.planText}>{planName}</Text></View></View>
      </Card>

      <View style={styles.stats}><Stat Icon={FileText} value={documents.length} label="documentos analisados" /><Stat Icon={BellRing} value={deadlineCount} label="prazos monitorados" /></View>

      <Text style={styles.sectionTitle}>Notificações</Text>
      <Setting Icon={BellRing} title="Alertas de prazo" description="Avisos 7, 3 e 1 dia antes do vencimento" value={alertsEnabled} onValueChange={changeAlerts} />
      <Setting Icon={Moon} title="Modo silencioso" description="Sem alertas entre 22h e 7h" value={quietMode} onValueChange={setQuietMode} />

      <Text style={styles.sectionTitle}>Conta</Text>
      <MenuItem Icon={CreditCard} title="Plano e pagamento" onPress={() => setSheet('plan')} />
      <MenuItem Icon={LockKeyhole} title="Privacidade e dados" onPress={() => setSheet('privacy')} />
      <MenuItem Icon={Trash2} title="Excluir conta" destructive onPress={() => setSheet('delete')} />
      <Button title="Sair da conta" variant="destructive" onPress={onLogout} accessibilityLabel="Sair da conta" />

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 130, gap: spacing.md },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  notification: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.background, fontSize: 18, fontWeight: '800' },
  userCopy: { flex: 1 }, name: { color: colors.text, fontSize: 17, fontWeight: '800' }, email: { color: colors.muted, marginTop: 2, fontSize: 12 },
  planBadge: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }, planText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: spacing.sm }, stat: { flex: 1, minHeight: 90, gap: 3 }, statValue: { color: colors.text, fontSize: 21, fontWeight: '800', marginTop: 4 }, statLabel: { color: colors.tertiary, fontSize: 11 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: spacing.sm },
  setting: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10 }, settingIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }, settingCopy: { flex: 1 }, settingTitle: { color: colors.text, fontSize: 13, fontWeight: '700' }, settingDescription: { color: colors.tertiary, fontSize: 10, marginTop: 3 },
  menuItem: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, menuPressed: { opacity: 0.75 }, menuIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }, menuText: { flex: 1, fontSize: 13, fontWeight: '700' }, sheetText: { color: colors.muted, lineHeight: 21 }, deleteWarning: { color: colors.error, lineHeight: 21 },
});
