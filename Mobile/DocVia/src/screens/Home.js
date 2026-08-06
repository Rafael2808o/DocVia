/* eslint-disable react-hooks/set-state-in-effect */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BellRing, CalendarDays, Sparkles, TriangleAlert, Upload, WalletCards } from 'lucide-react-native';
import { Card, EmptyState, ErrorState, Skeleton } from '../components/ui';
import { documentsApi, userApi } from '../services/api';
import { colors, common, spacing } from '../theme';
import { DocumentCard } from './sharedV2';

function MiniMetric({ Icon, label, value, hint }) {
  return <Card style={styles.metric}><Icon size={17} color={colors.tertiary} /><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricHint}>{hint}</Text></Card>;
}

export default function Home({ user, navigate, openDocument }) {
  const [data, setData] = useState(); const [error, setError] = useState('');
  const load = useCallback(async () => { try { setError(''); const [usage, deadlines, documents] = await Promise.all([userApi.usage(), documentsApi.deadlines(), documentsApi.list()]); setData({ usage, deadlines: deadlines.deadlines || [], documents }); } catch (nextError) { setError(nextError.message); } }, []);
  useEffect(() => { load(); }, [load]);
  if (error) return <ScrollView style={common.screen}><ErrorState error={error} retry={load} /></ScrollView>;
  if (!data) return <ScrollView contentContainerStyle={styles.content}><Skeleton height={68} /><Skeleton height={112} /><Skeleton height={90} /></ScrollView>;
  const nearest = data.deadlines[0]; const name = user?.name?.split(' ')[0] || 'você';
  return <ScrollView style={common.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} />}>
    <View style={styles.header}><View><Text style={styles.greeting}>Olá, {name}</Text><Text style={common.subtitle}>Seus documentos, explicados de forma simples</Text></View><View style={styles.notification}><BellRing size={20} color={colors.muted} /></View></View>
    <Pressable onPress={() => navigate('upload')} accessibilityRole="button" style={({ pressed }) => [styles.analyze, pressed && styles.analyzePressed]}><View style={styles.analyzeIcon}><Sparkles size={24} color={colors.background} /></View><View style={styles.analyzeCopy}><Text style={styles.analyzeTitle}>Analisar novo documento</Text><Text style={styles.analyzeText}>PDF, JPG ou PNG até 10 MB · resultado em segundos</Text></View><Upload size={21} color={colors.background} /></Pressable>
    <View style={styles.metrics}><MiniMetric Icon={CalendarDays} label="PRÓXIMO PRAZO" value={nearest ? 'Em breve' : 'Sem prazos'} hint={nearest?.description || 'Nenhuma pendência'} /><MiniMetric Icon={WalletCards} label="USO DISPONÍVEL" value={`${data.usage.restante}`} hint="análises restantes hoje" /></View>
    {data.deadlines.length > 0 && <Card style={styles.warning}><TriangleAlert size={20} color={colors.warning} /><View style={styles.warningCopy}><Text style={styles.warningTitle}>{data.deadlines.length} ponto{data.deadlines.length > 1 ? 's' : ''} de atenção</Text><Text style={styles.warningText}>Há prazos detectados que merecem uma leitura antes de vencer.</Text></View></Card>}
    <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Recentes</Text><Pressable onPress={() => navigate('documents')}><Text style={styles.link}>Ver todos</Text></Pressable></View>
    {data.documents.length ? data.documents.slice(0, 3).map((document) => <DocumentCard key={document.id} document={document} onPress={() => openDocument(document.id)} />) : <EmptyState title="Envie seu primeiro documento" text="PDF, JPG ou PNG de até 10 MB." />}
  </ScrollView>;
}
const styles = StyleSheet.create({ content: { padding: spacing.lg, paddingBottom: 130, gap: spacing.md }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }, greeting: { color: colors.text, fontSize: 23, fontWeight: '800' }, notification: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, analyze: { minHeight: 112, borderRadius: 25, backgroundColor: '#5B94F8', padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, analyzePressed: { opacity: .86 }, analyzeIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }, analyzeCopy: { flex: 1, alignSelf: 'flex-end', marginLeft: -42 }, analyzeTitle: { color: colors.background, fontSize: 18, fontWeight: '800' }, analyzeText: { color: '#0B0D12AA', fontSize: 11, lineHeight: 16, marginTop: 4 }, metrics: { flexDirection: 'row', gap: spacing.sm }, metric: { flex: 1, minHeight: 88, gap: 2 }, metricLabel: { color: colors.tertiary, fontSize: 9, fontWeight: '800' }, metricValue: { color: colors.text, fontSize: 16, fontWeight: '800' }, metricHint: { color: colors.tertiary, fontSize: 10 }, warning: { flexDirection: 'row', borderColor: '#F59E0B66', backgroundColor: '#F59E0B10', gap: spacing.sm }, warningCopy: { flex: 1 }, warningTitle: { color: colors.warning, fontSize: 13, fontWeight: '800' }, warningText: { color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 2 }, sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs }, sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' }, link: { color: colors.success, fontSize: 12, fontWeight: '700' } });
