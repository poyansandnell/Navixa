/**
 * Navixa — singleton Socket.IO client.
 *
 * Connects to the api-server's Socket.IO endpoint mounted at path
 * `/api/socket.io` on `https://${EXPO_PUBLIC_DOMAIN}`. The Clerk session JWT is
 * supplied in `handshake.auth.token` from the same token getter the REST client
 * uses (registered via `setSocketTokenGetter`). Reconnection is enabled.
 *
 * Rooms / events (see api-server realtime):
 *   client → server: match:subscribe {matchId} (ack), match:unsubscribe
 *   server → client: matchmaking:matched, match:update / match:move /
 *                    match:event, notification:new, friend:event
 */
import { io, type Socket } from 'socket.io-client';

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

type TokenGetter = () => Promise<string | null> | string | null;

let tokenGetter: TokenGetter | null = null;
let socket: Socket | null = null;

/** Register the getter used to populate handshake.auth.token on connect. */
export function setSocketTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}

/**
 * Return the shared socket, creating (and connecting) it lazily on first use.
 * The connection is authenticated via an async token callback so the freshest
 * Clerk token is used on every (re)connect.
 */
export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(BASE_URL, {
    path: '/api/socket.io',
    transports: ['websocket'],
    reconnection: true,
    autoConnect: true,
    auth: async (cb: (data: { token?: string }) => void) => {
      let token: string | null = null;
      try {
        token = tokenGetter ? await tokenGetter() : null;
      } catch {
        token = null;
      }
      cb({ token: token ?? undefined });
    },
  });

  return socket;
}

/** Ensure the socket exists and is connected. */
export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

/** Disconnect and tear down the shared socket (call on sign-out). */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

/** Subscribe to a match room; resolves once the server acks (or rejects). */
export function subscribeToMatch(matchId: string): Promise<boolean> {
  const s = connectSocket();
  return new Promise((resolve) => {
    s.emit('match:subscribe', { matchId }, (res: { ok?: boolean } | undefined) => {
      resolve(Boolean(res?.ok));
    });
  });
}

/** Leave a match room. */
export function unsubscribeFromMatch(matchId: string): void {
  if (socket) socket.emit('match:unsubscribe', { matchId });
}
