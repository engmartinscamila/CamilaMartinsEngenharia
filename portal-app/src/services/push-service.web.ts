import { supabase } from '@/lib/supabase';

export async function dispatchPendingPushNotifications() {
  // A versão web usa a central interna e os indicadores de não lidas.
}

export async function enablePushNotifications() {
  return 'Ative os avisos quando abrir a versão instalada no celular.';
}

export async function markNotificationOpened(notificationId: string) {
  await supabase.rpc('mark_received_notification_read', {
    p_notificacao_id: notificationId,
  });
}
