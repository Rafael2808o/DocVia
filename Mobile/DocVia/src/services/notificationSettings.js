import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const KEY = 'docvia.notification-settings';
const defaults = { alertsEnabled: true, quietMode: false };
const native = Platform.OS !== 'web';
const expoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';

function notificationsModule() {
  if (!native || expoGo) return null;
  try { return require('expo-notifications'); } catch { return null; }
}

export function supportsDeviceNotifications() { return Boolean(notificationsModule()); }

export async function requestDeviceNotificationPermission() {
  const Notifications = notificationsModule();
  if (!Notifications) return { supported: false, granted: false };
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

function deadlineDate(item) {
  const raw = typeof item === 'string' ? item : item?.due_date || item?.data || item?.description || item?.descricao;
  const iso = String(raw || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = String(raw || '').match(/([0-3]?\d)[/-]([0-1]?\d)[/-](\d{4})/);
  return br ? `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}` : null;
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
      const description = typeof item === 'string' ? item : item.description || item.descricao || 'Prazo identificado';
      for (const daysBefore of [7, 3, 1]) {
        const trigger = triggerFor(dueDate, daysBefore, settings.quietMode);
        if (trigger <= now) continue;
        await Notifications.scheduleNotificationAsync({ content: { title: 'Prazo DocVia', body: `${description} vence em ${daysBefore} dia${daysBefore > 1 ? 's' : ''}.`, data: { documentId: document.id, dueDate } }, trigger });
        created += 1;
      }
    }
  }
  return created;
}

export async function scheduleSingleDeadlineReminder(dueDate, settings) {
  const Notifications = notificationsModule();
  if (!settings.alertsEnabled || !Notifications) return false;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return false;
  const trigger = triggerFor(dueDate, 1, settings.quietMode);
  if (trigger <= new Date()) return false;
  await Notifications.scheduleNotificationAsync({ content: { title: 'Prazo DocVia', body: 'Você tem um prazo chegando amanhã.' }, trigger });
  return true;
}
