import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Clock3, FileText } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

const slides = [
  {
    title: 'Documentos sem\njuridiquês.',
    description: 'Envie um arquivo e receba um resumo\nsimples, com pontos importantes em\ndestaque.',
    Icon: FileText,
    accent: '#147D92',
    iconBackground: '#0A252B',
    iconBorder: '#1B5661',
    gradientTop: '#0B3540',
  },
  {
    title: 'Prazos que não passam.',
    description: 'A IA encontra datas importantes para\nvocê agir no momento certo.',
    Icon: Clock3,
    accent: '#62D4C7',
    iconBackground: '#0B292B',
    iconBorder: '#24635F',
    gradientTop: '#0A302F',
  },
  {
    title: 'Decida com clareza.',
    description: 'Custos, riscos e próximas ações em\numa experiência segura e privada.',
    Icon: Check,
    accent: '#2BA99E',
    iconBackground: '#0A2727',
    iconBorder: '#23635F',
    gradientTop: '#0A2B2C',
  },
];

export default function Onboarding({ done }) {
  const [page, setPage] = useState(0);
  const insets = useSafeAreaInsets();
  const slide = slides[page];
  const isLast = page === slides.length - 1;
  const advance = () => { if (isLast) done(); else setPage((current) => current + 1); };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 18, paddingBottom: Math.max(insets.bottom + 24, 40) }]}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="onboardingGlow" cx="50%" cy="-12%" r="78%">
            <Stop offset="0" stopColor={slide.gradientTop} stopOpacity="1" />
            <Stop offset="0.55" stopColor={slide.gradientTop} stopOpacity="0.48" />
            <Stop offset="1" stopColor="#071316" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="#071316" />
        <Rect width="100%" height="100%" fill="url(#onboardingGlow)" />
      </Svg>
      <Pressable accessibilityRole="button" accessibilityLabel="Pular apresentação" onPress={done} style={styles.skip}><Text style={styles.skipText}>Pular</Text></Pressable>

      <View style={styles.content}>
        <View style={[styles.iconBox, { backgroundColor: slide.iconBackground, borderColor: slide.iconBorder }]}><slide.Icon size={30} color={slide.accent} strokeWidth={1.7} /></View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.description}>{slide.description}</Text>
      </View>

      <View style={styles.footer}>
        <View accessibilityLabel={`Etapa ${page + 1} de ${slides.length}`} style={styles.dots}>{slides.map((item, index) => <View key={item.title} style={[styles.dot, index === page && { width: 20, backgroundColor: slide.accent }]} />)}</View>
        <Pressable accessibilityRole="button" onPress={advance} style={({ pressed }) => [styles.continue, { backgroundColor: slide.accent }, pressed && styles.continuePressed]}><Text style={styles.continueText}>{isLast ? 'Começar agora' : 'Continuar'}</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', alignSelf: 'stretch', paddingHorizontal: 24 },
  skip: { alignSelf: 'flex-end', minHeight: 40, justifyContent: 'center', paddingHorizontal: 2 },
  skipText: { color: '#71868B', fontSize: 11, fontWeight: '500' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 46 },
  iconBox: { width: 72, height: 72, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 35 },
  title: { color: '#F6F4FA', fontSize: 23, lineHeight: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  description: { color: '#AAB9BB', fontSize: 12, lineHeight: 19, fontWeight: '400', textAlign: 'center', marginTop: 17, letterSpacing: 0.1 },
  footer: { gap: 27 },
  dots: { height: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#26373B' },
  continue: { height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  continuePressed: { opacity: 0.83, transform: [{ scale: 0.99 }] },
  continueText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
