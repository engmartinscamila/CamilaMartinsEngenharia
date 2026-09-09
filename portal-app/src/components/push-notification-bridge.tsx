import { notificationRoute } from '@/lib/notification-route';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import {
  isRunningInExpoGo,
  loadInstalledAppNotifications,
  markNotificationOpened,
} from '@/services/push-service';

export function PushNotificationBridge() {
  const router = useRouter();
  const { role, loading, session } = useAuth();
  const userId = session?.user.id;
  const lastOpened = useRef<string | null>(null);

  useEffect(() => {
    if (isRunningInExpoGo() || loading || !userId || !['admin', 'client', 'collaborator'].includes(role ?? '')) return;

    let active = true;
    let removeSubscription: (() => void) | undefined;

    void loadInstalledAppNotifications().then((Notifications) => {
      if (!Notifications || !active) return;

      const open = (response: Awaited<ReturnType<typeof Notifications.getLastNotificationResponseAsync>>) => {
        if (!response || !active) return;
        const responseKey = `${userId}:${response.notification.request.identifier}:${response.actionIdentifier}`;
        if (lastOpened.current === responseKey) return;
        lastOpened.current = responseKey;
        const data = response.notification.request.content.data ?? {};
        const notificationId = typeof data.notificationId === 'string' ? data.notificationId : null;
        const linkPath = typeof data.linkPath === 'string' ? data.linkPath : null;
        if (notificationId) void markNotificationOpened(notificationId).catch(() => undefined);
        const destination = notificationRoute(linkPath, role === 'admin' ? 'admin' : 'client', typeof data.projectId === 'string' ? data.projectId : null);
        if (destination) router.push(destination as never);
      };

      void Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined);
      const subscription = Notifications.addNotificationResponseReceivedListener(open);
      removeSubscription = () => subscription.remove();
    }).catch(() => undefined);

    return () => {
      active = false;
      removeSubscription?.();
    };
  }, [router, role, loading, userId]);

  return null;
}
