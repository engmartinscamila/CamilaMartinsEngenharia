import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

type NotificationsModule = typeof import('expo-notifications');

let notificationsPromise: Promise<NotificationsModule | null> | null = null;
let notificationHandlerConfigured = false;

async function loadNotifications() {
  if (Platform.OS === 'web' || Constants.expoVersion) return null;
  if (!notificationsPromise) {
    notificationsPromise = import('expo-notifications').then((Notifications) => {
      if (!notificationHandlerConfigured) {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });
        notificationHandlerConfigured = true;
      }
      return Notifications;
    }).catch(() => null);
  }
  return notificationsPromise;
}

export function isRunningInExpoGo() {
  return Platform.OS !== 'web' && Boolean(Constants.expoVersion);
}

export async function loadInstalledAppNotifications() {
  return loadNotifications();
}

export async function dispatchPendingPushNotifications() {
  try {
    await supabase.functions.invoke('send-push-notifications', { body: {} });
  } catch {
    // A notificação interna permanece disponível mesmo se o push estiver indisponível.
  }
}

export async function enablePushNotifications() {
  if (Platform.OS === 'web') {
    return 'Ative os avisos quando abrir a versão instalada no celular.';
  }
  if (isRunningInExpoGo()) {
    return 'O Expo Go mostra os avisos internos do aplicativo. As notificações na tela do celular serão ativadas na versão instalada.';
  }
  if (!Device.isDevice) {
    return 'As notificações precisam ser ativadas em um aparelho físico.';
  }

  const projectId = Constants.easConfig?.projectId
    ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId || typeof projectId !== 'string') {
    return 'O aplicativo ainda precisa ser vinculado ao projeto Expo/EAS para ativar avisos no celular.';
  }

  const Notifications = await loadNotifications();
  if (!Notifications) {
    return 'Os avisos internos continuam disponíveis. As notificações do celular exigem a versão instalada do aplicativo.';
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('atualizacoes', {
      name: 'Atualizações do projeto',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === 'granted'
    ? current
    : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') {
    return 'A permissão de notificações não foi concedida neste aparelho.';
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    const result = await supabase.rpc('register_own_push_token', {
      p_token: token.data,
      p_platform: Platform.OS,
      p_device_name: Device.deviceName ?? null,
    });
    if (result.error || result.data !== true) {
      return 'Não foi possível registrar este aparelho para receber avisos.';
    }
    void dispatchPendingPushNotifications();
    return null;
  } catch {
    return 'Não foi possível concluir a ativação dos avisos neste aparelho.';
  }
}

export async function markNotificationOpened(notificationId: string) {
  await supabase.rpc('mark_received_notification_read', {
    p_notificacao_id: notificationId,
  });
}
