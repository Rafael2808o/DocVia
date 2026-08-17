/* eslint-disable react-hooks/set-state-in-effect */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bell, BellRing, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { ErrorState, Skeleton } from '../components/ui';
import NotificationCenter from '../components/NotificationCenter';
import { documentsApi } from '../services/api';
import { loadNotificationSettings } from '../services/notificationSettings';
import { common } from '../theme';
import { dateKey, deadlineDate, deadlineDescription, localDate } from '../utils/deadlines';

const primary = '#147D92';
const weekNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function remainingDays(value) { return Math.max(0, Math.ceil((localDate(value).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000)); }
function dueLabel(value) { const days = remainingDays(value); return days === 0 ? 'Hoje' : `${days}d`; }
function fullDate(value) { return localDate(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', ''); }
function analysisDeadlines(documents) {
  return documents.flatMap((document) => (document.analysis_deadlines || []).map((item, index) => {
    const description = deadlineDescription(item);
    const dueDate = deadlineDate(item);
    return dueDate ? { id: `${document.id}-${index}`, document_id: document.id, description, due_date: dueDate, original_name: document.original_name, document_type: document.document_type } : null;
  }).filter(Boolean));
}

function CalendarStrip({ selectedDate, onSelect, weekOffset, onPreviousWeek, onNextWeek }) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() + weekOffset * 7 + index); return date; }), [weekOffset]);
  const label = `${days[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - ${days[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
  return <View><View style={styles.weekControls}><Pressable accessibilityRole="button" accessibilityLabel="Semana anterior" onPress={onPreviousWeek} style={({ pressed }) => [styles.weekButton, pressed && styles.dayPressed]}><ChevronLeft size={16} color="#8DD8D1" /></Pressable><Text style={styles.weekLabel}>{label}</Text><Pressable accessibilityRole="button" accessibilityLabel="Próxima semana" onPress={onNextWeek} style={({ pressed }) => [styles.weekButton, pressed && styles.dayPressed]}><ChevronRight size={16} color="#8DD8D1" /></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calendar}>{days.map((day) => { const selected = dateKey(day) === selectedDate; return <Pressable key={day.toISOString()} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`Ver prazos de ${day.toLocaleDateString('pt-BR')}`} onPress={() => onSelect(dateKey(day))} style={({ pressed }) => [styles.day, selected && styles.dayActive, pressed && styles.dayPressed]}><Text style={[styles.dayName, selected && styles.dayNameActive]}>{weekNames[day.getDay()]}</Text><Text style={[styles.dayNumber, selected && styles.dayNumberActive]}>{day.getDate()}</Text></Pressable>; })}</ScrollView></View>;
}

function DeadlineCard({ item, index }) {
  const accent = index % 2 ? '#62D4C7' : '#FFC52E';
  const days = remainingDays(item.due_date);
  const badgeColor = days <= 7 ? '#FFC52E' : '#62D4C7';
  return <View style={styles.deadlineCard}><View style={[styles.deadlineAccent, { backgroundColor: accent }]} /><View style={styles.deadlineCopy}><Text numberOfLines={1} style={styles.deadlineName}>{item.description}</Text><Text style={styles.deadlineDate}>{fullDate(item.due_date)}</Text><Text numberOfLines={1} style={styles.deadlineFile}>via {item.original_name}</Text></View><View style={[styles.dueBadge, { backgroundColor: `${badgeColor}18` }]}><Text style={[styles.dueText, { color: badgeColor }]}>{dueLabel(item.due_date)}</Text></View></View>;
}

export default function Deadlines({ navigate }) {
  const [items, setItems] = useState();
  const [error, setError] = useState('');
  const [documents, setDocuments] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [weekOffset, setWeekOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const load = useCallback(async () => { try { setError(''); const [saved, nextDocuments, notificationSettings] = await Promise.all([documentsApi.deadlines(), documentsApi.list(), loadNotificationSettings()]); const merged = [...(saved.deadlines || []), ...analysisDeadlines(nextDocuments)]; const unique = Array.from(new Map(merged.map((item) => [`${item.document_id}-${item.due_date}-${item.description}`, item])).values()).sort((a, b) => new Date(a.due_date) - new Date(b.due_date)); setDocuments(nextDocuments); setItems(unique); setAlertsEnabled(notificationSettings.alertsEnabled); } catch (nextError) { setError(nextError.message); } }, []);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } };
  if (error) return <ScrollView style={common.screen}><ErrorState error={error} retry={load} /></ScrollView>;
  if (!items) return <ScrollView contentContainerStyle={styles.loading}><Skeleton height={30} /><Skeleton height={70} /><Skeleton height={96} /></ScrollView>;
  const now = localDate(selectedDate);
  const upcoming = items.filter((item) => item.due_date === selectedDate);
  const moveWeek = (direction) => { const nextOffset = weekOffset + direction; const nextDate = new Date(); nextDate.setDate(nextDate.getDate() + nextOffset * 7); setWeekOffset(nextOffset); setSelectedDate(dateKey(nextDate)); };
  return <ScrollView style={common.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={primary} />}>
    <View style={styles.header}><View><Text style={styles.title}>Prazos</Text><Text style={styles.month}>{monthNames[now.getMonth()]} {now.getFullYear()}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Abrir notificações" onPress={() => setNotificationsOpen(true)} style={({ pressed }) => [styles.bell, pressed && styles.dayPressed]}><Bell size={19} color="#A0A2B0" strokeWidth={1.8} /></Pressable></View>
    <CalendarStrip selectedDate={selectedDate} onSelect={setSelectedDate} weekOffset={weekOffset} onPreviousWeek={() => moveWeek(-1)} onNextWeek={() => moveWeek(1)} />
    <Text style={styles.sectionLabel}>PRÓXIMOS PRAZOS</Text>
    {upcoming.length ? <View style={styles.deadlines}>{upcoming.map((item, index) => <DeadlineCard item={item} index={index} key={item.id} />)}</View> : <View style={styles.emptyDeadline}><Text style={styles.emptyTitle}>Nenhum prazo neste dia</Text><Text style={styles.emptyText}>Escolha outro dia para ver os vencimentos detectados.</Text></View>}
    <View style={styles.alertBox}><BellRing size={17} color="#62D4C7" strokeWidth={1.8} /><Text style={styles.alertText}>{alertsEnabled ? <>Você receberá alertas <Text style={styles.alertStrong}>7, 3 e 1 dia</Text> antes de cada vencimento.</> : <>Alertas estão desativados. Ative-os no <Text style={styles.alertStrong}>perfil</Text> para receber lembretes.</>}</Text></View>
    <NotificationCenter visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} documents={documents} onViewDeadlines={() => navigate?.('deadlines')} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 28, paddingTop: 68, paddingBottom: 130 }, loading: { paddingHorizontal: 28, paddingTop: 68, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: '#F4F4F8', fontSize: 23, fontWeight: '800', letterSpacing: .1 }, month: { color: '#7E8090', fontSize: 12, marginTop: 7 }, bell: { width: 41, height: 41, borderRadius: 21, borderWidth: 1, borderColor: '#282A35', backgroundColor: '#111219', alignItems: 'center', justifyContent: 'center' }, weekControls: { height: 28, marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, weekButton: { width: 28, height: 28, borderRadius: 10, borderWidth: 1, borderColor: '#2A2B35', backgroundColor: '#111219', alignItems: 'center', justifyContent: 'center' }, weekLabel: { color: '#9799A8', fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  calendar: { flexGrow: 1, justifyContent: 'center', gap: 7, paddingTop: 11, paddingBottom: 27 }, day: { width: 42, height: 70, borderRadius: 21, borderWidth: 1, borderColor: '#282A35', backgroundColor: '#111219', alignItems: 'center', justifyContent: 'center', gap: 6 }, dayActive: { backgroundColor: primary, borderColor: primary }, dayPressed: { opacity: .82, transform: [{ scale: .97 }] }, dayName: { color: '#878998', fontSize: 9, fontWeight: '700' }, dayNameActive: { color: '#E0F4F1' }, dayNumber: { color: '#F0F0F5', fontSize: 14, fontWeight: '800' }, dayNumberActive: { color: '#FFFFFF' },
  sectionLabel: { color: '#858797', fontSize: 9, letterSpacing: 1.3, fontWeight: '800', marginBottom: 14 }, deadlines: { gap: 12 }, deadlineCard: { minHeight: 94, borderRadius: 17, borderWidth: 1, borderColor: '#282A35', backgroundColor: '#111219', paddingVertical: 14, paddingLeft: 32, paddingRight: 14, flexDirection: 'row', alignItems: 'center' }, deadlineAccent: { position: 'absolute', left: 16, top: 17, bottom: 17, width: 4, borderRadius: 3 }, deadlineCopy: { flex: 1, minWidth: 0 }, deadlineName: { color: '#F0F0F5', fontSize: 12, fontWeight: '700' }, deadlineDate: { color: '#8B8D9B', fontSize: 10, marginTop: 5 }, deadlineFile: { color: '#888A98', fontSize: 10, marginTop: 6 }, dueBadge: { minWidth: 35, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }, dueText: { fontSize: 10, fontWeight: '800' },
  emptyDeadline: { minHeight: 94, borderRadius: 17, borderWidth: 1, borderColor: '#282A35', backgroundColor: '#111219', padding: 16, justifyContent: 'center' }, emptyTitle: { color: '#F0F0F5', fontSize: 13, fontWeight: '700' }, emptyText: { color: '#888A98', fontSize: 10, marginTop: 6, lineHeight: 15 },
  alertBox: { minHeight: 75, borderRadius: 17, borderWidth: 1, borderColor: '#173F47', backgroundColor: '#091B1E', flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, marginTop: 17 }, alertText: { color: '#AAA9BA', fontSize: 11, lineHeight: 17, flex: 1 }, alertStrong: { color: '#78D9CF', fontWeight: '800' }
});
