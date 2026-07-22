import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { realtimeClient, type RealtimeEntity } from '@/lib/realtime';
import { useGetMe } from '@/lib/api';

const ENTITY_QUERY_KEYS: Record<RealtimeEntity, unknown[][]> = {
  calls: [],
  chats: [['chat-logs']],
  credits: [],
  notifications: [['notifications']],
  contacts: [],
};

const RealtimeContext = createContext<typeof realtimeClient | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { data: user } = useGetMe({ query: { retry: false } });
  const queryClient = useQueryClient();
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      if (connectedRef.current) {
        realtimeClient.disconnect();
        connectedRef.current = false;
      }
      return;
    }

    realtimeClient.connect();
    connectedRef.current = true;

    const unsub = realtimeClient.on((event) => {
      if (event.type !== 'invalidate') return;
      const keys = ENTITY_QUERY_KEYS[event.entity] ?? [];
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    });

    return () => {
      unsub();
      realtimeClient.disconnect();
      connectedRef.current = false;
    };
  }, [user, queryClient]);

  return (
    <RealtimeContext.Provider value={realtimeClient}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used inside <RealtimeProvider>');
  return ctx;
}
