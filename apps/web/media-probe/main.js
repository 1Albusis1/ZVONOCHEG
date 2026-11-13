import { ExternalE2EEKeyProvider, Room, RoomEvent, Track } from 'livekit-client';
import EncryptionWorker from 'livekit-client/e2ee-worker?worker';

const form = document.querySelector('form');
const connect = form.querySelector('button');
const mic = document.querySelector('#mic');
const leave = document.querySelector('#leave');
const status = document.querySelector('#status');
const tracks = document.querySelector('#tracks');
let active;

async function close(session, message) {
  if (active !== session) return;
  mic.disabled = true;
  leave.disabled = true;
  active = undefined;
  try {
    await session.room.disconnect();
  } finally {
    session.worker.terminate();
    tracks.replaceChildren();
    mic.textContent = 'Включить микрофон';
    connect.disabled = false;
    status.textContent = message;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (active) return;
  const values = new FormData(form);
  const keyProvider = new ExternalE2EEKeyProvider();
  const worker = new EncryptionWorker();
  const room = new Room({ encryption: { keyProvider, worker } });
  const session = { room, worker };
  active = session;
  connect.disabled = true;
  form.elements.key.value = '';
  form.elements.token.value = '';
  status.textContent = 'Подключение…';
  room.on(RoomEvent.EncryptionError, () => void close(session, 'Ошибка E2EE. Соединение закрыто.'));
  room.on(RoomEvent.Disconnected, (reason) => {
    if (session.connected) void close(session, `Соединение прервано (код ${reason ?? 'не указан'})`);
  });
  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (active === session && track.kind === Track.Kind.Audio) {
      const audio = track.attach();
      audio.controls = true;
      tracks.append(audio);
    }
  });
  room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((element) => element.remove()));
  try {
    await keyProvider.setKey(values.get('key'));
    await room.setE2EEEnabled(true);
    await room.connect(values.get('endpoint'), values.get('token'), {
      rtcConfig: { iceTransportPolicy: values.has('relay') ? 'relay' : 'all' },
    });
    if (active !== session) return;
    if (!room.isE2EEEnabled) throw new Error('E2EE unavailable');
    session.connected = true;
    mic.disabled = false;
    leave.disabled = false;
    status.textContent = 'Подключено с E2EE';
  } catch (error) {
    const code = typeof error?.status === 'number' ? ` HTTP ${error.status}` : '';
    const reason = typeof error?.reason === 'number' ? ` (код LiveKit ${error.reason})` : '';
    await close(session, `Подключение с E2EE не удалось.${code}${reason} Проверьте адрес и срок действия токена.`);
  }
});

mic.addEventListener('click', async () => {
  const session = active;
  if (!session) return;
  mic.disabled = true;
  try {
    const participant = session.room.localParticipant;
    await participant.setMicrophoneEnabled(!participant.isMicrophoneEnabled);
    if (active !== session) return;
    mic.textContent = participant.isMicrophoneEnabled ? 'Выключить микрофон' : 'Включить микрофон';
    mic.disabled = false;
  } catch {
    await close(session, 'Не удалось включить или выключить микрофон');
  }
});
leave.addEventListener('click', () => {
  if (active) void close(active, 'Отключено');
});
