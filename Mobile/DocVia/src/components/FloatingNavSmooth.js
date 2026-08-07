import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CalendarClock, FileText, FileUp, House, UserRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';
import { useInteractiveState } from './ui';

const navItems = [
  { key: 'home', label: 'Início', Icon: House },
  { key: 'documents', label: 'Documentos', Icon: FileText },
  { key: 'upload', label: 'Enviar', Icon: FileUp },
  { key: 'deadlines', label: 'Prazos', Icon: CalendarClock },
  { key: 'profile', label: 'Perfil', Icon: UserRound },
];
const notchWidth = 200;
const bubbleSize = 50;
const animConfig = { duration: 520, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true };

function Tab({ item, active, onPress }) {
  const state = useInteractiveState();
  const color = state.hovered ? '#A8AAB4' : '#70727D';
  const [iconLift] = useState(() => new Animated.Value(active ? -26 : 0));
  useEffect(() => { Animated.timing(iconLift, { toValue: active ? -26 : 0, ...animConfig }).start(); }, [active, iconLift]);
  return (
    <Pressable {...state.bind} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={item.label} onPress={onPress} style={[styles.tab, active && styles.activeTab]}>
      <Animated.View style={[styles.iconSlot, { transform: [{ translateY: iconLift }] }]}><item.Icon size={21} color={active ? '#5D43F2' : color} strokeWidth={item.key === 'upload' ? 2.4 : 2} /></Animated.View>
      <Text style={styles.label}>{item.label}</Text>
    </Pressable>
  );
}

export default function FloatingNavSmooth({ active, navigate }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const barWidth = width;
  const itemWidth = barWidth / navItems.length;
  const activeIndex = Math.max(0, navItems.findIndex((item) => item.key === active));
  const initialCenter = activeIndex * itemWidth + itemWidth / 2;
  const [position] = useState(() => new Animated.Value(initialCenter));

  useEffect(() => {
    const target = activeIndex * itemWidth + itemWidth / 2;
    Animated.spring(position, {
      toValue: target,
      stiffness: 210,
      damping: 17,
      mass: 0.72,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, itemWidth, position]);

  const notchStyle = { transform: [{ translateX: Animated.add(position, -notchWidth / 2) }] };
  const bubbleStyle = { transform: [{ translateX: Animated.add(position, -bubbleSize / 2) }] };
  const open = (key) => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => undefined); navigate(key); };

  return (
    <View pointerEvents="box-none" style={[styles.outer, { paddingBottom: insets.bottom }]}>
      <View style={[styles.bar, { width: barWidth }]}>
        <Animated.View pointerEvents="none" style={[styles.notch, notchStyle]}>
          <Svg width={notchWidth} height={42}>
            <Path
  d="M 0 0 H 34
     C 58 0, 67 15, 80 29
     C 87 35, 93 39, 100 39
     C 109 39, 116 34, 128 24
     C 141 11, 149 0, 168 0
     H 200 Z"
  fill={colors.background}
/>
          </Svg>
        </Animated.View>
        <View style={styles.items}>{navItems.map((item) => <Tab key={item.key} item={item} active={item.key === active} onPress={() => open(item.key)} />)}</View>
        <Animated.View pointerEvents="none" style={[styles.bubble, bubbleStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: { height: 70, backgroundColor: colors.surfaceRaised, borderTopLeftRadius: 0, borderTopRightRadius: 0, shadowColor: '#000', shadowOpacity: 0, shadowRadius: 16, shadowOffset: { width: 0, height: -6 }, elevation: 0 },
  notch: { position: 'absolute', top: 0, left: 0, height: 42, zIndex: 1 },
  items: { flex: 1, flexDirection: 'row', alignItems: 'center', zIndex: 5 },
  tab: { flex: 1, height: 70, alignItems: 'center', justifyContent: 'center', zIndex: 2, outlineStyle: 'none' },
  iconSlot: { width: 36, height: 34, alignItems: 'center', justifyContent: 'center' },
  activeTab: { position: 'relative', zIndex: 6 },
  label: { display: 'none' },
  bubble: { position: 'absolute', left: 0, top: -16, width: bubbleSize, height: bubbleSize, borderRadius: bubbleSize / 2, backgroundColor: colors.surfaceRaised, borderWidth: 3, borderColor: colors.background, zIndex: 4 },
});
