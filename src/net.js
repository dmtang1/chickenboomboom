import { joinRoom } from 'trystero';

const APP_ID = 'chicken-boom-boom';

export function connectRoom(code, handlers) {
  const room = joinRoom({
    appId: APP_ID,
    identity: 'local',
    maxUsers: 6,
    maxReceiveBytes: 2_000_000,
  }, `cbb-${code}`);
  const action = room.makeAction('m');
  const unsubscribe = [
    action.onMessage((data, context) => handlers.onMessage(data, context.peerId)),
    room.onPeerJoin((context) => handlers.onJoin(context.peerId), { replay: true }),
    room.onPeerLeave((context) => handlers.onLeave(context.peerId)),
    room.onError((error) => handlers.onError(error)),
  ];
  const ready = Promise.race([
    room.ready,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Could not reach a connection relay')), 12000);
    }),
  ]);
  return {
    ready,
    async selfId() {
      const info = await room.getSelf();
      return info.peerId;
    },
    send(data, target) {
      const options = target ? { target } : undefined;
      return action.send(data, options).catch(() => {});
    },
    async leave() {
      for (const stop of unsubscribe) stop();
      await room.leave();
    },
  };
}
