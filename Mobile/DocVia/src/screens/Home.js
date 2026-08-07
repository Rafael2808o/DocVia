/* eslint-disable react-hooks/set-state-in-effect */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, CalendarDays, ChevronRight, FileText, HeartPulse, ReceiptText, Sparkles, Upload } from 'lucide-react-native';
import { ErrorState, Skeleton } from '../components/ui';
import NotificationCenter from '../components/NotificationCenter';
import { documentsApi, userApi } from '../services/api';
import { common } from '../theme';
import { date, typeLabel } from './shared';

const violet = '#5D43F2';
const documentColors = {
  contract: { color: '#8B80FF', background: '#8B80FF1F', Icon: FileText },
  exame: { color: '#24D6AF', background: '#24D6AF1F', Icon: HeartPulse },
  exam: { color: '#24D6AF', background: '#24D6AF1F', Icon: HeartPulse },
  boleto: { color: '#E5BD3E', background: '#E5BD3E1F', Icon: ReceiptText },
};

function documentStyle(document) {
  return documentColors[document.document_type] || { color: '#9BA4B8', background: '#9BA4B81F', Icon: FileText };
}

function deadlineText(deadline) {
  const value = deadline?.date || deadline?.due_date || deadline?.deadline || deadline?.data;
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return deadline ? 'Em breve' : 'Sem prazos';
  return `${parsed.getDate()} ${parsed.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}`;
}

function Metric({ Icon, iconColor, label, value, hint }) {
  return <View style={styles.metric}><Icon size={17} color={iconColor} strokeWidth={1.9} /><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text numberOfLines={2} style={styles.metricHint}>{hint}</Text></View>;
}

function RecentDocument({ document, onPress }) {
  const visual = documentStyle(document); const Icon = visual.Icon;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${document.original_name}`} onPress={onPress} style={({ pressed }) => [styles.document, pressed && styles.documentPressed]}><View style={[styles.documentIcon, { backgroundColor: visual.background }]}><Icon size={19} color={visual.color} strokeWidth={1.9} /></View><View style={styles.documentInfo}><Text numberOfLines={1} style={styles.documentName}>{document.original_name}</Text><View style={styles.documentMeta}><Text style={[styles.documentType, { color: visual.color }]}>{typeLabel[document.document_type] || 'DOCUMENTO'}</Text><Text style={styles.documentDate}>· {date(document.created_at)}</Text></View></View><ChevronRight size={17} color="#646878" /></Pressable>;
}

function EmptyRecent({ onPress }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.emptyRecent, pressed && styles.documentPressed]}><View style={styles.emptyIcon}><Upload size={20} color="#A99DFF" strokeWidth={1.9} /></View><View style={styles.emptyCopy}><Text style={styles.emptyTitle}>Nenhum documento por aqui</Text><Text style={styles.emptyText}>Envie um documento para analisar e acompanhar prazos.</Text></View><ChevronRight size={17} color="#646878" /></Pressable>;
}

export default function Home({ user, navigate, openDocument }) {
  const [data, setData] = useState(); const [error, setError] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const load = useCallback(async () => { try { setError(''); const [usage, deadlines, documents] = await Promise.all([userApi.usage(), documentsApi.deadlines(), documentsApi.list()]); setData({ usage, deadlines: deadlines.deadlines || [], documents }); } catch (nextError) { setError(nextError.message); } }, []);
  useEffect(() => { load(); }, [load]);
  if (error) return <ScrollView style={common.screen}><ErrorState error={error} retry={load} /></ScrollView>;
  if (!data) return <ScrollView contentContainerStyle={styles.loading}><Skeleton height={72} /><Skeleton height={136} /><Skeleton height={126} /><Skeleton height={210} /></ScrollView>;
  const name = user?.name?.trim().split(/\s+/)[0] || 'você'; const nearest = data.deadlines[0];
  return <ScrollView style={common.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={violet} />}>
    <View style={styles.header}><View><Text style={styles.welcome}>Bem-vindo de volta</Text><Text style={styles.greeting}>Olá, {name} <Text style={styles.hand}>👋</Text></Text></View><Pressable accessibilityRole="button" accessibilityLabel="Abrir notificações" onPress={() => setNotificationsOpen(true)} style={({ pressed }) => [styles.notification, pressed && styles.notificationPressed]}><Bell size={20} color="#A4A6B2" strokeWidth={1.8} /></Pressable></View>
    <Pressable accessibilityRole="button" onPress={() => navigate('upload')} style={({ pressed }) => [styles.analyze, pressed && styles.analyzePressed]}><LinearGradient colors={['#3F28C7', '#6337E5', '#9145FA']} locations={[0, .54, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.analyzeGradient}><Sparkles size={24} color="#DDD8FF" strokeWidth={1.8} /><View style={styles.uploadCircle}><Upload size={17} color="#FFFFFF" strokeWidth={2} /></View><Text style={styles.analyzeTitle}>Analisar novo documento</Text><Text style={styles.analyzeText}>PDF, JPG ou PNG · até 10 MB · resultado em segundos</Text></LinearGradient></Pressable>
    <View style={styles.metrics}><Metric Icon={CalendarDays} iconColor="#8B80FF" label="PRÓXIMO PRAZO" value={deadlineText(nearest)} hint={nearest?.description || 'Nenhum prazo próximo'} /><Metric Icon={Sparkles} iconColor="#24D6AF" label="USO DISPONÍVEL" value={`${data.usage.restante}`} hint="análises restantes hoje" /></View>
    <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Recentes</Text><Pressable accessibilityRole="button" onPress={() => navigate('documents')} hitSlop={10}><Text style={styles.link}>Ver todos</Text></Pressable></View>
    {data.documents.length ? <View style={styles.documents}>{data.documents.slice(0, 3).map((document) => <RecentDocument key={document.id} document={document} onPress={() => openDocument(document.id)} />)}</View> : <EmptyRecent onPress={() => navigate('upload')} />}
    <NotificationCenter visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} documents={data.documents} onViewDeadlines={() => navigate('deadlines')} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 38, paddingBottom: 130, gap: 16 }, loading: { padding: 22, gap: 16 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }, welcome: { color: '#818393', fontSize: 12, marginBottom: 6 }, greeting: { color: '#F4F4F8', fontSize: 23, letterSpacing: .1, fontWeight: '800' }, hand: { fontSize: 21 }, notification: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#292A36', backgroundColor: '#12131B', alignItems: 'center', justifyContent: 'center' }, notificationPressed: { opacity: .8, transform: [{ scale: .96 }] }, analyze: { minHeight: 135, borderRadius: 18, overflow: 'hidden' }, analyzeGradient: { flex: 1, minHeight: 135, padding: 20 }, analyzePressed: { opacity: .87, transform: [{ scale: .99 }] }, uploadCircle: { position: 'absolute', right: 18, top: 49, width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF20', alignItems: 'center', justifyContent: 'center' }, analyzeTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginTop: 13 }, analyzeText: { color: '#EAE6FF', fontSize: 12, lineHeight: 17, marginTop: 5, maxWidth: 245 }, metrics: { flexDirection: 'row', gap: 12 }, metric: { flex: 1, minHeight: 131, borderRadius: 17, borderWidth: 1, borderColor: '#242631', backgroundColor: '#101118', padding: 15 }, metricLabel: { color: '#77798A', fontSize: 8, letterSpacing: 1.3, fontWeight: '800', marginTop: 13 }, metricValue: { color: '#F0F0F5', fontSize: 16, fontWeight: '800', marginTop: 7 }, metricHint: { color: '#838695', fontSize: 10, lineHeight: 14, marginTop: 5 }, sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }, sectionTitle: { color: '#EEEFF4', fontSize: 14, fontWeight: '800' }, link: { color: '#A99DFF', fontSize: 11, fontWeight: '700' }, documents: { gap: 10 }, document: { minHeight: 71, borderRadius: 17, borderWidth: 1, borderColor: '#242631', backgroundColor: '#101118', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, documentPressed: { opacity: .82, transform: [{ scale: .99 }] }, documentIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, documentInfo: { flex: 1, minWidth: 0 }, documentName: { color: '#F0F0F5', fontSize: 13, fontWeight: '700' }, documentMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 5 }, documentType: { fontSize: 10, letterSpacing: .7, fontWeight: '900' }, documentDate: { color: '#747786', fontSize: 10, marginLeft: 6 }, emptyRecent: { minHeight: 86, borderRadius: 17, borderWidth: 1, borderColor: '#242631', backgroundColor: '#101118', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, emptyIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#5D43F21F', alignItems: 'center', justifyContent: 'center' }, emptyCopy: { flex: 1 }, emptyTitle: { color: '#F0F0F5', fontSize: 13, fontWeight: '700' }, emptyText: { color: '#838695', fontSize: 10, marginTop: 5 }
});
