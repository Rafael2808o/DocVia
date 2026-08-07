import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { deadlineDate, deadlineDescription } from '../utils/deadlines';

const KEY = 'docvia.notification-settings';
const defaults = { alertsEnabled: false, quietMode: false };
const native = Platform.OS !== 'web';
const expoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';

function notificationsModule() {
  if (!native || expoGo) return null;
  try { return require('expo-notifications'); } catch { return null; }
}

export function supportsDeviceNotifications() { return Boolean(notificationsModule()); }

async function ensureDeadlineChannel(Notifications) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('deadlines', {
    name: 'Prazos de documentos',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
  });
}

export async function requestDeviceNotificationPermission() {
  const Notifications = notificationsModule();
  if (!Notifications) return { supported: false, granted: false };
  await ensureDeadlineChannel(Notifications);
  const permission = await Notifications.requestPermissionsAsync();
  return { supported: true, granted: permission.granted };
}

async function read() { return native ? SecureStore.getItemAsync(KEY) : globalThis.localStorage?.getItem(KEY) || null; }
async function write(value) { if (native) return SecureStore.setItemAsync(KEY, value); globalThis.localStorage?.setItem(KEY, value); }

export async function loadNotificationSettings() {
  try { return { ...defaults, ...(JSON.parse(await read() || '{}')) }; } catch { return defaults; }
}

export async function saveNotificationSettings(settings) {
  const next = { ...defaults, ...settings };
  await write(JSON.stringify(next));
  return next;
}

function localDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
}

function triggerFor(dueDate, daysBefore, quietMode) {
  const trigger = localDate(dueDate);
  trigger.setDate(trigger.getDate() - daysBefore);
  trigger.setHours(quietMode ? 7 : 9, 0, 0, 0);
  return trigger;
}

export async function scheduleDeadlineAlerts(documents, settings) {
  const Notifications = notificationsModule();
  if (!Notifications) return 0;
  await ensureDeadlineChannel(Notifications);
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.alertsEnabled) return 0;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return 0;
  let created = 0;
  const now = new Date();
  for (const document of documents) {
    for (const item of document.analysis_deadlines || []) {
      const dueDate = deadlineDate(item);
      if (!dueDate) continue;
      const description = deadlineDescription(item);
      for (const daysBefore of [7, 3, 1]) {
        const trigger = triggerFor(dueDate, daysBefore, settings.quietMode);
        if (trigger <= now) continue;
        await Notifications.scheduleNotificationAsync({ content: { title: 'Prazo DocVia', body: `${description} vence em ${daysBefore} dia${daysBefore > 1 ? 's' : ''}.`, data: { documentId: document.id, dueDate }, ...(Platform.OS === 'android' ? { channelId: 'deadlines' } : {}) }, trigger });
        created += 1;
      }
    }
  }
  return created;
}

export async function scheduleSingleDeadlineReminder(dueDate, settings) {
  const Notifications = notificationsModule();
  if (!settings.alertsEnabled || !Notifications) return false;
  await ensureDeadlineChannel(Notifications);
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return false;
  const trigger = triggerFor(dueDate, 1, settings.quietMode);
  if (trigger <= new Date()) return false;
  await Notifications.scheduleNotificationAsync({ content: { title: 'Prazo DocVia', body: 'Você tem um prazo chegando amanhã.', ...(Platform.OS === 'android' ? { channelId: 'deadlines' } : {}) }, trigger });
  return true;
}
