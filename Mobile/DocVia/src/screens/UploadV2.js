/* eslint-disable react-hooks/static-components */
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle, Rect } from 'react-native-svg';
import { Camera, Check, CircleAlert, FileText, TextCursorInput, Trash2, Upload } from 'lucide-react-native';
import { documentsApi, userApi } from '../services/api';
import { common } from '../theme';
import { loadNotificationSettings, scheduleDeadlineAlerts } from '../services/notificationSettings';

const types = [['contrato', 'Contrato'], ['boleto', 'Boleto'], ['termo_de_uso', 'Termo de Uso'], ['outro', 'Outro']];
const ringCircumference = 2 * Math.PI * 24;
const steps = [{ key: 'queued', label: 'Enviado' }, { key: 'processing', label: 'Extraindo texto' }, { key: 'extracted', label: 'Texto extraído' }, { key: 'analyzing', label: 'Analisando com IA' }, { key: 'done', label: 'Pronto' }];
const mimePorExtensao = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };

function mimeDoArquivo(asset, name, mode) {
  const informado = String(asset.mimeType || '').toLowerCase();
  if (informado === 'image/jpg') return 'image/jpeg';
  if (['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'].includes(informado)) return informado;
  const extensao = name.split('.').pop()?.toLowerCase();
  if (mimePorExtensao[extensao]) return mimePorExtensao[extensao];
  return mode === 'camera' ? 'image/jpeg' : informado || 'application/octet-stream';
}

function SourceButton({ Icon, label, active, onPress }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.source, active && styles.sourceActive, pressed && styles.pressed]}><Icon size={18} color={active ? '#A99DFF' : '#989AAA'} strokeWidth={1.8} /><Text style={[styles.sourceText, active && styles.sourceTextActive]}>{label}</Text></Pressable>;
}

function ProgressRing({ progress }) {
  const progressOffset = ringCircumference * (1 - progress / 100);
  return <View style={styles.progressSymbol}><Svg width={58} height={58} viewBox="0 0 58 58" style={styles.progressRing}><Circle cx="29" cy="29" r="24" fill="none" stroke="#2D294C" strokeWidth="4" /><Circle cx="29" cy="29" r="24" fill="none" stroke="#8B80FF" strokeWidth="4" strokeLinecap="round" strokeDasharray={ringCircumference} strokeDashoffset={progressOffset} transform="rotate(-90 29 29)" /></Svg><Text style={styles.progressPercent}>{progress}%</Text></View>;
}

export default function UploadV2({ navigate }) {
  const [file, setFile] = useState();
  const [type, setType] = useState('contrato');
  const [source, setSource] = useState('file');
  const [manualText, setManualText] = useState('');
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [document, setDocument] = useState();
  const scheduledDocumentId = useRef();

  const pick = async (mode) => {
    try {
      setSource(mode);
      let asset;
      if (mode === 'file') {
        const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'application/octet-stream', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
        if (!result.canceled) asset = result.assets[0];
      } else {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return Alert.alert('Permissão necessária', 'Permita o acesso para selecionar ou digitalizar o documento.');
        const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: .9 });
        if (!result.canceled) asset = result.assets[0];
      }
      if (!asset) return;
      const size = asset.size || asset.fileSize || 0;
      if (size > 10 * 1024 * 1024) return Alert.alert('Arquivo muito grande', 'Envie PDF, JPG ou PNG de até 10 MB.');
      const name = asset.name || asset.fileName || (mode === 'camera' ? 'documento.jpg' : 'documento');
      const mimeType = mimeDoArquivo(asset, name, mode);
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(mimeType)) return Alert.alert('Formato não suportado', 'Envie o documento em PDF, JPG ou PNG.');
      setFile({ uri: asset.uri, name, type: mimeType, size, webFile: asset.file });
    } catch (error) {
      Alert.alert('Não foi possível abrir o arquivo', error?.message || 'Tente selecionar o documento novamente.');
    }
  };

  const send = async () => {
    const hasContent = source === 'text' ? manualText.trim().length >= 20 : Boolean(file);
    if (!hasContent || !consent) return;
    setSending(true);
    try {
      await userApi.consent();
      const response = source === 'text' ? await documentsApi.uploadText(manualText.trim(), type) : await documentsApi.upload(file, type);
      setDocument(response.documento);
    } catch (error) {
      Alert.alert('Não foi possível enviar', error.message);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!document?.id || ['done', 'completed', 'failed'].includes(document.status)) return undefined;
    const timer = setInterval(async () => { try { setDocument(await documentsApi.detail(document.id)); } catch { clearInterval(timer); } }, 3000);
    return () => clearInterval(timer);
  }, [document?.id, document?.status]);

  useEffect(() => {
    if (document?.status !== 'done' || scheduledDocumentId.current === document.id) return;
    scheduledDocumentId.current = document.id;
    Promise.all([documentsApi.list(), loadNotificationSettings()])
      .then(([documents, settings]) => scheduleDeadlineAlerts(documents, settings))
      .catch(() => undefined);
  }, [document?.id, document?.status]);

  if (document) {
    const failed = document.status === 'failed';
    // A conclusão da análise vem da API. Não espere a animação terminar para
    // mostrar o resultado, pois ela pode ser interrompida ao renderizar na web.
    const done = ['done', 'completed'].includes(document.status);
    const current = failed ? -1 : done ? steps.length - 1 : Math.max(0, steps.findIndex((step) => step.key === document.status));
    // O percentual conta apenas as etapas já concluídas. A etapa atual fica
    // em andamento e só soma 20% quando o status avança para a próxima.
    const progress = done ? 100 : current * 20;
    const ResultIcon = failed ? CircleAlert : () => <ProgressRing progress={progress} />;
    return <ScrollView style={common.screen} contentContainerStyle={styles.resultContent}>
      <View style={styles.resultIntro}><View style={[styles.resultIcon, failed && styles.resultIconError]}><ResultIcon size={27} color={failed ? '#FF7E8A' : '#A99DFF'} strokeWidth={1.8} /></View><Text style={styles.resultEyebrow}>{failed ? 'NÃO FOI POSSÍVEL CONCLUIR' : done ? 'ANÁLISE CONCLUÍDA' : 'ANALISANDO DOCUMENTO'}</Text><Text style={styles.resultTitle}>{failed ? 'Algo deu errado' : done ? 'Documento analisado' : 'Estamos cuidando disso'}</Text><Text style={styles.resultSubtitle}>{failed ? document.error_message || 'Tente novamente em alguns instantes.' : done ? 'Sua análise está pronta para ser consultada.' : 'Você pode acompanhar cada etapa abaixo.'}</Text></View>
      <View style={[styles.progressCard, failed && styles.progressCardError]}>{steps.map((step, index) => { const completed = (index < current || done) && !failed; const active = index === current && !done && !failed; return <View key={step.key} style={styles.progressStep}><View style={styles.progressMarker}>{index < steps.length - 1 ? <View style={[styles.progressLine, completed && styles.progressLineDone]} /> : null}<View style={[styles.progressDot, completed && styles.progressDotDone, active && styles.progressDotActive, failed && index === current && styles.progressDotError]}>{completed ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}</View></View><Text style={[styles.progressText, completed && styles.progressTextDone, active && styles.progressTextActive]}>{step.label}</Text></View>; })}</View>
      {failed ? <Pressable accessibilityRole="button" onPress={async () => { try { await documentsApi.retry(document.id); setDocument({ ...document, status: 'queued' }); } catch (error) { Alert.alert('Erro', error.message); } }} style={({ pressed }) => [styles.resultButton, pressed && styles.pressed]}><Text style={styles.resultButtonText}>Tentar novamente</Text></Pressable> : <Pressable accessibilityRole="button" onPress={() => navigate('documents')} style={({ pressed }) => [styles.resultButton, pressed && styles.pressed]}><Text style={styles.resultButtonText}>{done ? 'Ver meus documentos' : 'Ir para documentos'}</Text></Pressable>}
    </ScrollView>;
  }

  return <ScrollView style={common.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View><Text style={styles.title}>Enviar documento</Text><Text style={styles.subtitle}>PDF, JPG ou PNG de até 10 MB.</Text></View>
    {source === 'text' ? <View style={styles.textBox}><View style={styles.textBoxHead}><View style={styles.uploadIcon}><TextCursorInput size={23} color="#8B80FF" strokeWidth={1.7} /></View><View><Text style={styles.dropTitle}>Cole ou digite o texto</Text><Text style={styles.textHint}>A IA vai analisar o conteúdo enviado.</Text></View></View><TextInput value={manualText} onChangeText={setManualText} multiline textAlignVertical="top" placeholder="Cole aqui o conteúdo do documento..." placeholderTextColor="#6F7180" selectionColor="#6657F2" style={styles.textInput} accessibilityLabel="Texto do documento" /></View> : <Pressable accessibilityRole="button" accessibilityLabel="Escolher um arquivo" onPress={() => pick('file')} style={({ pressed }) => [styles.drop, pressed && styles.pressed]}>
      <Svg pointerEvents="none" viewBox="0 0 300 200" preserveAspectRatio="none" style={styles.dashedBorder}><Rect x="1" y="1" width="298" height="198" rx="17" fill="none" stroke="#363640" strokeWidth="2" strokeDasharray="11 7" /></Svg>
      <View style={styles.dropCopy}><View style={styles.uploadIcon}><Upload size={24} color="#8B80FF" strokeWidth={1.7} /></View>
      <Text style={styles.dropTitle}>{file?.name || 'Escolha um arquivo'}</Text>
      <Text style={styles.dropText}>{file ? `${Math.ceil(file.size / 1024)} KB` : 'Seus documentos são enviados com\nsegurança'}</Text>
      </View>{file?.type?.startsWith('image') ? <Image source={{ uri: file.uri }} style={styles.preview} /> : null}
      {file ? <Pressable accessibilityLabel="Remover arquivo" onPress={() => setFile(undefined)} style={styles.remove}><Trash2 size={15} color="#FF7E8A" /><Text style={styles.removeText}>Remover</Text></Pressable> : null}
    </Pressable>}
    <View style={styles.sources}><SourceButton Icon={FileText} label="Arquivo ou foto" active={source === 'file'} onPress={() => pick('file')} /><SourceButton Icon={Camera} label="Câmera" active={source === 'camera'} onPress={() => pick('camera')} /><SourceButton Icon={TextCursorInput} label="Texto" active={source === 'text'} onPress={() => setSource('text')} /></View>
    <View style={styles.typeSection}><Text style={styles.typeLabel}>TIPO DO DOCUMENTO</Text><View style={styles.chips}>{types.map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: type === value }} onPress={() => setType(value)} style={({ pressed }) => [styles.chip, type === value && styles.chipOn, pressed && styles.pressed]}><Text style={[styles.chipText, type === value && styles.chipTextOn]}>{label}</Text></Pressable>)}</View></View>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(!consent)} style={styles.consent}><View style={[styles.checkbox, consent && styles.checkboxOn]}>{consent ? <Text style={styles.check}>✓</Text> : null}</View><Text style={styles.consentText}>Autorizo o processamento deste documento{`\n`}conforme a <Text style={styles.policy}>política de privacidade.</Text></Text></Pressable>
    <Pressable accessibilityRole="button" disabled={!(source === 'text' ? manualText.trim().length >= 20 : file) || !consent || sending} onPress={send} style={({ pressed }) => [styles.send, (!(source === 'text' ? manualText.trim().length >= 20 : file) || !consent || sending) && styles.sendDisabled, pressed && (source === 'text' ? manualText.trim().length >= 20 : file) && consent && styles.pressed]}><Text style={[styles.sendText, (!(source === 'text' ? manualText.trim().length >= 20 : file) || !consent || sending) && styles.sendTextDisabled]}>{sending ? 'Enviando...' : 'Enviar para análise'}</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 28, paddingTop: 56, paddingBottom: 130 },
  title: { color: '#F4F4F8', fontSize: 23, fontWeight: '800', letterSpacing: .1 },
  subtitle: { color: '#7E8090', fontSize: 12, marginTop: 7 },
  drop: { minHeight: 197, marginTop: 22, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingVertical: 18, overflow: 'hidden' }, dashedBorder: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  dropCopy: { alignItems: 'center', transform: [{ translateY: -13 }] }, uploadIcon: { width: 58, height: 58, borderRadius: 17, backgroundColor: '#151331', borderWidth: 1, borderColor: '#342B78', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  dropTitle: { color: '#F2F1F6', fontSize: 13, fontWeight: '700' },
  dropText: { color: '#818395', fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 7 },
  preview: { width: 92, height: 58, borderRadius: 9, marginTop: 10 },
  remove: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, padding: 4 },
  removeText: { color: '#FF7E8A', fontSize: 11, fontWeight: '700' },
  textBox: { minHeight: 197, marginTop: 22, borderRadius: 18, borderWidth: 1, borderColor: '#2D2E38', backgroundColor: '#111219', padding: 16 }, textBoxHead: { flexDirection: 'row', alignItems: 'center', gap: 11 }, textHint: { color: '#818395', fontSize: 10, marginTop: 4 }, textInput: { flex: 1, minHeight: 102, color: '#F2F1F6', fontSize: 12, lineHeight: 18, paddingTop: 11, outlineStyle: 'none' },
  sources: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 21 },
  source: { width: '22%', flexGrow: 1, height: 71, borderRadius: 19, borderWidth: 1, borderColor: '#282A34', backgroundColor: '#111219', alignItems: 'center', justifyContent: 'center', gap: 7 },
  sourceActive: { borderColor: '#40349A', backgroundColor: '#151331' },
  sourceText: { color: '#A1A3B0', fontSize: 11, fontWeight: '600' },
  sourceTextActive: { color: '#C1B8FF' },
  typeSection: { marginTop: 22 }, typeLabel: { color: '#848697', fontSize: 9, letterSpacing: 1.3, fontWeight: '800', marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 33, paddingHorizontal: 16, borderRadius: 17, borderWidth: 1, borderColor: '#2C2E38', backgroundColor: '#111219', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: '#6657F2', borderColor: '#6657F2' }, chipText: { color: '#A1A3B0', fontSize: 11, fontWeight: '600' }, chipTextOn: { color: '#FFFFFF' },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 21, minHeight: 43 },
  checkbox: { width: 21, height: 21, borderRadius: 11, borderWidth: 1, borderColor: '#6F7280', alignItems: 'center', justifyContent: 'center' }, checkboxOn: { borderColor: '#6657F2', backgroundColor: '#6657F2' }, check: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  consentText: { flex: 1, color: '#A0A2AF', fontSize: 11, lineHeight: 16 }, policy: { color: '#8B80FF', fontWeight: '700' },
  send: { height: 56, borderRadius: 16, backgroundColor: '#6657F2', alignItems: 'center', justifyContent: 'center', marginTop: 18 }, sendDisabled: { backgroundColor: '#181920' }, sendText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' }, sendTextDisabled: { color: '#757786' }, pressed: { opacity: .82, transform: [{ scale: .99 }] },
  resultContent: { paddingHorizontal: 28, paddingTop: 68, paddingBottom: 130 }, resultIntro: { alignItems: 'center', paddingHorizontal: 12 }, resultIcon: { width: 62, height: 62, borderRadius: 21, backgroundColor: '#171433', borderWidth: 1, borderColor: '#38307E', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }, resultIconError: { backgroundColor: '#291319', borderColor: '#71303A' }, resultEyebrow: { color: '#9B91FF', fontSize: 9, letterSpacing: 1.4, fontWeight: '800' }, resultTitle: { color: '#F4F4F8', fontSize: 23, fontWeight: '800', marginTop: 9 }, resultSubtitle: { color: '#9294A2', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 9 }, progressCard: { marginTop: 30, borderRadius: 19, borderWidth: 1, borderColor: '#282A35', backgroundColor: '#111219', paddingHorizontal: 19, paddingVertical: 19, gap: 15 }, progressCardError: { borderColor: '#54262F' }, progressStep: { minHeight: 22, flexDirection: 'row', alignItems: 'center' }, progressMarker: { width: 26, height: 33, alignItems: 'center', position: 'relative' }, progressLine: { position: 'absolute', top: 21, width: 2, height: 19, backgroundColor: '#30323E' }, progressLineDone: { backgroundColor: '#6657F2' }, progressDot: { width: 21, height: 21, borderRadius: 11, backgroundColor: '#252631', borderWidth: 1, borderColor: '#3A3B47', alignItems: 'center', justifyContent: 'center' }, progressDotDone: { backgroundColor: '#6657F2', borderColor: '#6657F2' }, progressDotActive: { borderColor: '#9D92FF', boxShadow: '0 0 8px rgba(102, 87, 242, 0.38)' }, progressDotError: { backgroundColor: '#EF4444', borderColor: '#EF4444' }, progressText: { color: '#8F919E', fontSize: 12, marginLeft: 9 }, progressTextDone: { color: '#E6E4F7', fontWeight: '700' }, progressTextActive: { color: '#C8C1FF', fontWeight: '800' }, resultButton: { height: 54, borderRadius: 16, backgroundColor: '#6657F2', alignItems: 'center', justifyContent: 'center', marginTop: 21 }, resultButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' }
  , progressSymbol: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' }, progressRing: { position: 'absolute' }, progressPercent: { color: '#D7D2FF', fontSize: 13, fontWeight: '900' }
});
