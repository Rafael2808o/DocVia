import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, BellOff, CalendarDays, ChevronRight } from 'lucide-react-native';
import { Button, Sheet } from './ui';
import { loadNotificationSettings } from '../services/notificationSettings';
import { deadlineDate, deadlineDescription } from '../utils/deadlines';

function deadlineAlerts(documents) {
  return documents.flatMap((document) => (document.analysis_deadlines || []).map((item, index) => {
    const description = deadlineDescription(item);
    const dueDateValue = deadlineDate(item);
    const dueDate = dueDateValue ? new Date(`${dueDateValue}T00:00:00`) : null;
    if (!dueDate || Number.isNaN(dueDate.getTime())) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    const days = Math.ceil((dueDate - today) / 86400000);
    if (days < 0) return null;
    return { id: `${document.id}-${index}`, description, originalName: document.original_name, dueDate, days };
  }).filter(Boolean)).sort((a, b) => a.dueDate - b.dueDate).slice(0, 5);
}

function dueLabel(days) {
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  return `Em ${days} dias`;
}

export default function NotificationCenter({ visible, onClose, documents = [], onViewDeadlines }) {
  const [settings, setSettings] = useState({ alertsEnabled: false, quietMode: false });
  const alerts = useMemo(() => deadlineAlerts(documents), [documents]);

  useEffect(() => { if (visible) loadNotificationSettings().then(setSettings); }, [visible]);

  const viewDeadlines = () => { onClose(); onViewDeadlines?.(); };
  return <Sheet visible={visible} title="Notificações" onClose={onClose}>
    <View style={styles.status}><View style={styles.statusIcon}><Bell size={18} color="#74D8CE" /></View><View style={styles.statusCopy}><Text style={styles.statusTitle}>{settings.alertsEnabled ? 'Alertas de prazo ativos' : 'Alertas de prazo desativados'}</Text><Text style={styles.statusText}>{settings.alertsEnabled ? `Avisos 7, 3 e 1 dia antes${settings.quietMode ? ', após as 7h.' : '.'}` : 'Ative-os no seu perfil para receber lembretes.'}</Text></View></View>
    {alerts.length ? <View style={styles.alerts}>{alerts.map((alert) => <Pressable key={alert.id} onPress={viewDeadlines} accessibilityRole="button" accessibilityLabel={`Ver prazo: ${alert.description}`} style={({ pressed }) => [styles.alert, pressed && styles.pressed]}><View style={styles.alertIcon}><CalendarDays size={17} color="#74D8CE" /></View><View style={styles.alertCopy}><Text numberOfLines={1} style={styles.alertTitle}>{alert.description}</Text><Text numberOfLines={1} style={styles.alertText}>{alert.originalName}</Text></View><View style={styles.due}><Text style={styles.dueText}>{dueLabel(alert.days)}</Text></View><ChevronRight size={16} color="#77798A" /></Pressable>)}</View> : <View style={styles.empty}><BellOff size={20} color="#8C8E9E" /><Text style={styles.emptyTitle}>Nenhuma notificação por agora</Text><Text style={styles.emptyText}>Os próximos alertas dos seus documentos aparecerão aqui.</Text></View>}
    <Button title="Ver todos os prazos" onPress={viewDeadlines} />
  </Sheet>;
}

const styles = StyleSheet.create({
  status: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 17, borderWidth: 1, borderColor: '#1A4A53', backgroundColor: '#0B2226', padding: 14 },
  statusIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#147D9226' }, statusCopy: { flex: 1 }, statusTitle: { color: '#F1F0FA', fontSize: 13, fontWeight: '800' }, statusText: { color: '#9C9BAB', fontSize: 10, lineHeight: 15, marginTop: 4 },
  alerts: { gap: 9 }, alert: { minHeight: 72, borderWidth: 1, borderColor: '#292B35', borderRadius: 16, backgroundColor: '#111219', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }, pressed: { opacity: .8, transform: [{ scale: .99 }] }, alertIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#147D921F' }, alertCopy: { flex: 1, minWidth: 0 }, alertTitle: { color: '#F1F1F6', fontSize: 12, fontWeight: '700' }, alertText: { color: '#888A98', fontSize: 10, marginTop: 4 }, due: { borderRadius: 10, backgroundColor: '#FFC52E18', paddingHorizontal: 7, paddingVertical: 5 }, dueText: { color: '#FFC52E', fontSize: 9, fontWeight: '800' },
  empty: { minHeight: 116, borderWidth: 1, borderColor: '#292B35', borderRadius: 17, backgroundColor: '#111219', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 }, emptyTitle: { color: '#F1F1F6', fontSize: 13, fontWeight: '800', marginTop: 9 }, emptyText: { color: '#888A98', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 5 },
});
