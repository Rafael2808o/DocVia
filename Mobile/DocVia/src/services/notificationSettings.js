import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { deadlineDate, deadlineDescription, normalizeDeadlines } from '../utils/deadlines';

const KEY = 'docvia.notification-settings';
const defaults = { alertsEnabled: false, quietMode: false };
const native = Platform.OS !== 'web';
const expoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
let handlerConfigured = false;

function notificationsModule() {
  if (!native || expoGo) return null;
  try {
    const Notifications = require('expo-notifications');
    if (!handlerConfigured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
      });
      handlerConfigured = true;
    }
    return Notifications;
  } catch { return null; }
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

function dateTrigger(Notifications, date) {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date,
    ...(Platform.OS === 'android' ? { channelId: 'deadlines' } : {}),
  };
}

async function scheduleDocuments(Notifications, documents, settings) {
  let created = 0;
  const now = new Date();
  for (const document of documents) {
    for (const item of normalizeDeadlines(document.analysis_deadlines || [], document.extracted_text || '')) {
      const dueDate = deadlineDate(item);
      if (!dueDate) continue;
      const description = deadlineDescription(item);
      for (const daysBefore of [7, 3, 1]) {
        const trigger = triggerFor(dueDate, daysBefore, settings.quietMode);
        if (trigger <= now) continue;
        await Notifications.scheduleNotificationAsync({ content: { title: 'Prazo DocVia', body: `${description} vence em ${daysBefore} dia${daysBefore > 1 ? 's' : ''}.`, data: { documentId: document.id, dueDate }, sound: 'default' }, trigger: dateTrigger(Notifications, trigger) });
        created += 1;
      }
    }
  }
  return created;
}

export async function scheduleDeadlineAlerts(documents, settings) {
  const Notifications = notificationsModule();
  if (!Notifications) return 0;
  await ensureDeadlineChannel(Notifications);
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.alertsEnabled) return 0;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return 0;
  return scheduleDocuments(Notifications, documents, settings);
}

export async function scheduleSingleDeadlineReminder(dueDate, settings) {
  const Notifications = notificationsModule();
  if (!settings.alertsEnabled || !Notifications) return false;
  await ensureDeadlineChannel(Notifications);
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return false;
  const trigger = triggerFor(dueDate, 1, settings.quietMode);
  if (trigger <= new Date()) return false;
  await Notifications.scheduleNotificationAsync({ content: { title: 'Prazo DocVia', body: 'Você tem um prazo chegando amanhã.', sound: 'default' }, trigger: dateTrigger(Notifications, trigger) });
  return true;
}

export async function reconcileDeadlineAlerts(documents) {
  return scheduleDeadlineAlerts(documents, await loadNotificationSettings());
}

export async function reconcileDocumentDeadlineAlerts(document) {
  const Notifications = notificationsModule();
  if (!Notifications) return 0;
  const settings = await loadNotificationSettings();
  await ensureDeadlineChannel(Notifications);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const matching = scheduled.filter((item) => String(item.content?.data?.documentId || '') === String(document.id));
  await Promise.all(matching.map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
  if (!settings.alertsEnabled) return 0;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return 0;
  return scheduleDocuments(Notifications, [document], settings);
}

export async function clearScheduledDeadlineAlerts() {
  const Notifications = notificationsModule();
  if (Notifications) await Notifications.cancelAllScheduledNotificationsAsync();
}

// Registra a forma de apresentação assim que o aplicativo nativo inicia.
notificationsModule();
