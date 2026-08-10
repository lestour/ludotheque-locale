import { WorkletSynthesizer } from '../../vendor/spessasynth_lib/dist/index.js?v=local-2';

const programs = [
  [/celesta/i, 8], [/glockenspiel/i, 9], [/music.?box|boîte.*musique/i, 10], [/vibraphone/i, 11], [/marimba/i, 12], [/xylophone/i, 13], [/tubular|carillon/i, 14],
  [/harpsichord|clavecin/i, 6], [/clavinet/i, 7], [/piano|keyboard|clavier/i, 0], [/accordion|accordéon/i, 21], [/harmonica/i, 22], [/organ|orgue/i, 19], [/guitar|guitare/i, 24],
  [/acoustic.*bass|contrebasse/i, 32], [/electric.*bass|basse électrique/i, 33],
  [/violin|violon/i, 40], [/viola|alto string/i, 41], [/cello|violoncelle/i, 42],
  [/contrabass|string.*bass/i, 43], [/tremolo.*string/i, 44], [/pizzicato/i, 45], [/harp|harpe/i, 46], [/timpani|timbale/i, 47],
  [/string.*ensemble|ensemble.*corde/i, 48], [/choir|chorus|chœur|choeur|vocal|voice\.choir|voice\.vocals|soprano|mezzo|contralto|t[ée]nor.*voice|baritone.*voice|bass.*voice/i, 52], [/voice.*oohs|voix/i, 53], [/synth.*voice/i, 54],
  [/trumpet|trompette|cornet|bugle/i, 56], [/trombone/i, 57],
  [/tuba|sousaphone/i, 58], [/horn|cor /i, 60], [/saxophone alto|alto sax/i, 65],
  [/saxophone.*t[ée]nor|tenor sax/i, 66], [/baritone sax|saxophone baryton/i, 67],
  [/oboe|hautbois/i, 68], [/clarinet|clarinette/i, 71], [/piccolo/i, 72], [/flute|flûte/i, 73],
  [/recorder|flûte à bec/i, 74], [/pan.?flute|flûte de pan/i, 75], [/shakuhachi/i, 77], [/whistle|sifflet/i, 78], [/ocarina/i, 79],
  [/euphonium|baritone/i, 58], [/bassoon|basson/i, 70], [/sitar/i, 104], [/banjo/i, 105], [/mandolin/i, 105], [/bagpipe|cornemuse/i, 109], [/fiddle/i, 110]
];
const channelPrograms = new Map();
const channelActiveUntil = new Map();
let context;
let synth;
let loading;
let playbackGeneration = 0;
const noteOffTimers = new Set();

function audioContextConstructor() {
  return window.AudioContext || window.webkitAudioContext;
}

function withTimeout(promise, milliseconds, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = window.setTimeout(() => reject(new Error(message)), milliseconds); })
  ]).finally(() => window.clearTimeout(timer));
}

function isDrums(name = '') { return /drum|percussion|batterie/i.test(name); }
function programFor(name = '') { const match = programs.find(([pattern]) => pattern.test(name)); if (match) return match[1]; if (/voice|vocal|choir|chor/i.test(name)) return 52; if (/strings?|bowed|corde/i.test(name)) return 48; if (/brass|cuivre/i.test(name)) return 56; if (/wind\.flutes?|flute|flûte/i.test(name)) return 73; if (/wind\.reed|reed|anche/i.test(name)) return 71; if (/pitched.?percussion|mallet/i.test(name)) return 11; if (/pluck|guitar|guitare/i.test(name)) return 24; if (/synth/i.test(name)) return 80; return 0; }
function channelFor(name = '', duration = .4) {
  if (isDrums(name)) return 9;
  const program = programFor(name); const now = performance.now(); const channels = Array.from({ length: 16 }, (_, index) => index).filter(index => index !== 9);
  let channel = channels.find(index => channelPrograms.get(index) === program);
  channel ??= channels.find(index => (channelActiveUntil.get(index) || 0) <= now);
  channel ??= channels.sort((left, right) => (channelActiveUntil.get(left) || 0) - (channelActiveUntil.get(right) || 0))[0];
  if (channelPrograms.get(channel) !== program) { synth.programChange(channel, program); channelPrograms.set(channel, program); }
  channelActiveUntil.set(channel, Math.max(channelActiveUntil.get(channel) || 0, now + duration * 1000));
  return channel;
}

async function init() {
  if (synth) return synth;
  if (loading) return loading;
  loading = (async () => {
    const AudioContextClass = audioContextConstructor();
    if (!AudioContextClass) throw new Error('Web Audio n’est pas disponible dans ce navigateur');
    context = new AudioContextClass({ latencyHint: 'interactive' });
    if (!context.audioWorklet?.addModule) throw new Error('AudioWorklet n’est pas disponible dans ce navigateur');
    if (context.state === 'suspended') await context.resume();
    await context.audioWorklet.addModule(new URL('../../vendor/spessasynth_lib/dist/spessasynth_processor.min.js?v=local-2', import.meta.url));
    synth = new WorkletSynthesizer(context);
    synth.connect(context.destination);
    const response = await fetch(new URL('./assets/MS-Basic.sf3', import.meta.url));
    if (!response.ok) throw new Error(`SoundFont introuvable (${response.status})`);
    const soundBank = await response.arrayBuffer();
    if (soundBank.byteLength < 1024 * 1024) throw new Error('SoundFont incomplet ou corrompu');
    await withTimeout(synth.soundBankManager.addSoundBank(soundBank, 'MS Basic'), 45000, 'décodage MS Basic trop long');
    await withTimeout(synth.isReady, 15000, 'moteur SoundFont non initialisé');
    return synth;
  })().catch(error => {
    loading = null;
    synth?.destroy?.();
    synth = null;
    context?.close?.().catch(() => {});
    context = null;
    throw new Error(`${error.message} [${location.protocol}//${location.host || 'fichier local'}]`, { cause: error });
  });
  return loading;
}

async function play({ pitch, velocity = 80, duration = .4, instrument = '' }) {
  const generation = playbackGeneration;
  await init();
  if (generation !== playbackGeneration) return;
  if (context.state === 'suspended') await context.resume();
  if (generation !== playbackGeneration) return;
  const channel = channelFor(instrument, duration);
  const midiPitch = Math.max(0, Math.min(127, Math.round(pitch)));
  synth.noteOn(channel, midiPitch, Math.max(1, Math.min(127, Math.round(velocity))));
  const timer = window.setTimeout(() => {
    noteOffTimers.delete(timer);
    if (generation === playbackGeneration) synth?.noteOff(channel, midiPitch);
  }, Math.max(40, duration * 1000));
  noteOffTimers.add(timer);
}

function stopAll() {
  playbackGeneration += 1;
  noteOffTimers.forEach(window.clearTimeout);
  noteOffTimers.clear();
  channelActiveUntil.clear();
  synth?.stopAll(true);
}
function resume() { return context?.state === 'suspended' ? context.resume() : Promise.resolve(); }

window.SoundFontEngine = {
  init,
  play,
  stopAll,
  resume,
  get ready() { return Boolean(synth); },
  get status() { return { ready: Boolean(synth), context: context?.state || 'absent' }; }
};
window.dispatchEvent(new CustomEvent('soundfont-engine-ready'));
