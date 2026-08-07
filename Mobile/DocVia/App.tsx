// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import FloatingNav from './src/components/FloatingNavSmooth';
import { Toast } from './src/components/ui';
import { colors } from './src/theme';
import { authApi, userApi } from './src/services/api';
import { clearSession, loadSession, saveSession, subscribeSessionExpiration } from './src/services/session';
import Onboarding from './src/screens/Onboarding';
import { Login, Register, Forgot } from './src/screens/Auth';
import Home from './src/screens/Home'; import Documents from './src/screens/DocumentsV2'; import Upload from './src/screens/UploadV2'; import Deadlines from './src/screens/Deadlines'; import Profile from './src/screens/ProfileV2'; import DocumentDetail from './src/screens/DocumentDetail';

export default function AppRoot() {
  const [session, setSession] = useState(); const [user, setUser] = useState(); const [screen, setScreen] = useState('boot'); const [detail, setDetail] = useState();
  useEffect(() => subscribeSessionExpiration(() => { setSession(); setUser(); setScreen('login'); }), []);
  useEffect(() => { (async () => { const saved = await loadSession(); if (!saved) { setScreen('onboarding'); return; } try { const account = await userApi.me(); const next = { ...saved, user: account }; await saveSession(next); setUser(account); setSession(next); setScreen('home'); } catch (error) { if (error?.status === 401 || error?.status === 403) { await clearSession(); setScreen('login'); return; } setUser(saved.user); setSession(saved); setScreen('home'); } })(); }, []);
  const login = async (email, senha) => { const r = await authApi.login(email, senha); const account = r.usuario ? { ...r.usuario, name: r.usuario.name || r.usuario.nome } : await userApi.me(); const next = { accessToken: r.access_token, refreshToken: r.refresh_token, user: account }; await saveSession(next); setSession(next); setUser(account); setScreen('home'); };
  const logout = async () => { try { await authApi.logout(session?.refreshToken); } finally { await clearSession(); setSession(); setUser(); setScreen('login'); } };
  /* Legacy inline routing kept below temporarily for reference.
  let content; if (screen === 'boot') content = <View style={styles.boot}><ActivityIndicator color={colors.primary} /><Text style={styles.bootText}>Carregando DocVia…</Text></View>; else if (screen === 'onboarding') content = <Onboarding done={() => setScreen('login')} />; else if (screen === 'login') content = <Login login={login} go={setScreen} />; else if (screen === 'register') content = <Register login={login} go={setScreen} />; else if (screen === 'forgot') content = <Forgot go={setScreen} />; else if (screen === 'detail') content = <DocumentDetail id={detail} back={() => setScreen('documents')} />; else if (screen === 'home') content = <Home user={user} navigate={setScreen} openDocument={id => { setDetail(id); setScreen('detail'); }} />; else if (screen === 'documents') content = <Documents openDocument={id => { setDetail(id); setScreen('detail'); }} />; else if (screen === 'upload') content = <Upload navigate={setScreen} />; else if (screen === 'deadlines') content = <Deadlines />; else content = <Profile user={user} onLogout={logout} />; return <SafeAreaProvider><StatusBar style="light" />{content}{session && screen !== 'detail' && <FloatingNav active={screen} navigate={setScreen} />}<Toast /></SafeAreaProvider>;
  */
  let content;
  if (screen === 'boot') content = <View style={styles.boot}><ActivityIndicator color={colors.primary} /><Text style={styles.bootText}>Carregando DocVia...</Text></View>;
  else if (screen === 'onboarding') content = <Onboarding done={() => setScreen('login')} />;
  else if (screen === 'login') content = <Login login={login} go={setScreen} />;
  else if (screen === 'register') content = <Register login={login} go={setScreen} />;
  else if (screen === 'forgot') content = <Forgot go={setScreen} />;
  else if (screen === 'detail') content = <DocumentDetail id={detail} back={() => setScreen('documents')} />;
  else if (screen === 'home') content = <Home user={user} navigate={setScreen} openDocument={id => { setDetail(id); setScreen('detail'); }} />;
  else if (screen === 'documents') content = <Documents navigate={setScreen} openDocument={id => { setDetail(id); setScreen('detail'); }} />;
  else if (screen === 'upload') content = <Upload navigate={setScreen} />;
  else if (screen === 'deadlines') content = <Deadlines navigate={setScreen} />;
  else content = <Profile user={user} onLogout={logout} navigate={setScreen} />;
  return <SafeAreaProvider style={styles.app}><StatusBar style="light" />{content}{session && screen !== 'detail' && <FloatingNav active={screen} navigate={setScreen} />}<Toast /></SafeAreaProvider>;
}
const styles = StyleSheet.create({ app: { flex: 1, width: '100%', backgroundColor: '#08080F' }, boot: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: 12 }, bootText: { color: colors.text } });
