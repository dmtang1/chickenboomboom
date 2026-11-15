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
    action.onMessage((data, context) => handlers.onMessage(data, context.peerId, context.userId)),
    room.onPeerJoin((context) => handlers.onJoin(context.peerId, context.userId), { replay: true }),
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
    selfInfo() {
      return room.getSelf();
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

const CAR_KINDS = ['sedan', 'taxi', 'sport', 'police', 'van', 'truck', 'bus', 'cyber', 'wagon', 'diesel'];
const JUNK_KINDS = ['', 'duck', 'pin', 'ball', 'float'];
const FULL = 1;
const LAYOUT = 2;
const WALK = 1;
const ROOM = 2;
const DRIVE = 4;
const NEAR = 8;
const HOLD = 16;
const ECHO = 32;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function createWriter() {
  let buf = new Uint8Array(4096);
  let view = new DataView(buf.buffer);
  let at = 0;
  function fit(n) {
    if (at + n <= buf.length) return;
    let size = buf.length;
    while (at + n > size) size *= 2;
    const next = new Uint8Array(size);
    next.set(buf);
    buf = next;
    view = new DataView(buf.buffer);
  }
  function i16(n) {
    fit(2);
    const q = Math.max(-32767, Math.min(32767, Math.round(n)));
    view.setInt16(at, q, true);
    at += 2;
  }
  return {
    u8(n) { fit(1); buf[at++] = n & 255; },
    u16(n) { fit(2); view.setUint16(at, n & 65535, true); at += 2; },
    u32(n) { fit(4); view.setUint32(at, n >>> 0, true); at += 4; },
    f32(n) { fit(4); view.setFloat32(at, Number.isFinite(n) ? n : 0, true); at += 4; },
    i16,
    quat(x, y, z, w) {
      i16((x || 0) * 32767);
      i16((y || 0) * 32767);
      i16((z || 0) * 32767);
      i16((w || 0) * 32767);
    },
    str(value) {
      const raw = textEncoder.encode(String(value || ''));
      const n = Math.min(255, raw.length);
      fit(1 + n);
      buf[at++] = n;
      buf.set(raw.subarray(0, n), at);
      at += n;
    },
    bytes() { return buf.slice(0, at); },
  };
}

function createReader(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let at = 0;
  function need(n) {
    if (at + n > buf.length) throw new Error('short snap');
  }
  function i16() {
    need(2);
    const n = view.getInt16(at, true);
    at += 2;
    return n;
  }
  return {
    u8() { need(1); return buf[at++]; },
    u16() { need(2); const n = view.getUint16(at, true); at += 2; return n; },
    u32() { need(4); const n = view.getUint32(at, true); at += 4; return n; },
    f32() { need(4); const n = view.getFloat32(at, true); at += 4; return n; },
    i16,
    quat() {
      let x = i16() / 32767;
      let y = i16() / 32767;
      let z = i16() / 32767;
      let w = i16() / 32767;
      const len = Math.hypot(x, y, z, w) || 1;
      return [x / len, y / len, z / len, w / len];
    },
    str() {
      const n = this.u8();
      need(n);
      const text = textDecoder.decode(buf.subarray(at, at + n));
      at += n;
      return text;
    },
  };
}

function kindIndex(list, id) {
  const index = list.indexOf(id || '');
  return index < 0 ? 0 : index;
}

export function encodeSnap(packet) {
  const city = packet.city || {};
  const players = packet.players || [];
  const w = createWriter();
  w.u8(1);
  let flags = 0;
  if (city.full) flags |= FULL;
  if (city.layout) flags |= LAYOUT;
  w.u8(flags);
  w.f32(city.time || 0);
  w.f32(city.sx || 0);
  w.f32(city.sz || 0);
  const tiles = city.tiles || [];
  w.u8(Math.min(255, tiles.length));
  for (let i = 0; i < tiles.length && i < 255; i++) {
    w.i16(tiles[i][0] || 0);
    w.i16(tiles[i][1] || 0);
  }
  w.u8(Math.min(255, players.length));
  for (const pose of players) {
    w.str(pose.id);
    w.str(pose.name);
    w.u32(pose.color || 0);
    let bits = 0;
    if (pose.w) bits |= WALK;
    if (pose.room) bits |= ROOM;
    if (pose.drive) bits |= DRIVE;
    if (pose.near) bits |= NEAR;
    if (pose.hold) bits |= HOLD;
    if (pose.echo) bits |= ECHO;
    w.u8(bits);
    w.i16(pose.arm == null ? -1 : pose.arm);
    w.u8(Math.max(0, Math.min(255, Math.round((pose.chop || 0) * 255))));
    if (pose.w) {
      w.f32(pose.x || 0);
      w.f32(pose.y || 0);
      w.f32(pose.z || 0);
      w.f32(pose.yaw || 0);
      w.f32(pose.phase || 0);
      w.u8(Math.max(0, Math.min(255, Math.round((pose.gait || 0) * 100))));
    } else {
      const parts = pose.parts || [];
      w.u8(Math.min(255, parts.length));
      for (let i = 0; i < parts.length && i < 255; i++) {
        const row = parts[i];
        w.f32(row[0] || 0);
        w.f32(row[1] || 0);
        w.f32(row[2] || 0);
        w.quat(row[3], row[4], row[5], row[6]);
      }
    }
    if (pose.drive) w.i16(Math.round((pose.spd || 0) * 10));
    if (pose.hold) w.str(pose.hold);
    if (pose.echo) w.u32(pose.echo);
  }
  const cars = city.cars || [];
  w.u16(cars.length);
  for (const row of cars) {
    w.u16(row[0] || 0);
    w.u8(kindIndex(CAR_KINDS, row[1]));
    w.u32(row[2] || 0);
    w.f32(row[3] || 0);
    w.f32(row[4] || 0);
    w.f32(row[5] || 0);
    w.quat(row[6], row[7], row[8], row[9]);
    w.f32(row[10] || 0);
  }
  const carGone = city.full ? [] : (city.carGone || []);
  w.u16(carGone.length);
  for (const id of carGone) w.u16(id || 0);
  const junk = city.junk || [];
  w.u16(junk.length);
  for (const row of junk) {
    w.u16(row[0] || 0);
    w.f32(row[1] || 0);
    w.f32(row[2] || 0);
    w.f32(row[3] || 0);
    w.quat(row[4], row[5], row[6], row[7]);
    w.i16(Math.round((row[8] || 1) * 100));
    w.i16(Math.round((row[9] || 1) * 100));
    w.i16(Math.round((row[10] || 1) * 100));
    w.u8(kindIndex(JUNK_KINDS, row[12]));
    w.u32(row[11] || 0);
  }
  const junkGone = city.full ? [] : (city.junkGone || []);
  w.u16(junkGone.length);
  for (const id of junkGone) w.u16(id || 0);
  const toys = city.toys;
  if (!toys) w.u8(255);
  else {
    w.u8(Math.min(254, toys.length));
    for (let i = 0; i < toys.length && i < 254; i++) {
      const row = toys[i];
      w.f32(row[0] || 0);
      w.f32(row[1] || 0);
      w.f32(row[2] || 0);
      w.quat(row[3], row[4], row[5], row[6]);
    }
  }
  if (city.back) {
    w.u8(1);
    w.f32(city.back.x || 0);
    w.f32(city.back.z || 0);
    w.f32(city.back.yaw || 0);
  } else w.u8(0);
  if (flags & LAYOUT) {
    const buildings = city.buildings || [];
    w.u16(buildings.length);
    for (const id of buildings) w.str(id);
    const drops = city.drops || [];
    w.u8(Math.min(255, drops.length));
    for (let i = 0; i < drops.length && i < 255; i++) {
      w.u8(drops[i][0] || 0);
      w.f32(drops[i][1] || 0);
      w.f32(drops[i][2] || 0);
    }
    w.u32(city.hits || 0);
    if (city.cell) {
      w.u8(1);
      w.u8(city.cell.k ? 1 : 0);
      w.str(city.cell.b || '');
    } else w.u8(0);
  }
  return w.bytes();
}

export function decodeSnap(buf) {
  if (!buf || buf.length < 8) return null;
  try {
    const r = createReader(buf);
    if (r.u8() !== 1) return null;
    const flags = r.u8();
    const city = {
      time: r.f32(),
      sx: r.f32(),
      sz: r.f32(),
      tiles: [],
      cars: [],
      carGone: [],
      junk: [],
      junkGone: [],
      toys: null,
      back: null,
      full: !!(flags & FULL),
      layout: !!(flags & LAYOUT),
    };
    const tileCount = r.u8();
    for (let i = 0; i < tileCount; i++) city.tiles.push([r.i16(), r.i16()]);
    const players = [];
    const playerCount = r.u8();
    for (let i = 0; i < playerCount; i++) {
      const pose = {
        id: r.str(),
        name: r.str(),
        color: r.u32(),
      };
      const bits = r.u8();
      const arm = r.i16();
      pose.arm = arm;
      pose.chop = r.u8() / 255;
      pose.w = bits & WALK ? 1 : 0;
      if (bits & ROOM) pose.room = 1;
      if (bits & NEAR) pose.near = 1;
      if (pose.w) {
        pose.x = r.f32();
        pose.y = r.f32();
        pose.z = r.f32();
        pose.yaw = r.f32();
        pose.phase = r.f32();
        pose.gait = r.u8() / 100;
      } else {
        const n = r.u8();
        pose.parts = [];
        for (let p = 0; p < n; p++) {
          const x = r.f32();
          const y = r.f32();
          const z = r.f32();
          const q = r.quat();
          pose.parts.push([x, y, z, q[0], q[1], q[2], q[3]]);
        }
      }
      if (bits & DRIVE) {
        pose.drive = 1;
        pose.spd = r.i16() / 10;
      }
      if (bits & HOLD) pose.hold = r.str();
      if (bits & ECHO) pose.echo = r.u32();
      players.push(pose);
    }
    const carCount = r.u16();
    for (let i = 0; i < carCount; i++) {
      const id = r.u16();
      const kind = CAR_KINDS[r.u8()] || CAR_KINDS[0];
      const color = r.u32();
      const x = r.f32();
      const y = r.f32();
      const z = r.f32();
      const q = r.quat();
      const spin = r.f32();
      city.cars.push([id, kind, color, x, y, z, q[0], q[1], q[2], q[3], spin]);
    }
    const carGoneCount = r.u16();
    for (let i = 0; i < carGoneCount; i++) city.carGone.push(r.u16());
    const junkCount = r.u16();
    for (let i = 0; i < junkCount; i++) {
      const id = r.u16();
      const x = r.f32();
      const y = r.f32();
      const z = r.f32();
      const q = r.quat();
      const sx = r.i16() / 100;
      const sy = r.i16() / 100;
      const sz = r.i16() / 100;
      const kind = JUNK_KINDS[r.u8()] || '';
      const color = r.u32();
      city.junk.push([id, x, y, z, q[0], q[1], q[2], q[3], sx, sy, sz, color, kind]);
    }
    const junkGoneCount = r.u16();
    for (let i = 0; i < junkGoneCount; i++) city.junkGone.push(r.u16());
    const toyCount = r.u8();
    if (toyCount !== 255) {
      city.toys = [];
      for (let i = 0; i < toyCount; i++) {
        const x = r.f32();
        const y = r.f32();
        const z = r.f32();
        const q = r.quat();
        city.toys.push([x, y, z, q[0], q[1], q[2], q[3]]);
      }
    }
    if (r.u8()) city.back = { x: r.f32(), z: r.f32(), yaw: r.f32() };
    if (flags & LAYOUT) {
      city.buildings = [];
      const buildingCount = r.u16();
      for (let i = 0; i < buildingCount; i++) city.buildings.push(r.str());
      city.drops = [];
      const dropCount = r.u8();
      for (let i = 0; i < dropCount; i++) city.drops.push([r.u8(), r.f32(), r.f32()]);
      city.hits = r.u32();
      if (r.u8()) city.cell = { k: r.u8(), b: r.str() };
      else city.cell = null;
    }
    return { players, city };
  } catch {
    return null;
  }
}
