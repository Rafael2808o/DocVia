import { StyleSheet } from 'react-native';

export const colors = {
  background: '#0B0D12',
  surface: '#14161B',
  surfaceRaised: '#1B1F27',
  border: 'rgba(255,255,255,0.08)',
  text: '#F5F7FA',
  muted: '#A5AEC0',
  tertiary: '#6E7788',
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  primarySoft: '#3B82F624',
  // O app usa azul como único tom de destaque, inclusive em estados concluídos.
  success: '#3B82F6',
  warning: '#F59E0B',
  error: '#EF4444',
  ai: '#8B5CF6',
  aiSoft: '#8B5CF61F',
  white: '#FFFFFF',
};
export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40 };
export const radii = { sm: 10, md: 16, lg: 22, pill: 999 };
export const typography = { display: { fontSize: 28, fontWeight: '700', lineHeight: 34 }, h2: { fontSize: 20, fontWeight: '600', lineHeight: 26 }, body: { fontSize: 15, fontWeight: '400', lineHeight: 22 }, caption: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' } };
export const shadows = { card: { shadowColor: '#000', shadowOpacity: .22, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 5 }, nav: { shadowColor: '#000', shadowOpacity: .12, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 12 } };
export const motion = { quick: 160, standard: 380, spring: { damping: 18, stiffness: 180 } };
export const common = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: spacing.lg, gap: spacing.md }, title: { color: colors.text, ...typography.display }, subtitle: { color: colors.muted, ...typography.body }, sectionTitle: { color: colors.text, ...typography.h2 }, card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadows.card } });
