const microphoneButton = document.getElementById('microphone');
const startButton = document.getElementById('start');
const stopButton = document.getElementById('stop');
const calibrateButton = document.getElementById('calibrate');
const statusElement = document.getElementById('status');
const targetNoteElement = document.getElementById('targetNote');
const lyricElement = document.getElementById('lyric');
const detectedElement = document.getElementById('detected');
const scoreElement = document.getElementById('score');
const holdMeter = document.getElementById('holdMeter');
const exerciseSelect = document.getElementById('exercise');
const tempoInput = document.getElementById('tempo');
const tempoValue = document.getElementById('tempoValue');
const latencyInput = document.getElementById('latency');
const latencyValue = document.getElementById('latencyValue');
const sequenceInput = document.getElementById('sequence');
const backingInput = document.getElementById('backingFile');
const backingAudio = document.getElementById('backing');
const frenchNotationInput = document.getElementById('frenchNotation');
const scoreVolumeInput = document.getElementById('scoreVolume');
const scoreFileInput = document.getElementById('scoreFile');
const scoreTrackSelect = document.getElementById('scoreTrack');
const scoreTrackLabel = document.getElementById('scoreTrackLabel');
const canvas = document.getElementById('pitchCanvas');
const context2d = canvas.getContext('2d');
let audioContext;
let analyser;
let microphoneStream;
let sampleBuffer;
let animationFrame;
let run;
let backingUrl;
let importedTracks = [];

const englishNoteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const frenchNoteNames = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
const noteAliases = { DO: 'C', RE: 'D', RÉ: 'D', MI: 'E', FA: 'F', SOL: 'G', LA: 'A', SI: 'B' };
function midiFrequency(midi) { return 440 * 2 ** ((midi - 69) / 12); }
function midiLabel(midi) { const names = frenchNotationInput.checked ? frenchNoteNames : englishNoteNames; return `${names[(midi % 12 + 12) % 12]}${Math.floor(midi / 12) - 1}`; }
function parseNote(label) { const cleaned = label.trim().toUpperCase().replace('♯', '#').replace('♭', 'B'); const match = cleaned.match(/^([A-G]|DO|RE|RÉ|MI|FA|SOL|LA|SI)(#|B)?(-?\d)$/); if (!match) return null; const base = noteAliases[match[1]] || match[1]; const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }; let pitch = semitones[base]; if (match[2] === '#') pitch += 1; if (match[2] === 'B') pitch -= 1; return (Number(match[3]) + 1) * 12 + pitch; }

async function ensureMicrophone() {
  if (analyser) return true;
  if (!navigator.mediaDevices?.getUserMedia) { statusElement.textContent = 'Le microphone exige une page servie par localhost ou HTTPS.'; return false; }
  try {
    microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(microphoneStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = .15;
    source.connect(analyser);
    sampleBuffer = new Float32Array(analyser.fftSize);
    microphoneButton.textContent = 'Microphone actif';
    statusElement.textContent = 'Microphone actif. Le signal est analysé uniquement dans ce navigateur.';
    return true;
  } catch (error) {
    statusElement.textContent = `Microphone indisponible : ${error.message}`;
    return false;
  }
}

function detectPitch() {
  if (!analyser) return null;
  analyser.getFloatTimeDomainData(sampleBuffer);
  let energy = 0;
  for (const sample of sampleBuffer) energy += sample * sample;
  const rms = Math.sqrt(energy / sampleBuffer.length);
  if (rms < .012) return null;
  const minimumLag = Math.floor(audioContext.sampleRate / 1000);
  const maximumLag = Math.min(Math.floor(audioContext.sampleRate / 65), sampleBuffer.length / 2);
  let bestLag = 0;
  let bestCorrelation = 0;
  for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
    let correlation = 0;
    let normalizer = 0;
    for (let index = 0; index < sampleBuffer.length - lag; index += 1) {
      correlation += sampleBuffer[index] * sampleBuffer[index + lag];
      normalizer += sampleBuffer[index] ** 2 + sampleBuffer[index + lag] ** 2;
    }
    correlation = normalizer ? correlation * 2 / normalizer : 0;
    if (correlation > bestCorrelation) { bestCorrelation = correlation; bestLag = lag; }
  }
  if (bestCorrelation < .72 || !bestLag) return null;
  return { frequency: audioContext.sampleRate / bestLag, confidence: bestCorrelation, rms };
}

function builtInSequence() {
  if (exerciseSelect.value === 'score' && importedTracks.length) {
    const track = importedTracks[Number(scoreTrackSelect.value) || 0];
    let previousEnd = 0;
    return track.events.map(event => {
      const prepared = { midi: event.midi, beats: event.beats, gapBefore: Math.max(0, event.startBeat - previousEnd), lyric: event.lyric || '—', velocity: event.velocity || 78 };
      previousEnd = Math.max(previousEnd, event.startBeat + event.beats);
      return prepared;
    });
  }
  if (exerciseSelect.value === 'intervals') return [60, 64, 62, 67, 65, 69, 67, 72].map((midi, index) => ({ midi, beats: index % 2 ? 2 : 1, lyric: index % 2 ? 'Ah' : 'La' }));
  if (exerciseSelect.value === 'custom') {
    const custom = sequenceInput.value.trim().split(/\s+/).map(token => { const [note, beats = '1', lyric = 'La'] = token.split(':'); return { midi: parseNote(note), beats: Math.max(.25, Number(beats) || 1), lyric }; }).filter(note => note.midi !== null);
    if (custom.length) return custom;
  }
  return [60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60].map(midi => ({ midi, beats: 1, lyric: 'La' }));
}

function prepareRun() {
  const beatDuration = 60000 / Number(tempoInput.value);
  let elapsed = 0;
  const notes = builtInSequence().map(note => { elapsed += (note.gapBefore || 0) * beatDuration; const prepared = { ...note, start: elapsed, duration: note.beats * beatDuration }; elapsed += prepared.duration; return prepared; });
  return { notes, beatDuration, total: elapsed, startAt: performance.now() + beatDuration * 4, accumulatedAccuracy: 0, accumulatedVolumeAccuracy: 0, volumeTime: 0, detectedTime: 0, expectedTime: 0, samples: 0, complete: false, trail: [] };
}

function playClick(time, accent) { const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain(); oscillator.frequency.value = accent ? 1250 : 880; gain.gain.setValueAtTime(.0001, time); gain.gain.exponentialRampToValueAtTime(.18, time + .006); gain.gain.exponentialRampToValueAtTime(.0001, time + .07); oscillator.connect(gain).connect(audioContext.destination); oscillator.start(time); oscillator.stop(time + .09); }
function scheduleCountIn() { const delay = Math.max(0, (run.startAt - performance.now()) / 1000); for (let beat = 0; beat < 4; beat += 1) playClick(audioContext.currentTime + delay - (4 - beat) * run.beatDuration / 1000, beat === 0); }

function stopRun(message = 'Exercice arrêté.') { cancelAnimationFrame(animationFrame); if (run) run.complete = true; backingAudio.pause(); if (audioContext) { const silent = audioContext.createGain(); silent.gain.value = 0; silent.connect(audioContext.destination); } statusElement.textContent = message; targetNoteElement.textContent = '—'; lyricElement.textContent = 'En attente'; }

function finishRun() {
  const pitchScore = run.detectedTime ? Math.round(run.accumulatedAccuracy / run.detectedTime * 100) : 0;
  const holdScore = run.expectedTime ? Math.round(run.detectedTime / run.expectedTime * 100) : 0;
  const volumeScore = run.volumeTime ? Math.round(run.accumulatedVolumeAccuracy / run.volumeTime * 100) : 0;
  const total = Math.round(scoreVolumeInput.checked ? pitchScore * .6 + holdScore * .25 + volumeScore * .15 : pitchScore * .7 + holdScore * .3);
  const key = `game-hub:karaoke:${exerciseSelect.value}:${tempoInput.value}`;
  const best = Math.max(total, Number(localStorage.getItem(key) || 0));
  localStorage.setItem(key, String(best));
  window.GameRecords?.finish({ score: total, scoreLabel: `${total}/100`, won: true });
  run.complete = true;
  backingAudio.pause();
  statusElement.textContent = `Terminé : ${total}/100 · meilleur ${best}/100.`;
  renderScore(pitchScore, holdScore, volumeScore, total, best);
}

function renderScore(pitch = 0, hold = 0, volume = 0, total = 0, best = Number(localStorage.getItem(`game-hub:karaoke:${exerciseSelect.value}:${tempoInput.value}`) || 0)) { scoreElement.innerHTML = `<div>Justesse<br><strong>${pitch}%</strong></div><div>Tenue<br><strong>${hold}%</strong></div>${scoreVolumeInput.checked ? `<div>Nuance<br><strong>${volume}%</strong></div>` : ''}<div>Score<br><strong>${total}</strong></div><div>Record<br><strong>${best}</strong></div>`; }
function drawPitch(targetMidi, detectedMidi) {
  context2d.clearRect(0, 0, canvas.width, canvas.height);
  context2d.fillStyle = '#ffffff16';
  for (let line = 0; line < 9; line += 1) context2d.fillRect(0, line * canvas.height / 8, canvas.width, 1);
  const center = canvas.height / 2;
  context2d.strokeStyle = '#fde047'; context2d.lineWidth = 5; context2d.beginPath(); context2d.moveTo(0, center); context2d.lineTo(canvas.width, center); context2d.stroke();
  run.trail.push(detectedMidi === null ? null : center - (detectedMidi - targetMidi) * 34);
  if (run.trail.length > 150) run.trail.shift();
  context2d.strokeStyle = '#6ee7b7'; context2d.lineWidth = 4; context2d.beginPath();
  let started = false;
  run.trail.forEach((height, index) => { if (height === null) { started = false; return; } const x = index / 149 * canvas.width; if (!started) { context2d.moveTo(x, height); started = true; } else context2d.lineTo(x, height); });
  context2d.stroke();
}

function updateRun(now) {
  if (!run || run.complete) return;
  const elapsed = now - run.startAt + Number(latencyInput.value);
  if (elapsed < 0) { statusElement.textContent = `Départ dans ${Math.max(1, Math.ceil(-elapsed / run.beatDuration))} temps…`; animationFrame = requestAnimationFrame(updateRun); return; }
  const active = run.notes.find(note => elapsed >= note.start && elapsed < note.start + note.duration);
  if (!active) { if (elapsed >= run.total) { finishRun(); return; } targetNoteElement.textContent = '—'; lyricElement.textContent = 'Silence'; detectedElement.textContent = 'Note captée : —'; holdMeter.style.width = '0%'; animationFrame = requestAnimationFrame(updateRun); return; }
  const pitch = detectPitch();
  const detectedMidi = pitch ? 69 + 12 * Math.log2(pitch.frequency / 440) : null;
  const cents = detectedMidi === null ? null : Math.round((detectedMidi - active.midi) * 100);
  const delta = Math.min(40, now - (run.lastFrame || now));
  run.lastFrame = now;
  run.expectedTime += delta;
  if (detectedMidi !== null) {
    run.detectedTime += delta;
    run.accumulatedAccuracy += Math.max(0, 1 - Math.abs(cents) / 100) * delta;
    const expectedRms = .018 + (active.velocity || 78) / 127 * .09;
    const volumeAccuracy = Math.max(0, 1 - Math.abs(Math.log2(Math.max(.001, pitch.rms) / expectedRms)) / 3);
    run.accumulatedVolumeAccuracy += volumeAccuracy * delta;
    run.volumeTime += delta;
  }
  targetNoteElement.textContent = midiLabel(active.midi);
  lyricElement.textContent = active.lyric;
  detectedElement.textContent = detectedMidi === null ? 'Note captée : —' : `Note captée : ${midiLabel(Math.round(detectedMidi))} · ${cents > 0 ? '+' : ''}${cents} cents`;
  holdMeter.style.width = `${Math.min(100, (elapsed - active.start) / active.duration * 100)}%`;
  drawPitch(active.midi, detectedMidi);
  const pitchScore = run.detectedTime ? Math.round(run.accumulatedAccuracy / run.detectedTime * 100) : 0;
  const holdScore = run.expectedTime ? Math.round(run.detectedTime / run.expectedTime * 100) : 0;
  const volumeScore = run.volumeTime ? Math.round(run.accumulatedVolumeAccuracy / run.volumeTime * 100) : 0;
  const total = Math.round(scoreVolumeInput.checked ? pitchScore * .6 + holdScore * .25 + volumeScore * .15 : pitchScore * .7 + holdScore * .3);
  renderScore(pitchScore, holdScore, volumeScore, total);
  animationFrame = requestAnimationFrame(updateRun);
}

async function startRun() { if (!await ensureMicrophone()) return; stopRun('Préparation…'); await audioContext.resume(); run = prepareRun(); scheduleCountIn(); if (backingAudio.src) { backingAudio.currentTime = 0; setTimeout(() => backingAudio.play().catch(() => {}), Math.max(0, run.startAt - performance.now())); } statusElement.textContent = 'Mesure de décompte…'; animationFrame = requestAnimationFrame(updateRun); }

async function calibrate() {
  if (!await ensureMicrophone()) return;
  statusElement.textContent = 'Calibration : utilisez les haut-parleurs et gardez le silence.';
  const baseline = detectPitch()?.rms || .01;
  const expectedAt = performance.now() + 500;
  playClick(audioContext.currentTime + .5, true);
  const started = performance.now();
  const poll = () => {
    analyser.getFloatTimeDomainData(sampleBuffer);
    const rms = Math.sqrt(sampleBuffer.reduce((sum, sample) => sum + sample * sample, 0) / sampleBuffer.length);
    if (performance.now() > expectedAt && rms > Math.max(.025, baseline * 2.5)) { const latency = Math.max(0, Math.min(500, Math.round(performance.now() - expectedAt))); latencyInput.value = latency; latencyValue.textContent = `${latency} ms`; statusElement.textContent = `Latence micro estimée : ${latency} ms.`; return; }
    if (performance.now() - started > 1500) { statusElement.textContent = 'Calibration non détectée. Réglez la latence manuellement ou utilisez les haut-parleurs.'; return; }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}

microphoneButton.addEventListener('click', ensureMicrophone);
startButton.addEventListener('click', startRun);
stopButton.addEventListener('click', () => stopRun());
calibrateButton.addEventListener('click', calibrate);
tempoInput.addEventListener('input', () => { tempoValue.textContent = `${tempoInput.value} BPM`; renderScore(); });
latencyInput.addEventListener('input', () => { latencyValue.textContent = `${latencyInput.value} ms`; });
exerciseSelect.addEventListener('change', renderScore);
scoreVolumeInput.addEventListener('change', renderScore);
frenchNotationInput.addEventListener('change', () => {
  if (!run || run.complete) return;
  const active = run.notes.find(note => performance.now() - run.startAt >= note.start && performance.now() - run.startAt < note.start + note.duration);
  if (active) targetNoteElement.textContent = midiLabel(active.midi);
});
backingInput.addEventListener('change', () => { if (backingUrl) URL.revokeObjectURL(backingUrl); backingUrl = backingInput.files[0] ? URL.createObjectURL(backingInput.files[0]) : ''; backingAudio.src = backingUrl; });
scoreFileInput.addEventListener('change', async () => {
  const file = scoreFileInput.files[0];
  if (!file) return;
  try {
    statusElement.textContent = `Import de ${file.name}…`;
    importedTracks = await MusicScoreParser.parseFile(file);
    if (!importedTracks.length) throw new Error('Aucune voix contenant des notes n’a été trouvée.');
    scoreTrackSelect.innerHTML = importedTracks.map((track, index) => `<option value="${index}">${track.name} · ${track.events.length} notes</option>`).join('');
    scoreTrackLabel.hidden = importedTracks.length < 2;
    const importedOption = exerciseSelect.querySelector('option[value="score"]');
    importedOption.disabled = false;
    exerciseSelect.value = 'score';
    tempoInput.value = Math.max(Number(tempoInput.min), Math.min(Number(tempoInput.max), Math.round(importedTracks[0].tempo || 90)));
    tempoValue.textContent = `${tempoInput.value} BPM`;
    statusElement.textContent = `${importedTracks.length} voix importée${importedTracks.length > 1 ? 's' : ''}. Choisissez la voix puis démarrez.`;
    renderScore();
  } catch (error) { importedTracks = []; statusElement.textContent = `Import impossible : ${error.message}`; }
});
scoreTrackSelect.addEventListener('change', () => {
  const track = importedTracks[Number(scoreTrackSelect.value) || 0];
  if (!track) return;
  tempoInput.value = Math.max(Number(tempoInput.min), Math.min(Number(tempoInput.max), Math.round(track.tempo || 90)));
  tempoValue.textContent = `${tempoInput.value} BPM`;
});
window.addEventListener('beforeunload', () => { microphoneStream?.getTracks().forEach(track => track.stop()); if (backingUrl) URL.revokeObjectURL(backingUrl); });
renderScore();

window.KaraokeTestAPI = {
  diagnostics() {
    const prepared = prepareRun();
    return {
      do4: parseNote('Do4'),
      c4: parseNote('C4'),
      siFlat3: parseNote('Si♭3'),
      sequenceLength: prepared.notes.length,
      positiveDuration: prepared.total > 0 && prepared.notes.every(note => note.duration > 0),
      fourBeatCountIn: prepared.startAt - performance.now() > prepared.beatDuration * 3.8,
      frenchNotationDefault: frenchNotationInput.checked
    };
  }
};

localStorage.setItem('game-hub:last-game', 'karaoke');
