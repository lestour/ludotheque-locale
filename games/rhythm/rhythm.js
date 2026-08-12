const stage = document.getElementById('stage');
const fileInput = document.getElementById('file');
const modeSelect = document.getElementById('mode');
const startButton = document.getElementById('start');
const trackList = document.getElementById('trackList');
const scoreElement = document.getElementById('score');
const accuracyElement = document.getElementById('accuracy');
const recordsElement = document.getElementById('records');
const statusElement = document.getElementById('status');
const copyStatusButton = document.createElement('button');
copyStatusButton.type = 'button';
copyStatusButton.textContent = 'Copier le diagnostic';
copyStatusButton.hidden = true;
statusElement.after(copyStatusButton);
const accidentalsToggle = document.getElementById('accidentals');
const palette = ['#fb7185', '#fb923c', '#facc15', '#a3e635', '#34d399', '#22d3ee', '#60a5fa', '#c084fc'];
const keyCodes = { piano: ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight'], buttons: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'] };
const defaultInputMappings = {
  piano: keyCodes.piano.slice(),
  buttons: keyCodes.buttons.slice(),
  valves: ['KeyA', 'KeyS', 'KeyD'],
  slide: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7'],
  breath: 'Space',
  pause: 'Escape',
  restart: 'Backspace',
  rhythm: 'Space',
  organ: ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL']
};
let inputMappings = structuredClone(defaultInputMappings);
try { inputMappings = { ...inputMappings, ...JSON.parse(localStorage.getItem('rhythm-input-mappings') || '{}') }; } catch {}
const macKeyboard = /mac/i.test(navigator.userAgentData?.platform || navigator.platform || '');
const keyboardLayoutDefinitions = {
  azerty: {
    base: { Digit1: '&', Digit2: 'É', Digit3: '"', Digit4: "'", Digit5: '(', Digit6: '§', Digit7: 'È', Digit8: '!', Digit9: 'Ç', Digit0: 'À', KeyQ: 'A', KeyW: 'Z', KeyE: 'E', KeyR: 'R', KeyT: 'T', KeyY: 'Y', KeyU: 'U', KeyI: 'I', KeyO: 'O', KeyP: 'P', BracketLeft: '^', BracketRight: '$', KeyA: 'Q', KeyS: 'S', KeyD: 'D', KeyF: 'F', KeyG: 'G', KeyH: 'H', KeyJ: 'J', KeyK: 'K', KeyL: 'L', Semicolon: 'M', Quote: 'Ù' },
    shift: { Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9', Digit0: '0', BracketLeft: '¨', BracketRight: macKeyboard ? '*' : '£', Quote: '%' }
  },
  qwerty: {
    base: { KeyQ: 'Q', KeyW: 'W', KeyE: 'E', KeyR: 'R', KeyT: 'T', KeyY: 'Y', KeyU: 'U', KeyI: 'I', KeyO: 'O', KeyP: 'P', BracketLeft: '[', BracketRight: ']', KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyF: 'F', KeyG: 'G', KeyH: 'H', KeyJ: 'J', KeyK: 'K', KeyL: 'L', Semicolon: ';', Quote: "'" },
    shift: { BracketLeft: '{', BracketRight: '}', Semicolon: ':', Quote: '"' }
  },
  qwertz: {
    base: { KeyQ: 'Q', KeyW: 'W', KeyE: 'E', KeyR: 'R', KeyT: 'T', KeyY: 'Z', KeyU: 'U', KeyI: 'I', KeyO: 'O', KeyP: 'P', BracketLeft: 'Ü', BracketRight: '+', KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyF: 'F', KeyG: 'G', KeyH: 'H', KeyJ: 'J', KeyK: 'K', KeyL: 'L', Semicolon: 'Ö', Quote: 'Ä' },
    shift: {}
  }
};
const friendlyCodeLabels = { Space: 'Espace', Escape: 'Échap', Backspace: 'Retour arrière', Enter: 'Entrée', Tab: 'Tab', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/' };
function localeKeyboardLayout() {
  const language = (navigator.languages?.[0] || navigator.language || '').toLowerCase();
  if (/^de(?:-|$)/.test(language)) return 'qwertz';
  return /^fr(?:-|$)/.test(language) ? 'azerty' : 'qwerty';
}
let keyboardLayout = localeKeyboardLayout();
let keyboardLayoutStored = false;
try {
  const storedLayout = localStorage.getItem('rhythm-keyboard-layout');
  if (storedLayout && (keyboardLayoutDefinitions[storedLayout] || storedLayout === 'auto')) {
    keyboardLayout = storedLayout;
    keyboardLayoutStored = true;
  }
} catch {}
let learnedKeyLabels = { base: {}, shift: {} };
try { learnedKeyLabels = { ...learnedKeyLabels, ...JSON.parse(localStorage.getItem('rhythm-key-labels') || '{}') }; } catch {}
let keyLabels = {};
let shiftedKeyLabels = {};
function refreshKeyLabels() {
  const definition = keyboardLayoutDefinitions[keyboardLayout];
  keyLabels = { ...(definition?.base || {}), ...(keyboardLayout === 'auto' ? learnedKeyLabels.base : {}) };
  shiftedKeyLabels = { ...(definition?.shift || {}), ...(keyboardLayout === 'auto' ? learnedKeyLabels.shift : {}) };
}
refreshKeyLabels();
async function detectKeyboardLayoutFromBrowser() {
  if (keyboardLayoutStored || !navigator.keyboard?.getLayoutMap) return;
  try {
    const layoutMap = await navigator.keyboard.getLayoutMap();
    const codes = new Set(Object.values(keyCodes).flat());
    let found = 0;
    codes.forEach(code => {
      const label = layoutMap.get(code);
      if (!label || label === 'Dead') return;
      learnedKeyLabels.base[code] = /\p{L}/u.test(label) ? label.toLocaleUpperCase(navigator.language || 'fr') : label;
      found += 1;
    });
    if (!found) return;
    keyboardLayout = 'auto';
    refreshKeyLabels();
    if (typeof keyboardLayoutSelect !== 'undefined') keyboardLayoutSelect.value = 'auto';
    try { localStorage.setItem('rhythm-keyboard-layout', 'auto'); localStorage.setItem('rhythm-key-labels', JSON.stringify(learnedKeyLabels)); } catch {}
    renderMappingControls();
    renderInstrumentGuide();
    render();
  } catch {}
}
const demoEvents = [60, 62, 64, 67, 64, 62, 60, 67, 69, 67, 64, 62].map((pitch, beat) => ({ pitch, beats: 1, beat }));
let tracks = [{ name: 'Démo', notes: demoEvents.map(event => event.pitch), events: demoEvents, clef: '𝄞', key: 'Do majeur', tempo: 100, time: '4/4' }];
let trackIndex = 0;
let game = null;
let audio;
const activeAudioSources = new Set();
let importedScoreId = 'demo';
let importedDocuments = [];
const pressedKeys = new Set();
let breathPressed = false;
let latencyOffsetMs = 0;
try { latencyOffsetMs = Number(localStorage.getItem('rhythm-latency-offset') || 0); } catch {}
let calibration = null;
let metronomePreview = null;
let audioScheduler = 0;
let lastPracticeMiss = null;
const unknownMuseSymbols = new Set();
try { JSON.parse(localStorage.getItem('rhythm-unknown-musescore-symbols') || '[]').forEach(symbol => unknownMuseSymbols.add(symbol)); } catch {}

document.querySelector('.toolbar').insertAdjacentHTML('beforeend', '<button id="pauseGame" type="button">Pause</button><button id="restartGame" type="button">Recommencer</button><label class="muted speed-control">Vitesse <input id="speed" type="range" min="50" max="150" step="5" value="100"><output id="speedValue">100 %</output></label><label class="muted">Commande <select id="inputStyle"><option value="keyboard">Notes au clavier</option><option value="organ">Orgue · deux rangées</option><option value="valves">Pistons</option><option value="slide">Coulisse</option><option value="midi-device">Clavier MIDI</option><option value="microphone">Microphone</option><option value="rhythm">Rythme seul · 1 touche</option></select></label><label id="midiDeviceLabel" class="muted" hidden>MIDI <select id="midiDevice"></select></label><button id="enableMidi" type="button" hidden>Activer MIDI</button><label id="microphoneLabel" class="muted" hidden>Sensibilité micro <input id="microphoneSensitivity" type="range" min="1" max="20" value="8"></label><label class="muted">Disposition <select id="keyboardLayout"><option value="azerty">AZERTY français</option><option value="qwerty">QWERTY</option><option value="qwertz">QWERTZ</option><option value="auto">Détection navigateur</option></select></label><label class="muted"><input id="verticalSlide" type="checkbox" checked> Coulisse verticale à gauche</label><label class="muted">Style audio <select id="audioStyle"><option value="soundfont" selected>MS Basic · MuseScore</option><option value="realistic">Réaliste synthétique</option><option value="midi">MIDI classique</option><option value="retro">Rétro</option></select></label><button id="testSoundFont" type="button">Tester MS Basic</button><label class="muted"><input id="breathEnabled" type="checkbox" checked> Bouton de souffle</label><label class="muted"><input id="requireHold" type="checkbox" checked> Maintenir selon la durée</label><button id="configureInputs" type="button">Mapper les commandes</button><label class="muted"><input id="showFingering" type="checkbox" checked> Doigté sous les notes</label><label class="muted"><input id="metronome" type="checkbox"> Métronome pendant le morceau</label><label class="muted"><input id="colorNotes" type="checkbox" checked> Notes colorées</label><label class="muted"><input id="accompaniment" type="checkbox" checked> Autres pistes</label><label class="muted"><input id="currentTrackPlayback" type="checkbox"> Piste actuelle automatique</label><label class="volume-control muted">Volume global <input id="masterVolume" type="range" min="0" max="100" value="75"></label><label class="volume-control muted">Piste actuelle <span class="volume-slider"><input id="trackVolume" type="range" min="0" max="400" value="100"><span class="midpoint">×1</span></span></label><button id="clickMetronome">Écouter le métronome</button>');
document.querySelector('.toolbar').insertAdjacentHTML('afterend', '<section id="inputMappingPanel" class="input-mapping" hidden><div><strong>Remappage des commandes</strong><button id="closeInputMapping" type="button">Fermer</button><button id="resetInputMapping" type="button">Valeurs par défaut</button></div><div id="mappingControls"></div><small class="muted">Cliquez une commande, puis appuyez sur la nouvelle touche. Les réglages restent locaux.</small></section>');
document.getElementById('microphoneLabel').insertAdjacentHTML('afterend', '<button id="toggleTuner" type="button" hidden>Accordeur</button><button id="calibrateMicrophone" type="button" hidden>Calibrer le microphone</button><span id="microphoneStatus" class="tuner-display muted" hidden></span>');
document.getElementById('keyboardLayout').parentElement.insertAdjacentHTML('afterend', '<label id="valveHandednessLabel" class="muted">Main des pistons <select id="valveHandedness"><option value="left">Gauche · Q/S/D</option><option value="right">Droite · J/K/L</option><option value="custom">Personnalisée</option></select></label>');
document.getElementById('restartGame').insertAdjacentHTML('afterend', '<label class="muted">Difficulté <select id="practicePreset"><option value="discovery">Découverte</option><option value="normal" selected>Normal</option><option value="difficult">Difficile</option><option value="expert">Expert</option><option value="custom">Personnalisée</option></select></label><label class="muted"><input id="loopEnabled" type="checkbox"> Boucle de mesures</label><label class="muted">Début <input id="loopStart" type="number" min="1" value="1"></label><label class="muted">Fin <input id="loopEnd" type="number" min="1" value="1"></label><label class="muted"><input id="adaptiveSpeed" type="checkbox"> Vitesse adaptative</label><button id="retryBeforeError" type="button" disabled>Rejouer avant l’erreur</button>');
document.getElementById('restartGame').insertAdjacentHTML('afterend', '<label class="muted">Clé <select id="clefOverride"><option value="auto">Automatique</option><option value="G">Sol</option><option value="G8VA">Sol 8va</option><option value="G8VB">Sol 8vb</option><option value="F">Fa</option><option value="F8VA">Fa 8va</option><option value="F8VB">Fa 8vb</option><option value="C1">Ut 1</option><option value="C2">Ut 2</option><option value="C3">Ut 3</option><option value="C4">Ut 4</option><option value="C5">Ut 5</option><option value="PERC">Percussion</option></select></label>');
document.getElementById('clefOverride').parentElement.insertAdjacentHTML('afterend', '<label class="muted" title="Décoché : notes écrites pour l’instrument. Coché : hauteurs réellement entendues."><input id="concertPitch" type="checkbox"> Tonalité réelle (concert)</label>');
document.getElementById('clefOverride').parentElement.insertAdjacentHTML('afterend', '<label id="scoreDocumentLabel" class="muted" hidden>Document <select id="scoreDocument"></select></label>');
document.getElementById('scoreDocumentLabel').insertAdjacentHTML('afterend', '<label class="muted">Trier les voix <select id="trackSort"><option value="score">Ordre de la partition</option><option value="name">Nom A → Z</option><option value="family">Type puis nom</option><option value="notes-desc">Plus de notes</option><option value="notes-asc">Moins de notes</option></select></label>');
document.getElementById('trackSort').parentElement.insertAdjacentHTML('afterend', '<button id="calibrateLatency" type="button">Calibrer la latence</button><span id="latencyStatus" class="muted"></span>');
document.getElementById('latencyStatus').insertAdjacentHTML('afterend', '<button id="exportUnknownSymbols" type="button" hidden>Exporter symboles inconnus</button>');
document.getElementById('exportUnknownSymbols').insertAdjacentHTML('afterend', '<button id="runRhythmTests" type="button">Autotest Rhythm Lab</button><button id="exportTrackDiagnostics" type="button">Exporter diagnostic partition</button><label class="muted"><input id="showRests" type="checkbox" checked> Afficher les silences</label><label class="muted"><input id="showMeasures" type="checkbox" checked> Afficher les mesures</label>');
document.getElementById('showMeasures').parentElement.insertAdjacentHTML('afterend', '<label class="muted visual-control">Taille partition <input id="scoreScale" type="range" min="70" max="150" step="5" value="100"><output>100 %</output></label><label class="muted visual-control">Espacement notes <input id="noteSpacing" type="range" min="70" max="210" step="5" value="126"><output>126 px</output></label><label class="muted visual-control">Anticipation <input id="approachTime" type="range" min="1400" max="5000" step="100" value="2800"><output>2.8 s</output></label>');
const optionsPanel = document.createElement('section');
optionsPanel.className = 'option-groups';
document.getElementById('inputMappingPanel').after(optionsPanel);
function optionGroup(title, elements, open = false) { const group = document.createElement('details'); group.className = 'option-group'; group.open = open; group.innerHTML = `<summary>${title}</summary><div></div>`; const content = group.querySelector('div'); elements.filter(Boolean).forEach(element => content.append(element)); optionsPanel.append(group); }
const parentOf = id => document.getElementById(id)?.closest('label') || document.getElementById(id);
optionGroup('Partie', [document.getElementById('pauseGame'), document.getElementById('restartGame'), parentOf('practicePreset'), parentOf('speed'), parentOf('requireHold'), parentOf('loopEnabled'), parentOf('loopStart'), parentOf('loopEnd'), parentOf('adaptiveSpeed'), document.getElementById('retryBeforeError')], true);
optionGroup('Partition', [parentOf('scoreDocument'), parentOf('trackSort'), parentOf('clefOverride'), parentOf('concertPitch')], true);
optionGroup('Commande', [parentOf('inputStyle'), parentOf('midiDevice'), document.getElementById('enableMidi'), parentOf('microphoneSensitivity'), document.getElementById('toggleTuner'), document.getElementById('calibrateMicrophone'), document.getElementById('microphoneStatus'), parentOf('keyboardLayout'), parentOf('valveHandedness'), parentOf('breathEnabled'), parentOf('verticalSlide'), document.getElementById('configureInputs')]);
optionGroup('Son', [parentOf('audioStyle'), document.getElementById('testSoundFont'), parentOf('metronome'), document.getElementById('clickMetronome'), parentOf('accompaniment'), parentOf('currentTrackPlayback'), parentOf('masterVolume'), parentOf('trackVolume')]);
optionGroup('Affichage', [parentOf('accidentals'), parentOf('showFingering'), parentOf('colorNotes'), parentOf('showRests'), parentOf('showMeasures'), parentOf('scoreScale'), parentOf('noteSpacing'), parentOf('approachTime')]);
optionGroup('Outils', [document.getElementById('calibrateLatency'), document.getElementById('latencyStatus'), document.getElementById('runRhythmTests'), document.getElementById('exportTrackDiagnostics'), document.getElementById('exportUnknownSymbols')]);
const metronomeToggle = document.getElementById('metronome');
const colorNotesToggle = document.getElementById('colorNotes');
const accompanimentToggle = document.getElementById('accompaniment');
const currentTrackPlaybackToggle = document.getElementById('currentTrackPlayback');
const inputStyle = document.getElementById('inputStyle');
const keyboardLayoutSelect = document.getElementById('keyboardLayout');
keyboardLayoutSelect.value = keyboardLayout;
window.setTimeout(detectKeyboardLayoutFromBrowser, 0);
const breathEnabled = document.getElementById('breathEnabled');
const requireHoldToggle = document.getElementById('requireHold');
const masterVolume = document.getElementById('masterVolume');
const trackVolume = document.getElementById('trackVolume');
masterVolume.closest('label').firstChild.textContent = 'Autres pistes ';
const audioStyle = document.getElementById('audioStyle');
const verticalSlideToggle = document.getElementById('verticalSlide');
const speedControl = document.getElementById('speed');
const pauseButton = document.getElementById('pauseGame');
const clefOverride = document.getElementById('clefOverride');
const concertPitchToggle = document.getElementById('concertPitch');
concertPitchToggle.checked = false;
const scoreDocument = document.getElementById('scoreDocument');
const trackSort = document.getElementById('trackSort');
const latencyStatus = document.getElementById('latencyStatus');
const showRestsToggle = document.getElementById('showRests');
const showMeasuresToggle = document.getElementById('showMeasures');
const scoreScaleControl = document.getElementById('scoreScale');
const noteSpacingControl = document.getElementById('noteSpacing');
const approachTimeControl = document.getElementById('approachTime');
const practicePreset = document.getElementById('practicePreset');
const loopEnabled = document.getElementById('loopEnabled');
const loopStart = document.getElementById('loopStart');
const loopEnd = document.getElementById('loopEnd');
const adaptiveSpeed = document.getElementById('adaptiveSpeed');
const retryBeforeError = document.getElementById('retryBeforeError');
const midiDevice = document.getElementById('midiDevice');
const midiDeviceLabel = document.getElementById('midiDeviceLabel');
const enableMidiButton = document.getElementById('enableMidi');
const microphoneLabel = document.getElementById('microphoneLabel');
const microphoneSensitivity = document.getElementById('microphoneSensitivity');
const valveHandedness = document.getElementById('valveHandedness');
const valveHandednessLabel = document.getElementById('valveHandednessLabel');
const toggleTunerButton = document.getElementById('toggleTuner');
const calibrateMicrophoneButton = document.getElementById('calibrateMicrophone');
const microphoneStatus = document.getElementById('microphoneStatus');
valveHandednessLabel.hidden = inputStyle.value !== 'valves';
const practiceHistory = document.createElement('div');
practiceHistory.className = 'practice-history muted';
recordsElement.after(practiceHistory);
try { audioStyle.value = localStorage.getItem('rhythm-audio-style') || 'soundfont'; } catch {}
const mappingPanel = document.getElementById('inputMappingPanel');
const mappingControls = document.getElementById('mappingControls');
const showFingeringToggle = document.getElementById('showFingering');
const instrumentGuide = document.createElement('div');
instrumentGuide.className = 'instrument-guide';
stage.after(instrumentGuide);
const mobileInputDock = document.createElement('section');
mobileInputDock.className = 'mobile-input-dock';
mobileInputDock.setAttribute('aria-label', 'Commandes tactiles de Rhythm Lab');
mobileInputDock.innerHTML = '<div class="mobile-orientation-hint">Tournez le téléphone en paysage pour mieux lire la partition.</div><div class="mobile-dock-head"><strong>Commandes tactiles</strong><div class="mobile-dock-actions"><button type="button" data-mobile-action="focus">Vue jeu</button><button type="button" data-mobile-action="pause">Pause</button><button type="button" data-mobile-action="restart">Recommencer</button></div></div><div class="mobile-input-row"></div>';
document.body.append(mobileInputDock);
const pressedValves = new Set();
let slidePosition = 1;
let mappingTarget = null;
let instrumentDebounce = 0;
let slideInteracting = false;
let pointerRhythmActive = false;
let visualSelectionActive = false;
let midiAccess = null;
const midiPressed = new Set();
let microphoneStream = null;
let microphoneAnalyser = null;
let microphoneTimer = 0;
let microphoneCandidate = null;
let microphoneStableFrames = 0;
let microphoneActiveInput = '';
let microphonePitch = null;
let microphoneFrequency = 0;
let microphoneLatencyMs = 0;
let microphoneCalibration = null;
let tunerEnabled = false;
const mobileInputPointers = new Map();
try { microphoneLatencyMs = Number(localStorage.getItem('rhythm-microphone-latency') || 0); } catch {}
const rightHandValveCodes = ['KeyJ', 'KeyK', 'KeyL'];
const leftHandValveCodes = ['KeyA', 'KeyS', 'KeyD'];
const sameCodes = (left, right) => left.length === right.length && left.every((code, index) => code === right[index]);
valveHandedness.value = sameCodes(inputMappings.valves, rightHandValveCodes) ? 'right' : sameCodes(inputMappings.valves, leftHandValveCodes) ? 'left' : 'custom';

function setTextIfChanged(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function updateVisualSelectionState() {
  const selection = window.getSelection();
  visualSelectionActive = Boolean(selection && !selection.isCollapsed && document.querySelector('main')?.contains(selection.anchorNode));
}

function updateDiagnosticButton() {
  copyStatusButton.hidden = !/(échec|erreur|impossible|indisponible)/i.test(statusElement.textContent);
  if (!copyStatusButton.hidden) copyStatusButton.textContent = 'Copier le diagnostic';
}

statusElement.addEventListener('pointerdown', () => { visualSelectionActive = true; });
document.addEventListener('selectionchange', updateVisualSelectionState);
document.addEventListener('pointerup', () => requestAnimationFrame(updateVisualSelectionState));
new MutationObserver(updateDiagnosticButton).observe(statusElement, { childList: true, characterData: true, subtree: true });
copyStatusButton.addEventListener('click', async () => {
  const diagnostic = statusElement.textContent.trim();
  try {
    await navigator.clipboard.writeText(diagnostic);
  } catch {
    const field = document.createElement('textarea');
    field.value = diagnostic;
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    document.execCommand('copy');
    field.remove();
  }
  copyStatusButton.textContent = 'Diagnostic copié';
});

function activeCodes() { if (inputStyle.value === 'rhythm') return [inputMappings.rhythm]; return inputStyle.value === 'organ' ? inputMappings.organ : (inputMappings[modeSelect.value] || inputMappings.piano); }
function keyLabel(code) { const base = keyLabels[code] || friendlyCodeLabels[code] || code.replace(/^Key/, '').replace(/^Digit/, ''); const shifted = shiftedKeyLabels[code]; return shifted && shifted.toLocaleUpperCase('fr') !== base.toLocaleUpperCase('fr') ? `${base} · ⇧${shifted}` : base; }
function rememberKeyLabel(event) {
  if (keyboardLayout !== 'auto') return;
  if (!event.code || !event.key || event.key === 'Dead' || event.key.length !== 1) return;
  const value = /\p{L}/u.test(event.key) ? event.key.toLocaleUpperCase(navigator.language || 'fr') : event.key;
  const group = event.shiftKey && !/\p{L}/u.test(event.key) ? 'shift' : 'base';
  const target = group === 'shift' ? shiftedKeyLabels : keyLabels;
  if (target[event.code] === value) return;
  target[event.code] = value;
  learnedKeyLabels[group][event.code] = value;
  if (game) { const lane = activeCodes().indexOf(event.code); if (lane >= 0) game.notes.filter(note => note.lane === lane).forEach(note => { note.label = keyLabel(event.code); }); }
  try { localStorage.setItem('rhythm-key-labels', JSON.stringify(learnedKeyLabels)); } catch {}
}
function saveInputMappings() { try { localStorage.setItem('rhythm-input-mappings', JSON.stringify(inputMappings)); } catch {} }
function mappingButton(group, index, label) { const code = index === null ? inputMappings[group] : inputMappings[group][index]; return `<button type="button" data-map-group="${group}" data-map-index="${index ?? ''}" class="${mappingTarget?.group === group && mappingTarget?.index === index ? 'listening' : ''}">${label} : <b>${keyLabel(code)}</b></button>`; }
function renderMappingControls() {
  mappingControls.innerHTML = `<div class="mapping-group"><strong>Partie</strong>${mappingButton('pause', null, 'Pause / reprise')}${mappingButton('restart', null, 'Recommencer')}${mappingButton('rhythm', null, 'Rythme seul')}</div><div class="mapping-group"><strong>Pistons</strong>${inputMappings.valves.map((_, index) => mappingButton('valves', index, `Piston ${index + 1}`)).join('')}</div><div class="mapping-group"><strong>Souffle</strong>${mappingButton('breath', null, 'Souffle')}</div><div class="mapping-group"><strong>Positions</strong>${inputMappings.slide.map((_, index) => mappingButton('slide', index, `Position ${index + 1}`)).join('')}</div><div class="mapping-group"><strong>Piano</strong>${inputMappings.piano.map((_, index) => mappingButton('piano', index, `Note ${index + 1}`)).join('')}</div><div class="mapping-group"><strong>Boutons</strong>${inputMappings.buttons.map((_, index) => mappingButton('buttons', index, `Note ${index + 1}`)).join('')}</div><div class="mapping-group organ-map"><strong>Orgue / notes</strong>${inputMappings.organ.map((_, index) => mappingButton('organ', index, `Note ${index + 1}`)).join('')}</div>`;
  mappingControls.querySelectorAll('[data-map-group]').forEach(button => button.addEventListener('click', () => { mappingTarget = { group: button.dataset.mapGroup, index: button.dataset.mapIndex === '' ? null : Number(button.dataset.mapIndex) }; renderMappingControls(); }));
}
function noteName(pitch) { const sharp = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si']; const flat = ['Do', 'Ré♭', 'Ré', 'Mi♭', 'Mi', 'Fa', 'Sol♭', 'Sol', 'La♭', 'La', 'Si♭', 'Si']; const names = accidentalsToggle?.checked ? sharp : flat; return `${names[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`; }
function noteAccidental(pitch) { return [1, 3, 6, 8, 10].includes(((pitch % 12) + 12) % 12) ? (accidentalsToggle?.checked ? '♯' : '♭') : ''; }
function staffStep(pitch) { return Math.floor(pitch / 12) * 7 + [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][((pitch % 12) + 12) % 12]; }
function isUnpitchedPercussion(value = '') { return /drum(?:set| kit)?|percussion|batterie|caisse|cymbal|tambour/i.test(value); }
function clefInfo(value = 'G') {
  const name = String(value).toUpperCase();
  const octave = /8VA|8A|15MA/.test(name) ? ' 8va' : /8VB|8B|15MB/.test(name) ? ' 8vb' : '';
  if (name.includes('PERC')) return { glyph: '', kind: 'percussion', reference: 60, label: 'Percussion' };
  if (name.includes('F')) return { glyph: `𝄢${octave ? '⁸' : ''}`, kind: 'bass', reference: 48, label: `Fa${octave}` };
  if (name.includes('C1')) return { glyph: '𝄡', kind: 'alto', reference: 67, label: 'Ut 1' };
  if (name.includes('C2')) return { glyph: '𝄡', kind: 'alto', reference: 64, label: 'Ut 2' };
  if (name.includes('C5')) return { glyph: '𝄡', kind: 'alto', reference: 52, label: 'Ut 5' };
  if (name.includes('C4') || name.includes('TENOR')) return { glyph: '𝄡', kind: 'alto', reference: 55, label: 'Ut 4' };
  if (name.includes('C3') || name.includes('ALTO') || name === 'C') return { glyph: '𝄡', kind: 'alto', reference: 60, label: 'Ut 3' };
  return { glyph: `𝄞${octave ? '⁸' : ''}`, kind: 'treble', reference: 60, label: `Sol${octave}` };
}
function clefMarkup(info) {
  if (info.kind !== 'percussion') return info.glyph;
  return '<svg class="percussion-clef-symbol" viewBox="0 0 72 112" role="img" aria-label="Clé de percussion"><rect x="14" y="10" width="13" height="92" rx="4" fill="currentColor"/><rect x="43" y="10" width="13" height="92" rx="4" fill="currentColor"/></svg>';
}
function inferredClef(instrument = '', events = []) { const name = instrument.toLowerCase(); if (/clef de sol|treble/.test(name)) return 'G'; if (/clef de fa|bass clef/.test(name)) return 'F'; if (/drum|percussion|batterie/.test(name)) return 'PERC'; if (/sousaph|tuba|trombon|euphon|bassoon|basson|contrebass|basse/.test(name)) return 'F'; if (/alto|viola/.test(name) && !/sax/.test(name)) return 'C3'; const pitches = events.map(event => event.displayPitch ?? event.pitch).filter(Number.isFinite).sort((left, right) => left - right); const median = pitches.length ? pitches[Math.floor(pitches.length / 2)] : 60; return median < 55 ? 'F' : median < 60 ? 'C4' : 'G'; }
function inferredConcertClef(instrument = '', writtenClef = '') { const name = instrument.toLowerCase(); if (/euphon|baritone.*(?:horn|brass)|sousaph|tuba/.test(name) && /^(?:G|TREBLE)/i.test(writtenClef)) return 'F'; return writtenClef || inferredClef(instrument, []); }
function notationPitch(note) { return concertPitchToggle.checked ? note.pitch : (note.writtenPitch ?? note.displayPitch ?? note.pitch); }
function effectiveClef(track, note = null) {
  if (clefOverride.value !== 'auto') return clefOverride.value;
  const instrument = `${note?.instrument || ''} ${note?.instrumentId || ''} ${track.instrument || ''} ${track.instrumentId || ''} ${track.name || ''}`;
  if (isUnpitchedPercussion(instrument)) return 'PERC';
  return concertPitchToggle.checked ? (note?.concertClef || track.concertClef || note?.clef || track.clef || inferredClef(instrument, track.events)) : (note?.writtenClef || track.writtenClef || note?.clef || track.clef || inferredClef(instrument, track.events));
}
function scoreNoteTop(track, note, shift = 0) {
  const info = clefInfo(effectiveClef(track, note));
  if (info.kind === 'percussion') return shift + 128;
  return shift + 176 - (staffStep(notationPitch(note)) - staffStep(info.reference)) * 11;
}
function scoreGeometry(track) {
  const rawTops = track.events.map(note => scoreNoteTop(track, note));
  const minimum = rawTops.length ? Math.min(...rawTops) : 90;
  const maximum = rawTops.length ? Math.max(...rawTops) : 190;
  const shift = Math.max(0, 54 - minimum);
  return { shift, height: Math.max(300, Math.ceil(maximum + shift + 76)) };
}
function microphoneDisplayNote(track) {
  if (microphonePitch === null) return null;
  const transpose = track?.transpose || 0;
  const pitch = Math.round(microphonePitch);
  return { pitch, writtenPitch: pitch - transpose, displayPitch: pitch - transpose, transpose, clef: effectiveClef(track), writtenClef: effectiveClef(track), concertClef: effectiveClef(track) };
}
function durationClass(beats, beamed = false) { if (beats >= 4) return 'whole open'; if (beats >= 2) return 'open'; if (beats >= 1 || beamed) return ''; if (beats >= .5) return 'flag-1'; if (beats >= .25) return 'flag-2'; return 'flag-3'; }
function durationLabel(note) { const beats = note.beats || 1; const names = [[16,'longue'],[8,'brève'],[4,'ronde'],[2,'blanche'],[1,'noire'],[.5,'croche'],[.25,'double croche'],[.125,'triple croche'],[.0625,'quadruple croche']]; const base = names.find(([value]) => Math.abs(beats - value) < .001)?.[1] || `${beats} temps`; return `${base}${note.dots ? ' pointée'.repeat(note.dots) : ''}${note.tuplet ? ` · triolet ${note.tuplet}` : ''}`; }
function restGlyph(beats) {
  if (beats >= 4) return '<svg class="rest-symbol whole-rest" viewBox="0 0 32 54" aria-hidden="true"><path d="M7 20h18v7H7z"/></svg>';
  if (beats >= 2) return '<svg class="rest-symbol half-rest" viewBox="0 0 32 54" aria-hidden="true"><path d="M7 25h18v7H7z"/></svg>';
  if (beats >= 1) return '<svg class="rest-symbol quarter-rest" viewBox="0 0 32 54" aria-hidden="true"><path d="M19 3c-2 7-7 10-3 16l5 7-8 8c5 2 8 6 7 13-2-5-6-8-11-7l-1-4 7-10-5-8c-2-4 4-9 9-15z"/></svg>';
  const flags = beats >= .5 ? 1 : beats >= .25 ? 2 : beats >= .125 ? 3 : 4;
  return `<svg class="rest-symbol flagged-rest" viewBox="0 0 32 54" aria-hidden="true"><path d="M18 6v35h-3V6z"/>${Array.from({ length: flags }, (_, index) => `<path d="M18 ${7 + index * 9}c10 1 10 9 3 15 3-7 0-9-3-9z"/>`).join('')}<circle cx="13" cy="42" r="4"/></svg>`;
}
function measureLengthAt(track, beat) { const signature = stateAt(track, beat).time || '4/4'; const [top, bottom] = String(signature).split('/').map(Number); return (top || 4) * 4 / (bottom || 4); }
function expandedRests(track) {
  const events = track.events || [];
  const explicitRests = (track.rests || []).filter(rest => !events.some(event => event.beat < rest.beat + rest.beats - .001 && event.beat + (event.beats || 1) > rest.beat + .001));
  const measureStarts = [...new Set((track.measureBeats || []).map(beat => Math.round(beat * 1000) / 1000))].sort((left, right) => left - right);
  const emptyMeasures = measureStarts.map((beat, index) => {
    const nextBeat = measureStarts[index + 1];
    const beats = nextBeat === undefined ? measureLengthAt(track, beat) : Math.max(.001, nextBeat - beat);
    const hasNote = events.some(event => event.beat < beat + beats - .001 && event.beat + (event.beats || 1) > beat + .001);
    return hasNote ? null : { beat, beats, displayBeat: beat + beats / 2 };
  });
  for (let index = 0; index < emptyMeasures.length;) {
    if (!emptyMeasures[index]) { index += 1; continue; }
    let end = index + 1;
    while (end < emptyMeasures.length && emptyMeasures[end] && Math.abs(emptyMeasures[end - 1].beat + emptyMeasures[end - 1].beats - emptyMeasures[end].beat) < .05) end += 1;
    for (let cursor = index; cursor < end; cursor += 1) emptyMeasures[cursor].measuresRemaining = end - cursor;
    index = end;
  }
  const inferred = emptyMeasures.filter(Boolean).map(measure => { const explicit = explicitRests.find(rest => Math.abs(rest.beat - measure.beat) < .001); return explicit ? { ...measure, symbols: explicit.symbols || [] } : measure; });
  const partial = explicitRests.filter(rest => !inferred.some(measure => rest.beat >= measure.beat - .001 && rest.beat < measure.beat + measure.beats - .001)).map(rest => ({ ...rest, displayBeat: rest.beat + rest.beats / 2 }));
  return [...partial, ...inferred].sort((left, right) => left.beat - right.beat);
}
function articulationGlyph(articulation = '') { if (/stacc/i.test(articulation)) return '·'; if (/accent|marcato|sforz/i.test(articulation)) return '>'; if (/tenuto|portato/i.test(articulation)) return '—'; return ''; }
function laneFor(pitch) { return Math.abs(pitch) % activeCodes().length; }
function laneColor(lane) { return palette[lane % palette.length]; }
function valveFingeringsFor(note, track = tracks[trackIndex] || tracks[0]) {
  const source = typeof note === 'number' ? { pitch: note } : note;
  const fallback = ['0','123','13','23','12','1','2','0','23','12','1','2'][(((source?.pitch || 0) % 12) + 12) % 12];
  if (!window.BrassFingering || !source) return { primary: fallback, alternatives: [], accepted: [fallback], profile: { name: 'Cuivre à pistons' } };
  return window.BrassFingering.fingeringsFor({
    pitch: source.pitch,
    transpose: source.transpose ?? track?.transpose ?? 0,
    instrumentId: source.instrumentId || track?.instrumentId || '',
    instrument: source.instrument || track?.instrument || '',
    name: track?.name || ''
  });
}
function slidePositionsFor(pitch) { return window.TrombonePosition?.positionsFor(pitch) || []; }
function fingeringPitch(note) { return typeof note === 'number' ? note : note.pitch; }
function controlLabel(note, track = tracks[trackIndex] || tracks[0]) { const source = typeof note === 'number' ? (game?.notes.find(candidate => !candidate.done) || note) : note; const pitch = fingeringPitch(source); if (inputStyle.value === 'rhythm') return keyLabel(inputMappings.rhythm); if (inputStyle.value === 'valves') { const fingering = valveFingeringsFor(source, track); return fingering.display || fingering.primary; } if (inputStyle.value === 'slide') { const positions = slidePositionsFor(pitch); return positions.length ? positions.join('/') : '—'; } if (inputStyle.value === 'midi-device' || inputStyle.value === 'microphone') return noteName(notationPitch(source)); const codes = activeCodes(); const lanePitch = typeof source === 'number' ? source : source.pitch; return keyLabel(codes[laneFor(lanePitch)]); }
function timingFor(track, speed = game?.speed || 1) {
  const tempos = [{ beat: 0, bpm: track.tempo || 100 }, ...(track.changes || []).filter(change => change.type === 'tempo')].sort((left, right) => left.beat - right.beat);
  const bpmAt = beat => {
    const available = tempos.filter(change => change.beat <= beat);
    return available[available.length - 1]?.bpm || tempos[0].bpm;
  };
  const beatToMs = targetBeat => { let elapsed = 0; let cursor = 0; let bpm = tempos[0].bpm; for (const change of tempos.slice(1)) { if (change.beat >= targetBeat) break; elapsed += (change.beat - cursor) * 60000 / bpm; cursor = change.beat; bpm = change.bpm; } elapsed += (targetBeat - cursor) * 60000 / bpm; const pauses = (track.pauses || []).filter(pause => pause.beat < targetBeat - .001).reduce((sum, pause) => sum + (pause.beats || 0) * 60000 / bpmAt(pause.beat), 0); return (elapsed + pauses) / speed; };
  return { tempos, beatToMs };
}
function mergedPauses(trackList) { const pauses = new Map(); trackList.flatMap(track => track.pauses || []).forEach(pause => { const key = Math.round(pause.beat * 1000) / 1000; const previous = pauses.get(key); if (!previous || pause.beats > previous.beats) pauses.set(key, { ...pause, beat: key }); }); return [...pauses.values()].sort((left, right) => left.beat - right.beat); }
function ensureAudio() { const AudioContextClass = window.AudioContext || window.webkitAudioContext; if (!AudioContextClass) throw new Error('Web Audio indisponible'); audio ??= new AudioContextClass(); if (audio.state === 'suspended') audio.resume().catch(() => {}); return audio; }
async function ensureSoundFontEngine() {
  if (location.protocol === 'file:') throw new Error('ouverture directe interdite : lancez « Lancer le Hub Windows.bat » puis utilisez http://127.0.0.1:8765');
  if (!window.SoundFontEngine) await import('./soundfont-engine.js?v=7');
  if (!window.SoundFontEngine) throw new Error('module SoundFont non chargé');
  return window.SoundFontEngine;
}
function trackAudioSource(source) {
  activeAudioSources.add(source);
  source.addEventListener('ended', () => { activeAudioSources.delete(source); try { source.disconnect(); } catch {} }, { once: true });
  return source;
}
function stopGeneratedAudio() {
  activeAudioSources.forEach(source => { try { source.stop(); } catch {} try { source.disconnect(); } catch {} });
  activeAudioSources.clear();
}
function stopAllAudio() { stopGeneratedAudio(); window.SoundFontEngine?.stopAll(); }
function clearPressedInputs() {
  pressedKeys.clear();
  pressedValves.clear();
  breathPressed = false;
  pointerRhythmActive = false;
  if (!game) return;
  game.activeInputs.forEach(note => { note.active = false; note.done = true; });
  game.activeInputs.clear();
}
function recordKey() { const track = tracks[trackIndex] || tracks[0]; return ['rhythm', importedScoreId, track?.name, `mode:${modeSelect.value}`, `commande:${inputStyle.value}`, requireHoldToggle.checked ? 'tenue' : 'frappe', accompanimentToggle.checked ? 'accompagnement' : 'solo', currentTrackPlaybackToggle.checked ? 'guide' : 'sans-guide', metronomeToggle.checked ? 'metronome' : 'sans-metronome', showFingeringToggle.checked ? 'doigtes' : 'sans-doigtes', colorNotesToggle.checked ? 'couleurs' : 'monochrome', breathEnabled.checked ? 'souffle-manuel' : 'souffle-auto', loopEnabled.checked ? `boucle:${loopStart.value}-${loopEnd.value}` : 'morceau-entier', `vitesse:${speedControl.value}`].join('|'); }
function rhythmRecordsKey() { return window.GameRuntime?.profileKey('game-hub:records') || 'game-hub:records'; }
function readRecords() { try { return JSON.parse(localStorage.getItem(rhythmRecordsKey()) || '{}'); } catch { return {}; } }
function renderRecord() { const record = readRecords()[recordKey()]; recordsElement.innerHTML = record ? `<span>🏆 Meilleur score <strong>${record.score}</strong></span><span>Précision ${record.accuracy}%</span><span>${record.date}</span>` : '<span>🏆 Aucun record pour cette partition et ces paramètres.</span>'; }
function saveRecord() { if (!game) return false; const attempts = game.hits + game.misses; const result = { score: game.score, accuracy: attempts ? Math.round(game.hits / attempts * 100) : 0, time: Math.round((performance.now() - game.started) / 1000), date: new Date().toLocaleDateString('fr-FR') }; const records = readRecords(); const previous = records[recordKey()]; if (!previous || result.score > previous.score || (result.score === previous.score && result.accuracy > previous.accuracy)) { records[recordKey()] = result; try { localStorage.setItem(rhythmRecordsKey(), JSON.stringify(records)); } catch {} renderRecord(); return true; } return false; }
function practiceBounds(track = tracks[trackIndex] || tracks[0]) {
  const starts = track?.measureBeats?.length ? track.measureBeats : [0];
  const maximumBeat = track?.events?.length ? Math.max(...track.events.map(event => event.beat + (event.beats || 1))) : 1;
  const startIndex = loopEnabled.checked ? Math.max(0, Math.min(starts.length - 1, Number(loopStart.value || 1) - 1)) : 0;
  const endIndex = loopEnabled.checked ? Math.max(startIndex, Math.min(starts.length - 1, Number(loopEnd.value || starts.length) - 1)) : starts.length - 1;
  return { startMeasure: startIndex + 1, endMeasure: endIndex + 1, startBeat: starts[startIndex] || 0, endBeat: starts[endIndex + 1] ?? maximumBeat, measureCount: starts.length };
}
function refreshPracticeRange() {
  const count = Math.max(1, tracks[trackIndex]?.measureBeats?.length || 1);
  loopStart.max = String(count); loopEnd.max = String(count);
  if (!loopEnabled.checked) loopEnd.value = String(count);
  loopStart.value = String(Math.max(1, Math.min(count, Number(loopStart.value || 1))));
  loopEnd.value = String(Math.max(Number(loopStart.value), Math.min(count, Number(loopEnd.value || count))));
}
function applyPracticePreset() {
  const presets = {
    discovery: { speed: 70, hold: false, guide: true, colors: true, fingerings: true, metronome: true },
    normal: { speed: 100, hold: true, guide: false, colors: true, fingerings: true, metronome: false },
    difficult: { speed: 110, hold: true, guide: false, colors: false, fingerings: true, metronome: false },
    expert: { speed: 125, hold: true, guide: false, colors: false, fingerings: false, metronome: false }
  };
  const preset = presets[practicePreset.value];
  if (!preset) return;
  speedControl.value = String(preset.speed); requireHoldToggle.checked = preset.hold; currentTrackPlaybackToggle.checked = preset.guide; colorNotesToggle.checked = preset.colors; showFingeringToggle.checked = preset.fingerings; metronomeToggle.checked = preset.metronome;
  document.getElementById('speedValue').value = `${preset.speed} %`; renderRecord(); render();
}
function renderPracticeHistory(entries = game?.judgements || []) {
  const recent = entries.slice(-6);
  practiceHistory.innerHTML = recent.length ? `<b>Dernières actions :</b> ${recent.map(entry => `${entry.kind === 'hit' ? '✓' : '✗'} M${entry.measure} ${entry.offset >= 0 ? '+' : ''}${Math.round(entry.offset)} ms`).join(' · ')}` : '';
}
function measureForBeat(beat, track = tracks[trackIndex] || tracks[0]) { const starts = track?.measureBeats || [0]; const index = starts.findLastIndex(start => start <= beat + .001); return Math.max(1, index + 1); }
function registerJudgement(note, kind, offset) {
  if (!game || !note) return;
  game.judgements.push({ kind, offset, beat: note.beat, measure: measureForBeat(note.beat), pitch: note.pitch });
  if (kind === 'miss') { game.lastMissBeat = note.beat; lastPracticeMiss = { beat: note.beat, trackIndex }; retryBeforeError.disabled = false; }
  renderPracticeHistory();
}
function normalizedFifths(value) { let fifths = Number(value) || 0; while (fifths > 7) fifths -= 12; while (fifths < -7) fifths += 12; return fifths; }
function writtenFifths(concertValue, chromatic = 0, diatonic = 0) { return normalizedFifths((Number(concertValue) || 0) - 7 * chromatic + 12 * diatonic); }
function concertFifths(writtenValue, chromatic = 0, diatonic = 0) { return normalizedFifths((Number(writtenValue) || 0) + 7 * chromatic - 12 * diatonic); }
function stateAt(track, beat) { return (track.changes || []).filter(change => change.beat <= beat).reduce((state, change) => { if (change.type === 'key') return { ...state, key: concertPitchToggle.checked ? (change.concertValue ?? change.value) : (change.writtenValue ?? change.value) }; if (change.type === 'clef') return { ...state, clef: concertPitchToggle.checked ? (change.concertValue ?? change.value) : (change.writtenValue ?? change.value) }; return { ...state, [change.type]: change.value ?? change.bpm }; }, { key: concertPitchToggle.checked ? (track.concertKey ?? track.key) : (track.writtenKey ?? track.key), time: track.time, tempo: track.tempo, clef: effectiveClef(track) }); }
function keySignatureMarkup(value, clef = 'G') { const info = typeof clef === 'object' ? clef : clefInfo(clef); if (info.kind === 'percussion') return ''; const fifths = Math.max(-7, Math.min(7, Number(String(value).replace('Armure ', '')) || 0)); if (!fifths) return '<span class="natural-key">♮</span>'; const sharpTreble = [0,3,6,2,5,1,4], flatTreble = [4,1,5,2,6,3,0]; const positions = fifths > 0 ? sharpTreble : flatTreble; const symbol = fifths > 0 ? '♯' : '♭'; const bassShift = info.kind === 'bass' ? 2 : 0; return Array.from({ length: Math.abs(fifths) }, (_, index) => `<i style="--staff-pos:${(positions[index] + bassShift) % 7}">${symbol}</i>`).join(''); }
function timeSignatureMarkup(value = '4/4') { const [top, bottom] = String(value).split('/'); return `<b>${top || 4}</b><b>${bottom || 4}</b>`; }
function mobileControlDefinitions() {
  if (inputStyle.value === 'rhythm') return [{ code: inputMappings.rhythm, label: 'FRAPPER', wide: true }];
  if (inputStyle.value === 'valves') return [
    ...inputMappings.valves.map((code, index) => ({ code, label: `Piston ${index + 1}`, kind: 'valve', value: index + 1 })),
    ...(breathEnabled.checked ? [{ code: inputMappings.breath, label: 'Souffle', kind: 'breath', wide: true }] : []),
  ];
  if (inputStyle.value === 'slide') return [
    ...inputMappings.slide.map((code, index) => ({ code, label: String(index + 1), kind: 'slide', value: index + 1 })),
    ...(breathEnabled.checked ? [{ code: inputMappings.breath, label: 'Souffle', kind: 'breath', wide: true }] : []),
  ];
  if (inputStyle.value === 'midi-device' || inputStyle.value === 'microphone') return [];
  return activeCodes().map(code => ({ code, label: keyLabel(code) }));
}

function mobileControlActive(button) {
  if (button.dataset.kind === 'valve') return pressedValves.has(Number(button.dataset.value));
  if (button.dataset.kind === 'slide') return slidePosition === Number(button.dataset.value);
  if (button.dataset.kind === 'breath') return breathPressed;
  return pressedKeys.has(button.dataset.code);
}

function renderMobileControls() {
  const definitions = mobileControlDefinitions();
  const signature = `${inputStyle.value}|${breathEnabled.checked}|${definitions.map(item => `${item.code}:${item.label}:${item.kind || ''}:${item.value || ''}`).join('|')}`;
  const row = mobileInputDock.querySelector('.mobile-input-row');
  if (row.dataset.signature !== signature) {
    row.dataset.signature = signature;
    row.innerHTML = definitions.length
      ? definitions.map(item => `<button type="button" class="mobile-input-button${item.wide ? ' wide' : ''}" data-code="${item.code}" data-kind="${item.kind || ''}" data-value="${item.value || ''}">${item.label}</button>`).join('')
      : `<span class="mobile-input-message">${inputStyle.value === 'microphone' ? 'Le microphone fournit directement les notes.' : 'Utilisez votre clavier MIDI connecté.'}</span>`;
  }
  row.querySelectorAll('[data-code]').forEach(button => {
    const active = mobileControlActive(button);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const pause = mobileInputDock.querySelector('[data-mobile-action="pause"]');
  pause.textContent = game?.pausedAt ? 'Reprendre' : 'Pause';
  mobileInputDock.querySelector('[data-mobile-action="focus"]').textContent = document.body.classList.contains('rhythm-focus') ? 'Options' : 'Vue jeu';
}

function dispatchMobileKey(type, code) {
  document.dispatchEvent(new KeyboardEvent(type, { code, key: keyLabel(code), bubbles: true, cancelable: true }));
}

mobileInputDock.addEventListener('pointerdown', event => {
  const button = event.target.closest('[data-code]');
  if (!button || mobileInputPointers.has(event.pointerId)) return;
  event.preventDefault();
  button.setPointerCapture?.(event.pointerId);
  mobileInputPointers.set(event.pointerId, button.dataset.code);
  dispatchMobileKey('keydown', button.dataset.code);
  renderMobileControls();
});
const releaseMobileInput = event => {
  const code = mobileInputPointers.get(event.pointerId);
  if (!code) return;
  event.preventDefault();
  mobileInputPointers.delete(event.pointerId);
  dispatchMobileKey('keyup', code);
  renderMobileControls();
};
mobileInputDock.addEventListener('pointerup', releaseMobileInput);
mobileInputDock.addEventListener('pointercancel', releaseMobileInput);
mobileInputDock.addEventListener('contextmenu', event => event.preventDefault());
mobileInputDock.addEventListener('click', event => {
  const action = event.target.closest('[data-mobile-action]')?.dataset.mobileAction;
  if (action === 'pause') { pauseButton.click(); requestAnimationFrame(renderMobileControls); }
  else if (action === 'restart') { startButton.click(); requestAnimationFrame(renderMobileControls); }
  else if (action === 'focus') {
    document.body.classList.toggle('rhythm-focus');
    renderMobileControls();
    if (document.body.classList.contains('rhythm-focus')) document.querySelector('.stage-wrap')?.scrollIntoView({ block: 'start' });
  }
});

function renderInstrumentGuide() { renderMobileControls(); const breathText = breathEnabled.checked ? `Souffle : ${keyLabel(inputMappings.breath)}` : 'Souffle automatique'; const vertical = inputStyle.value === 'slide' && verticalSlideToggle.checked; document.querySelector('.stage-wrap')?.classList.toggle('slide-at-left', vertical); instrumentGuide.classList.toggle('vertical-slide', vertical); if (slideInteracting && inputStyle.value === 'slide' && instrumentGuide.querySelector('#slideControl')) return; const expected = game?.notes.find(note => !note.done); const signature = [inputStyle.value, concertPitchToggle.checked, breathEnabled.checked, breathPressed, [...pressedValves].join(''), slidePosition, expected?.beat, expected?.pitch, microphoneCandidate, [...midiPressed].join(','), [...pressedKeys].join('')].join('|'); if (instrumentGuide.dataset.signature === signature) return; instrumentGuide.dataset.signature = signature; if (inputStyle.value === 'rhythm') instrumentGuide.innerHTML = `<strong>Rythme seul</strong><span class="valve${pressedKeys.has(inputMappings.rhythm) ? ' active' : ''}">${keyLabel(inputMappings.rhythm)}</span><small>La hauteur est ignorée ; seules la précision rythmique et la tenue comptent.</small>`; else if (inputStyle.value === 'valves') instrumentGuide.innerHTML = `<strong>Pistons</strong><span class="valve zero${pressedValves.size ? '' : ' active'}${breathPressed && !pressedValves.size ? ' breathing' : ''}">0<small>ouvert</small></span>${[1,2,3].map(value => `<span class="valve${pressedValves.has(value) ? ' active' : ''}${breathPressed && pressedValves.has(value) ? ' breathing' : ''}">${value}<small>${keyLabel(inputMappings.valves[value - 1])}</small></span>`).join('')}<small>${breathText} · attendu : ${expected ? controlLabel(expected) : '—'}</small>`; else if (inputStyle.value === 'slide') instrumentGuide.innerHTML = `<strong>Coulisse</strong><div class="slide-scale${breathPressed ? ' breathing' : ''}"><input id="slideControl" type="range" min="1" max="7" step="1" value="${slidePosition}" aria-label="Position de coulisse">${Array.from({ length: 7 }, (_, index) => `<i style="--position:${6 - index}">${index + 1}</i>`).join('')}</div><span data-slide-position class="${breathPressed ? 'breathing' : ''}">${slidePosition}</span><small>${inputMappings.slide.map(keyLabel).join(' · ')} · ${breathText}</small>`; else if (inputStyle.value === 'midi-device') instrumentGuide.innerHTML = `<strong>MIDI</strong><span class="valve active">${midiPressed.size ? [...midiPressed].map(noteName).join(' + ') : '—'}</span><small>Attendu : ${expected ? controlLabel(expected) : '—'}</small>`; else if (inputStyle.value === 'microphone') instrumentGuide.innerHTML = `<strong>Microphone</strong><span class="valve${microphoneCandidate !== null ? ' active' : ''}">${microphoneCandidate !== null ? noteName(microphoneCandidate) : '—'}</span><small>Attendu : ${expected ? controlLabel(expected) : '—'} · analyse locale</small>`; else if (inputStyle.value === 'organ') instrumentGuide.innerHTML = `<strong>Orgue</strong><small>${inputMappings.organ.map(keyLabel).join(' · ')}</small>`; else instrumentGuide.innerHTML = '<span class="muted">Jouez la touche écrite sous la note.</span>'; const slider = instrumentGuide.querySelector('#slideControl'); slider?.addEventListener('pointerdown', () => { slideInteracting = true; }); slider?.addEventListener('input', event => { slidePosition = Number(event.target.value); instrumentGuide.querySelector('[data-slide-position]').textContent = String(slidePosition); if (!breathEnabled.checked) scheduleInstrumentInput(); }); }
document.addEventListener('pointerup', () => { if (!slideInteracting) return; slideInteracting = false; renderInstrumentGuide(); render(); });

async function detectLayout() { if (keyboardLayout !== 'auto') return; try { const map = await navigator.keyboard?.getLayoutMap?.(); if (!map) return; const codes = new Set(Object.values(inputMappings).flatMap(value => Array.isArray(value) ? value : [value])); codes.forEach(code => { const label = map.get(code); if (label && label !== 'Dead') learnedKeyLabels.base[code] = /\p{L}/u.test(label) ? label.toLocaleUpperCase(navigator.language || 'fr') : label; }); refreshKeyLabels(); try { localStorage.setItem('rhythm-key-labels', JSON.stringify(learnedKeyLabels)); } catch {} renderMappingControls(); render(); } catch {} }
function playableNotes(track, timing, countIn, codes, elapsed = -Infinity, bounds = practiceBounds(track), timelineOffset = timing.beatToMs(bounds.startBeat)) { return track.events.filter(event => event.beat >= bounds.startBeat - .001 && event.beat < bounds.endBeat - .001).map((event, index) => { const time = countIn + timing.beatToMs(event.beat) - timelineOffset + latencyOffsetMs; const durationMs = Math.max(80, (timing.beatToMs(event.beat + (event.audibleBeats || event.beats || 1)) - timing.beatToMs(event.beat)) * (event.playbackStretch || 1)); return { ...event, visualId: event.sourceElementId || `${event.beat}:${event.pitch}:${index}`, beats: event.beats || 1, lane: Math.abs(event.pitch) % codes.length, label: keyLabel(codes[Math.abs(event.pitch) % codes.length]), time, durationMs, done: time + durationMs < elapsed, active: false }; }); }
function instrumentFamily(track) { const value = `${track.instrumentId || ''} ${track.instrument || track.name || ''}`.toLowerCase(); if (/voice|vocal|choir|chor|soprano|mezzo|contralto/.test(value)) return 'Voix'; if (/drum|percussion|batterie|timpani|xylophone|marimba|vibraphone/.test(value)) return 'Percussions'; if (/trump|trombon|tuba|sousaph|euphon|horn|brass|cuivre|cornet/.test(value)) return 'Cuivres'; if (/flute|flûte|clarinet|sax|oboe|hautbois|bassoon|basson|wind|reed/.test(value)) return 'Bois'; if (/violin|viola|cello|contrabass|string|corde|harp/.test(value)) return 'Cordes'; if (/piano|keyboard|organ|orgue|accordion|clavecin/.test(value)) return 'Claviers'; if (/guitar|guitare|banjo|mandolin|pluck/.test(value)) return 'Cordes pincées'; return 'Autres'; }
function sharedPlaybackTiming() { return game?.timelineTiming || timingFor(tracks[trackIndex], game?.speed || 1); }
function playbackMomentFor(timing, countIn, timelineOffset, beat) { return countIn + timing.beatToMs(beat) - timelineOffset; }
function sharedPlaybackMoment(beat) {
  if (!game) return 0;
  return playbackMomentFor(sharedPlaybackTiming(), game.countIn, game.timelineOffset, beat);
}
function syncPlaybackIndexes(elapsed = game ? (game.pausedAt || performance.now()) - game.started : 0) {
  if (!game) return;
  const indexes = tracks.map(track => {
    const firstFuture = track.events.findIndex(event => event.beat >= game.bounds.startBeat - .001 && event.beat < game.bounds.endBeat - .001 && sharedPlaybackMoment(event.beat) > elapsed);
    return firstFuture < 0 ? track.events.length : firstFuture;
  });
  game.backIndexes = indexes.slice();
  game.guideIndexes = indexes.slice();
}
function applyLiveSpeed() {
  if (!game) return;
  const nextSpeed = Number(speedControl.value) / 100;
  if (!Number.isFinite(nextSpeed) || Math.abs(nextSpeed - game.speed) < .001) return;
  const now = (game.pausedAt || performance.now()) - game.started;
  const factor = game.speed / nextSpeed;
  const retime = time => now + (time - now) * factor;
  stopAllAudio();
  game.notes.forEach(note => { note.time = retime(note.time); note.durationMs *= factor; if (note.active) { note.active = false; note.pressedAt = 0; } });
  game.activeInputs.clear();
  game.clicks.forEach(click => { click.time = retime(click.time); });
  game.changes.forEach(change => { change.time = retime(change.time); });
  game.countIn = retime(game.countIn);
  game.initialBeatMs *= factor;
  game.speed = nextSpeed;
  const track = tracks[trackIndex];
  const timing = timingFor(track, nextSpeed);
  game.timelineTiming = timing;
  game.timelineOffset = timing.beatToMs(game.bounds.startBeat);
  game.msToBeat = milliseconds => { let low = game.bounds.startBeat; let high = game.bounds.endBeat + 1; for (let iteration = 0; iteration < 22; iteration += 1) { const middle = (low + high) / 2; if (timing.beatToMs(middle) - game.timelineOffset < milliseconds) low = middle; else high = middle; } return (low + high) / 2; };
  syncPlaybackIndexes(now);
  game.clickIndex = game.clicks.findIndex(click => click.time > now);
  if (game.clickIndex < 0) game.clickIndex = game.clicks.length;
  statusElement.textContent = `Vitesse appliquée en direct : ${speedControl.value} %.`;
  render();
}
function applyTrackSort() { const selected = tracks[trackIndex]; tracks.forEach((track, index) => { track.importOrder ??= index; }); const byName = (left, right) => left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' }); if (trackSort.value === 'name') tracks.sort(byName); else if (trackSort.value === 'family') tracks.sort((left, right) => instrumentFamily(left).localeCompare(instrumentFamily(right), 'fr') || byName(left, right)); else if (trackSort.value === 'notes-desc') tracks.sort((left, right) => right.events.length - left.events.length || byName(left, right)); else if (trackSort.value === 'notes-asc') tracks.sort((left, right) => left.events.length - right.events.length || byName(left, right)); else tracks.sort((left, right) => left.importOrder - right.importOrder); trackIndex = Math.max(0, tracks.indexOf(selected)); syncPlaybackIndexes(); renderTracks(); renderRecord(); render(); }
function selectTrack(index) {
  if (index === trackIndex) return;
  trackIndex = index;
  if (game) {
    stopAllAudio();
    const track = tracks[trackIndex];
    const timing = timingFor(track, game.speed);
    game.timelineTiming = timing;
    const elapsed = (game.pausedAt || performance.now()) - game.started;
    game.bounds = practiceBounds(track);
    game.timelineOffset = timing.beatToMs(game.bounds.startBeat);
    game.notes = playableNotes(track, timing, game.countIn, activeCodes(), elapsed - 320, game.bounds, game.timelineOffset);
    game.msToBeat = milliseconds => { let low = game.bounds.startBeat; let high = game.bounds.endBeat + 1; for (let iteration = 0; iteration < 22; iteration += 1) { const middle = (low + high) / 2; if (timing.beatToMs(middle) - game.timelineOffset < milliseconds) low = middle; else high = middle; } return (low + high) / 2; };
    game.changes = (track.changes || []).filter(change => change.beat >= game.bounds.startBeat && change.beat < game.bounds.endBeat).map(change => ({ ...change, time: game.countIn + timing.beatToMs(change.beat) - game.timelineOffset + latencyOffsetMs }));
    game.activeInputs.clear();
    syncPlaybackIndexes(elapsed);
    statusElement.textContent = `Partie poursuivie avec la voix « ${track.name} ».`;
  }
  renderTracks(); renderRecord(); render();
}
function renderTracks() { trackList.innerHTML = tracks.map((track, index) => { const source = track.sourceKind === 'excerpt' ? 'partie récente' : track.sourceKind === 'master' ? 'partition générale' : ''; return `<button class="track${index === trackIndex ? ' selected' : ''}" data-track="${index}" title="${source ? `Source : ${source} · ` : ''}${track.sourceDocument || ''}">${track.name} · ${track.events.length} notes${source ? ` · ${source}` : ''}</button>`; }).join(''); trackList.querySelectorAll('[data-track]').forEach(button => button.onclick = () => selectTrack(Number(button.dataset.track))); refreshPracticeRange(); }

function renderScorePreview() {
  const codes = activeCodes();
  const track = tracks[trackIndex] || tracks[0];
  const now = game ? (game.pausedAt || performance.now()) - game.started : 0;
  const source = game ? game.notes.filter(note => note.time - now > -game.initialBeatMs * 2 && note.time - now < game.initialBeatMs * 9) : track.events.slice(0, 28).map((event, index) => ({ ...event, time: 2400 + index * 600, done: false }));
  const target = 208;
  const currentBeat = game ? game.msToBeat(Math.max(0, now - game.countIn)) : 0;
  const musicalState = stateAt(track, currentBeat);
  const geometry = scoreGeometry(track);
  const selectedClef = effectiveClef(track);
  const scoreTiming = timingFor(track, game?.speed || 1);
  const noteSpacing = Number(noteSpacingControl.value);
  const scoreScale = Number(scoreScaleControl.value) / 100;
  const rightEdge = Math.max(320, (stage.clientWidth - 76) / scoreScale || 1120);
  const flowTimeForBeat = beat => game ? game.countIn + scoreTiming.beatToMs(beat) - game.timelineOffset + latencyOffsetMs : 0;
  const beatPosition = beat => game ? target + (flowTimeForBeat(beat) - now) / game.initialBeatMs * noteSpacing : target + beat * noteSpacing / 3;
  const positionFor = (note, index) => { const left = game ? target + (note.time - now) / game.initialBeatMs * noteSpacing : target + index * noteSpacing / 3; return { left, top: scoreNoteTop(track, note, geometry.shift) }; };
  const notes = source.map((note, index) => {
    const { left, top } = positionFor(note, index);
    if (left < 42 || left > rightEdge || note.done) return '';
    const lane = laneFor(note.pitch);
    const color = colorNotesToggle.checked ? laneColor(lane) : '#17243a';
    const opacity = Math.max(0, Math.min(1, (left - target + 72) / 72));
    const fingering = controlLabel(note, track);
    const stackedValves = inputStyle.value === 'valves' && /^\d{2,}$/.test(fingering);
    const hasLowerNotation = Boolean(noteAccidental(notationPitch(note)) || note.dots || articulationGlyph(note.articulation) || note.symbols?.length || note.chord?.length > 1);
    const fingeringMarkup = stackedValves ? [...fingering].join('<br>') : fingering;
    return `<i class="score-note ${durationClass(note.baseBeats || note.beats || 1, Boolean(note.beam))}${note.grace ? ' grace' : ''}${note.tieEnd ? ' tied-from-previous' : ''}" data-flow-time="${note.time}" data-flow-kind="note" data-visual-id="${note.visualId}" style="--note:${color};left:${left}px;top:${top}px;opacity:${opacity}" title="${noteName(notationPitch(note))} · ${durationLabel(note)} · ${note.tieStart ? 'début de liaison' : note.tieEnd ? 'fin de liaison' : ''}"><em>${noteAccidental(notationPitch(note))}</em>${note.tieEnd ? '<span class="tie-incoming" title="Liée depuis la note précédente"></span>' : ''}${note.dots ? `<span class="duration-dot" title="${note.dots} point(s) de durée">${'·'.repeat(note.dots)}</span>` : ''}${note.chord?.length > 1 ? `<span class="chord-count">+${note.chord.length - 1}</span>` : ''}${note.tuplet ? `<span class="tuplet-number" title="Tuplet ${note.tuplet}">${note.tuplet.split(':')[0]}</span>` : ''}${articulationGlyph(note.articulation) ? `<span class="articulation">${articulationGlyph(note.articulation)}</span>` : ''}${note.symbols?.length ? `<span class="notation-symbols">${note.symbols.join(' · ')}</span>` : ''}${showFingeringToggle.checked && inputStyle.value !== 'rhythm' ? `<small class="fingering${stackedValves ? ' stacked' : ''}${hasLowerNotation ? ' lower' : ''}">${fingeringMarkup}</small>` : ''}</i>`;
  }).join('');
  const beams = source.map((note, index) => { if (!note.beam || note.done) return ''; const nextIndex = source.findIndex((candidate, candidateIndex) => candidateIndex > index && candidate.beam === note.beam && !candidate.done); if (nextIndex < 0 || nextIndex - index > 4) return ''; const next = source[nextIndex], from = positionFor(note, index), to = positionFor(next, nextIndex); if (from.left < 42 || to.left > rightEdge) return ''; const deltaX = to.left - from.left, deltaY = to.top - from.top; const layers = Math.max(1, Math.min(3, Math.round(-Math.log2(Math.max(note.baseBeats || .5, next.baseBeats || .5))))); return Array.from({ length: layers }, (_, layer) => `<span class="beam-segment" data-flow-start="${note.time}" data-flow-end="${next.time}" data-flow-range="beam" data-from-top="${from.top - 35 + layer * 7}" data-to-top="${to.top - 35 + layer * 7}" style="left:${from.left + 19}px;top:${from.top - 35 + layer * 7}px;width:${Math.hypot(deltaX, deltaY)}px;transform:rotate(${Math.atan2(deltaY, deltaX)}rad)"></span>`).join(''); }).join('');
  const ties = source.map((note, index) => { if (!note.tieStart || note.done) return ''; const nextIndex = source.findIndex((candidate, candidateIndex) => candidateIndex > index && candidate.tieEnd && candidate.pitch === note.pitch); if (nextIndex < 0) return ''; const next = source[nextIndex], from = positionFor(note, index), to = positionFor(next, nextIndex); if (from.left < target - 72 || to.left > rightEdge) return ''; const opacity = Math.max(0, Math.min(1, (from.left - target + 72) / 72)); return `<span class="tie-segment" data-flow-start="${note.time}" data-flow-end="${next.time}" data-flow-range="tie" style="left:${from.left + 8}px;top:${Math.max(from.top,to.top) + 12}px;width:${Math.max(18,to.left-from.left)}px;opacity:${opacity}" title="Liaison de tenue"></span>`; }).join('');
  const durations = source.map(note => { const left = game ? target + (note.time - now) / game.initialBeatMs * noteSpacing : target + source.indexOf(note) * noteSpacing / 3; if (left < 42 || left > rightEdge || note.done) return ''; const width = Math.min(rightEdge - left, Math.max(8, (note.beats || 1) * noteSpacing)); const tap = (note.beats || 1) <= 1 && !requireHoldToggle.checked; return `<span class="duration-mark${tap ? ' tap' : ''}" data-flow-time="${note.time}" style="--note:${colorNotesToggle.checked ? laneColor(laneFor(note.pitch)) : '#64748b'};left:${left}px;width:${width}px" data-label="${durationLabel(note)}"></span>`; }).join('');
  const rests = showRestsToggle.checked ? expandedRests(track).map(rest => { const displayBeat = rest.displayBeat ?? rest.beat + rest.beats / 2; const left = beatPosition(displayBeat); if (left < target - 72 || left > rightEdge) return ''; const opacity = Math.max(0, Math.min(1, (left - target + 72) / 72)); const remaining = Number(rest.measuresRemaining || 0); const label = remaining > 0 ? `<b>${remaining}</b>` : ''; const annotations = rest.symbols?.length ? `<i class="rest-annotation">${rest.symbols.join(' ')}</i>` : ''; return `<span class="score-rest" data-flow-time="${flowTimeForBeat(displayBeat)}" data-flow-kind="fade" style="left:${left}px;top:${geometry.shift + 126}px;opacity:${opacity}" title="Silence de ${rest.beats} temps">${restGlyph(rest.beats)}${label}${annotations}</span>`; }).join('') : '';
  const measureLines = showMeasuresToggle.checked ? (track.measureBeats || []).map((beat, index) => { const left = beatPosition(beat); return left < 42 || left > rightEdge ? '' : `<span class="measure-line" data-flow-time="${flowTimeForBeat(beat)}" style="left:${left}px"><small>${index + 1}</small></span>`; }).join('') : '';
  const changes = game ? game.changes.map(change => { const left = target + (change.time - now) / game.initialBeatMs * noteSpacing; if (left < 70 || left > rightEdge) return ''; if (change.type === 'key') { const key = concertPitchToggle.checked ? (change.concertValue ?? change.value) : (change.writtenValue ?? change.value); return `<span class="score-change incoming-signature key-signature" data-flow-time="${change.time}" style="left:${left}px">${keySignatureMarkup(key, clefInfo(selectedClef))}</span>`; } if (change.type === 'time') return `<span class="score-change incoming-signature time-signature" data-flow-time="${change.time}" style="left:${left}px">${timeSignatureMarkup(change.value)}</span>`; if (change.type === 'clef') { const clef = concertPitchToggle.checked ? (change.concertValue ?? change.value) : (change.writtenValue ?? change.value); const info = clefInfo(clef); return clefOverride.value === 'auto' ? `<span class="score-change incoming-clef" data-flow-time="${change.time}" style="left:${left}px" title="Clef de ${info.label}">${clefMarkup(info)}</span>` : ''; } const label = change.type === 'tempo' ? `♩=${change.bpm}` : change.value; return `<span class="score-change" data-flow-time="${change.time}" style="left:${left}px">${label || ''}</span>`; }).join('') : '';
  stage.classList.add('score-stage');
  stage.style.setProperty('--score-scale', scoreScale);
  stage.style.setProperty('--score-content-width', `${100 / scoreScale}%`);
  const displayClef = clefInfo(clefOverride.value === 'auto' ? (musicalState.clef || selectedClef) : selectedClef);
  const detectedNote = inputStyle.value === 'microphone' ? microphoneDisplayNote(track) : null;
  const microphoneLine = detectedNote ? `<span class="microphone-pitch-line" style="left:${target}px;top:${scoreNoteTop(track, detectedNote, geometry.shift) + 8}px"><b>${noteName(Math.round(microphonePitch))}</b></span>` : '';
  const controls = inputStyle.value === 'valves' ? ['0','1','2','3'].map(value => { const active = value === '0' ? !pressedValves.size : pressedValves.has(Number(value)); return `<span class="${active ? 'pressed' : ''}${active && breathPressed ? ' breathing' : ''}">${value}</span>`; }).join('') : inputStyle.value === 'slide' ? Array.from({ length: 7 }, (_, index) => `<span class="${slidePosition === index + 1 ? 'pressed' : ''}${slidePosition === index + 1 && breathPressed ? ' breathing' : ''}">${index + 1}</span>`).join('') : inputStyle.value === 'midi-device' || inputStyle.value === 'microphone' ? `<span class="${inputStyle.value === 'midi-device' ? midiPressed.size : microphoneCandidate !== null ? 'pressed' : ''}">${game?.notes.find(note => !note.done) ? controlLabel(game.notes.find(note => !note.done), track) : '—'}</span>` : codes.map((code, index) => `<span class="${pressedKeys.has(code) ? 'pressed' : ''}" style="--lane:${laneColor(index)}">${keyLabel(code)}</span>`).join('');
  const valveProfile = inputStyle.value === 'valves' ? valveFingeringsFor(game?.notes.find(note => !note.done) || track.events[0], track).profile.name : '';
  stage.innerHTML = `<div class="staff-meta"><strong>${track.name} · ${track.instrument || 'instrument synthétique'}</strong><span>Clef de ${displayClef.label} · ♩ = ${musicalState.tempo || 100}${valveProfile ? ` · Profil ${valveProfile}` : ''}</span></div><div class="staff-lines" style="height:${geometry.height}px;--staff-shift:${geometry.shift}px"><span class="clef">${clefMarkup(displayClef)}</span><span class="key-signature">${keySignatureMarkup(musicalState.key, displayClef)}</span><span class="time-signature">${timeSignatureMarkup(musicalState.time)}</span><span class="hit-line" style="left:${target}px"></span>${microphoneLine}${measureLines}${changes}${rests}${beams}${ties}${notes}</div><div class="duration-track"><span class="duration-label">Tenue attendue</span>${durations}</div><div class="score-keys">${controls}</div>`;
  if (game) game.lastSceneRefresh = now;
  renderInstrumentGuide();
}
function updateVisualFrame(now = game ? (game.pausedAt || performance.now()) - game.started : 0) {
  if (!game) return;
  if (modeSelect.value === 'score') {
    const target = 208;
    const noteSpacing = Number(noteSpacingControl.value);
    const leftFor = time => target + (time - now) / game.initialBeatMs * noteSpacing;
    stage.querySelectorAll('[data-flow-time]').forEach(element => {
      const left = leftFor(Number(element.dataset.flowTime));
      element.style.left = `${left}px`;
      if (element.dataset.flowKind === 'note' || element.dataset.flowKind === 'fade') element.style.opacity = String(Math.max(0, Math.min(1, (left - target + 72) / 72)));
    });
    stage.querySelectorAll('[data-flow-range]').forEach(element => {
      const from = leftFor(Number(element.dataset.flowStart));
      const to = leftFor(Number(element.dataset.flowEnd));
      if (element.dataset.flowRange === 'beam') {
        const fromTop = Number(element.dataset.fromTop), toTop = Number(element.dataset.toTop);
        const deltaX = to - from, deltaY = toTop - fromTop;
        element.style.left = `${from + 19}px`; element.style.top = `${fromTop}px`; element.style.width = `${Math.hypot(deltaX, deltaY)}px`; element.style.transform = `rotate(${Math.atan2(deltaY, deltaX)}rad)`;
      } else {
        element.style.left = `${from + 8}px`; element.style.width = `${Math.max(18, to - from)}px`; element.style.opacity = String(Math.max(0, Math.min(1, (from - target + 72) / 72)));
      }
    });
    return;
  }
  stage.querySelectorAll('[data-fall-time]').forEach(element => { const top = ((now - Number(element.dataset.fallTime) + game.travel) / game.travel) * 680 - 130; element.style.transform = `translate3d(0,${top}px,0)`; });
}
function render() {
  if (modeSelect.value === 'score') { renderScorePreview(); return; }
  stage.classList.remove('score-stage');
  const codes = activeCodes();
  stage.style.setProperty('--lanes', codes.length);
  stage.innerHTML = codes.map((code, index) => `<div class="lane" style="--lane:${laneColor(index)}"><div class="target">${keyLabel(code)}</div></div>`).join('');
  renderInstrumentGuide();
  if (!game) return;
  const lanes = stage.querySelectorAll('.lane');
  const now = (game.pausedAt || performance.now()) - game.started;
  game.notes.forEach(note => { if (note.done) return; const top = ((now - note.time + game.travel) / game.travel) * 680 - 130; if (top < -130 || top > 650) return; const element = document.createElement('div'); element.className = 'note'; element.dataset.fallTime = note.time; element.style.setProperty('--lane', laneColor(note.lane)); element.style.transform = `translate3d(0,${top}px,0)`; element.textContent = note.label; lanes[note.lane].append(element); });
  game.lastSceneRefresh = now;
}

function instrumentProfile(name = '') { const value = name.toLowerCase(); if (audioStyle.value === 'retro') return { wave: 'square', harmonics: [1,.22], attack: .002, release: .08, cutoff: 9000 }; if (audioStyle.value === 'midi') return { wave: /flute|organ|orgue/.test(value) ? 'sine' : 'triangle', harmonics: [1,.18,.06], attack: .008, release: .18, cutoff: 6500 }; if (/drum|percussion|batterie/.test(value)) return { wave: 'square', harmonics: [1,.35,.18], attack: .002, release: .08, noise: .45, cutoff: 5200 }; if (/tromp|cornet|bugle/.test(value)) return { wave: 'sawtooth', harmonics: [1,.32,.12], attack: .035, release: .22, cutoff: 3900, detune: 4 }; if (/trombon|euphon|tuba|sousaph|horn|cor|baritone/.test(value)) return { wave: 'sawtooth', harmonics: [1,.2,.08], attack: .06, release: .32, cutoff: 2700, detune: 3 }; if (/sax|clarinet/.test(value)) return { wave: 'square', harmonics: [1,.16,.08], attack: .045, release: .28, cutoff: 3200, detune: 2 }; if (/flute|piccolo|hautbois|oboe/.test(value)) return { wave: 'sine', harmonics: [1,.22,.06], attack: .04, release: .26, cutoff: 7200, detune: 2 }; if (/violin|viola|cello|violon|corde|string/.test(value)) return { wave: 'sawtooth', harmonics: [1,.28,.14], attack: .13, release: .48, cutoff: 4300, detune: 5 }; if (/guitar|guitare|harp|harpe/.test(value)) return { wave: 'triangle', harmonics: [1,.3,.1], attack: .005, release: .7, cutoff: 4800, detune: 2 }; if (/organ|orgue/.test(value)) return { wave: 'sine', harmonics: [1,.5,.25,.12], attack: .035, release: .4, cutoff: 6200, detune: 1 }; return { wave: 'triangle', harmonics: [1,.24,.08], attack: .015, release: .35, cutoff: 5600, detune: 2 }; }
function syntheticSound(pitch, volume = .1, duration = .24, instrument = '', delayMs = 0) {
  ensureAudio();
  const profile = instrumentProfile(instrument);
  const output = audio.createGain();
  const filter = audio.createBiquadFilter();
  const startAt = audio.currentTime + Math.max(0, delayMs) / 1000;
  const releaseAt = startAt + Math.max(.06, duration);
  const safeVolume = volume * .3;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(profile.cutoff || 6000, startAt);
  filter.Q.value = audioStyle.value === 'realistic' ? .7 : .2;
  output.gain.setValueAtTime(.0001, startAt);
  output.gain.exponentialRampToValueAtTime(Math.max(.0001, safeVolume), startAt + profile.attack);
  output.gain.setValueAtTime(Math.max(.0001, safeVolume), releaseAt);
  output.gain.exponentialRampToValueAtTime(.0001, releaseAt + profile.release);
  output.connect(filter).connect(audio.destination);
  profile.harmonics.forEach((level, index) => {
    const oscillator = trackAudioSource(audio.createOscillator());
    const partial = audio.createGain();
    oscillator.type = profile.wave;
    oscillator.frequency.value = 440 * 2 ** ((pitch - 69) / 12) * (index + 1);
    oscillator.detune.value = index ? (profile.detune || 0) * (index % 2 ? 1 : -1) : 0;
    partial.gain.value = level / profile.harmonics.reduce((sum, item) => sum + item, 0);
    oscillator.connect(partial).connect(output);
    oscillator.start(startAt);
    oscillator.stop(releaseAt + profile.release + .03);
  });
  if (profile.noise) {
    const length = Math.max(1, Math.floor(audio.sampleRate * Math.min(.18, duration)));
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    const noise = trackAudioSource(audio.createBufferSource());
    const noiseGain = audio.createGain();
    noise.buffer = buffer;
    noiseGain.gain.value = safeVolume * profile.noise;
    noise.connect(noiseGain).connect(output);
    noise.start(startAt);
  }
}
function sound(pitch, volume = .1, duration = .24, instrument = '', delayMs = 0) {
  if (audioStyle.value !== 'soundfont') { syntheticSound(pitch, volume, duration, instrument, delayMs); return; }
  const velocity = Math.max(1, Math.min(127, volume * 1200));
  ensureSoundFontEngine().then(engine => engine.play({ pitch, velocity, duration, instrument, delayMs })).catch(error => {
    statusElement.textContent = `MS Basic indisponible : ${error.message}. Repli synthétique utilisé.`;
    syntheticSound(pitch, volume, duration, instrument, delayMs);
  });
}
function diatonicNeighbor(pitch, direction, fifths = 0) { const tonicByFifths = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]; const tonic = tonicByFifths[((Number(fifths) % 12) + 12) % 12]; const scale = new Set([0,2,4,5,7,9,11].map(interval => (tonic + interval) % 12)); for (let distance = 1; distance <= 3; distance += 1) { const candidate = pitch + direction * distance; if (scale.has(((candidate % 12) + 12) % 12)) return candidate; } return pitch + direction * 2; }
function ornamentPitches(note) { const value = String(note.ornament || '').toLowerCase(); const upper = Number.isFinite(note.ornamentAbove) ? note.pitch + note.ornamentAbove : diatonicNeighbor(note.pitch, 1, note.keyFifths); const lower = Number.isFinite(note.ornamentBelow) ? note.pitch - note.ornamentBelow : diatonicNeighbor(note.pitch, -1, note.keyFifths); if (/trill/.test(value)) return [note.pitch, upper, note.pitch, upper]; if (/mordent/.test(value)) return [note.pitch, lower, note.pitch]; if (/turn|gruppetto/.test(value)) return [upper, note.pitch, lower, note.pitch]; return []; }
function tremoloCount(value = '') { const text = String(value).toLowerCase(); if (/32|3|r32/.test(text)) return 8; if (/16|2|r16/.test(text)) return 4; if (/8|1|r8/.test(text)) return 2; return text ? 4 : 0; }
function playEventSound(note, volumeLimit = .18, currentTrack = false, delayMs = 0, automaticPlayback = false) {
  if (note.silentTie || (automaticPlayback && note.tremoloContinuation)) return;
  const pitches = note.tremoloPitches?.length ? note.tremoloPitches : note.chord?.length ? note.chord : [note.pitch];
  const articulation = note.articulation || '';
  const durationFactor = /stacc/i.test(articulation) ? .46 : /tenuto|portato/i.test(articulation) ? 1.015 : note.tieStart ? 1.01 : .965;
  const accent = /accent|marcato|sforz/i.test(articulation) ? 1.3 : 1;
  const trackGain = Number(currentTrack ? trackVolume.value : masterVolume.value) / 100;
  const writtenDuration = (note.durationMs ? note.durationMs / 1000 : note.playbackDuration || note.beats * .6) * (note.playbackStretch || 1);
  const instrument = `${note.instrumentId || ''} ${note.instrument || ''}`.trim();
  const volume = Math.min(volumeLimit, (note.volume || .1) * accent / Math.sqrt(pitches.length)) * trackGain;
  const ornaments = ornamentPitches(note);
  const tremolos = tremoloCount(note.tremolo);
  if (ornaments.length) { const slice = Math.max(.05, Math.min(.18, writtenDuration / ornaments.length)); ornaments.forEach((pitch, index) => sound(pitch, volume, slice * .9, instrument, delayMs + index * slice * 1000)); return; }
  if (tremolos) { const slice = Math.max(.035, writtenDuration / tremolos); Array.from({ length: tremolos }, (_, index) => sound(pitches[index % pitches.length], volume, slice * .82, instrument, delayMs + index * slice * 1000)); return; }
  pitches.forEach((pitch, index) => sound(pitch, volume, Math.max(.06, Math.min(8, writtenDuration * durationFactor)), instrument, delayMs + (note.arpeggio ? index * 38 : 0)));
  if (note.glissandoTarget && pitches.length === 1) { const steps = Math.min(18, Math.max(2, Math.abs(note.glissandoTarget - note.pitch))); const slice = writtenDuration / steps; Array.from({ length: steps - 1 }, (_, index) => { const ratio = (index + 1) / steps; sound(note.pitch + (note.glissandoTarget - note.pitch) * ratio, volume * .7, Math.max(.035, slice * .9), instrument, delayMs + ratio * writtenDuration * 1000); }); }
}
function metronomeClick(accent = false, delayMs = 0) { ensureAudio(); const oscillator = trackAudioSource(audio.createOscillator()); const gain = audio.createGain(); const startAt = audio.currentTime + Math.max(0, delayMs) / 1000; oscillator.type = 'square'; oscillator.frequency.value = accent ? 1320 : 880; gain.gain.setValueAtTime(.075, startAt); gain.gain.exponentialRampToValueAtTime(.001, startAt + .045); oscillator.connect(gain).connect(audio.destination); oscillator.start(startAt); oscillator.stop(startAt + .05); }
function audioSchedulerTick() {
  if (!game || game.pausedAt) return;
  const now = performance.now() - game.started;
  const horizon = now + 140;
  while (game.clickIndex < game.clicks.length && game.clicks[game.clickIndex].time <= horizon) {
    const click = game.clicks[game.clickIndex];
    if (click.prelude || metronomeToggle.checked) metronomeClick(click.accent, click.time - now);
    game.clickIndex += 1;
  }
  if (accompanimentToggle.checked) tracks.forEach((track, index) => {
    if (index === trackIndex) return;
    const timing = sharedPlaybackTiming();
    let cursor = game.backIndexes[index] || 0;
    while (cursor < track.events.length) {
      const event = track.events[cursor];
      if (event.beat >= game.bounds.endBeat - .001) { cursor = track.events.length; break; }
      const when = sharedPlaybackMoment(event.beat);
      if (when > horizon) break;
      const audibleBeats = event.audibleBeats || event.beats;
      playEventSound({ ...event, playbackDuration: Math.max(.04, (timing.beatToMs(event.beat + audibleBeats) - timing.beatToMs(event.beat)) / 1000) }, .055, false, when - now, true);
      cursor += 1;
    }
    game.backIndexes[index] = cursor;
  });
  if (currentTrackPlaybackToggle.checked) {
    const track = tracks[trackIndex];
    const timing = sharedPlaybackTiming();
    let cursor = game.guideIndexes[trackIndex] || 0;
    while (cursor < track.events.length) {
      const event = track.events[cursor];
      if (event.beat >= game.bounds.endBeat - .001) { cursor = track.events.length; break; }
      const when = sharedPlaybackMoment(event.beat);
      if (when > horizon) break;
      const audibleBeats = event.audibleBeats || event.beats;
      playEventSound({ ...event, playbackDuration: Math.max(.04, (timing.beatToMs(event.beat + audibleBeats) - timing.beatToMs(event.beat)) / 1000) }, .12, true, when - now, true);
      cursor += 1;
    }
    game.guideIndexes[trackIndex] = cursor;
  }
}
function startAudioScheduler() { clearInterval(audioScheduler); audioSchedulerTick(); audioScheduler = window.setInterval(audioSchedulerTick, 25); }
function stopAudioScheduler() { clearInterval(audioScheduler); audioScheduler = 0; }
function stopMetronomePreview() { if (!metronomePreview) return; clearInterval(metronomePreview.timer); metronomePreview = null; document.getElementById('clickMetronome').textContent = 'Écouter le métronome'; }
function toggleMetronome() {
  if (game) {
    metronomeToggle.checked = !metronomeToggle.checked;
    if (metronomeToggle.checked) { const elapsed = performance.now() - game.started; game.clickIndex = game.clicks.findIndex(click => click.time > elapsed); if (game.clickIndex < 0) game.clickIndex = game.clicks.length; }
    document.getElementById('clickMetronome').textContent = metronomeToggle.checked ? 'Couper le métronome' : 'Écouter le métronome';
    renderRecord();
    return;
  }
  if (metronomePreview) { stopMetronomePreview(); return; }
  const tempo = tracks[trackIndex]?.tempo || 100;
  const interval = 60000 / tempo / (Number(speedControl.value) / 100);
  let beat = 0;
  metronomeClick(true);
  metronomePreview = { timer: setInterval(() => { beat += 1; metronomeClick(beat % 4 === 0); }, interval) };
  document.getElementById('clickMetronome').textContent = 'Arrêter le métronome';
}
function renderLatencyStatus(message = '') { const browserLatency = audio?.outputLatency ? ` · sortie navigateur ≈ ${Math.round(audio.outputLatency * 1000)} ms` : ''; latencyStatus.textContent = message || `Compensation : ${latencyOffsetMs >= 0 ? '+' : ''}${latencyOffsetMs} ms${browserLatency}`; }
function finishLatencyCalibration(cancelled = false) { if (!calibration) return; calibration.timers.forEach(clearTimeout); const samples = calibration.samples.map(sample => sample.offset).sort((left, right) => left - right); calibration = null; document.getElementById('calibrateLatency').textContent = 'Calibrer la latence'; if (cancelled || samples.length < 4) { renderLatencyStatus(cancelled ? 'Calibrage annulé.' : 'Pas assez de frappes : recommencez le calibrage.'); return; } const trimmed = samples.length > 5 ? samples.slice(1, -1) : samples; latencyOffsetMs = Math.max(-250, Math.min(500, Math.round(trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length))); try { localStorage.setItem('rhythm-latency-offset', latencyOffsetMs); } catch {} renderLatencyStatus(`Calibrage enregistré : ${latencyOffsetMs >= 0 ? '+' : ''}${latencyOffsetMs} ms (${samples.length} frappes).`); render(); }
function startLatencyCalibration() { if (calibration) { finishLatencyCalibration(true); return; } stop(); ensureAudio(); const interval = 700; const startAt = performance.now() + 900; const expected = Array.from({ length: 12 }, (_, index) => startAt + index * interval); calibration = { expected, samples: [], used: new Set(), timers: expected.map((time, index) => setTimeout(() => { metronomeClick(index % 4 === 0); latencyStatus.textContent = index < 4 ? `Écoutez les clics… entraînement ${index + 1}/4` : `Frappez une touche sur chaque clic · ${index - 3}/8`; }, Math.max(0, time - performance.now()))) }; calibration.timers.push(setTimeout(() => finishLatencyCalibration(false), expected[expected.length - 1] - performance.now() + 900)); document.getElementById('calibrateLatency').textContent = 'Annuler le calibrage'; latencyStatus.textContent = 'Préparez-vous : écoutez quatre clics, puis frappez en rythme.'; }
function registerCalibrationTap() { if (!calibration) return; const now = performance.now(); let nearestIndex = -1, nearestDistance = Infinity; calibration.expected.forEach((time, index) => { const distance = Math.abs(now - time); if (index >= 4 && !calibration.used.has(index) && distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; } }); if (nearestIndex < 0 || nearestDistance > 350) return; calibration.used.add(nearestIndex); calibration.samples.push({ index: nearestIndex, offset: now - calibration.expected[nearestIndex] }); }
function loop() {
  if (!game) return;
  const now = performance.now() - game.started;
  game.notes.forEach(note => { if (note.done || note.active) return; if (note.silentTie && now - note.time > note.durationMs) { note.done = true; return; } if (!note.silentTie && now - note.time > 320) { note.done = true; game.misses += 1; registerJudgement(note, 'miss', now - note.time); } });
  if (!visualSelectionActive && now - game.lastRender >= 15) { game.visualStepMs = Number.isFinite(game.lastRender) ? Math.min(50, now - game.lastRender) : 16; game.lastRender = now; if (now - (game.lastSceneRefresh || -Infinity) >= 260) render(); else updateVisualFrame(now); }
  setTextIfChanged(accuracyElement, game.hits + game.misses ? `${Math.round(game.hits / (game.hits + game.misses) * 100)} %` : '—');
  if (game.notes.every(note => note.done)) {
    const finished = game;
    const attempts = finished.hits + finished.misses;
    const accuracy = attempts ? finished.hits / attempts : 0;
    const isRecord = saveRecord();
    const repeat = loopEnabled.checked;
    if (repeat && adaptiveSpeed.checked) {
      if (accuracy >= .9) speedControl.value = String(Math.min(150, Number(speedControl.value) + 5));
      else if (accuracy < .7) speedControl.value = String(Math.max(50, Number(speedControl.value) - 5));
      document.getElementById('speedValue').value = `${speedControl.value} %`;
    }
    statusElement.textContent = `Terminé : ${finished.hits} notes réussies.${isRecord ? ' Nouveau record !' : ''}${repeat ? ` Nouvelle boucle à ${speedControl.value} %…` : ''}`;
    if (!repeat) {
      const result = { score: finished.score, scoreLabel: `${finished.score} points · ${Math.round(accuracy * 100)} %`, won: true, accuracy: Math.round(accuracy * 100) };
      if (window.GameRecords) window.GameRecords.finish(result);
      else window.LanMultiplayer?.finish(result);
    }
    stopAudioScheduler(); game = null;
    if (repeat) window.setTimeout(() => startButton.click(), 800);
    return;
  }
  game.frame = requestAnimationFrame(loop);
}
async function start() {
  stopMetronomePreview();
  stop();
  const track = tracks[trackIndex];
  if (!track?.events.length) { statusElement.textContent = 'Cette piste ne contient aucune note reconnue.'; return; }
  if (audioStyle.value === 'soundfont') {
    statusElement.textContent = 'Chargement de MS Basic MuseScore (49 Mo)…';
    try { const engine = await ensureSoundFontEngine(); await engine.init(); statusElement.textContent = 'MS Basic chargé. Préparation de la partie…'; }
    catch (error) { statusElement.textContent = `MS Basic indisponible (${error.message}) : utilisation du moteur réaliste synthétique.`; audioStyle.value = 'realistic'; }
  }
  const codes = activeCodes();
  const speed = Number(speedControl.value) / 100;
  const timing = timingFor(track, speed);
  const bounds = practiceBounds(track);
  if (!track.events.some(event => event.beat >= bounds.startBeat - .001 && event.beat < bounds.endBeat - .001)) { statusElement.textContent = `Aucune note dans la boucle M${bounds.startMeasure} à M${bounds.endMeasure}.`; return; }
  const timelineOffset = timing.beatToMs(bounds.startBeat);
  const initialBeatMs = 60000 / (track.tempo || 100) / speed;
  const [initialNumerator, initialDenominator] = String(stateAt(track, bounds.startBeat).time || '4/4').split('/').map(Number);
  const countInPulseBeats = 4 / (initialDenominator || 4);
  const countInPulseCount = initialNumerator || 4;
  const countIn = timing.beatToMs(countInPulseCount * countInPulseBeats);
  const maxBeat = bounds.endBeat;
  const changes = (track.changes || []).filter(change => change.beat >= bounds.startBeat && change.beat < bounds.endBeat).map(change => ({ ...change, time: countIn + timing.beatToMs(change.beat) - timelineOffset + latencyOffsetMs }));
  const timeChanges = [{ beat: 0, value: track.time || '4/4' }, ...(track.changes || []).filter(change => change.type === 'time')];
  const clicks = Array.from({ length: countInPulseCount }, (_, pulse) => ({ time: timing.beatToMs(pulse * countInPulseBeats), accent: pulse === 0, prelude: true }));
  const measureStarts = track.measureBeats || [];
  for (let beat = bounds.startBeat; beat <= maxBeat + .001;) { const available = timeChanges.filter(change => change.beat <= beat); const signature = available[available.length - 1]; const [numerator, denominator] = String(signature?.value || track.time || '4/4').split('/').map(Number); const pulseBeats = 4 / (denominator || 4); const measureBeats = (numerator || 4) * pulseBeats; const relativeMeasure = (beat - (signature?.beat || 0)) / measureBeats; const accent = measureStarts.length ? measureStarts.some(start => Math.abs(start - beat) < .01) : Math.abs(relativeMeasure - Math.round(relativeMeasure)) < .01; clicks.push({ time: countIn + timing.beatToMs(beat) - timelineOffset, accent, prelude: false }); beat += pulseBeats; }
  const msToBeat = milliseconds => { let low = bounds.startBeat; let high = maxBeat + 1; for (let iteration = 0; iteration < 22; iteration += 1) { const middle = (low + high) / 2; if (timing.beatToMs(middle) - timelineOffset < milliseconds) low = middle; else high = middle; } return (low + high) / 2; };
  ensureAudio();
  game = { started: performance.now(), pausedAt: 0, pausedTotal: 0, visibilityPaused: false, speed, bounds, timelineTiming: timing, timelineOffset, travel: Number(approachTimeControl.value), hits: 0, misses: 0, score: 0, initialBeatMs, countIn, clicks, clickIndex: 0, changes, msToBeat, backPlayed: new Set(), backIndexes: tracks.map(() => 0), guideIndexes: tracks.map(() => 0), lastRender: -Infinity, visualStepMs: 16, activeInputs: new Map(), judgements: [], lastMissBeat: null, notes: playableNotes(track, timing, countIn, codes, -Infinity, bounds, timelineOffset) };
  syncPlaybackIndexes(0);
  retryBeforeError.disabled = true;
  renderPracticeHistory([]);
  if (matchMedia('(pointer: coarse)').matches && modeSelect.value === 'score') {
    document.body.classList.add('rhythm-focus');
    requestAnimationFrame(() => document.querySelector('.stage-wrap')?.scrollIntoView({ block: 'start' }));
  }
  document.getElementById('clickMetronome').textContent = metronomeToggle.checked ? 'Couper le métronome' : 'Écouter le métronome';
  scoreElement.textContent = '0'; statusElement.textContent = `Décompte initial : une mesure en ${initialNumerator || 4}/${initialDenominator || 4}${loopEnabled.checked ? ` · boucle M${bounds.startMeasure} à M${bounds.endMeasure}` : ''}. Le métronome continu dépend de l’option « Métronome pendant le morceau » dans Son.`; startAudioScheduler(); render(); game.frame = requestAnimationFrame(loop);
}
function stop() { stopMetronomePreview(); stopAudioScheduler(); if (game?.frame) cancelAnimationFrame(game.frame); stopAllAudio(); clearPressedInputs(); game = null; pauseButton.textContent = 'Pause'; document.getElementById('clickMetronome').textContent = 'Écouter le métronome'; render(); }
function togglePause() { if (!game) { statusElement.textContent = 'Démarrez une partie avant de la mettre en pause.'; return; } if (game.pausedAt) { const pause = performance.now() - game.pausedAt; game.started += pause; game.pausedTotal += pause; game.pausedAt = 0; game.visibilityPaused = false; ensureAudio(); window.SoundFontEngine?.resume(); syncPlaybackIndexes(); game.clickIndex = game.clicks.findIndex(click => click.time > performance.now() - game.started); if (game.clickIndex < 0) game.clickIndex = game.clicks.length; startAudioScheduler(); pauseButton.textContent = 'Pause'; statusElement.textContent = 'Partie reprise.'; game.frame = requestAnimationFrame(loop); return; } game.pausedAt = performance.now(); stopAudioScheduler(); cancelAnimationFrame(game.frame); stopAllAudio(); clearPressedInputs(); audio?.suspend().catch(() => {}); pauseButton.textContent = 'Reprendre'; statusElement.textContent = 'Partie en pause.'; }
function beginNote(note, inputId, inputLatencyMs = 0) { const now = performance.now() - game.started - inputLatencyMs; if (!note || Math.abs(note.time - now) >= 220) { statusElement.textContent = 'Aucune note jouable dans la fenêtre de précision.'; return; } const offset = now - note.time; const timingScore = Math.max(50, 250 - Math.round(Math.abs(offset))); if (!requireHoldToggle.checked || note.beats <= .5 || /stacc/i.test(note.articulation || '')) { note.done = true; game.hits += 1; game.score += timingScore; registerJudgement(note, 'hit', offset); playEventSound(note, .18, true); statusElement.textContent = `Juste : +${timingScore} points.`; } else { note.active = true; note.inputLatencyMs = inputLatencyMs; note.pressedAt = now; note.attackOffset = offset; note.timingScore = timingScore; game.score += timingScore; game.activeInputs.set(inputId, note); playEventSound({ ...note, beats: Math.min(note.beats, 2) }, .18, true); statusElement.textContent = `Attaque juste : +${timingScore}. Maintenez la note.`; } scoreElement.textContent = game.score; }
function releaseNote(inputId) { const note = game?.activeInputs.get(inputId); if (!note) return; if (game.pausedAt) { note.active = false; game.activeInputs.delete(inputId); return; } const held = performance.now() - game.started - (note.inputLatencyMs || 0) - note.pressedAt; const target = note.durationMs * (/tenuto|portato/i.test(note.articulation || '') ? .9 : .72); const ratio = held / target; note.active = false; note.done = true; game.activeInputs.delete(inputId); if (ratio >= .72 && ratio <= 1.55) { const holdScore = Math.max(80, 300 - Math.round(Math.abs(1 - ratio) * 220)); game.hits += 1; game.score += holdScore; registerJudgement(note, 'hit', note.attackOffset || 0); statusElement.textContent = `Tenue réussie : +${holdScore} points.`; } else { game.misses += 1; registerJudgement(note, 'miss', held - target); statusElement.textContent = `Tenue ${ratio < .72 ? 'trop courte' : 'trop longue'} (${Math.round(held)} ms pour ${Math.round(target)} ms attendues).`; } scoreElement.textContent = game.score; }
function press(code) {
  if (!game || game.pausedAt) return;
  const lane = activeCodes().indexOf(code);
  if (lane < 0) return;
  const now = performance.now() - game.started;
  const pending = game.notes.filter(item => !item.done && !item.active && !item.silentTie).sort((left, right) => Math.abs(left.time - now) - Math.abs(right.time - now));
  const nearest = pending[0];
  if (!nearest) { statusElement.textContent = 'Aucune note attendue maintenant.'; return; }
  const distance = nearest.time - now;
  if (Math.abs(distance) > 420) { statusElement.textContent = distance > 0 ? `Prochaine note dans ${(distance / 1000).toFixed(1)} s.` : 'La fenêtre de cette note est passée.'; return; }
  const expected = pending.filter(note => Math.abs(note.time - nearest.time) < 35);
  const note = expected.find(item => item.lane === lane);
  if (!note) { statusElement.textContent = `Mauvaise touche — attendu : ${[...new Set(expected.map(item => item.label))].join(' + ')}.`; return; }
  beginNote(note, code);
}
function hitInstrumentNote(note, inputId = 'instrument') { beginNote(note, inputId); }
function tryInstrumentInput() { if (!game || game.pausedAt || !['valves', 'slide'].includes(inputStyle.value)) return; const now = performance.now() - game.started; const note = game.notes.filter(item => !item.done && !item.active && !item.silentTie).sort((left, right) => Math.abs(left.time - now) - Math.abs(right.time - now))[0]; if (!note || Math.abs(note.time - now) > 420) return; const pitch = fingeringPitch(note); const pressed = [...pressedValves].sort((left, right) => left - right).join('') || '0'; const matches = inputStyle.value === 'valves' ? valveFingeringsFor(note).accepted.includes(pressed) : slidePositionsFor(pitch).includes(slidePosition); if (matches) hitInstrumentNote(note); }
function scheduleInstrumentInput() { clearTimeout(instrumentDebounce); instrumentDebounce = setTimeout(tryInstrumentInput, 80); }
function refreshMidiDevices() {
  const inputs = midiAccess ? [...midiAccess.inputs.values()] : [];
  const selected = midiDevice.value;
  midiDevice.innerHTML = inputs.length ? inputs.map(input => `<option value="${input.id}">${input.name || input.manufacturer || 'Entrée MIDI'}</option>`).join('') : '<option value="">Aucune entrée MIDI</option>';
  if (inputs.some(input => input.id === selected)) midiDevice.value = selected;
  inputs.forEach(input => { input.onmidimessage = input.id === midiDevice.value ? handleMidiMessage : null; });
}
async function enableMidi() {
  if (!navigator.requestMIDIAccess) { statusElement.textContent = 'Web MIDI n’est pas disponible dans ce navigateur.'; return; }
  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    midiAccess.onstatechange = refreshMidiDevices;
    refreshMidiDevices();
    statusElement.textContent = `${midiAccess.inputs.size} entrée(s) MIDI disponible(s).`;
  } catch (error) { statusElement.textContent = `MIDI inaccessible : ${error.message}`; }
}
function pendingInputNote(inputLatencyMs = 0) {
  if (!game || game.pausedAt) return null;
  const now = performance.now() - game.started - inputLatencyMs;
  return game.notes.filter(note => !note.done && !note.active && !note.silentTie && Math.abs(note.time - now) <= 420).sort((left, right) => Math.abs(left.time - now) - Math.abs(right.time - now))[0] || null;
}
function handleMidiMessage(event) {
  if (inputStyle.value !== 'midi-device') return;
  const command = event.data[0] & 0xf0, pitch = event.data[1], velocity = event.data[2] || 0;
  if (command === 0x90 && velocity > 0) {
    midiPressed.add(pitch);
    const note = pendingInputNote();
    const required = note?.chord?.length ? note.chord : note ? [note.pitch] : [];
    if (note && required.every(value => midiPressed.has(Math.round(value)))) beginNote(note, `midi:${note.visualId}`);
    renderInstrumentGuide(); render();
    return;
  }
  if (command === 0x80 || command === 0x90) {
    midiPressed.delete(pitch);
    const active = [...(game?.activeInputs || [])].find(([inputId, note]) => inputId.startsWith('midi:') && !(note.chord?.length ? note.chord : [note.pitch]).some(value => midiPressed.has(Math.round(value))));
    if (active) releaseNote(active[0]);
    renderInstrumentGuide(); render();
  }
}
function detectedFrequency(buffer, sampleRate) {
  let rms = 0;
  for (const value of buffer) rms += value * value;
  rms = Math.sqrt(rms / buffer.length);
  const threshold = Math.max(.004, (21 - Number(microphoneSensitivity.value)) * .0017);
  if (rms < threshold) return 0;
  const minimumLag = Math.floor(sampleRate / 1200), maximumLag = Math.min(buffer.length - 2, Math.ceil(sampleRate / 40));
  let bestLag = 0, bestCorrelation = 0;
  for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
    let correlation = 0, energyA = 0, energyB = 0;
    for (let index = 0; index < buffer.length - lag; index += 2) { const left = buffer[index], right = buffer[index + lag]; correlation += left * right; energyA += left * left; energyB += right * right; }
    correlation /= Math.sqrt(energyA * energyB) || 1;
    if (correlation > bestCorrelation) { bestCorrelation = correlation; bestLag = lag; }
  }
  return bestCorrelation > .72 && bestLag ? sampleRate / bestLag : 0;
}
function updateMicrophoneStatus() {
  const rounded = microphonePitch === null ? null : Math.round(microphonePitch);
  const cents = microphonePitch === null ? 0 : Math.round((microphonePitch - rounded) * 100);
  const calibrationText = microphoneCalibration ? ` · calibrage ${microphoneCalibration.samples.length}/${microphoneCalibration.expected.length - 2}` : ` · latence ${microphoneLatencyMs} ms`;
  microphoneStatus.textContent = rounded === null ? `Aucun son stable${calibrationText}` : `${noteName(rounded)} · ${microphoneFrequency.toFixed(1)} Hz · ${cents >= 0 ? '+' : ''}${cents} cents${calibrationText}`;
}
function updateMicrophonePitchVisual() {
  const line = stage.querySelector('.microphone-pitch-line');
  if (!line || microphonePitch === null) return;
  const track = tracks[trackIndex] || tracks[0];
  const note = microphoneDisplayNote(track);
  line.style.top = `${scoreNoteTop(track, note, scoreGeometry(track).shift) + 8}px`;
  const label = line.querySelector('b');
  if (label) label.textContent = noteName(Math.round(microphonePitch));
}
function microphoneCalibrationTone(delayMs = 0) {
  ensureAudio();
  const oscillator = trackAudioSource(audio.createOscillator());
  const gain = audio.createGain();
  const startsAt = audio.currentTime + Math.max(0, delayMs) / 1000;
  oscillator.type = 'sine'; oscillator.frequency.value = 440;
  gain.gain.setValueAtTime(.0001, startsAt); gain.gain.linearRampToValueAtTime(.13, startsAt + .015); gain.gain.setValueAtTime(.13, startsAt + .14); gain.gain.linearRampToValueAtTime(.0001, startsAt + .2);
  oscillator.connect(gain).connect(audio.destination); oscillator.start(startsAt); oscillator.stop(startsAt + .22);
}
function finishMicrophoneCalibration(cancelled = false) {
  if (!microphoneCalibration) return;
  microphoneCalibration.timers.forEach(clearTimeout);
  const samples = microphoneCalibration.samples.slice().sort((left, right) => left - right);
  microphoneCalibration = null;
  calibrateMicrophoneButton.textContent = 'Calibrer le microphone';
  if (!cancelled && samples.length >= 3) {
    const trimmed = samples.length > 4 ? samples.slice(1, -1) : samples;
    microphoneLatencyMs = Math.max(0, Math.min(600, Math.round(trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length)));
    try { localStorage.setItem('rhythm-microphone-latency', microphoneLatencyMs); } catch {}
    statusElement.textContent = `Latence microphone enregistrée : ${microphoneLatencyMs} ms.`;
  } else statusElement.textContent = cancelled ? 'Calibrage microphone annulé.' : 'Calibrage impossible. Utilisez les haut-parleurs, rapprochez le microphone et recommencez.';
  updateMicrophoneStatus();
}
async function startMicrophoneCalibration() {
  if (microphoneCalibration) { finishMicrophoneCalibration(true); return; }
  stop();
  if (!microphoneAnalyser) await startMicrophone();
  if (!microphoneAnalyser) return;
  const startsAt = performance.now() + 900;
  const expected = Array.from({ length: 8 }, (_, index) => startsAt + index * 700);
  const timers = expected.map(time => setTimeout(() => microphoneCalibrationTone(), Math.max(0, time - performance.now())));
  microphoneCalibration = { expected, samples: [], used: new Set(), timers };
  timers.push(setTimeout(() => finishMicrophoneCalibration(false), expected[expected.length - 1] - performance.now() + 700));
  calibrateMicrophoneButton.textContent = 'Annuler le calibrage';
  microphoneStatus.hidden = false;
  statusElement.textContent = 'Calibrage acoustique : laissez les haut-parleurs jouer huit La sans produire de son.';
}
function microphoneTick() {
  if (!microphoneAnalyser || inputStyle.value !== 'microphone') return;
  const buffer = new Float32Array(microphoneAnalyser.fftSize);
  microphoneAnalyser.getFloatTimeDomainData(buffer);
  const frequency = detectedFrequency(buffer, audio.sampleRate);
  const pitch = frequency ? 69 + 12 * Math.log2(frequency / 440) : null;
  microphonePitch = pitch;
  microphoneFrequency = frequency;
  const rounded = pitch === null ? null : Math.round(pitch);
  if (rounded === microphoneCandidate && pitch !== null && Math.abs(pitch - rounded) < .48) microphoneStableFrames += 1;
  else { microphoneCandidate = rounded; microphoneStableFrames = 1; }
  if (microphoneCalibration && pitch !== null && Math.abs(pitch - 69) < .45) {
    const now = performance.now();
    const index = microphoneCalibration.expected.findIndex((time, candidate) => candidate >= 2 && !microphoneCalibration.used.has(candidate) && now >= time && now - time < 500);
    if (index >= 0) { microphoneCalibration.used.add(index); microphoneCalibration.samples.push(now - microphoneCalibration.expected[index]); }
  }
  const activeNote = game?.activeInputs.get('microphone');
  const activePitches = activeNote ? (activeNote.chord?.length ? activeNote.chord : [activeNote.pitch]) : [];
  if (activeNote && (pitch === null || !activePitches.some(value => Math.abs(value - pitch) < .72))) {
    releaseNote('microphone');
    microphoneActiveInput = '';
  }
  if (microphoneStableFrames >= 2 && rounded !== null) {
    const note = pendingInputNote(microphoneLatencyMs);
    const required = note?.chord?.length ? note.chord : note ? [note.pitch] : [];
    if (note && required.some(value => Math.abs(value - pitch) < .55) && !game.activeInputs.has('microphone')) { microphoneActiveInput = note.visualId; beginNote(note, 'microphone', microphoneLatencyMs); }
  }
  updateMicrophoneStatus();
  updateMicrophonePitchVisual();
  renderInstrumentGuide();
}
async function startMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) { statusElement.textContent = 'Entrée microphone indisponible.'; return; }
  stopMicrophone();
  try {
    microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    ensureAudio();
    microphoneAnalyser = audio.createAnalyser(); microphoneAnalyser.fftSize = 2048; microphoneAnalyser.smoothingTimeConstant = .15;
    audio.createMediaStreamSource(microphoneStream).connect(microphoneAnalyser);
    microphoneTimer = window.setInterval(microphoneTick, 55);
    statusElement.textContent = 'Microphone actif : la hauteur est analysée uniquement dans ce navigateur.';
  } catch (error) { statusElement.textContent = `Microphone inaccessible : ${error.message}`; }
}
function stopMicrophone() { if (microphoneCalibration) finishMicrophoneCalibration(true); clearInterval(microphoneTimer); microphoneTimer = 0; microphoneStream?.getTracks().forEach(track => track.stop()); microphoneStream = null; microphoneAnalyser = null; microphoneCandidate = null; microphonePitch = null; microphoneFrequency = 0; microphoneStableFrames = 0; microphoneActiveInput = ''; }
async function prepareLanReady() {
  ensureAudio();
  await audio.resume();
  if (audioStyle.value === 'soundfont') {
    statusElement.textContent = 'Préchargement de MS Basic avant la partie LAN…';
    const engine = await ensureSoundFontEngine();
    await engine.init();
  }
  if (inputStyle.value === 'midi-device') {
    if (!midiAccess) await enableMidi();
    if (!midiAccess?.inputs?.size) throw new Error('Connectez et activez un clavier MIDI avant de vous déclarer prêt.');
  }
  if (inputStyle.value === 'microphone') {
    if (!microphoneAnalyser) await startMicrophone();
    if (!microphoneAnalyser) throw new Error('Autorisez le microphone avant de vous déclarer prêt.');
  }
  statusElement.textContent = 'Audio et commandes prêts pour le départ synchronisé.';
}
function registerLanAdapter() {
  if (!window.LanMultiplayer || registerLanAdapter.done) return;
  registerLanAdapter.done = true;
  window.LanMultiplayer.registerAdapter({ prepareReady: prepareLanReady });
}
registerLanAdapter();
window.addEventListener('lan:available', registerLanAdapter);
document.addEventListener('keydown', event => {
  rememberKeyLabel(event);
  if (calibration) { event.preventDefault(); if (!event.repeat) registerCalibrationTap(); return; }
  if (mappingTarget) {
    event.preventDefault();
    if (mappingTarget.index === null) inputMappings[mappingTarget.group] = event.code;
    else inputMappings[mappingTarget.group][mappingTarget.index] = event.code;
    if (mappingTarget.group === 'valves') valveHandedness.value = 'custom';
    mappingTarget = null; saveInputMappings(); renderMappingControls(); renderInstrumentGuide(); render(); return;
  }
  if (event.code === inputMappings.pause) { event.preventDefault(); if (!event.repeat) togglePause(); return; }
  if (event.code === inputMappings.restart && !event.target.matches('input, select, textarea')) { event.preventDefault(); if (!event.repeat) startButton.click(); return; }
  if (inputStyle.value === 'rhythm' && event.code === inputMappings.rhythm) { event.preventDefault(); if (!event.repeat) { pressedKeys.add(event.code); press(event.code); render(); } return; }
  if ((inputStyle.value === 'valves' || inputStyle.value === 'slide') && breathEnabled.checked && event.code === inputMappings.breath) { event.preventDefault(); breathPressed = true; renderInstrumentGuide(); render(); if (!event.repeat) tryInstrumentInput(); return; }
  if (event.repeat) return;
  if (inputStyle.value === 'valves') {
    const valveIndex = inputMappings.valves.indexOf(event.code);
    if (valveIndex >= 0) { pressedValves.add(valveIndex + 1); renderInstrumentGuide(); render(); if (!breathEnabled.checked || breathPressed) scheduleInstrumentInput(); event.preventDefault(); return; }
  }
  if (inputStyle.value === 'slide') {
    const position = inputMappings.slide.indexOf(event.code);
    if (position >= 0) { slidePosition = position + 1; renderInstrumentGuide(); render(); if (!breathEnabled.checked) scheduleInstrumentInput(); event.preventDefault(); return; }
  }
  if (inputStyle.value === 'keyboard' || inputStyle.value === 'organ') { if (activeCodes().includes(event.code)) { pressedKeys.add(event.code); press(event.code); render(); event.preventDefault(); } }
});
document.addEventListener('keyup', event => { pressedKeys.delete(event.code); releaseNote(event.code); if (event.code === inputMappings.breath) { event.preventDefault(); breathPressed = false; releaseNote('instrument'); renderInstrumentGuide(); render(); } const valveIndex = inputMappings.valves.indexOf(event.code); if (valveIndex >= 0) { pressedValves.delete(valveIndex + 1); renderInstrumentGuide(); render(); if (inputStyle.value === 'valves' && !breathEnabled.checked && pressedValves.size === 0) scheduleInstrumentInput(); } else if (activeCodes().includes(event.code)) render(); });
stage.addEventListener('pointerdown', event => { if (inputStyle.value !== 'rhythm' || !game || game.pausedAt || pointerRhythmActive || !event.target.closest('.target, .score-keys span')) return; event.preventDefault(); pointerRhythmActive = true; stage.setPointerCapture?.(event.pointerId); pressedKeys.add(inputMappings.rhythm); press(inputMappings.rhythm); render(); });
stage.addEventListener('pointerup', event => { if (!pointerRhythmActive) return; event.preventDefault(); pointerRhythmActive = false; pressedKeys.delete(inputMappings.rhythm); releaseNote(inputMappings.rhythm); render(); });
stage.addEventListener('pointercancel', () => { if (!pointerRhythmActive) return; pointerRhythmActive = false; pressedKeys.delete(inputMappings.rhythm); releaseNote(inputMappings.rhythm); render(); });
modeSelect.onchange = () => { stop(); renderRecord(); renderInstrumentGuide(); render(); };
let lanStartAuthorized = false;
startButton.onclick = () => {
  if (window.LanMultiplayer?.active && !lanStartAuthorized) { statusElement.textContent = 'Le départ et le redémarrage sont contrôlés par le salon LAN.'; return; }
  start().catch(error => { statusElement.textContent = `Démarrage impossible : ${error.message}`; });
};
pauseButton.onclick = togglePause;
document.getElementById('restartGame').onclick = () => startButton.click();
window.addEventListener('lan:start', () => { if (!game) { lanStartAuthorized = true; startButton.click(); lanStartAuthorized = false; } });
window.addEventListener('lan:pause', event => {
  const shouldPause = Boolean(event.detail?.paused);
  if (game && Boolean(game.pausedAt) !== shouldPause) togglePause();
});
window.addEventListener('lan:finished', () => {
  if (!game) return;
  stop();
  statusElement.textContent = 'Partie LAN terminée. Le résultat commun est affiché.';
});
speedControl.oninput = () => { document.getElementById('speedValue').value = `${speedControl.value} %`; applyLiveSpeed(); };
speedControl.onchange = renderRecord;
practicePreset.onchange = applyPracticePreset;
[loopEnabled, loopStart, loopEnd, adaptiveSpeed].forEach(control => control.addEventListener('change', () => { if (control === loopStart && Number(loopEnd.value) < Number(loopStart.value)) loopEnd.value = loopStart.value; refreshPracticeRange(); renderRecord(); }));
retryBeforeError.onclick = () => {
  if (!lastPracticeMiss) return;
  if (lastPracticeMiss.trackIndex !== trackIndex) selectTrack(lastPracticeMiss.trackIndex);
  const measure = measureForBeat(lastPracticeMiss.beat);
  loopEnabled.checked = true;
  loopStart.value = String(Math.max(1, measure - 2));
  loopEnd.value = String(Math.max(Number(loopEnd.value), measure));
  practicePreset.value = 'custom';
  startButton.click();
};
document.getElementById('clickMetronome').onclick = toggleMetronome;
colorNotesToggle.onchange = () => { renderRecord(); render(); };
requireHoldToggle.onchange = () => { renderRecord(); render(); };
inputStyle.onchange = async () => {
  pressedValves.clear(); midiPressed.clear();
  const midiMode = inputStyle.value === 'midi-device';
  const microphoneMode = inputStyle.value === 'microphone';
  midiDeviceLabel.hidden = !midiMode; enableMidiButton.hidden = !midiMode; valveHandednessLabel.hidden = inputStyle.value !== 'valves'; microphoneLabel.hidden = !microphoneMode; toggleTunerButton.hidden = !microphoneMode; calibrateMicrophoneButton.hidden = !microphoneMode; microphoneStatus.hidden = !microphoneMode || (!tunerEnabled && !microphoneCalibration);
  if (midiMode && !midiAccess) await enableMidi(); else if (midiMode) refreshMidiDevices();
  if (microphoneMode) await startMicrophone(); else stopMicrophone();
  renderRecord(); renderInstrumentGuide(); render();
};
valveHandedness.onchange = () => {
  if (valveHandedness.value === 'right') inputMappings.valves = rightHandValveCodes.slice();
  else if (valveHandedness.value === 'left') inputMappings.valves = leftHandValveCodes.slice();
  saveInputMappings();
  instrumentGuide.dataset.signature = '';
  renderMappingControls(); renderInstrumentGuide(); render();
  statusElement.textContent = valveHandedness.value === 'right' ? 'Pistons en mode droitier : J, K et L.' : valveHandedness.value === 'left' ? 'Pistons en mode main gauche : Q, S et D sur AZERTY.' : 'Commandes de pistons personnalisées.';
};
toggleTunerButton.onclick = async () => {
  tunerEnabled = !tunerEnabled;
  toggleTunerButton.textContent = tunerEnabled ? 'Masquer l’accordeur' : 'Accordeur';
  microphoneStatus.hidden = !tunerEnabled && !microphoneCalibration;
  if (tunerEnabled && !microphoneAnalyser) await startMicrophone();
  updateMicrophoneStatus();
};
calibrateMicrophoneButton.onclick = startMicrophoneCalibration;
midiDevice.onchange = refreshMidiDevices;
enableMidiButton.onclick = enableMidi;
keyboardLayoutSelect.onchange = async () => {
  keyboardLayout = keyboardLayoutSelect.value;
  try { localStorage.setItem('rhythm-keyboard-layout', keyboardLayout); } catch {}
  refreshKeyLabels();
  if (keyboardLayout === 'auto') await detectLayout();
  if (game) game.notes.forEach(note => { note.label = keyLabel(activeCodes()[note.lane]); });
  renderMappingControls();
  renderInstrumentGuide();
  render();
  statusElement.textContent = `Disposition ${keyboardLayoutSelect.options[keyboardLayoutSelect.selectedIndex].text} appliquée.`;
};
verticalSlideToggle.onchange = renderInstrumentGuide;
clefOverride.onchange = render;
concertPitchToggle.onchange = () => { instrumentGuide.dataset.signature = ''; renderInstrumentGuide(); render(); };
trackSort.onchange = applyTrackSort;
document.getElementById('calibrateLatency').onclick = startLatencyCalibration;
document.getElementById('exportUnknownSymbols').onclick = exportUnknownMuseSymbols;
document.getElementById('runRhythmTests').onclick = runRhythmTests;
document.getElementById('exportTrackDiagnostics').onclick = exportTrackDiagnostics;
showRestsToggle.onchange = render;
showMeasuresToggle.onchange = render;
function updateVisualControls() { scoreScaleControl.nextElementSibling.value = `${scoreScaleControl.value} %`; noteSpacingControl.nextElementSibling.value = `${noteSpacingControl.value} px`; approachTimeControl.nextElementSibling.value = `${(Number(approachTimeControl.value) / 1000).toFixed(1)} s`; render(); }
[scoreScaleControl, noteSpacingControl, approachTimeControl].forEach(control => control.addEventListener('input', updateVisualControls));
breathEnabled.onchange = () => { renderRecord(); renderInstrumentGuide(); };
document.getElementById('configureInputs').onclick = () => { mappingPanel.hidden = false; renderMappingControls(); };
document.getElementById('closeInputMapping').onclick = () => { mappingPanel.hidden = true; mappingTarget = null; };
document.getElementById('resetInputMapping').onclick = () => { inputMappings = structuredClone(defaultInputMappings); valveHandedness.value = 'left'; mappingTarget = null; saveInputMappings(); renderMappingControls(); render(); };
showFingeringToggle.onchange = () => { renderRecord(); render(); };
accidentalsToggle?.addEventListener('change', render);
accompanimentToggle.onchange = () => { if (accompanimentToggle.checked) syncPlaybackIndexes(); renderRecord(); };
currentTrackPlaybackToggle.onchange = () => { if (currentTrackPlaybackToggle.checked) syncPlaybackIndexes(); renderRecord(); };
metronomeToggle.onchange = () => { if (game && metronomeToggle.checked) { const elapsed = performance.now() - game.started; game.clickIndex = game.clicks.findIndex(click => click.time > elapsed); if (game.clickIndex < 0) game.clickIndex = game.clicks.length; } document.getElementById('clickMetronome').textContent = game && metronomeToggle.checked ? 'Couper le métronome' : 'Écouter le métronome'; renderRecord(); };
audioStyle.onchange = async () => { stopAllAudio(); try { localStorage.setItem('rhythm-audio-style', audioStyle.value); } catch {} statusElement.textContent = `Style audio : ${audioStyle.options[audioStyle.selectedIndex].text}.`; if (audioStyle.value === 'soundfont') { statusElement.textContent = 'Chargement de MS Basic.sf3…'; try { const engine = await ensureSoundFontEngine(); await engine.init(); statusElement.textContent = 'MS Basic MuseScore chargé.'; } catch (error) { statusElement.textContent = `Chargement SoundFont impossible : ${error.message}`; } } };
document.getElementById('testSoundFont').onclick = async () => {
  stopAllAudio();
  statusElement.textContent = `Test MS Basic en cours · ${navigator.userAgent} · ${location.protocol}`;
  try {
    const engine = await ensureSoundFontEngine();
    const diagnostic = await engine.diagnose();
    if (!diagnostic.ok) throw new Error(diagnostic.checks.filter(check => !check.ok).map(check => `${check.name}: ${check.detail}`).join(' · '));
    await engine.init();
    await engine.play({ pitch: 60, velocity: 105, duration: 1.2, instrument: 'piano' });
    statusElement.textContent = `MS Basic fonctionne : un Do doit être audible · contexte ${engine.status.context} · ${location.protocol}`;
  } catch (error) {
    statusElement.textContent = `Échec MS Basic : ${error.message}`;
  }
};
document.addEventListener('pointerdown', ensureAudio, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (game && !game.pausedAt) { game.pausedAt = performance.now(); game.visibilityPaused = true; stopAudioScheduler(); cancelAnimationFrame(game.frame); clearPressedInputs(); } stopAllAudio(); audio?.suspend().catch(() => {}); return; }
  ensureAudio(); window.SoundFontEngine?.resume();
  if (game?.pausedAt && game.visibilityPaused) { const pause = performance.now() - game.pausedAt; game.started += pause; game.pausedTotal += pause; game.pausedAt = 0; game.visibilityPaused = false; syncPlaybackIndexes(); game.clickIndex = game.clicks.findIndex(click => click.time > performance.now() - game.started); if (game.clickIndex < 0) game.clickIndex = game.clicks.length; startAudioScheduler(); statusElement.textContent = 'Partie reprise sans perdre la synchronisation.'; game.frame = requestAnimationFrame(loop); }
});

async function unzipMsczDocuments(buffer) { const view = new DataView(buffer); const bytes = new Uint8Array(buffer); const decoder = new TextDecoder(); const documents = []; for (let cursor = 0; cursor + 46 <= bytes.length; cursor += 1) { if (view.getUint32(cursor, true) !== 0x02014b50) continue; const method = view.getUint16(cursor + 10, true); const compressed = view.getUint32(cursor + 20, true); const nameLength = view.getUint16(cursor + 28, true); const extraLength = view.getUint16(cursor + 30, true); const commentLength = view.getUint16(cursor + 32, true); const local = view.getUint32(cursor + 42, true); const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength)); cursor += 45 + nameLength + extraLength + commentLength; if (!name.toLowerCase().endsWith('.mscx') || local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) continue; const localName = view.getUint16(local + 26, true); const localExtra = view.getUint16(local + 28, true); const start = local + 30 + localName + localExtra; const data = bytes.slice(start, start + compressed); let xml; if (method === 0) xml = decoder.decode(data); else if (method === 8 && 'DecompressionStream' in window) xml = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text(); else throw new Error('Votre navigateur ne décompresse pas cette archive `.mscz`. Exportez-la en `.mscx` ou utilisez un navigateur récent.'); documents.push({ name, xml }); } if (!documents.length) throw new Error('Archive MuseScore invalide : aucune partition `.mscx` trouvée.'); return documents.sort((left, right) => Number(left.name.includes('/')) - Number(right.name.includes('/')) || left.name.localeCompare(right.name)); }
function durationData(element, tuplet = null) { const named = { longa: 16, breve: 8, whole: 4, half: 2, quarter: 1, eighth: .5, '16th': .25, '32nd': .125, '64th': .0625, '128th': .03125 }; const type = element.querySelector(':scope > durationType')?.textContent.trim(); const fraction = element.querySelector(':scope > duration')?.textContent.trim(); const baseBeats = named[type] || (fraction?.includes('/') ? 4 * Number(fraction.split('/')[0]) / Number(fraction.split('/')[1]) : 1); const dots = Number(element.querySelector(':scope > dots')?.textContent || 0); const grace = Boolean(element.querySelector(':scope > grace, :scope > grace4, :scope > grace8, :scope > grace16, :scope > grace32, :scope > appoggiatura, :scope > acciaccatura')); let beats = baseBeats; for (let dot = 1; dot <= dots; dot += 1) beats += baseBeats / 2 ** dot; if (tuplet) beats *= tuplet.normal / tuplet.actual; return { beats: grace ? Math.min(.25, beats) : beats, baseBeats, dots, grace, tuplet: tuplet ? `${tuplet.actual}:${tuplet.normal}` : '' }; }
function rememberUnknownMuseSymbol(symbol) { if (!symbol || unknownMuseSymbols.has(symbol)) return; unknownMuseSymbols.add(symbol); try { localStorage.setItem('rhythm-unknown-musescore-symbols', JSON.stringify([...unknownMuseSymbols].sort())); } catch {} renderUnknownSymbolButton(); }
function renderUnknownSymbolButton() { const button = document.getElementById('exportUnknownSymbols'); if (!button) return; button.hidden = unknownMuseSymbols.size === 0; button.textContent = `Exporter symboles inconnus (${unknownMuseSymbols.size})`; }
function exportUnknownMuseSymbols() { const lines = ['Rhythm Lab · identifiants MuseScore inconnus', `Export : ${new Date().toLocaleString('fr-FR')}`, `Nombre : ${unknownMuseSymbols.size}`, '', ...[...unknownMuseSymbols].sort()]; const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'rhythm-lab-symboles-musescore-inconnus.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function normalizedMuseSymbol(value = '') { const clean = value.replace(/\*+I?/g, ' ').replace(/\s+/g, ' ').trim(); if (!clean) return ''; const mappings = [[/artic\w*stacc/i,'·'],[/artic\w*tenuto/i,'—'],[/artic\w*marcato/i,'^'],[/artic\w*accent/i,'>'],[/fermata/i,'𝄐'],[/trill/i,'tr'],[/mordent/i,'mordant'],[/turn/i,'gruppetto'],[/tremolo/i,'trémolo'],[/arpeggio/i,'arpège'],[/breath|caesura/i,'virgule respiratoire'],[/accidental\w*sharp/i,'♯'],[/accidental\w*flat/i,'♭'],[/accidental\w*natural/i,'♮'],[/gliss/i,'glissando']]; const technicalTokens = clean.match(/(?:artic|ornament|sym|accidental|notehead|flag|dynamic)[A-Za-z0-9_-]+/gi) || []; technicalTokens.filter(token => !mappings.some(([pattern]) => pattern.test(token))).forEach(rememberUnknownMuseSymbol); const mapped = [...new Set(mappings.filter(([pattern]) => pattern.test(clean)).map(([, symbol]) => symbol))]; if (mapped.length) return mapped.join(' '); if (technicalTokens.length) return ''; return clean; }
function musicalSymbols(element) { const selectors = ['Articulation > subtype','Articulation > sym','Ornament > subtype','Ornament > sym','Tremolo > subtype','Fermata > subtype','Arpeggio > subtype','Breath > subtype','Glissando > text','Note > Accidental > subtype','Lyrics > text']; const symbols = selectors.flatMap(selector => [...element.querySelectorAll(selector)].map(node => normalizedMuseSymbol(node.textContent))).filter(Boolean); if (element.querySelector('Spanner[type="Tie"], Tie')) symbols.push('liaison de tenue'); if (element.querySelector('Spanner[type="Slur"], Slur')) symbols.push('liaison de phrasé'); if (element.querySelector('grace, grace4, grace8, grace16, grace32, appoggiatura, acciaccatura')) symbols.push('appoggiature'); return [...new Set(symbols)]; }
function dynamicVelocity(value = '', fallback = 80) { const levels = { pppp: 20, ppp: 28, pp: 38, p: 50, mp: 64, mf: 78, f: 94, ff: 108, fff: 120, ffff: 127, sfz: 116, sf: 108, fp: 72 }; return levels[String(value).toLowerCase().replace(/[^a-z]/g, '')] || fallback; }
function trackDiagnosticSnapshot(list = tracks) {
  return list.map(track => ({
    name: track.name,
    instrument: track.instrument,
    instrumentId: track.instrumentId,
    source: track.sourceKind || 'partition',
    sourceDocument: track.sourceDocument || '',
    clef: track.clef,
    writtenClef: track.writtenClef,
    concertClef: track.concertClef,
    tempo: track.tempo,
    time: track.time,
    eventCount: track.events.length,
    firstBeat: track.events[0]?.beat ?? null,
    lastBeat: track.events.length ? Math.max(...track.events.map(event => event.beat + (event.beats || 0))) : null,
    pitchRange: track.events.length ? [Math.min(...track.events.map(event => event.pitch)), Math.max(...track.events.map(event => event.pitch))] : [],
    measureCount: track.measureBeats?.length || 0,
    changeCount: track.changes?.length || 0,
    timelineAnchors: track.timelineAnchors || 0,
    timelineAnchorSource: track.timelineAnchorSource || ''
  }));
}
function validateTracks(list = tracks) {
  const errors = [], warnings = [];
  list.forEach((track, trackIndex) => {
    if (!track.events?.length) errors.push(`Piste ${trackIndex + 1} sans note`);
    if (!track.instrument && !track.instrumentId) warnings.push(`${track.name} : instrument non identifié`);
    track.events?.forEach((event, eventIndex) => {
      if (!Number.isFinite(event.pitch) || !Number.isFinite(event.beat) || !Number.isFinite(event.beats) || event.beats <= 0) errors.push(`${track.name} : événement ${eventIndex + 1} invalide`);
      if (eventIndex && event.beat < track.events[eventIndex - 1].beat - .001) errors.push(`${track.name} : chronologie non triée à l’événement ${eventIndex + 1}`);
    });
    track.changes?.forEach((change, changeIndex) => { if (!Number.isFinite(change.beat)) errors.push(`${track.name} : changement ${changeIndex + 1} sans position valide`); });
  });
  const names = new Map();
  list.forEach(track => { const key = normalizedInstrumentName(track.name); if (!names.has(key)) names.set(key, []); names.get(key).push(track); });
  names.forEach((duplicates, name) => { if (name && duplicates.length > 1 && new Set(duplicates.map(track => track.instrumentId || track.instrument)).size > 1) warnings.push(`${duplicates[0].name} : nom partagé par plusieurs instruments`); });
  return { errors, warnings };
}
function regressionFixture() {
  return `<?xml version="1.0"?><museScore version="4.0"><Score><Part><trackName>Sousaphone test</trackName><Instrument><instrumentId>brass.sousaphone</instrumentId><transposeChromatic>-14</transposeChromatic><transposeDiatonic>-8</transposeDiatonic></Instrument><Staff id="1"/></Part><Staff id="1"><Measure><startRepeat/><voice><TimeSig><sigN>4</sigN><sigD>4</sigD></TimeSig><Chord><durationType>half</durationType><dots>1</dots><Note><pitch>58</pitch></Note></Chord><Rest><durationType>quarter</durationType></Rest></voice></Measure><Measure><endRepeat>2</endRepeat><voice><Chord><durationType>quarter</durationType><Note><pitch>59</pitch></Note></Chord><Rest><durationType>half</durationType><dots>1</dots></Rest></voice></Measure></Staff></Score></museScore>`;
}
function advancedNotationFixture() {
  return `<?xml version="1.0"?><museScore version="4.0"><Score><Part><trackName>Cuivre avancé</trackName><Instrument><instrumentId>brass.tuba</instrumentId></Instrument><Staff id="1"/></Part><Staff id="1"><Measure><voice><TimeSig><sigN>4</sigN><sigD>4</sigD></TimeSig><Dynamic><subtype>ff</subtype></Dynamic><Chord><durationType>quarter</durationType><Articulation><subtype>articStaccatoAbove</subtype></Articulation><Ornament><subtype>trill</subtype></Ornament><Tremolo><subtype>r16</subtype></Tremolo><Arpeggio><subtype>0</subtype></Arpeggio><Note><pitch>48</pitch><Accidental><subtype>accidentalSharp</subtype></Accidental><Spanner type="Glissando"><Glissando><subtype>1</subtype></Glissando></Spanner></Note></Chord><Fermata><subtype>fermataAbove</subtype></Fermata><Breath><subtype>breathComma</subtype></Breath><Chord><durationType>quarter</durationType><Note><pitch>52</pitch></Note></Chord><Rest><durationType>half</durationType></Rest></voice></Measure><Measure len="8/4"><multiMeasureRest>2</multiMeasureRest><voice><Rest><durationType>measure</durationType><duration>8/4</duration></Rest><Fermata><subtype>fermataAbove</subtype></Fermata></voice></Measure></Staff></Score></museScore>`;
}
function runRhythmTests() {
  const failures = [];
  const expected = ['123','13','23','12','1','2','0','123','13','23','12','1','2','0','23','12','1','2','0','12','1','2','0','1','2','0','23','12','1','2','0','2/12','1'];
  expected.forEach((wanted, index) => {
    const result = window.BrassFingering?.fingeringsFor({ pitch: 28 + index, instrumentId: 'brass.sousaphone', instrument: 'Sousaphone en Si♭', transpose: -14 });
    if (!result || wanted.split('/').some(value => !result.accepted.includes(value)) || (wanted.includes('/') ? result.display !== wanted : result.primary !== wanted)) failures.push(`Doigté MIDI ${28 + index}`);
  });
  try {
    const parsed = parseScore(regressionFixture(), 'fixture-rhythm-lab.mscx', false);
    if (parsed.length !== 1) failures.push('Nombre de pistes du fixture');
    if (parsed[0]?.events.length !== 4) failures.push('Développement de la reprise');
    if (parsed[0]?.events.map(event => event.beat).join(',') !== '0,4,8,12') failures.push('Chronologie de la reprise');
    if (Math.abs(parsed[0]?.events[0]?.beats - 3) > .001) failures.push('Blanche pointée');
    failures.push(...validateTracks(parsed).errors.map(error => `Fixture : ${error}`));
  } catch (error) { failures.push(`Parseur fixture : ${error.message}`); }
  try {
    const track = parseScore(advancedNotationFixture(), 'fixture-notations.mscx', false)[0];
    const first = track?.events[0];
    if (!/stacc/i.test(first?.articulation || '')) failures.push('Articulation MuseScore');
    if (first?.ornament !== 'trill') failures.push('Ornement MuseScore');
    if (first?.tremolo !== 'r16') failures.push('Trémolo MuseScore');
    if (!first?.arpeggio) failures.push('Arpège MuseScore');
    if (first?.glissandoTarget !== 52) failures.push('Glissando MuseScore');
    if (!first?.symbols.includes('𝄐') || !first?.symbols.includes('♯')) failures.push('Symboles expressifs MuseScore');
    if (track?.pauses.length !== 2 || track.pauses[0].beats < .49 || !track.rests.some(rest => rest.symbols?.includes('𝄐'))) failures.push('Respiration et fermata MuseScore');
    if (track?.measureBeats.join(',') !== '0,4,8') failures.push('Mesures multiples MuseScore');
    if (Math.abs((first?.volume || 0) - 108 / 700) > .002) failures.push('Nuance MuseScore');
  } catch (error) { failures.push(`Parseur avancé : ${error.message}`); }
  const previousGame = game;
  try {
    const sharedTiming = timingFor({ tempo: 120, changes: [] }, 1);
    const conflictingTiming = timingFor({ tempo: 60, changes: [] }, 1);
    game = { timelineTiming: sharedTiming, countIn: 1000, timelineOffset: 0 };
    if (sharedPlaybackMoment(4) !== playbackMomentFor(sharedTiming, 1000, 0, 4) || sharedPlaybackMoment(4) === playbackMomentFor(conflictingTiming, 1000, 0, 4)) failures.push('Horloge commune des voix');
  } finally { game = previousGame; }
  const current = validateTracks();
  failures.push(...current.errors.map(error => `Partition : ${error}`));
  const total = 47;
  const passed = Math.max(0, total - failures.length);
  statusElement.textContent = failures.length ? `Autotest : ${passed}/${total} réussis · ${failures.join(' · ')}` : `Autotest Rhythm Lab : ${total}/${total} réussis${current.warnings.length ? ` · avertissements : ${current.warnings.join(' · ')}` : ''}.`;
  return { passed, failures, warnings: current.warnings };
}
function exportTrackDiagnostics() {
  const report = { generatedAt: new Date().toISOString(), application: 'Rhythm Lab', score: importedScoreId, browser: navigator.userAgent, validation: validateTracks(), tracks: trackDiagnosticSnapshot() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `rhythm-lab-diagnostic-${(fileInput.files[0]?.name || 'demo').replace(/[^a-z0-9.-]+/gi, '-')}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function timelineMeasureElements(staff) { return [...staff.children].filter(element => element.tagName === 'Measure'); }
function structuralMeasureTimeline(staff) {
  let time = '4/4';
  return timelineMeasureElements(staff).map(measure => {
    const timeSignature = measure.querySelector('TimeSig');
    if (timeSignature) time = `${timeSignature.querySelector('sigN')?.textContent || '4'}/${timeSignature.querySelector('sigD')?.textContent || '4'}`;
    const [numerator, denominator] = time.split('/').map(Number);
    const normalBeats = (numerator || 4) * 4 / (denominator || 4);
    const measureFraction = measure.getAttribute('len')?.split('/').map(Number);
    const beats = measureFraction?.length === 2 && measureFraction[1] ? 4 * measureFraction[0] / measureFraction[1] : normalBeats;
    const multiMeasureCount = Math.max(1, Number(measure.querySelector(':scope > multiMeasureRest')?.textContent || 1));
    return { beats, normalBeats, time, multiMeasureCount };
  });
}
function markerNames(measure) { return [...measure.querySelectorAll('Marker')].flatMap(marker => ['label','markerType','text','subtype'].map(tag => marker.querySelector(`:scope > ${tag}`)?.textContent.trim().toLowerCase()).filter(Boolean)); }
function voltaCoverage(measures) {
  const coverage = new Map();
  measures.forEach((measure, start) => measure.querySelectorAll('Spanner[type="Volta"]').forEach(spanner => {
    const endings = spanner.querySelector('Volta > endings')?.textContent.trim() || '';
    const span = Math.max(1, Number(spanner.querySelector(':scope > next > location > measures')?.textContent || 1));
    for (let index = start; index < Math.min(measures.length, start + span); index += 1) coverage.set(index, endings);
  }));
  return coverage;
}
function playbackOrder(referenceStaff) {
  const measures = timelineMeasureElements(referenceStaff); const markers = new Map(); const voltas = voltaCoverage(measures);
  measures.forEach((measure, index) => markerNames(measure).forEach(name => markers.set(name, index)));
  const order = [], repeatCounts = new Map(), executedJumps = new Set();
  let index = 0, repeatStart = 0, jumped = false, playUntil = '', continueAt = '';
  while (index >= 0 && index < measures.length && order.length < measures.length * 12) {
    const measure = measures[index]; if (measure.querySelector('startRepeat')) repeatStart = index;
    const volta = voltas.get(index) || measure.querySelector('Volta endings, Spanner[type="Volta"] endings')?.textContent.trim(); const pass = (repeatCounts.get(repeatStart) || 0) + 1;
    if (!volta || volta.split(/[,; ]+/).map(Number).includes(pass)) order.push(index);
    const markerList = markerNames(measure); if (jumped && markerList.some(marker => /fine/.test(marker))) break;
    if (playUntil && markerList.includes(playUntil)) { index = markers.get(continueAt) ?? index + 1; playUntil = ''; continueAt = ''; continue; }
    const jump = measure.querySelector('Jump');
    if (jump && !executedJumps.has(index)) { executedJumps.add(index); jumped = true; const destination = jump.querySelector('jumpTo')?.textContent.trim().toLowerCase() || 'start'; playUntil = jump.querySelector('playUntil')?.textContent.trim().toLowerCase() || ''; continueAt = jump.querySelector('continueAt')?.textContent.trim().toLowerCase() || ''; index = destination === 'start' ? 0 : (markers.get(destination) ?? 0); continue; }
    if (measure.querySelector('endRepeat')) { const repeats = Math.max(2, Number(measure.querySelector('endRepeat')?.textContent || measure.querySelector('repeatCount')?.textContent || 2)); const completed = repeatCounts.get(repeatStart) || 0; if (completed < repeats - 1) { repeatCounts.set(repeatStart, completed + 1); index = repeatStart; continue; } }
    index += 1;
  }
  return order;
}
function parseScore(xml, name, commit = true) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Le contenu XML de la partition est invalide.');
  const concertPitchScore = doc.querySelector('Score > concertPitch')?.textContent.trim() === '1';
  const metadataByExplicitStaffId = new Map(); const orderedStaffMetadata = [];
  [...doc.querySelectorAll('Score > Part')].forEach(part => {
    const instrumentNode = part.querySelector(':scope > Instrument');
    const instrument = part.querySelector(':scope > trackName, Instrument longName, Instrument trackName, Instrument shortName')?.textContent.trim() || `Piste ${part.getAttribute('id')}`;
    const transpose = Number(instrumentNode?.querySelector('transposeChromatic')?.textContent || 0);
    const transposeDiatonic = Number(instrumentNode?.querySelector('transposeDiatonic')?.textContent || 0);
    const clef = part.querySelector(':scope > Staff defaultClef, :scope > Instrument clef')?.textContent.trim() || '';
    const instrumentId = instrumentNode?.querySelector('instrumentId')?.textContent.trim() || instrumentNode?.getAttribute('id') || '';
    const partStaffs = [...part.querySelectorAll(':scope > Staff')];
    const metadataSources = partStaffs.length ? partStaffs : [null];
    metadataSources.forEach(partStaff => {
      const sourceStaffId = partStaff?.querySelector(':scope > eid')?.textContent.trim() || '';
      const linkedMasterStaffId = partStaff?.querySelector(':scope > linkedTo')?.textContent.trim() || '';
      const metadata = { name: instrument, instrument, instrumentId, transpose, transposeDiatonic, clef, sourceStaffId, linkedMasterStaffId };
      orderedStaffMetadata.push(metadata);
      const explicitStaffId = partStaff?.getAttribute('id') || '';
      if (explicitStaffId) metadataByExplicitStaffId.set(explicitStaffId, metadata);
    });
  });
  const tempoRaw = Number(doc.querySelector('Tempo tempo')?.textContent || 1.66);
  const documentTempo = Math.max(35, Math.min(260, Math.round(tempoRaw * 60)));
  const staffs = [...doc.querySelectorAll('Score > Staff[id]')];
  const useExplicitStaffIds = staffs.length > 0 && staffs.every(staff => metadataByExplicitStaffId.has(staff.getAttribute('id')));
  const referenceStaff = staffs.reduce((best, staff) => timelineMeasureElements(staff).length > timelineMeasureElements(best).length ? staff : best, staffs[0]);
  const sharedOrder = playbackOrder(referenceStaff);
  const structuralMeasures = structuralMeasureTimeline(referenceStaff);
  let sharedBeat = 0;
  const sharedMeasureStarts = sharedOrder.map(measureIndex => {
    const start = sharedBeat;
    sharedBeat += structuralMeasures[measureIndex]?.beats || 4;
    return start;
  });
  const parsed = staffs.map((staff, staffIndex) => {
    let velocity = 80;
    let currentTime = '4/4';
    const staffMetadata = useExplicitStaffIds ? metadataByExplicitStaffId.get(staff.getAttribute('id')) : orderedStaffMetadata[staffIndex];
    const initialClef = staff.querySelector('Clef');
    const fallbackWrittenClef = staffMetadata?.clef || inferredClef(staffMetadata?.instrument || '', []);
    const writtenSourceClef = initialClef?.querySelector('transposingClefType')?.textContent.trim() || initialClef?.querySelector('concertClefType')?.textContent.trim() || fallbackWrittenClef;
    const concertSourceClef = initialClef?.querySelector('concertClefType')?.textContent.trim() || inferredConcertClef(staffMetadata?.instrument || '', writtenSourceClef);
    let currentWrittenClef = writtenSourceClef;
    let currentConcertClef = concertSourceClef;
    let currentInstrument = staffMetadata?.instrument || '';
    let currentInstrumentId = staffMetadata?.instrumentId || '';
    let currentTranspose = staffMetadata?.transpose || 0;
    let currentTransposeDiatonic = staffMetadata?.transposeDiatonic || 0;
    let currentConcertKey = 0;
    let currentWrittenKey = writtenFifths(currentConcertKey, currentTranspose, currentTransposeDiatonic);
    const events = [];
    const rests = [];
    const measureBeats = [];
    const changes = [];
    const ramps = [];
    const pauses = [];
    const sourceMeasures = timelineMeasureElements(staff);
    sharedOrder.forEach((measureIndex, playbackIndex) => {
      const measureBeat = sharedMeasureStarts[playbackIndex];
      const measureStructure = structuralMeasures[measureIndex];
      const representedMeasures = measureStructure?.multiMeasureCount || 1;
      for (let represented = 0; represented < representedMeasures; represented += 1) measureBeats.push(measureBeat + represented * (measureStructure?.normalBeats || 4));
      const measure = sourceMeasures[measureIndex];
      if (!measure) return;
      const normalMeasureBeats = structuralMeasures[measureIndex]?.normalBeats || Number(currentTime.split('/')[0]) * 4 / Number(currentTime.split('/')[1]);
      const declaredMeasureBeats = structuralMeasures[measureIndex]?.beats || normalMeasureBeats;
      markerNames(measure).forEach(marker => changes.push({ type: 'navigation', beat: measureBeat, value: marker }));
      const jumpText = measure.querySelector(':scope > Jump > text')?.textContent.trim();
      if (jumpText) changes.push({ type: 'navigation', beat: measureBeat, value: jumpText });
      const voltaText = measure.querySelector('Spanner[type="Volta"] Volta > beginText')?.textContent.trim();
      if (voltaText) changes.push({ type: 'navigation', beat: measureBeat, value: voltaText });
      if (measure.querySelector(':scope > startRepeat')) changes.push({ type: 'navigation', beat: measureBeat, value: '𝄆' });
      if (measure.querySelector(':scope > endRepeat')) changes.push({ type: 'navigation', beat: measureBeat + declaredMeasureBeats, value: '𝄇' });
      const voices = [...measure.children].filter(element => element.tagName === 'voice');
      voices.forEach(voice => {
        let localBeat = 0;
        let activeTuplet = null;
        let beamGroup = '';
        let autoBeamCluster = 0;
        let previousTimedElement = null;
        voice.querySelectorAll(':scope > location, :scope > Dynamic, :scope > Tempo, :scope > KeySig, :scope > TimeSig, :scope > Clef, :scope > InstrumentChange, :scope > Spanner[type="HairPin"], :scope > Tuplet, :scope > endTuplet, :scope > Beam, :scope > Fermata, :scope > Breath, :scope > Chord, :scope > Rest').forEach(element => {
          if (element.tagName.toLowerCase() === 'location') {
            const [numerator, denominator] = (element.querySelector(':scope > fractions')?.textContent || '0/1').split('/').map(Number);
            const measures = Number(element.querySelector(':scope > measures')?.textContent || 0);
            localBeat += measures * normalMeasureBeats + (denominator ? 4 * numerator / denominator : 0);
            return;
          }
          const beat = measureBeat + localBeat;
          if (element.tagName === 'Tuplet') { const actual = Number(element.querySelector('actualNotes')?.textContent || 3); const normal = Number(element.querySelector('normalNotes')?.textContent || 2); activeTuplet = { actual, normal }; return; }
          if (element.tagName === 'endTuplet') { activeTuplet = null; return; }
          if (element.tagName === 'Beam') { beamGroup = element.querySelector('eid')?.textContent.trim() || `${measureIndex}:${beat}`; return; }
          if (element.tagName === 'Dynamic') { const dynamic = element.querySelector('subtype')?.textContent.trim() || element.querySelector('text')?.textContent.trim(); velocity = Number(element.querySelector('velocity')?.textContent || dynamicVelocity(dynamic, velocity)); if (dynamic) changes.push({ type: 'dynamic', beat, value: dynamic }); return; }
          if (element.tagName === 'Tempo') { const bpm = Math.max(20, Math.min(400, Math.round(Number(element.querySelector('tempo')?.textContent || documentTempo / 60) * 60))); changes.push({ type: 'tempo', beat, bpm, value: bpm }); return; }
          if (element.tagName === 'KeySig') {
            const concertKeyText = element.querySelector(':scope > concertKey')?.textContent.trim();
            const displayedKeyText = element.querySelector(':scope > key')?.textContent.trim();
            currentConcertKey = concertKeyText !== undefined ? Number(concertKeyText) || 0 : concertPitchScore ? Number(displayedKeyText) || 0 : concertFifths(displayedKeyText, currentTranspose, currentTransposeDiatonic);
            currentWrittenKey = displayedKeyText !== undefined && !concertPitchScore ? Number(displayedKeyText) || 0 : writtenFifths(currentConcertKey, currentTranspose, currentTransposeDiatonic);
            changes.push({ type: 'key', beat, value: currentWrittenKey, concertValue: currentConcertKey, writtenValue: currentWrittenKey });
            return;
          }
          if (element.tagName === 'TimeSig') { const numerator = element.querySelector('sigN')?.textContent || '4'; const denominator = element.querySelector('sigD')?.textContent || '4'; currentTime = `${numerator}/${denominator}`; changes.push({ type: 'time', beat, value: currentTime }); return; }
          if (element.tagName === 'Clef') {
            const genericClef = element.querySelector(':scope > clefType, :scope > subtype')?.textContent.trim();
            currentWrittenClef = element.querySelector(':scope > transposingClefType')?.textContent.trim() || (!concertPitchScore ? genericClef : '') || currentWrittenClef;
            currentConcertClef = element.querySelector(':scope > concertClefType')?.textContent.trim() || (concertPitchScore ? genericClef : '') || inferredConcertClef(currentInstrument, currentWrittenClef);
            changes.push({ type: 'clef', beat, value: currentWrittenClef, concertValue: currentConcertClef, writtenValue: currentWrittenClef });
            return;
          }
          if (element.tagName === 'InstrumentChange') {
            const changed = element.querySelector('Instrument');
            const previousTranspose = currentTranspose;
            const previousDiatonic = currentTransposeDiatonic;
            currentInstrument = element.querySelector('longName, trackName, shortName')?.textContent.trim() || currentInstrument;
            currentInstrumentId = changed?.querySelector('instrumentId')?.textContent.trim() || changed?.getAttribute('id') || currentInstrumentId;
            currentTranspose = Number(changed?.querySelector('transposeChromatic')?.textContent ?? currentTranspose);
            currentTransposeDiatonic = Number(changed?.querySelector('transposeDiatonic')?.textContent ?? currentTransposeDiatonic);
            const changedWrittenClef = changed?.querySelector('transposingClefType, clef')?.textContent.trim();
            const changedConcertClef = changed?.querySelector('concertClefType')?.textContent.trim();
            if (changedWrittenClef || changedConcertClef) {
              currentWrittenClef = changedWrittenClef || currentWrittenClef;
              currentConcertClef = changedConcertClef || inferredConcertClef(currentInstrument, currentWrittenClef);
              changes.push({ type: 'clef', beat, value: currentWrittenClef, concertValue: currentConcertClef, writtenValue: currentWrittenClef });
            }
            if (currentTranspose !== previousTranspose || currentTransposeDiatonic !== previousDiatonic) {
              currentWrittenKey = writtenFifths(currentConcertKey, currentTranspose, currentTransposeDiatonic);
              changes.push({ type: 'key', beat, value: currentWrittenKey, concertValue: currentConcertKey, writtenValue: currentWrittenKey });
            }
            changes.push({ type: 'instrument', beat, value: currentInstrument, instrumentId: currentInstrumentId, transpose: currentTranspose, transposeDiatonic: currentTransposeDiatonic });
            return;
          }
          if (element.matches('Spanner[type="HairPin"]')) {
            const [numerator, denominator] = (element.querySelector('next fractions')?.textContent || '0/1').split('/').map(Number);
            const measures = Number(element.querySelector('next measures')?.textContent || 0);
            const measureLength = Number(currentTime.split('/')[0]) * 4 / Number(currentTime.split('/')[1]);
            const duration = measures * measureLength + (denominator ? 4 * numerator / denominator : 0);
            const crescendo = Number(element.querySelector('HairPin > subtype')?.textContent || 0) === 0;
            ramps.push({ start: beat, end: beat + Math.max(.25, duration), from: velocity, to: Math.max(20, Math.min(127, velocity + (crescendo ? 38 : -38))) });
            changes.push({ type: 'expression', beat, value: crescendo ? 'cresc.' : 'dim.' });
            return;
          }
          if (element.tagName === 'Fermata' && previousTimedElement) {
            const subtype = element.querySelector('subtype')?.textContent.trim() || 'fermata';
            const stretch = Math.max(1.15, Number(element.querySelector('timeStretch')?.textContent || (/long|veryLong/i.test(subtype) ? 2 : /short/i.test(subtype) ? 1.25 : 1.5)));
            previousTimedElement.playbackStretch = Math.max(previousTimedElement.playbackStretch || 1, stretch);
            previousTimedElement.symbols = [...new Set([...(previousTimedElement.symbols || []), '𝄐'])];
            pauses.push({ beat: previousTimedElement.beat + previousTimedElement.beats, beats: previousTimedElement.beats * (stretch - 1), type: 'fermata' });
            return;
          }
          if (element.tagName === 'Breath' && previousTimedElement) {
            const subtype = element.querySelector('subtype')?.textContent.trim() || 'breath';
            const pauseBeats = /caesura|curved|straight/i.test(subtype) ? .5 : .25;
            previousTimedElement.symbols = [...new Set([...(previousTimedElement.symbols || []), normalizedMuseSymbol(subtype) || 'virgule respiratoire'])];
            pauses.push({ beat: previousTimedElement.beat + previousTimedElement.beats, beats: pauseBeats, type: 'breath' });
            return;
          }
          const duration = durationData(element, activeTuplet);
          if (element.tagName === 'Rest' && element.querySelector(':scope > durationType')?.textContent.trim() === 'measure') { duration.beats = declaredMeasureBeats; duration.baseBeats = normalMeasureBeats; }
          if (element.tagName === 'Chord') {
            const pitches = [...element.querySelectorAll('Note > pitch')].map(note => Number(note.textContent)).filter(Number.isFinite);
            const articulation = [...element.querySelectorAll('Articulation')].map(node => node.querySelector('subtype, sym')?.textContent.trim() || node.getAttribute('name') || '').filter(Boolean).join(' ');
            const automaticBeam = duration.baseBeats < 1 ? `auto:${measureIndex}:${Math.floor(localBeat)}:${autoBeamCluster}` : '';
            const tieStart = Boolean(element.querySelector('Note > Spanner[type="Tie"] > Tie'));
            const tieEnd = Boolean(element.querySelector('Note > Spanner[type="Tie"] > prev'));
            const tremolo = element.querySelector('Tremolo > subtype')?.textContent.trim() || '';
            const ornament = element.querySelector('Ornament > subtype, Ornament > sym')?.textContent.trim() || '';
            const ornamentAbove = Number(element.querySelector('Ornament > intervalAbove')?.textContent);
            const ornamentBelow = Number(element.querySelector('Ornament > intervalBelow')?.textContent);
            const arpeggio = element.querySelector('Arpeggio')?.textContent.trim() || element.querySelector('Arpeggio > subtype')?.textContent.trim() || '';
            const glissando = Boolean(element.querySelector('Spanner[type="Glissando"], Glissando'));
            if (pitches.length) { previousTimedElement = { pitch: pitches[0], writtenPitch: pitches[0] - currentTranspose, displayPitch: pitches[0] - currentTranspose, transpose: currentTranspose, transposeDiatonic: currentTransposeDiatonic, chord: pitches, writtenChord: pitches.map(pitch => pitch - currentTranspose), articulation, tremolo, ornament, ...(Number.isFinite(ornamentAbove) ? { ornamentAbove } : {}), ...(Number.isFinite(ornamentBelow) ? { ornamentBelow } : {}), arpeggio, glissando, keyFifths: currentConcertKey, ...duration, symbols: musicalSymbols(element), beat, velocity, instrument: currentInstrument, instrumentId: currentInstrumentId, clef: currentWrittenClef, writtenClef: currentWrittenClef, concertClef: currentConcertClef, sourceElementId: element.querySelector(':scope > eid')?.textContent.trim() || '', linkedMasterElementId: element.querySelector(':scope > linkedTo')?.textContent.trim() || '', beam: duration.baseBeats < 1 ? (beamGroup || automaticBeam) : '', tieStart, tieEnd }; events.push(previousTimedElement); }
          }
          if (element.tagName === 'Rest') { previousTimedElement = { beat, beats: duration.beats, symbols: musicalSymbols(element) }; rests.push(previousTimedElement); }
          if (!duration.grace) localBeat += duration.beats;
          if (element.tagName === 'Rest' || duration.baseBeats >= 1) { beamGroup = ''; autoBeamCluster += 1; }
        });
      });
    });
    events.sort((left, right) => left.beat - right.beat || left.pitch - right.pitch);
    events.forEach((event, index) => { const next = events.find((candidate, candidateIndex) => candidateIndex > index && candidate.beat > event.beat + .001); if (event.glissando && next) event.glissandoTarget = next.pitch; if (/^c/i.test(event.tremolo || '') && next) { event.tremoloPitches = [event.pitch, next.pitch]; next.tremoloContinuation = true; } });
    events.forEach((event, index) => { if (!event.tieStart) return; const end = events.find((candidate, candidateIndex) => candidateIndex > index && candidate.tieEnd && candidate.pitch === event.pitch); if (end) { event.audibleBeats = end.beat + end.beats - event.beat; end.silentTie = true; } });
    events.forEach(event => {
      const ramp = ramps.find(candidate => event.beat >= candidate.start && event.beat <= candidate.end);
      const eventVelocity = ramp ? ramp.from + (ramp.to - ramp.from) * (event.beat - ramp.start) / (ramp.end - ramp.start) : event.velocity;
      event.volume = Math.max(.025, Math.min(.18, eventVelocity / 700));
      delete event.velocity;
    });
    const firstClefChange = changes.find(change => change.type === 'clef');
    const writtenClefText = firstClefChange?.writtenValue || writtenSourceClef || inferredClef(staffMetadata?.instrument || '', events);
    const concertClefText = firstClefChange?.concertValue || concertSourceClef || inferredConcertClef(staffMetadata?.instrument || '', writtenClefText);
    const firstKeyChange = changes.find(change => change.type === 'key');
    const firstConcertKey = firstKeyChange?.concertValue ?? 0;
    const firstWrittenKey = firstKeyChange?.writtenValue ?? writtenFifths(firstConcertKey, staffMetadata?.transpose || 0, staffMetadata?.transposeDiatonic || 0);
    const firstTime = changes.find(change => change.type === 'time')?.value || '4/4';
    const firstTempo = changes.find(change => change.type === 'tempo')?.bpm || documentTempo;
    const uniqueRests = rests.filter((rest, index) => rests.findIndex(candidate => Math.abs(candidate.beat - rest.beat) < .001 && Math.abs(candidate.beats - rest.beats) < .001) === index);
    return { name: staffMetadata?.name || `Piste ${staff.getAttribute('id')}`, instrument: staffMetadata?.instrument || '', instrumentId: staffMetadata?.instrumentId || '', sourceStaffId: staffMetadata?.sourceStaffId || '', linkedMasterStaffId: staffMetadata?.linkedMasterStaffId || '', notes: events.map(event => event.pitch), events, rests: uniqueRests, pauses, measureBeats, changes: changes.filter(change => change.beat > 0), clef: writtenClefText, writtenClef: writtenClefText, concertClef: concertClefText, key: firstWrittenKey, writtenKey: firstWrittenKey, concertKey: firstConcertKey, tempo: firstTempo, time: firstTime };
  }).filter(track => track.events.length);
  let parsedTracks = parsed;
  if (parsed.length) {
    const conductor = parsed[Math.max(0, staffs.indexOf(referenceStaff))] || parsed[0];
    const globalChanges = conductor.changes.filter(change => change.type === 'tempo' || change.type === 'time');
    const globalPauses = mergedPauses(parsed);
    parsedTracks = parsed.map(track => ({ ...track, tempo: conductor.tempo, time: conductor.time, pauses: globalPauses, changes: [...track.changes.filter(change => change.type !== 'tempo' && change.type !== 'time'), ...globalChanges].sort((left, right) => left.beat - right.beat) }));
  }
  if (!commit) return parsedTracks;
  tracks = parsedTracks;
  trackIndex = 0;
  statusElement.textContent = `${tracks.length} piste(s) reconnue(s) dans ${name}. Parcours commun de ${sharedOrder.length} mesures jouées : reprises, voltas, sauts, tempo et métrique sont synchronisés entre toutes les pistes.`;
  renderTracks();
  render();
}

function parseMusicXml(xml, name) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Le contenu MusicXML est invalide.');
  const instrumentDefinitions = new Map([...doc.querySelectorAll('score-instrument[id]')].map(instrument => [instrument.getAttribute('id'), instrument.querySelector('instrument-name')?.textContent.trim() || instrument.querySelector('instrument-sound')?.textContent.trim() || '']));
  const definitions = new Map([...doc.querySelectorAll('part-list > score-part')].map(part => { const id = part.getAttribute('id'); return [id, { name: part.querySelector('part-name')?.textContent.trim() || id, instrument: part.querySelector('instrument-name')?.textContent.trim() || part.querySelector('part-name')?.textContent.trim() || '' }]; }));
  const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const parsed = [...doc.querySelectorAll('score-partwise > part')].map(part => {
    const partId = part.getAttribute('id'); const definition = definitions.get(partId) || { name: partId, instrument: '' }; const events = [], rests = [], pauses = [], measureBeats = [], changes = []; let measureBeat = 0, divisions = 1, currentTime = '4/4', currentWrittenKey = 0, currentConcertKey = 0, currentWrittenClef = inferredClef(definition.instrument, []), currentConcertClef = inferredConcertClef(definition.instrument, currentWrittenClef), transpose = 0, transposeDiatonic = 0, tempo = 120;
    [...part.querySelectorAll(':scope > measure')].forEach(measure => {
      measureBeats.push(measureBeat);
      const attributes = measure.querySelector(':scope > attributes');
      if (attributes) {
        divisions = Number(attributes.querySelector('divisions')?.textContent || divisions);
        const transposeElement = attributes.querySelector('transpose');
        if (transposeElement) {
          const octaveChange = Number(transposeElement.querySelector('octave-change')?.textContent || 0);
          transpose = Number(transposeElement.querySelector('chromatic')?.textContent || 0) + octaveChange * 12;
          transposeDiatonic = Number(transposeElement.querySelector('diatonic')?.textContent || 0) + octaveChange * 7;
          currentConcertKey = concertFifths(currentWrittenKey, transpose, transposeDiatonic);
        }
        const fifths = attributes.querySelector('key > fifths')?.textContent;
        if (fifths !== undefined) {
          currentWrittenKey = Number(fifths) || 0;
          currentConcertKey = concertFifths(currentWrittenKey, transpose, transposeDiatonic);
          changes.push({ type: 'key', beat: measureBeat, value: currentWrittenKey, writtenValue: currentWrittenKey, concertValue: currentConcertKey });
        }
        const beats = attributes.querySelector('time > beats')?.textContent;
        const beatType = attributes.querySelector('time > beat-type')?.textContent;
        if (beats && beatType) { currentTime = `${beats}/${beatType}`; changes.push({ type: 'time', beat: measureBeat, value: currentTime }); }
        const sign = attributes.querySelector('clef > sign')?.textContent.trim();
        const line = attributes.querySelector('clef > line')?.textContent.trim();
        if (sign) {
          currentWrittenClef = sign === 'C' ? `C${line || 3}` : sign;
          currentConcertClef = inferredConcertClef(definition.instrument, currentWrittenClef);
          changes.push({ type: 'clef', beat: measureBeat, value: currentWrittenClef, writtenValue: currentWrittenClef, concertValue: currentConcertClef });
        }
      }
      const tempoElement = measure.querySelector('direction sound[tempo], direction per-minute'); if (tempoElement) { tempo = Number(tempoElement.getAttribute?.('tempo') || tempoElement.textContent || tempo); changes.push({ type: 'tempo', beat: measureBeat, bpm: tempo, value: tempo }); }
      let cursor = 0, previousStart = 0, measureLength = 0;
      [...measure.children].forEach(element => {
        if (element.tagName === 'backup') { cursor -= Number(element.querySelector('duration')?.textContent || 0) / divisions; return; }
        if (element.tagName === 'forward') { cursor += Number(element.querySelector('duration')?.textContent || 0) / divisions; measureLength = Math.max(measureLength, cursor); return; }
        if (element.tagName !== 'note') return;
        const beats = Number(element.querySelector(':scope > duration')?.textContent || 0) / divisions; const chord = Boolean(element.querySelector(':scope > chord')); const start = chord ? previousStart : cursor; if (!chord) previousStart = start;
        if (!element.querySelector(':scope > rest')) { const step = element.querySelector('pitch > step')?.textContent; const octave = Number(element.querySelector('pitch > octave')?.textContent); const alter = Number(element.querySelector('pitch > alter')?.textContent || 0); if (step && Number.isFinite(octave)) { const writtenPitch = (octave + 1) * 12 + semitones[step] + alter; const dots = element.querySelectorAll(':scope > dot').length; const dotFactor = dots ? 2 - 1 / 2 ** dots : 1; const instrumentId = element.querySelector(':scope > instrument')?.getAttribute('id') || ''; const instrument = instrumentDefinitions.get(instrumentId) || definition.instrument; const articulation = [...element.querySelectorAll('notations > articulations > *')].map(node => node.tagName).join(' '); const ornament = [...element.querySelectorAll('notations > ornaments > *')].map(node => node.tagName).join(' '); const tremolo = element.querySelector('notations tremolo')?.textContent.trim() || ''; const arpeggio = Boolean(element.querySelector('notations > arpeggiate')); const glissando = Boolean(element.querySelector('notations > glissando, notations > slide')); const fermata = element.querySelector('notations > fermata'); const playbackStretch = fermata ? 1.5 : 1; const event = { pitch: writtenPitch + transpose, writtenPitch, displayPitch: writtenPitch, transpose, transposeDiatonic, chord: [writtenPitch + transpose], writtenChord: [writtenPitch], beat: measureBeat + start, beats: beats || 1, baseBeats: beats / dotFactor || 1, dots, grace: Boolean(element.querySelector(':scope > grace')), tieStart: Boolean(element.querySelector('tie[type="start"]')), tieEnd: Boolean(element.querySelector('tie[type="stop"]')), articulation, ornament, tremolo, arpeggio, glissando, playbackStretch, symbols: [...new Set([...(alter ? [alter > 0 ? '♯' : '♭'] : []), ...(fermata ? ['𝄐'] : []), ...(ornament ? [normalizedMuseSymbol(ornament)] : [])].filter(Boolean))], instrument, instrumentId, clef: currentWrittenClef, writtenClef: currentWrittenClef, concertClef: currentConcertClef }; events.push(event); if (fermata) pauses.push({ beat: event.beat + event.beats, beats: event.beats * .5, type: 'fermata' }); } } else rests.push({ beat: measureBeat + start, beats: beats || measureLengthAt({ time: currentTime, changes: [] }, measureBeat + start) });
        if (!chord) cursor += beats; measureLength = Math.max(measureLength, cursor);
      });
      measureBeat += Math.max(measureLength, Number(currentTime.split('/')[0]) * 4 / Number(currentTime.split('/')[1]));
    });
    events.sort((left, right) => left.beat - right.beat || left.pitch - right.pitch); events.forEach((event, index) => { if (event.glissando) { const next = events.find((candidate, candidateIndex) => candidateIndex > index && candidate.beat > event.beat + .001); if (next) event.glissandoTarget = next.pitch; } if (!event.tieStart) return; const end = events.find((candidate, candidateIndex) => candidateIndex > index && candidate.tieEnd && candidate.pitch === event.pitch); if (end) { event.audibleBeats = end.beat + end.beats - event.beat; end.silentTie = true; } });
    const firstKeyChange = changes.find(change => change.type === 'key');
    const firstClefChange = changes.find(change => change.type === 'clef');
    const writtenKey = firstKeyChange?.writtenValue ?? currentWrittenKey;
    const concertKey = firstKeyChange?.concertValue ?? currentConcertKey;
    const writtenClef = firstClefChange?.writtenValue || currentWrittenClef || inferredClef(definition.instrument, events);
    const concertClef = firstClefChange?.concertValue || currentConcertClef || inferredConcertClef(definition.instrument, writtenClef);
    return { name: definition.name, instrument: definition.instrument, notes: events.map(event => event.pitch), events, rests, pauses, measureBeats, changes: changes.filter(change => change.beat > 0), clef: writtenClef, writtenClef, concertClef, key: writtenKey, writtenKey, concertKey, tempo, time: currentTime };
  }).filter(track => track.events.length);
  if (!parsed.length) throw new Error('Aucune note MusicXML reconnue.'); tracks = parsed; trackIndex = 0; statusElement.textContent = `${tracks.length} partie(s) reconnue(s) dans ${name} (MusicXML).`; renderTracks(); render();
}

function parseImportedScore(xml, name) { if (/<score-partwise\b|<score-timewise\b/i.test(xml)) parseMusicXml(xml, name); else parseScore(xml, name); }

function normalizedInstrumentName(value = '') { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase(); }
function excerptDisplayName(document) {
  const doc = new DOMParser().parseFromString(document.xml, 'application/xml');
  const nameParts = document.name.split('/');
  return doc.querySelector('museScore > Score > name')?.textContent.trim() || nameParts[nameParts.length - 2]?.replace(/^\d+_/, '').replace(/_/g, ' ') || document.name;
}
function primaryExcerptTrack(document) {
  const excerptName = excerptDisplayName(document);
  const parsedTracks = parseScore(document.xml, document.name, false);
  const wanted = normalizedInstrumentName(excerptName);
  const score = track => {
    const names = [track.name, track.instrument, track.instrumentId].map(normalizedInstrumentName).filter(Boolean);
    if (names.includes(wanted)) return 1000;
    if (names.some(name => name.includes(wanted) || wanted.includes(name))) return 600;
    const wantedTokens = wanted.match(/[a-z]+|\d+/g) || [];
    return names.reduce((best, name) => Math.max(best, wantedTokens.filter(token => token.length > 2 && name.includes(token)).length * 80), 0) + Math.min(50, track.events.length / 10);
  };
  const primary = parsedTracks.slice().sort((left, right) => score(right) - score(left))[0];
  return primary ? { ...primary, name: excerptName || primary.name, sourceDocument: document.name, sourceKind: 'excerpt' } : null;
}
function trackMatchScore(excerpt, master) {
  if (excerpt.linkedMasterStaffId && excerpt.linkedMasterStaffId === master.sourceStaffId) return 10000;
  const excerptId = normalizedInstrumentName(excerpt.instrumentId);
  const masterId = normalizedInstrumentName(master.instrumentId);
  const excerptNames = [excerpt.name, excerpt.instrument].map(normalizedInstrumentName).filter(Boolean);
  const masterNames = [master.name, master.instrument].map(normalizedInstrumentName).filter(Boolean);
  let score = excerptId && masterId && excerptId === masterId ? 900 : 0;
  if (excerptNames.some(name => masterNames.includes(name))) score += 700;
  if (excerptNames.some(left => masterNames.some(right => left.includes(right) || right.includes(left)))) score += 320;
  if (instrumentFamily(excerpt) === instrumentFamily(master)) score += 90;
  const excerptRange = excerpt.events.length ? [Math.min(...excerpt.events.map(event => event.pitch)), Math.max(...excerpt.events.map(event => event.pitch))] : [0, 0];
  const masterRange = master.events.length ? [Math.min(...master.events.map(event => event.pitch)), Math.max(...master.events.map(event => event.pitch))] : [0, 0];
  const rangeDistance = Math.abs(excerptRange[0] - masterRange[0]) + Math.abs(excerptRange[1] - masterRange[1]);
  score += Math.max(0, 120 - rangeDistance * 4);
  return score;
}
function musicalTimelineAnchors(excerpt, master) {
  const windowSize = 4;
  const fingerprint = (events, index) => {
    const window = events.slice(index, index + windowSize);
    if (window.length < windowSize) return '';
    const originBeat = window[0].beat;
    const originPitch = window[0].pitch;
    return window.map(event => `${Math.round((event.beat - originBeat) * 1000)}:${event.pitch - originPitch}:${Math.round((event.beats || 1) * 1000)}:${event.chord?.length || 1}`).join('|');
  };
  const indexesByFingerprint = events => events.reduce((map, _, index) => { const key = fingerprint(events, index); if (!key) return map; if (!map.has(key)) map.set(key, []); map.get(key).push(index); return map; }, new Map());
  const excerptFingerprints = indexesByFingerprint(excerpt.events);
  const masterFingerprints = indexesByFingerprint(master.events);
  const anchors = [];
  excerptFingerprints.forEach((excerptIndexes, key) => {
    const masterIndexes = masterFingerprints.get(key) || [];
    if (excerptIndexes.length !== 1 || masterIndexes.length !== 1) return;
    anchors.push({ excerptBeat: excerpt.events[excerptIndexes[0]].beat, masterBeat: master.events[masterIndexes[0]].beat, source: 'musical' });
  });
  anchors.sort((left, right) => left.excerptBeat - right.excerptBeat || left.masterBeat - right.masterBeat);
  const monotonic = [];
  anchors.forEach(anchor => { if (!monotonic.length || anchor.masterBeat > monotonic[monotonic.length - 1].masterBeat) monotonic.push(anchor); });
  return monotonic;
}
function alignExcerptToMaster(excerpt, master) {
  const masterEvents = new Map();
  master.events.filter(event => event.sourceElementId).forEach(event => { if (!masterEvents.has(event.sourceElementId)) masterEvents.set(event.sourceElementId, []); masterEvents.get(event.sourceElementId).push(event); });
  const occurrences = new Map();
  const matches = new Map();
  excerpt.events.forEach(event => { if (!event.linkedMasterElementId) return; const occurrence = occurrences.get(event.linkedMasterElementId) || 0; const candidates = masterEvents.get(event.linkedMasterElementId) || []; const masterEvent = candidates[occurrence]; occurrences.set(event.linkedMasterElementId, occurrence + 1); if (masterEvent) matches.set(event, masterEvent); });
  const linkedAnchors = excerpt.events.map(event => { const masterEvent = matches.get(event); return masterEvent ? { excerptBeat: event.beat, masterBeat: masterEvent.beat, source: 'linked' } : null; }).filter(Boolean).sort((left, right) => left.excerptBeat - right.excerptBeat);
  const rawAnchors = linkedAnchors.length ? linkedAnchors : musicalTimelineAnchors(excerpt, master);
  const anchors = rawAnchors.filter((anchor, index) => !index || anchor.excerptBeat > rawAnchors[index - 1].excerptBeat + .001 && anchor.masterBeat > rawAnchors[index - 1].masterBeat + .001);
  if (!anchors.length) return excerpt;
  const mapBeat = beat => {
    if (beat <= anchors[0].excerptBeat) return beat + anchors[0].masterBeat - anchors[0].excerptBeat;
    const lastAnchor = anchors[anchors.length - 1];
    if (beat >= lastAnchor.excerptBeat) return beat + lastAnchor.masterBeat - lastAnchor.excerptBeat;
    const rightIndex = anchors.findIndex(anchor => anchor.excerptBeat >= beat);
    const left = anchors[rightIndex - 1], right = anchors[rightIndex];
    const ratio = (beat - left.excerptBeat) / Math.max(.001, right.excerptBeat - left.excerptBeat);
    return left.masterBeat + ratio * (right.masterBeat - left.masterBeat);
  };
  const alignItem = item => {
    const beat = mapBeat(item.beat);
    const beats = Number.isFinite(item.beats) ? Math.max(.001, mapBeat(item.beat + item.beats) - beat) : item.beats;
    return { ...item, beat, ...(Number.isFinite(beats) ? { beats } : {}) };
  };
  const events = excerpt.events.map(event => {
    const aligned = alignItem(event);
    const exact = matches.get(event);
    if (exact) aligned.beat = exact.beat;
    if (Number.isFinite(event.audibleBeats)) aligned.audibleBeats = Math.max(.001, mapBeat(event.beat + event.audibleBeats) - mapBeat(event.beat));
    return aligned;
  }).sort((left, right) => left.beat - right.beat || left.pitch - right.pitch);
    return { ...excerpt, events, rests: excerpt.rests.map(alignItem), pauses: (excerpt.pauses || []).map(alignItem), changes: excerpt.changes.map(alignItem).sort((left, right) => left.beat - right.beat), measureBeats: [...new Set(excerpt.measureBeats.map(mapBeat).map(beat => Math.round(beat * 1000) / 1000))].sort((left, right) => left - right), timelineAnchors: anchors.length, timelineAnchorSource: linkedAnchors.length ? 'linked' : 'musical' };
}
function combineExcerptDocuments(documents) {
  const masterDocument = documents.find(document => !document.name.includes('/'));
  const masterTracks = masterDocument ? parseScore(masterDocument.xml, masterDocument.name, false).map(track => ({ ...track, sourceDocument: masterDocument.name, sourceKind: 'master' })) : [];
  const excerptTracks = documents.filter(document => document.name.includes('/')).map(primaryExcerptTrack).filter(Boolean);
  if (!excerptTracks.length) return { tracks: masterTracks, excerptCount: 0, fallbackCount: masterTracks.length };
  const pairs = [];
  excerptTracks.forEach(excerpt => masterTracks.forEach(master => pairs.push({ excerpt, master, score: trackMatchScore(excerpt, master) })));
  pairs.sort((left, right) => right.score - left.score);
  const replacements = new Map();
  const usedExcerpts = new Set();
  const usedMasters = new Set();
  pairs.forEach(pair => {
    if (pair.score < 180 || usedExcerpts.has(pair.excerpt) || usedMasters.has(pair.master)) return;
    replacements.set(pair.master, pair.excerpt);
    usedExcerpts.add(pair.excerpt);
    usedMasters.add(pair.master);
  });
  const combined = masterTracks.map(masterTrack => {
    const excerpt = replacements.get(masterTrack);
    if (!excerpt) return masterTrack;
    return { ...alignExcerptToMaster(excerpt, masterTrack), name: masterTrack.name || excerpt.name, legacyMasterTrack: masterTrack.name, matchedScore: trackMatchScore(excerpt, masterTrack) };
  });
  excerptTracks.filter(track => !usedExcerpts.has(track)).forEach(track => combined.push(track));
  const conductorPool = masterTracks.length ? masterTracks : combined;
  const conductor = conductorPool.reduce((best, track) => (track.measureBeats?.length || 0) > (best.measureBeats?.length || 0) ? track : best, conductorPool[0]);
  const globalChanges = conductor.changes.filter(change => change.type === 'tempo' || change.type === 'time');
  const globalPauses = mergedPauses(combined);
  const synchronized = combined.map((track, importOrder) => ({
    ...track,
    importOrder,
    tempo: conductor.tempo,
    time: conductor.time,
    pauses: globalPauses,
    changes: [...track.changes.filter(change => change.type !== 'tempo' && change.type !== 'time'), ...globalChanges].sort((left, right) => left.beat - right.beat)
  }));
  return { tracks: synchronized, excerptCount: usedExcerpts.size, fallbackCount: synchronized.filter(track => track.sourceKind === 'master').length };
}
function importedDocumentLabel(document) {
  if (document.sourceKind === 'combined') return 'Version récente · parties individuelles réunies';
  if (document.name.includes('/')) return `Partie individuelle · ${excerptDisplayName(document)}`;
  return `Version générale · ${document.name} (peut être ancienne)`;
}
function loadImportedDocument(index) {
  const document = importedDocuments[index];
  if (!document) return;
  stop();
  importedScoreId = `${fileInput.files[0]?.name || 'partition'}:${document.name}`;
  if (document.tracks) {
    tracks = document.tracks;
    trackIndex = 0;
    const source = document.mergeInfo || {};
    const anchors = tracks.reduce((sum, track) => sum + (track.timelineAnchors || 0), 0);
    statusElement.textContent = `${tracks.length} voix réunies : ${source.excerptCount || 0} remplacées par leur partie indépendante récente${source.fallbackCount ? `, ${source.fallbackCount} conservées depuis la partition générale faute d'extrait` : ''}. ${anchors} accords liés ont servi à synchroniser précisément les chronologies.`;
    renderTracks();
    render();
  } else parseImportedScore(document.xml, document.name);
  renderRecord();
}

scoreDocument.onchange = () => loadImportedDocument(Number(scoreDocument.value));
fileInput.onchange = async () => { const file = fileInput.files[0]; if (!file) return; try { statusElement.textContent = `Import de ${file.name}…`; await new Promise(resolve => setTimeout(resolve, 20)); const buffer = await file.arrayBuffer(); if (file.name.toLowerCase().endsWith('.mscz')) { importedDocuments = await unzipMsczDocuments(buffer); const hasIndividualParts = importedDocuments.some(document => document.name.includes('/')); const merged = combineExcerptDocuments(importedDocuments); if (hasIndividualParts && merged.tracks.length) importedDocuments.splice(1, 0, { name: 'Parties individuelles réunies', tracks: merged.tracks, mergeInfo: merged, sourceKind: 'combined' }); } else importedDocuments = [{ name: file.name, xml: new TextDecoder().decode(buffer) }]; scoreDocument.innerHTML = importedDocuments.map((document, index) => `<option value="${index}">${importedDocumentLabel(document)}</option>`).join(''); document.getElementById('scoreDocumentLabel').hidden = importedDocuments.length < 2; const preferredIndex = importedDocuments.findIndex(document => document.sourceKind === 'combined'); scoreDocument.value = String(preferredIndex >= 0 ? preferredIndex : 0); loadImportedDocument(Number(scoreDocument.value)); } catch (error) { statusElement.textContent = `Import impossible : ${error.message}`; } };
try { localStorage.setItem('game-hub:last-game', 'rhythm'); } catch {}
window.RhythmLabTestApi = { parseScore: (xml, name = 'test.mscx') => parseScore(xml, name, false), validateTracks, trackDiagnosticSnapshot, runRhythmTests, mobileInterface: () => ({ dock: mobileInputDock.isConnected, controls: mobileInputDock.querySelectorAll('[data-code]').length, focusButton: Boolean(mobileInputDock.querySelector('[data-mobile-action="focus"]')), landscapeHint: Boolean(mobileInputDock.querySelector('.mobile-orientation-hint')) }) };
window.addEventListener('beforeunload', stopMicrophone);
renderLatencyStatus();
renderUnknownSymbolButton();
detectLayout(); renderTracks(); renderRecord(); render();
if (location.protocol === 'file:') statusElement.textContent = 'Mode fichier détecté : MS Basic ne peut pas charger ainsi. Sous Windows, lancez « Lancer le Hub Windows.bat » et ouvrez http://127.0.0.1:8765.';
if (new URLSearchParams(location.search).has('autotest')) window.setTimeout(() => { const result = runRhythmTests(); document.title = result.failures.length ? `Rhythm Lab · AUTOTEST ÉCHEC · ${result.failures.join(' | ')}` : `Rhythm Lab · AUTOTEST ${result.passed}/${result.passed}`; }, 50);
