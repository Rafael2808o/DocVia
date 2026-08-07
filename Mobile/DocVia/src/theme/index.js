import { StyleSheet } from 'react-native';

export const colors = {
  background: '#020202',
  surface: '#090B0C',
  surfaceRaised: '#121619',
  border: 'rgba(255,255,255,0.20)',
  text: '#EEF7FB',
  muted: '#9DB8C5',
  tertiary: '#718894',
  primary: '#B2D5E5',
  primaryDark: '#8FBCCC',
  primarySoft: '#B2D5E524',
  // O app usa azul como único tom de destaque, inclusive em estados concluídos.
  success: '#B2D5E5',
  warning: '#B2D5E5',
  error: '#EF4444',
  ai: '#B2D5E5',
  aiSoft: '#B2D5E51F',
  white: '#FFFFFF',
};
export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40 };
export const radii = { sm: 10, md: 16, lg: 22, pill: 999 };
export const typography = { display: { fontSize: 28, fontWeight: '700', lineHeight: 34 }, h2: { fontSize: 20, fontWeight: '600', lineHeight: 26 }, body: { fontSize: 15, fontWeight: '400', lineHeight: 22 }, caption: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' } };
export const shadows = { card: { shadowColor: '#000', shadowOpacity: .22, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 5 }, nav: { shadowColor: '#000', shadowOpacity: .12, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 12 } };
export const motion = { quick: 160, standard: 380, spring: { damping: 18, stiffness: 180 } };
export const common = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: spacing.lg, gap: spacing.md }, title: { color: colors.text, ...typography.display }, subtitle: { color: colors.muted, ...typography.body }, sectionTitle: { color: colors.text, ...typography.h2 }, card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadows.card } });
