import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import {
  isRunningInExpoGo,
  loadInstalledAppNotifications,
  markNotificationOpened,
} from '@/services/push-service';

export function PushNotificationBridge() {
  const router = useRouter();

  useEffect(() => {
    if (isRunningInExpoGo()) return;

    let active = true;
    let removeSubscription: (() => void) | undefined;

    void loadInstalledAppNotifications().then((Notifications) => {
      if (!Notifications || !active) return;

      const open = (response: Awaited<ReturnType<typeof Notifications.getLastNotificationResponseAsync>>) => {
        if (!response) return;
        const data = response.notification.request.content.data ?? {};
        const notificationId = typeof data.notificationId === 'string' ? data.notificationId : null;
        const linkPath = typeof data.linkPath === 'string' ? data.linkPath : null;
        if (notificationId) void markNotificationOpened(notificationId).catch(() => undefined);
        if (linkPath?.startsWith('/')) router.push(linkPath as never);
      };

      void Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined);
      const subscription = Notifications.addNotificationResponseReceivedListener(open);
      removeSubscription = () => subscription.remove();
    });

    return () => {
      active = false;
      removeSubscription?.();
    };
  }, [router]);

  return null;
}
