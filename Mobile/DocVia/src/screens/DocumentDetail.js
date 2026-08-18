/* eslint-disable react-hooks/set-state-in-effect */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ArrowLeft, CalendarClock, Copy, FileDown, FileText, Trash2, TriangleAlert, WalletCards } from 'lucide-react-native';
import { ErrorState, Skeleton } from '../components/ui';
import { documentsApi } from '../services/api';
import { loadNotificationSettings, reconcileDocumentDeadlineAlerts, scheduleSingleDeadlineReminder } from '../services/notificationSettings';
import { common } from '../theme';
import { formatBrl, normalizeCosts } from '../utils/costs';
import { deadlineDate, normalizeDeadlines } from '../utils/deadlines';
import { date, typeLabel } from './shared';

const primary = '#147D92';
const tabs = [['Resumo', FileText], ['Prazos', CalendarClock], ['Custos', WalletCards], ['Avisos', TriangleAlert], ['Texto extraído', Copy]];

function DetailCard({ children, style }) { return <View style={[styles.card, style]}>{children}</View>; }

function warningTone(item) {
  const priority = String(item?.prioridade || item?.priority || item?.severity || '').toLowerCase();
  const text = String(typeof item === 'string' ? item : item?.descricao || item?.description || '').toLowerCase();
  if (['critico', 'crítico', 'critical', 'alta', 'high'].includes(priority) || /rescis|despejo|inadimpl|perda de prazo|multa.{0,20}(alta|3|três)/.test(text)) return { key: 'Critical', label: 'CRÍTICO', color: '#FF737D' };
  if (['informativo', 'info', 'baixa', 'low'].includes(priority)) return { key: 'Info', label: 'INFORMATIVO', color: '#7FD9D0' };
  return { key: 'Attention', label: 'ATENÇÃO', color: '#FFC52E' };
}

function normalizeDueDate(value) {
  const raw = String(value || '');
  const match = raw.match(/([0-3]?\d)[/-]([0-1]?\d)[/-](\d{4})/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : value || null;
}

function boletoDueDate(document, boleto) {
  if (boleto?.vencimento || boleto?.due_date) return normalizeDueDate(boleto.vencimento || boleto.due_date);
  const deadline = (document.analysis_deadlines || []).find(item => /vencimento|boleto/i.test(String(item?.description || item?.descricao || item)));
  return normalizeDueDate(deadline?.due_date || deadline?.data || deadline?.description || deadline?.descricao || deadline);
}

export default function DocumentDetail({ id, back }) {
  const [doc, setDoc] = useState(); const [tab, setTab] = useState('Resumo'); const [error, setError] = useState(''); const [boleto, setBoleto] = useState(); const [deleting, setDeleting] = useState(false); const [downloading, setDownloading] = useState(false);
  const load = useCallback(async () => { try { setError(''); const result = await documentsApi.detail(id); setDoc(result); await reconcileDocumentDeadlineAlerts(result).catch(() => undefined); if (result.document_type === 'boleto') { try { setBoleto((await documentsApi.boleto(id)).boleto); } catch {} } } catch (nextError) { setError(nextError.message); } }, [id]);
  useEffect(() => { load(); }, [load]);
  const reminder = async (due) => { const settings = await loadNotificationSettings(); const created = await scheduleSingleDeadlineReminder(due, settings); if (!created) return Alert.alert(settings.alertsEnabled ? 'Lembrete indisponível' : 'Alertas desativados', settings.alertsEnabled ? 'Não foi possível criar um lembrete para essa data.' : 'Ative os alertas de prazo no seu perfil.'); Alert.alert('Lembrete criado', settings.quietMode ? 'Vamos avisar você fora do horário silencioso.' : 'Vamos avisar você um dia antes.'); };
  const removeDocument = () => Alert.alert('Excluir documento?', 'O arquivo e a analise serao removidos permanentemente.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: async () => { try { setDeleting(true); await documentsApi.remove(id); back(); } catch (nextError) { setDeleting(false); Alert.alert('Nao foi possivel excluir', nextError.message || 'Tente novamente.'); } } }
  ]);
  const downloadOriginal = async () => {
    if (doc.storage_url === 'text://manual-entry' || downloading) return;
    setDownloading(true);
    try {
      const response = await documentsApi.file(id);
      const safeName = String(doc.original_name || 'documento').replace(/[^a-zA-Z0-9._-]/g, '_');
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(await response.blob());
        const link = globalThis.document.createElement('a');
        link.href = url;
        link.download = safeName;
        globalThis.document.body.appendChild(link);
        link.click();
        link.remove();
        globalThis.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      } else {
        const file = new File(Paths.cache, safeName);
        file.create({ overwrite: true });
        file.write(new Uint8Array(await response.arrayBuffer()));
        if (!await Sharing.isAvailableAsync()) throw new Error('O compartilhamento de arquivos não está disponível neste aparelho.');
        await Sharing.shareAsync(file.uri, { dialogTitle: 'Salvar arquivo original', mimeType: doc.mime_type || undefined });
      }
    } catch (nextError) {
      Alert.alert('Não foi possível baixar', nextError.message || 'Tente novamente.');
    } finally {
      setDownloading(false);
    }
  };
  if (error) return <ScrollView style={common.screen}><ErrorState error={error} retry={load} /></ScrollView>;
  if (!doc) return <ScrollView contentContainerStyle={styles.loading}><Skeleton height={28} /><Skeleton height={70} /><Skeleton height={150} /></ScrollView>;
  const analysis = doc.analysis || doc;
  const actionItems = doc.analysis_action_items || analysis.action_items || [];
  const status = doc.status === 'done' ? 'PRONTO' : doc.status === 'failed' ? 'ERRO' : 'ANALISANDO';
  const dueDate = boletoDueDate(doc, boleto);
  const normalizedCosts = normalizeCosts(doc.analysis_costs || [], doc.extracted_text || '');
  const normalizedDeadlines = normalizeDeadlines(doc.analysis_deadlines || [], doc.extracted_text || '');
  const content = () => {
    if (tab === 'Resumo') return <><Text style={styles.summary}>{doc.analysis_summary || 'A análise ainda está sendo processada. Volte em alguns instantes.'}</Text><Text style={styles.sectionTitle}>Ações recomendadas</Text>{actionItems.length ? actionItems.map((item, index) => <DetailCard key={index} style={styles.actionCard}><Text style={styles.actionText}>{typeof item === 'string' ? item : item.descricao || item.description}</Text></DetailCard>) : <Text style={styles.emptyText}>Nenhuma ação identificada.</Text>}</>;
    if (tab === 'Prazos') return normalizedDeadlines.length ? normalizedDeadlines.map((item, index) => { const due = deadlineDate(item); const recurring = item.recorrencia === 'mensal'; return <DetailCard key={`${item.descricao}-${due}-${index}`} style={styles.dataCard}><View style={styles.dataCopy}><Text style={styles.dataTitle}>{item.descricao}</Text>{due ? <Text style={styles.dataHint}>{date(due)}{recurring ? ' · recorrência mensal' : ''}</Text> : null}</View>{due ? <Pressable onPress={() => reminder(due)} style={styles.smallButton}><Text style={styles.smallButtonText}>Lembrar</Text></Pressable> : null}</DetailCard>; }) : <Text style={styles.emptyText}>Nenhum prazo identificado.</Text>;
    if (tab === 'Custos') return normalizedCosts.length ? normalizedCosts.map((item, index) => <DetailCard key={`${item.description}-${item.amount}-${index}`} style={styles.dataCard}><View style={styles.dataCopy}><Text style={styles.dataTitle}>{item.description}</Text>{item.amount ? <Text style={styles.dataHint}>{item.amount}</Text> : null}</View></DetailCard>) : <Text style={styles.emptyText}>Nenhum custo identificado.</Text>;
    if (tab === 'Avisos') return (doc.analysis_warnings || []).length ? doc.analysis_warnings.map((item, index) => { const tone = warningTone(item); return <DetailCard key={index} style={[styles.warningCard, styles[`warning${tone.key}`]]}><View style={styles.warningIcon}><TriangleAlert size={17} color={tone.color} /></View><View style={styles.warningCopy}><Text style={[styles.warningLabel, { color: tone.color }]}>{tone.label}</Text><Text style={styles.actionText}>{typeof item === 'string' ? item : item.descricao || item.description}</Text></View></DetailCard>; }) : <Text style={styles.emptyText}>Nenhum aviso identificado.</Text>;
    return <DetailCard><Text selectable style={styles.summary}>{doc.extracted_text || 'O texto extraído ficará disponível quando o processamento terminar.'}</Text><Pressable onPress={async () => { await Clipboard.setStringAsync(doc.extracted_text || ''); Alert.alert('Texto copiado'); }} style={styles.copyButton}><Copy size={15} color="#91E0D8" /><Text style={styles.copyText}>Copiar texto</Text></Pressable></DetailCard>;
  };
  return <ScrollView style={common.screen} contentContainerStyle={styles.content}>
    <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={back} style={styles.back}><ArrowLeft size={17} color="#7FD9D0" /><Text style={styles.backText}>Voltar</Text></Pressable>
    <View style={styles.heading}><View style={styles.headingCopy}><Text numberOfLines={2} style={styles.title}>{doc.original_name}</Text><Text style={styles.meta}>{typeLabel[doc.document_type]} · {date(doc.created_at)}</Text></View><View style={[styles.status, doc.status === 'failed' && styles.statusError]}><Text style={[styles.statusText, doc.status === 'failed' && styles.statusTextError]}>{status}</Text></View></View>
    {boleto ? <DetailCard style={styles.boletoCard}><Text style={styles.boletoLabel}>BOLETO IDENTIFICADO</Text><Text style={styles.boletoValue}>{formatBrl(boleto.valor || boleto.amount)}</Text><Text style={styles.boletoHint}>Vencimento: {dueDate ? date(dueDate) : 'não identificado'}</Text></DetailCard> : null}
    <View style={styles.tabs}>{tabs.map(([label, Icon]) => <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: tab === label }} onPress={() => setTab(label)} style={({ pressed }) => [styles.tab, tab === label && styles.tabActive, pressed && styles.pressed]}><Icon size={14} color={tab === label ? '#FFFFFF' : '#9092A0'} strokeWidth={1.8} /><Text numberOfLines={1} style={[styles.tabText, tab === label && styles.tabTextActive]}>{label === 'Texto extraído' ? 'Texto' : label}</Text></Pressable>)}</View>
    <View style={styles.result}>{content()}</View>
    <Text style={styles.disclaimer}>A análise por IA pode conter erros e não substitui orientação jurídica, financeira ou médica profissional. Confirme informações importantes no documento original.</Text>
    {doc.storage_url === 'text://manual-entry' ? <DetailCard style={styles.originalCard}><View style={styles.originalIcon}><FileDown size={19} color="#7FD9D0" /></View><View style={styles.originalCopy}><Text style={styles.originalTitle}>Texto enviado</Text><Text style={styles.originalText}>Este documento foi criado a partir de texto digitado.</Text></View></DetailCard> : <Pressable accessibilityRole="button" accessibilityLabel="Baixar arquivo original" disabled={downloading} onPress={downloadOriginal} style={({ pressed }) => [styles.card, styles.originalCard, pressed && styles.pressed, downloading && styles.disabled]}><View style={styles.originalIcon}><FileDown size={19} color="#7FD9D0" /></View><View style={styles.originalCopy}><Text style={styles.originalTitle}>{downloading ? 'Preparando arquivo...' : 'Baixar arquivo original'}</Text><Text style={styles.originalText}>Acesso autenticado; escolha onde salvar ou compartilhar.</Text></View></Pressable>}
    <Pressable disabled={deleting} accessibilityRole="button" accessibilityLabel="Excluir documento" onPress={removeDocument} style={({ pressed }) => [styles.deleteButton, pressed && !deleting && styles.pressed, deleting && styles.disabled]}><Trash2 size={16} color="#FF8992" /><Text style={styles.deleteText}>{deleting ? 'Excluindo...' : 'Excluir documento'}</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 28, paddingTop: 60, paddingBottom: 46 }, loading: { paddingHorizontal: 28, paddingTop: 68, gap: 16 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingVertical: 8, marginBottom: 23 }, backText: { color: '#91E0D8', fontSize: 12, fontWeight: '800' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, headingCopy: { flex: 1 }, title: { color: '#F4F4F8', fontSize: 24, lineHeight: 29, fontWeight: '800' }, meta: { color: '#888A99', fontSize: 11, marginTop: 8 }, status: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#147D921F' }, statusError: { backgroundColor: '#EF44441F' }, statusText: { color: '#8BE1D8', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, statusTextError: { color: '#FF8992' },
  boletoCard: { marginTop: 22, backgroundColor: '#0B2429', borderColor: '#205965' }, boletoLabel: { color: '#87DDD4', fontSize: 9, letterSpacing: 1.2, fontWeight: '900' }, boletoValue: { color: '#F5F4FA', fontSize: 23, fontWeight: '800', marginTop: 7 }, boletoHint: { color: '#9192A1', fontSize: 11, marginTop: 5 },
  tabs: { flexDirection: 'row', gap: 4, paddingTop: 24, paddingBottom: 21 }, tab: { flex: 1, height: 40, paddingHorizontal: 4, borderRadius: 14, borderWidth: 1, borderColor: '#2C2E38', backgroundColor: '#111219', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 0 }, tabActive: { backgroundColor: primary, borderColor: primary }, tabText: { color: '#989AA8', fontSize: 9, fontWeight: '700', flexShrink: 1 }, tabTextActive: { color: '#FFFFFF' }, pressed: { opacity: .82, transform: [{ scale: .99 }] },
  result: { minHeight: 198 }, summary: { color: '#DEDEE6', fontSize: 13, lineHeight: 22 }, sectionTitle: { color: '#F0F0F5', fontSize: 16, fontWeight: '800', marginTop: 23, marginBottom: 11 }, emptyText: { color: '#9597A5', fontSize: 12 }, card: { borderRadius: 18, borderWidth: 1, borderColor: '#292B35', backgroundColor: '#111219', padding: 16 }, actionCard: { marginTop: 8 }, actionText: { color: '#DCDDE6', fontSize: 12, lineHeight: 18, flex: 1 }, dataCard: { marginBottom: 9, flexDirection: 'row', alignItems: 'center' }, dataCopy: { flex: 1 }, dataTitle: { color: '#ECECF3', fontSize: 13, fontWeight: '700' }, dataHint: { color: '#8B8D9A', fontSize: 11, marginTop: 5 }, smallButton: { backgroundColor: '#147D921F', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 7 }, smallButtonText: { color: '#9FE2DC', fontSize: 10, fontWeight: '800' }, warningCard: { marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 10 }, warningIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#FFFFFF08', alignItems: 'center', justifyContent: 'center' }, warningCopy: { flex: 1 }, warningLabel: { fontSize: 9, letterSpacing: 1.1, fontWeight: '900', marginBottom: 5 }, warningAttention: { borderColor: '#5B4822', backgroundColor: '#1B1710' }, warningCritical: { borderColor: '#6B3039', backgroundColor: '#211216' }, warningInfo: { borderColor: '#1D4C55', backgroundColor: '#0B2226' }, copyButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7, marginTop: 15, paddingVertical: 6 }, copyText: { color: '#91E0D8', fontSize: 11, fontWeight: '800' },
  disclaimer: { color: '#8F919E', fontSize: 10, lineHeight: 16, marginTop: 20 }, originalCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }, originalIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#0E2A2F', alignItems: 'center', justifyContent: 'center' }, originalCopy: { flex: 1 }, originalTitle: { color: '#F0F0F5', fontSize: 14, fontWeight: '800' }, originalText: { color: '#9597A5', fontSize: 11, lineHeight: 16, marginTop: 5 }
  , deleteButton: { height: 48, marginTop: 13, borderRadius: 15, borderWidth: 1, borderColor: '#5A2932', backgroundColor: '#211217', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, deleteText: { color: '#FF8992', fontSize: 12, fontWeight: '800' }, disabled: { opacity: .62 }
});
