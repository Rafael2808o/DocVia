import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Eye, EyeOff, LockKeyhole, Mail, UserRound, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input, Screen } from '../components/ui';
import { authApi } from '../services/api';
import { common, spacing } from '../theme';

const accent = '#5D43F2';
const darkIcon = '#77758D';

function Field({ label, icon, children }) {
  const focused = useSharedValue(0);
  const focusStyle = useAnimatedStyle(() => ({ borderColor: interpolateColor(focused.value, [0, 1], ['#292838', accent]), shadowColor: accent, shadowOpacity: focused.value * .28, shadowRadius: focused.value * 10, elevation: focused.value * 4 }));
  const onFocus = () => { focused.set(withTiming(1, { duration: 150 })); };
  const onBlur = () => { focused.set(withTiming(0, { duration: 150 })); };
  const input = React.Children.map(children, (child) => child?.type === TextInput ? React.cloneElement(child, { onFocus, onBlur }) : child);
  return <><Text style={styles.fieldLabel}>{label}</Text><Animated.View style={[styles.authField, focusStyle]}>{icon(darkIcon)}{input}</Animated.View></>;
}

function AuthButton({ title, loading, onPress }) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={loading} style={({ pressed }) => [styles.authButton, pressed && styles.authPressed, loading && styles.authDisabled]}><Text style={styles.authButtonText}>{loading ? 'Aguarde...' : title}</Text></Pressable>;
}

function AuthLayout({ children, style }) {
  return <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={[styles.screen, style]} keyboardShouldPersistTaps="always" keyboardDismissMode="none" showsVerticalScrollIndicator={false}>{children}</ScrollView></KeyboardAvoidingView>;
}

export function Login({ login, go }) {
  const [email, setEmail] = useState(''); const [senha, setSenha] = useState(''); const [show, setShow] = useState(false); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const insets = useSafeAreaInsets();
  const submit = async () => { if (!email || !senha) return setError('Informe seu e-mail e senha.'); setLoading(true); try { await login(email, senha); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  return <AuthLayout style={{ paddingTop: insets.top + 42, paddingBottom: Math.max(insets.bottom, 24) }}>
    <View><Text style={styles.brand}>DOCVIA</Text><Text style={styles.title}>Entenda antes{'\n'}de assinar.</Text><Text style={styles.subtitle}>Seus documentos, explicados com clareza.</Text></View>
    <View style={styles.loginForm}>
      <Field label="E-MAIL" icon={(color) => <Mail size={17} color={color} strokeWidth={1.8} />}><TextInput value={email} onChangeText={setEmail} placeholder="seuemail@exemplo.com" placeholderTextColor="#8B899A" selectionColor={accent} autoComplete="email" textContentType="emailAddress" importantForAutofill="yes" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={styles.authInput} accessibilityLabel="E-mail" /></Field>
      <Field label="SENHA" icon={(color) => <LockKeyhole size={17} color={color} strokeWidth={1.8} />}><TextInput value={senha} onChangeText={setSenha} placeholder="••••••••••" placeholderTextColor="#B7B5C5" selectionColor={accent} autoComplete="current-password" textContentType="password" importantForAutofill="yes" secureTextEntry={!show} style={styles.authInput} accessibilityLabel="Senha" /><Pressable accessibilityRole="button" accessibilityLabel={show ? 'Ocultar senha' : 'Mostrar senha'} onPress={() => setShow((value) => !value)} hitSlop={10}>{show ? <EyeOff size={17} color={darkIcon} /> : <Eye size={17} color={darkIcon} />}</Pressable></Field>
      {error ? <Text style={styles.error}>{error}</Text> : null}<AuthButton title="Entrar" loading={loading} onPress={submit} /><Pressable accessibilityRole="button" onPress={() => go('forgot')} style={styles.forgot}><Text style={styles.linkText}>Esqueci minha senha</Text></Pressable>
    </View>
    <View style={styles.loginBottom}><Text style={styles.question}>Ainda não tem conta?</Text><Pressable accessibilityRole="button" onPress={() => go('register')} style={({ pressed }) => [styles.createButton, pressed && styles.linkPressed]}><Text style={styles.createText}>Criar conta</Text></Pressable></View>
  </AuthLayout>;
}

export function Register({ login, go }) {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [senha, setSenha] = useState(''); const [show, setShow] = useState(false); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const insets = useSafeAreaInsets();
  const submit = async () => { if (!name || !email || senha.length < 8) return setError('Preencha os dados; a senha precisa de 8 caracteres.'); setLoading(true); try { await authApi.register(name, email, senha); await login(email, senha); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  return <AuthLayout style={{ paddingTop: insets.top + 30, paddingBottom: Math.max(insets.bottom, 24) }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Voltar ao login" onPress={() => go('login')} style={({ pressed }) => [styles.close, pressed && styles.closePressed]}><X size={17} color="#858198" strokeWidth={1.8} /></Pressable>
    <View><Text style={styles.title}>Crie sua conta</Text><Text style={styles.subtitle}>Comece a entender seus documentos hoje.</Text></View>
    <View style={styles.registerForm}>
      <Field label="NOME" icon={(color) => <UserRound size={17} color={color} strokeWidth={1.8} />}><TextInput value={name} onChangeText={setName} placeholder="Seu nome completo" placeholderTextColor="#8B899A" selectionColor={accent} autoComplete="name" textContentType="name" importantForAutofill="yes" autoCapitalize="words" style={styles.authInput} accessibilityLabel="Nome completo" /></Field>
      <Field label="E-MAIL" icon={(color) => <Mail size={17} color={color} strokeWidth={1.8} />}><TextInput value={email} onChangeText={setEmail} placeholder="seuemail@exemplo.com" placeholderTextColor="#8B899A" selectionColor={accent} autoComplete="email" textContentType="emailAddress" importantForAutofill="yes" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={styles.authInput} accessibilityLabel="E-mail" /></Field>
      <Field label="SENHA" icon={(color) => <LockKeyhole size={17} color={color} strokeWidth={1.8} />}><TextInput value={senha} onChangeText={setSenha} placeholder="••••••••••" placeholderTextColor="#B7B5C5" selectionColor={accent} autoComplete="new-password" textContentType="newPassword" importantForAutofill="yes" secureTextEntry={!show} style={styles.authInput} accessibilityLabel="Senha" /><Pressable accessibilityRole="button" accessibilityLabel={show ? 'Ocultar senha' : 'Mostrar senha'} onPress={() => setShow((value) => !value)} hitSlop={10}>{show ? <EyeOff size={17} color={darkIcon} /> : <Eye size={17} color={darkIcon} />}</Pressable></Field>
      {error ? <Text style={styles.error}>{error}</Text> : null}<AuthButton title="Criar conta" loading={loading} onPress={submit} />
      <Pressable accessibilityRole="link" onPress={() => go('privacy')} style={styles.forgot}><Text style={styles.linkText}>Política de Privacidade</Text></Pressable>
    </View>
    <Pressable accessibilityRole="button" onPress={() => go('login')} style={({ pressed }) => [styles.loginLink, pressed && styles.linkPressed]}><Text style={styles.linkText}>Já tenho conta</Text></Pressable>
  </AuthLayout>;
}

export function Forgot({ go }) {
  const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(false); const insets = useSafeAreaInsets();
  const submit = async () => { if (!email) return setMessage('Informe seu e-mail para continuar.'); setLoading(true); try { await authApi.forgotPassword(email); setMessage('Se este e-mail estiver cadastrado, as instruções foram enviadas.'); } catch (e) { setMessage(e.message); } finally { setLoading(false); } };
  return <AuthLayout style={{ paddingTop: insets.top + 30, paddingBottom: Math.max(insets.bottom, 24) }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Voltar ao login" onPress={() => go('login')} style={({ pressed }) => [styles.close, pressed && styles.closePressed]}><X size={17} color="#858198" strokeWidth={1.8} /></Pressable>
    <View><Text style={styles.title}>Recupere sua senha</Text><Text style={styles.subtitle}>Informe seu e-mail para receber as instruções.</Text></View>
    <View style={styles.forgotForm}><Field label="E-MAIL" icon={(color) => <Mail size={17} color={color} strokeWidth={1.8} />}><TextInput value={email} onChangeText={setEmail} placeholder="seuemail@exemplo.com" placeholderTextColor="#8B899A" selectionColor={accent} autoComplete="email" textContentType="emailAddress" importantForAutofill="yes" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={styles.authInput} accessibilityLabel="E-mail" /></Field>{message ? <Text style={styles.message}>{message}</Text> : null}<AuthButton title="Enviar instruções" loading={loading} onPress={submit} /><Button title="Já tenho um código" variant="ghost" onPress={() => go('reset')} /></View>
    <Pressable accessibilityRole="button" onPress={() => go('login')} style={({ pressed }) => [styles.loginLink, pressed && styles.linkPressed]}><Text style={styles.linkText}>Voltar ao login</Text></Pressable>
  </AuthLayout>;
}

export function Reset({ go, initialToken = '' }) { const [token, setToken] = useState(initialToken); const [senha, setSenha] = useState(''); const [message, setMessage] = useState(''); return <Screen style={styles.legacy}><Text style={common.title}>Nova senha</Text><Text style={common.subtitle}>Use o código recebido e escolha uma senha segura.</Text><Input label="Código de recuperação" value={token} onChangeText={setToken} autoCapitalize="none" /><Input label="Nova senha" value={senha} onChangeText={setSenha} secureTextEntry autoComplete="new-password" /><Button title="Salvar nova senha" onPress={async () => { try { await authApi.resetPassword(token, senha); setMessage('Senha atualizada. Você já pode entrar.'); } catch (e) { setMessage(e.message); } }} />{message ? <Text style={styles.message}>{message}</Text> : null}<Button title="Voltar ao login" variant="ghost" onPress={() => go('login')} /></Screen>; }

const styles = StyleSheet.create({
  legacy: { justifyContent: 'center', flexGrow: 1, gap: spacing.md }, keyboard: { flex: 1 }, screen: { flexGrow: 1, paddingHorizontal: 39, backgroundColor: '#090910' }, brand: { color: '#8B80FF', fontSize: 11, fontWeight: '900', letterSpacing: 3, marginBottom: 20 }, title: { color: '#F7F5FA', fontSize: 29, lineHeight: 36, letterSpacing: .3, fontWeight: '800' }, subtitle: { color: '#B8B4C5', fontSize: 13, marginTop: 11 }, fieldLabel: { color: '#79758E', fontSize: 9, fontWeight: '800', letterSpacing: 1.6, marginTop: 5 }, authField: { height: 53, borderRadius: 20, borderWidth: 1, borderColor: '#292838', backgroundColor: '#171720', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17, gap: 13 }, authFieldFocused: { borderColor: accent, shadowColor: accent, shadowOpacity: .28, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 4 }, authInput: { flex: 1, color: '#F7F5FA', fontSize: 13, paddingVertical: 0, backgroundColor: '#171720' }, loginForm: { marginTop: 39, gap: 10 }, registerForm: { marginTop: 38, gap: 10 }, forgotForm: { marginTop: 38, gap: 10 }, authButton: { height: 55, marginTop: 11, borderRadius: 17, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }, authPressed: { opacity: .84, transform: [{ scale: .99 }] }, authDisabled: { opacity: .5 }, authButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' }, error: { color: '#EF7373', fontSize: 11, lineHeight: 16 }, message: { color: '#B8B4C5', fontSize: 12, textAlign: 'center', lineHeight: 18 }, forgot: { height: 43, alignItems: 'center', justifyContent: 'center' }, linkText: { color: '#B8B4C5', fontSize: 13 }, loginBottom: { marginTop: 'auto', alignItems: 'center', gap: 15 }, question: { color: '#77758D', fontSize: 13 }, createButton: { width: '100%', height: 57, borderRadius: 17, borderWidth: 1, borderColor: '#2B2A39', alignItems: 'center', justifyContent: 'center' }, createText: { color: '#F7F5FA', fontSize: 14, fontWeight: '800' }, close: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#2B2A39', backgroundColor: '#13131C', alignItems: 'center', justifyContent: 'center', marginBottom: 38 }, closePressed: { opacity: .72, transform: [{ scale: .96 }] }, loginLink: { alignSelf: 'center', height: 44, marginTop: 18, alignItems: 'center', justifyContent: 'center' }, linkPressed: { opacity: .65 }
});
