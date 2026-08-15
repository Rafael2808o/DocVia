/* eslint-disable react-hooks/set-state-in-effect */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronRight, FileText, HeartPulse, ReceiptText, Search, Upload } from 'lucide-react-native';
import { ErrorState, Skeleton } from '../components/ui';
import { documentsApi } from '../services/api';
import { common } from '../theme';
import { date, typeLabel } from './shared';

const violet = '#5D43F2';
const filters = [['todos', 'Todos'], ['contrato', 'Contrato'], ['exame', 'Exame'], ['boleto', 'Boleto'], ['termo_de_uso', 'Termo'], ['outro', 'Outro']];
const typeVisuals = {
  contrato: { color: '#8B80FF', background: '#8B80FF1F', Icon: FileText },
  exame: { color: '#24D6AF', background: '#24D6AF1F', Icon: HeartPulse },
  boleto: { color: '#E5BD3E', background: '#E5BD3E1F', Icon: ReceiptText },
  outro: { color: '#8B80FF', background: '#8B80FF1F', Icon: FileText },
};
const searchFocusStyles = StyleSheet.create({ active: { borderColor: '#5D43F2', boxShadow: '0 0 10px rgba(93, 67, 242, 0.30)', shadowColor: '#5D43F2', shadowOpacity: .28, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 4 } });

function visualFor(document) { return typeVisuals[document.document_type] || typeVisuals.outro; }

function statusFor(document) {
  if (document.status === 'failed') return { label: document.error_message || 'Falha no processamento', color: '#FF7E8A' };
  if (document.status !== 'done') return { label: 'Processamento em andamento', color: '#8B80FF' };
  const warnings = document.analysis_warnings || [];
  const critical = warnings.some((item) => ['critico', 'crítico', 'critical'].includes(String(item?.prioridade || item?.priority || '').toLowerCase()));
  if (critical) return { label: 'Aviso crítico na análise — revise os detalhes', color: '#FF737D' };
  if (warnings.length) return { label: 'A análise contém pontos de atenção', color: '#FFC52E' };
  return { label: 'Análise concluída', color: '#43E6B6' };
}

function DocumentRow({ document, openDocument }) {
  const visual = visualFor(document); const Icon = visual.Icon; const status = statusFor(document);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${document.original_name}`} onPress={() => openDocument(document.id)} style={({ pressed }) => [styles.document, pressed && styles.documentPressed]}><View style={styles.documentMain}><View style={[styles.fileIcon, { backgroundColor: visual.background }]}><Icon size={19} color={visual.color} strokeWidth={1.9} /></View><View style={styles.documentCopy}><Text numberOfLines={1} style={styles.documentName}>{document.original_name}</Text><View style={styles.metaLine}><Text style={[styles.typeTag, { color: visual.color, backgroundColor: visual.background }]}>{typeLabel[document.document_type] || 'DOCUMENTO'}</Text><Text style={styles.documentDate}>{date(document.created_at)}</Text></View></View><ChevronRight size={17} color="#626578" /></View><View style={styles.riskLine}><View style={[styles.riskDot, { backgroundColor: status.color }]} /><Text numberOfLines={2} style={styles.riskText}>{status.label}</Text></View></Pressable>;
}

function EmptyDocuments({ hasDocuments, onUpload }) {
  const title = hasDocuments ? 'Nenhum documento encontrado' : 'Nenhum documento por aqui';
  const text = hasDocuments ? 'Ajuste sua busca ou tente outro filtro.' : 'Envie um documento para analisar e acompanhar prazos.';
  const content = <><View style={styles.emptyIcon}><Upload size={20} color="#A99DFF" strokeWidth={1.9} /></View><View style={styles.emptyCopy}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{text}</Text></View><ChevronRight size={17} color="#646878" /></>;
  return hasDocuments ? <View style={styles.emptyDocuments}>{content}</View> : <Pressable accessibilityRole="button" accessibilityLabel="Enviar documento" onPress={onUpload} style={({ pressed }) => [styles.emptyDocuments, pressed && styles.documentPressed]}>{content}</Pressable>;
}

export default function DocumentsV2({ openDocument, navigate }) {
  const [documents, setDocuments] = useState(); const [error, setError] = useState(''); const [query, setQuery] = useState(''); const [type, setType] = useState('todos'); const [searchFocused, setSearchFocused] = useState(false); const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { try { setError(''); setDocuments(await documentsApi.list()); } catch (err) { setError(err.message); } }, []);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } };
  const filtered = useMemo(() => (documents || []).filter((document) => (type === 'todos' || document.document_type === type) && document.original_name.toLowerCase().includes(query.trim().toLowerCase())), [documents, query, type]);
  if (error && !documents) return <ScrollView style={common.screen}><ErrorState error={error} retry={load} /></ScrollView>;
  if (!documents) return <ScrollView contentContainerStyle={styles.loading}><Skeleton height={62} /><Skeleton height={48} /><Skeleton height={118} /><Skeleton height={118} /></ScrollView>;
  return <ScrollView style={common.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={violet} />}>
    <View><Text style={styles.title}>Documentos</Text><Text style={styles.subtitle}>{documents.length} arquivo{documents.length === 1 ? '' : 's'} · {documents.filter((item) => item.status === 'done').length} concluído{documents.filter((item) => item.status === 'done').length === 1 ? '' : 's'}</Text></View>
    {error ? <ErrorState error={error} retry={load} /> : null}
    <View style={[styles.search, searchFocused && searchFocusStyles.active]}><Search size={18} color={searchFocused ? violet : '#747789'} strokeWidth={1.8} /><TextInput value={query} onChangeText={setQuery} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} placeholder="Buscar documentos..." placeholderTextColor="#858797" selectionColor={violet} autoCorrect={false} style={styles.searchInput} accessibilityLabel="Buscar documentos" /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{filters.map(([value, label]) => <Pressable key={value} accessibilityRole="button" onPress={() => setType(value)} style={({ pressed }) => [styles.filter, type === value && styles.filterActive, pressed && styles.filterPressed]}><Text style={[styles.filterText, type === value && styles.filterTextActive]}>{label}</Text></Pressable>)}</ScrollView>
    {filtered.length ? <View style={styles.documents}>{filtered.map((document) => <DocumentRow key={document.id} document={document} openDocument={openDocument} />)}</View> : <EmptyDocuments hasDocuments={documents.length > 0} onUpload={() => navigate?.('upload')} />}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 38, paddingBottom: 130, gap: 12 }, loading: { padding: 22, gap: 14 }, title: { color: '#F4F4F8', fontSize: 23, letterSpacing: .1, fontWeight: '800' }, subtitle: { color: '#7E8090', fontSize: 12, marginTop: 6 }, search: { height: 47, marginTop: 7, borderRadius: 17, borderWidth: 1, borderColor: '#262833', backgroundColor: '#11121A', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 11 }, searchInput: { flex: 1, color: '#F0F0F5', fontSize: 12, paddingVertical: 0, outlineStyle: 'none' }, filters: { gap: 8, paddingVertical: 1 }, filter: { height: 32, paddingHorizontal: 17, borderRadius: 16, borderWidth: 1, borderColor: '#292B37', backgroundColor: '#11121A', alignItems: 'center', justifyContent: 'center' }, filterActive: { backgroundColor: violet, borderColor: violet }, filterPressed: { opacity: .78 }, filterText: { color: '#9A9CAB', fontSize: 11, fontWeight: '700' }, filterTextActive: { color: '#FFFFFF' }, documents: { gap: 10, marginTop: 5 }, document: { minHeight: 118, borderRadius: 17, borderWidth: 1, borderColor: '#242631', backgroundColor: '#101118', padding: 14, justifyContent: 'space-between' }, documentPressed: { opacity: .82, transform: [{ scale: .99 }] }, documentMain: { flexDirection: 'row', alignItems: 'center', gap: 12 }, fileIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, documentCopy: { flex: 1, minWidth: 0 }, documentName: { color: '#F0F0F5', fontSize: 13, fontWeight: '700' }, metaLine: { flexDirection: 'row', alignItems: 'center', marginTop: 7 }, typeTag: { overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 3, fontSize: 8, lineHeight: 10, letterSpacing: .7, fontWeight: '900' }, documentDate: { color: '#777A8C', fontSize: 10, marginLeft: 6 }, riskLine: { borderTopWidth: 1, borderTopColor: '#242631', paddingTop: 11, flexDirection: 'row', alignItems: 'center', gap: 9 }, riskDot: { width: 6, height: 6, borderRadius: 3 }, riskText: { color: '#A0A2AF', fontSize: 10 }, emptyDocuments: { minHeight: 86, marginTop: 5, borderRadius: 17, borderWidth: 1, borderColor: '#242631', backgroundColor: '#101118', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, emptyIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#5D43F21F', alignItems: 'center', justifyContent: 'center' }, emptyCopy: { flex: 1 }, emptyTitle: { color: '#F0F0F5', fontSize: 13, fontWeight: '700' }, emptyText: { color: '#838695', fontSize: 10, marginTop: 5 }
});
