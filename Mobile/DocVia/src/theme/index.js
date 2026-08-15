import { StyleSheet } from 'react-native';

export const colors = {
  background: '#071012',
  surface: '#0B171A',
  surfaceRaised: '#102126',
  border: '#24434A',
  text: '#F0FAFB',
  muted: '#9AB4B8',
  tertiary: '#6D8B91',
  primary: '#39C6CB',
  primaryDark: '#168B94',
  primarySoft: '#39C6CB24',
  success: '#46C79D',
  warning: '#E5B866',
  error: '#EF4444',
  ai: '#39C6CB',
  aiSoft: '#39C6CB1F',
  white: '#FFFFFF',
};
export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40 };
export const radii = { sm: 10, md: 16, lg: 22, pill: 999 };
export const typography = { display: { fontSize: 28, fontWeight: '700', lineHeight: 34 }, h2: { fontSize: 20, fontWeight: '600', lineHeight: 26 }, body: { fontSize: 15, fontWeight: '400', lineHeight: 22 }, caption: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' } };
export const shadows = { card: { shadowColor: '#000', shadowOpacity: .22, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 5 }, nav: { shadowColor: '#000', shadowOpacity: .12, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 12 } };
export const motion = { quick: 160, standard: 380, spring: { damping: 18, stiffness: 180 } };
export const common = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: spacing.lg, gap: spacing.md }, title: { color: colors.text, ...typography.display }, subtitle: { color: colors.muted, ...typography.body }, sectionTitle: { color: colors.text, ...typography.h2 }, card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadows.card } });
