/* eslint-disable react-hooks/set-state-in-effect */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { ArrowLeft, ExternalLink, ShieldCheck } from 'lucide-react-native';
import { Button, ErrorState, Skeleton } from '../components/ui';
import { userApi } from '../services/api';
import { common } from '../theme';

export default function PrivacyPolicy({ back }) {
  const [policy, setPolicy] = useState();
  const [error, setError] = useState('');
  const load = useCallback(async () => { try { setError(''); setPolicy(await userApi.privacyPolicy()); } catch (nextError) { setError(nextError.message); } }, []);
  useEffect(() => { load(); }, [load]);
  if (error) return <ScrollView style={common.screen} contentContainerStyle={styles.content}><ErrorState error={error} retry={load} /></ScrollView>;
  if (!policy) return <ScrollView style={common.screen} contentContainerStyle={styles.content}><Skeleton height={40} /><Skeleton height={160} /></ScrollView>;
  return <ScrollView style={common.screen} contentContainerStyle={styles.content}>
    <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={back} style={styles.back}><ArrowLeft size={17} color="#7FD9D0" /><Text style={styles.backText}>Voltar</Text></Pressable>
    <View style={styles.heading}><View style={styles.icon}><ShieldCheck size={22} color="#7FD9D0" /></View><View><Text style={styles.title}>Privacidade</Text><Text style={styles.version}>Versão {policy.version} · atualizada em {policy.updated_at}</Text></View></View>
    <Text style={styles.summary}>{policy.summary}</Text>
    <Text style={styles.label}>DADOS PROCESSADOS</Text>
    <View style={styles.card}>{(policy.data_collected || []).map((item) => <Text key={item} style={styles.item}>• {item}</Text>)}</View>
    <Text style={styles.label}>RETENÇÃO</Text><Text style={styles.body}>{policy.retention}</Text>
    {policy.contact ? <Text style={styles.body}>Contato de privacidade: {policy.contact}</Text> : <Text style={styles.warning}>O contato público de privacidade ainda não foi configurado.</Text>}
    {policy.privacy_policy_url ? <Button title="Abrir política completa" onPress={() => Linking.openURL(policy.privacy_policy_url)} /> : null}
    {policy.account_deletion_url ? <Pressable accessibilityRole="link" onPress={() => Linking.openURL(policy.account_deletion_url)} style={styles.link}><ExternalLink size={15} color="#7FD9D0" /><Text style={styles.linkText}>Solicitar exclusão pela web</Text></Pressable> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 28, paddingTop: 58, paddingBottom: 60, gap: 16 }, back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8 }, backText: { color: '#91E0D8', fontSize: 12, fontWeight: '800' }, heading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, icon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0C282E', borderWidth: 1, borderColor: '#1F5964' }, title: { color: '#F4F4F8', fontSize: 24, fontWeight: '800' }, version: { color: '#858796', fontSize: 10, marginTop: 4 }, summary: { color: '#D7D7E0', fontSize: 13, lineHeight: 21 }, label: { color: '#888A99', fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginTop: 8 }, card: { borderRadius: 17, borderWidth: 1, borderColor: '#292B35', backgroundColor: '#111219', padding: 15, gap: 8 }, item: { color: '#D7D7E0', fontSize: 12, lineHeight: 18 }, body: { color: '#A0A2B0', fontSize: 12, lineHeight: 19 }, warning: { color: '#FFC52E', fontSize: 11, lineHeight: 17 }, link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, linkText: { color: '#91E0D8', fontSize: 12, fontWeight: '800' },
});
