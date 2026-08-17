// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import FloatingNav from './src/components/FloatingNavSmooth';
import { Toast } from './src/components/ui';
import { colors } from './src/theme';
import { authApi, userApi } from './src/services/api';
import { clearSession, loadSession, saveSession, subscribeSessionExpiration } from './src/services/session';
import { completeOnboarding, hasCompletedOnboarding } from './src/services/onboarding';
import Onboarding from './src/screens/Onboarding';
import { Login, Register, Forgot, Reset, VerifyEmail } from './src/screens/Auth';
import Home from './src/screens/Home'; import Documents from './src/screens/DocumentsV2'; import Upload from './src/screens/UploadV2'; import Deadlines from './src/screens/Deadlines'; import Profile from './src/screens/ProfileV2'; import DocumentDetail from './src/screens/DocumentDetail';
import PrivacyPolicy from './src/screens/PrivacyPolicy';

function parseAuthLink(url) {
  if (!url) return null;
  const parsed = Linking.parse(url);
  const token = typeof parsed.queryParams?.token === 'string' ? parsed.queryParams.token : '';
  if (!token) return null;
  if (parsed.path === 'reset-password' || parsed.hostname === 'reset-password') return { screen: 'reset', token };
  if (parsed.path === 'verify-email' || parsed.hostname === 'verify-email') return { screen: 'verify', token };
  return null;
}

export default function AppRoot() {
  const [session, setSession] = useState(); const [user, setUser] = useState(); const [screen, setScreen] = useState('boot'); const [detail, setDetail] = useState(); const [resetToken, setResetToken] = useState(''); const [verificationToken, setVerificationToken] = useState(''); const [pendingEmail, setPendingEmail] = useState('');
  useEffect(() => subscribeSessionExpiration(() => { setSession(); setUser(); setScreen('login'); }), []);
  useEffect(() => { (async () => { const initialLink = parseAuthLink(await Linking.getInitialURL()); if (initialLink?.screen === 'reset') { setResetToken(initialLink.token); setScreen('reset'); return; } if (initialLink?.screen === 'verify') { setVerificationToken(initialLink.token); setScreen('verify'); return; } const saved = await loadSession(); if (!saved) { setScreen(await hasCompletedOnboarding() ? 'login' : 'onboarding'); return; } try { const account = await userApi.me(); const next = { ...saved, user: account }; await saveSession(next); setUser(account); setSession(next); setScreen('home'); } catch (error) { if (error?.status === 401 || error?.status === 403) { await clearSession(); setScreen('login'); return; } setUser(saved.user); setSession(saved); setScreen('home'); } })(); }, []);
  useEffect(() => {
    const openAuthLink = ({ url }) => {
      const authLink = parseAuthLink(url);
      if (authLink?.screen === 'reset') setResetToken(authLink.token);
      if (authLink?.screen === 'verify') setVerificationToken(authLink.token);
      if (authLink) setScreen(authLink.screen);
    };
    const subscription = Linking.addEventListener('url', openAuthLink);
    return () => subscription.remove();
  }, []);
  const login = async (email, senha) => { const r = await authApi.login(email, senha); const account = r.usuario ? { ...r.usuario, name: r.usuario.name || r.usuario.nome } : await userApi.me(); const next = { accessToken: r.access_token, refreshToken: r.refresh_token, user: account }; await saveSession(next); setSession(next); setUser(account); setScreen('home'); };
  const logout = async () => { try { await authApi.logout(session?.refreshToken); } finally { await clearSession(); setSession(); setUser(); setScreen('login'); } };
  let content;
  if (screen === 'boot') content = <View style={styles.boot}><ActivityIndicator accessibilityLabel="Carregando DocVia" color={colors.primary} /><Text style={styles.bootText}>Carregando DocVia...</Text></View>;
  else if (screen === 'onboarding') content = <Onboarding done={async () => { await completeOnboarding(); setScreen('login'); }} />;
  else if (screen === 'login') content = <Login login={login} go={setScreen} onVerificationRequired={(email) => { setPendingEmail(email); setVerificationToken(''); setScreen('verify'); }} />;
  else if (screen === 'register') content = <Register go={setScreen} onRegistered={(email) => { setPendingEmail(email); setVerificationToken(''); setScreen('verify'); }} />;
  else if (screen === 'forgot') content = <Forgot go={setScreen} />;
  else if (screen === 'reset') content = <Reset go={setScreen} initialToken={resetToken} />;
  else if (screen === 'verify') content = <VerifyEmail key={verificationToken || pendingEmail} go={setScreen} email={pendingEmail} initialToken={verificationToken} />;
  else if (screen === 'privacy') content = <PrivacyPolicy back={() => setScreen(session ? 'profile' : 'register')} />;
  else if (screen === 'detail') content = <DocumentDetail id={detail} back={() => setScreen('documents')} />;
  else if (screen === 'home') content = <Home user={user} navigate={setScreen} openDocument={id => { setDetail(id); setScreen('detail'); }} />;
  else if (screen === 'documents') content = <Documents navigate={setScreen} openDocument={id => { setDetail(id); setScreen('detail'); }} />;
  else if (screen === 'upload') content = <Upload navigate={setScreen} />;
  else if (screen === 'deadlines') content = <Deadlines navigate={setScreen} />;
  else content = <Profile user={user} onLogout={logout} navigate={setScreen} />;
  return <SafeAreaProvider style={styles.app}><StatusBar style="light" />{content}{session && !['detail', 'privacy', 'reset', 'verify'].includes(screen) && <FloatingNav active={screen} navigate={setScreen} />}<Toast /></SafeAreaProvider>;
}
const styles = StyleSheet.create({ app: { flex: 1, width: '100%', backgroundColor: colors.background }, boot: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: 12 }, bootText: { color: colors.text } });
