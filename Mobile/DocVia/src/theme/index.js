import { StyleSheet } from 'react-native';

export const colors = {
  background: '#020202',
  surface: '#090B0C',
  surfaceRaised: '#121619',
  border: 'rgba(255,255,255,0.20)',
  text: '#EEF7FB',
  muted: '#9DB8C5',
  tertiary: '#718894',
  primary: '#147D92',
  primaryDark: '#0E6678',
  primaryLight: '#62D4C7',
  primarySoft: '#147D9224',
  // O azul-petróleo é a assinatura única do DocVia em ações, foco e estados ativos.
  success: '#62D4C7',
  warning: '#62D4C7',
  error: '#EF4444',
  ai: '#62D4C7',
  aiSoft: '#147D921F',
  white: '#FFFFFF',
};
export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40 };
export const radii = { sm: 10, md: 16, lg: 22, pill: 999 };
export const typography = { display: { fontSize: 28, fontWeight: '700', lineHeight: 34 }, h2: { fontSize: 20, fontWeight: '600', lineHeight: 26 }, body: { fontSize: 15, fontWeight: '400', lineHeight: 22 }, caption: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' } };
export const shadows = { card: { shadowColor: '#000', shadowOpacity: .22, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 5 }, nav: { shadowColor: '#000', shadowOpacity: .12, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 12 } };
export const motion = { quick: 160, standard: 380, spring: { damping: 18, stiffness: 180 } };
export const common = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: spacing.lg, gap: spacing.md }, title: { color: colors.text, ...typography.display }, subtitle: { color: colors.muted, ...typography.body }, sectionTitle: { color: colors.text, ...typography.h2 }, card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadows.card } });
