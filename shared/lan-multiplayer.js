(() => {
  if (window.LanMultiplayer) return;

  const gamePathIndex = location.pathname.lastIndexOf('/games/');
  if (gamePathIndex < 0) return;
  const game = location.pathname.slice(gamePathIndex + 1);
  const synchronizedGames = new Set([
    'games/grid/sudoku.html',
    'games/grid/nonogram.html',
    'games/grid/minesweeper.html',
    'games/grid/logic-puzzles.html',
    'games/grid/fusion-2048.html',
    'games/arcade/arcade.html',
    'games/arcade/stellar-assault.html',
    'games/arcade/vector-drift.html',
    'games/arcade/pocket-platformer.html',
    'games/arcade/pinball.html',
    'games/arcade/labyrinthe-glouton.html',
    'games/arcade/traversee-turbo.html',
    'games/arcade/asteria.html',
    'games/arcade/eclipse-depths.html',
    'games/cards/classic/memory.html',
    'games/rhythm/rhythm-echo.html',
    'games/board/chess.html',
    'games/board/go.html',
    'games/board/mahjong.html',
    'games/cards/classic/klondike.html',
    'games/cards/classic/bataille-corse.html',
    'games/cards/modern/totem-reflexe.html',
    'games/cards/modern/symbole-unique.html',
    'games/rhythm/rhythm.html',
    'games/rhythm/karaoke.html',
    'games/cards/classic/bataille.html',
    'games/cards/modern/derniere-couleur.html',
    'games/cards/modern/sixieme-carte.html',
    'games/cards/modern/roi-pirate.html',
    'games/cards/modern/course-1000.html',
    'games/cards/modern/chatastrophe.html',
    'games/cards/modern/grille-zero.html',
    'games/cards/classic/rami-cartes.html',
    'games/board/rami-tuiles.html',
    'games/board/board-games.html'
  ]);
  const synchronizationAvailable = synchronizedGames.has(game);
  const twoPlayerGames = new Set(['games/board/chess.html', 'games/board/go.html']);
  const sharedPuzzleGames = new Set([
    'games/grid/sudoku.html', 'games/grid/nonogram.html', 'games/grid/minesweeper.html', 'games/grid/logic-puzzles.html', 'games/board/mahjong.html'
  ]);
  const scoreChallengeGames = new Set([
    'games/arcade/arcade.html', 'games/arcade/stellar-assault.html', 'games/arcade/vector-drift.html', 'games/arcade/pocket-platformer.html', 'games/arcade/pinball.html', 'games/arcade/labyrinthe-glouton.html', 'games/arcade/traversee-turbo.html', 'games/arcade/eclipse-depths.html',
    'games/grid/fusion-2048.html', 'games/cards/classic/memory.html',
    'games/rhythm/rhythm.html', 'games/rhythm/karaoke.html', 'games/rhythm/rhythm-echo.html'
  ]);
  const adventureGames = new Set(['games/arcade/asteria.html', 'games/arcade/eclipse-depths.html']);
  const MAX_REPLAY_EVENTS = 2000;
  const sessionKey = `ludotheque:lan:${location.host}:${game}`;
  const personalOptions = /^(?:sound|volume|masterVolume|trackVolume|keyboardLayout|audioStyle|microphone|microphoneSensitivity|showErrors|colorNotes|showFingering|cellScale)$/i;
  let credentials = null;
  let room = null;
  let sequence = 0;
  let pollTimer = 0;
  let socketTimer = 0;
  let roomSocket = null;
  let optionTimer = 0;
  let online = false;
  let applyingOptions = false;
  let finishing = false;
  let adapter = null;
  let startScheduledFor = 0;
  let dismissedResultKey = '';
  let replayEvents = [];
  let lastGhostSentAt = 0;
  const ghostSnapshots = new Map();

  try {
    credentials = JSON.parse(sessionStorage.getItem(sessionKey) || 'null');
    if (!credentials) {
      const saved = JSON.parse(localStorage.getItem(`${sessionKey}:reconnect`) || 'null');
      if (saved && Date.now() - saved.savedAt < 4 * 60 * 60 * 1000) credentials = saved;
    }
  } catch { credentials = null; }

  function encodeOptions(options) {
    const text = unescape(encodeURIComponent(JSON.stringify(options)));
    return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function safeText(value) {
    return String(value ?? '').replace(/[<>]/g, '').slice(0, 120);
  }

  function collectOptions() {
    const options = {};
    document.querySelectorAll('main select[id],main input[id][type="checkbox"],main input[id][type="radio"],main input[id][type="number"],main input[id][type="range"]').forEach(control => {
      if (control.closest('[data-lan-ui]') || control.dataset.lanPersonal !== undefined || personalOptions.test(control.id)) return;
      options[control.id] = control.type === 'checkbox' || control.type === 'radio' ? control.checked : control.type === 'number' || control.type === 'range' ? Number(control.value) : control.value;
    });
    if (game === 'games/grid/sudoku.html') {
      const variants = {
        typeKiller: 'killer', typeThermometer: 'thermometer', typeDiagonal: 'diagonal', typeKropki: 'kropki', typeXV: 'xv', typeKnight: 'knight', typeKing: 'king',
        typeNonconsecutive: 'nonconsecutive', typeHyper: 'hyper', typeDisjoint: 'disjoint', typePalindrome: 'palindrome', typeArrow: 'arrow', typeParity: 'parity',
        typeWhisper: 'whisper', typeRenban: 'renban', typeSandwich: 'sandwich', typeEntropic: 'entropic', typeModular: 'modular', typeQuadruple: 'quadruple'
      };
      options.sudokuVariants = Object.entries(variants).filter(([id]) => document.getElementById(id)?.classList.contains('selected')).map(([, variant]) => variant).join(',');
    }
    return options;
  }

  function applyOptions(options) {
    applyingOptions = true;
    window.GameRuntime?.applyLanOptions(options);
    applyingOptions = false;
  }

  async function request(path, options = {}) {
    const headers = { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) };
    if (credentials?.token) headers.Authorization = `Bearer ${credentials.token}`;
    const response = await fetch(path, { cache: 'no-store', ...options, headers: { ...headers, ...(options.headers || {}) } });
    let payload = {};
    try { payload = await response.json(); } catch {}
    if (!response.ok) throw new Error(payload.error || `Erreur LAN HTTP ${response.status}`);
    return payload;
  }

  function post(path, body) {
    return request(path, { method: 'POST', body: JSON.stringify(body) });
  }

  function saveCredentials(nextRoom, token) {
    credentials = { code: nextRoom.code, token, playerId: nextRoom.playerId, savedAt: Date.now() };
    sessionStorage.setItem(sessionKey, JSON.stringify(credentials));
    localStorage.setItem(`${sessionKey}:reconnect`, JSON.stringify(credentials));
  }

  function clearCredentials() {
    if (roomSocket) roomSocket.close();
    roomSocket = null;
    clearTimeout(socketTimer);
    credentials = null;
    room = null;
    ghostSnapshots.clear();
    sequence = 0;
    sessionStorage.removeItem(sessionKey);
    localStorage.removeItem(`${sessionKey}:reconnect`);
    const url = new URL(location.href);
    ['lan', 'lanOptions'].forEach(key => url.searchParams.delete(key));
    history.replaceState(null, '', url);
    window.dispatchEvent(new CustomEvent('lan:left'));
  }

  function playerName() {
    const input = document.getElementById('lanPlayerName');
    const stored = localStorage.getItem('ludotheque:lan:name') || '';
    const value = safeText(input?.value || stored || 'Joueur');
    localStorage.setItem('ludotheque:lan:name', value);
    return value;
  }

  function selectedSeatCount() {
    if (twoPlayerGames.has(game)) return 2;
    return Math.max(2, Math.min(8, Number(document.getElementById('lanSeatCount')?.value) || 2));
  }

  function seatCountOptions() {
    if (twoPlayerGames.has(game)) return '<option value="2" selected>2 places</option>';
    const gameControl = document.getElementById('playerCount') || document.getElementById('players');
    const values = gameControl
      ? [...gameControl.options].map(option => Number(option.value)).filter(value => Number.isInteger(value) && value >= 2 && value <= 8)
      : [2, 3, 4, 5, 6, 7, 8];
    const unique = [...new Set(values.length ? values : [2, 3, 4, 5, 6, 7, 8])];
    const current = Number(gameControl?.value) || unique[0];
    return unique.map(value => `<option value="${value}"${value === current ? ' selected' : ''}>${value} places</option>`).join('');
  }

  function multiplayerFormats() {
    if (adventureGames.has(game)) return [
      { id: 'coop', label: 'Coopération · monde partagé', description: 'Même monde, énigmes coopératives et progression des donjons partagée.' },
      { id: 'race', label: 'Course · mondes identiques', description: 'Même graine et mêmes options ; le premier à récupérer la Relique solaire gagne.' },
      { id: 'teams', label: 'Équipes · progression partagée', description: 'Les donjons et énigmes sont partagés uniquement entre partenaires.' }
    ];
    if (sharedPuzzleGames.has(game)) return [
      { id: 'coop', label: 'Coopération · grille partagée', description: 'Tous les joueurs agissent sur la même grille et gagnent ensemble.' },
      { id: 'race', label: 'Course · grilles séparées', description: 'Même génération pour tous, mais chaque joueur résout sa propre grille.' },
      { id: 'teams', label: 'Équipes · une grille par équipe', description: 'Les actions sont partagées uniquement entre partenaires de la même équipe.' }
    ];
    if (scoreChallengeGames.has(game)) return [
      { id: 'versus', label: 'Versus · score individuel', description: 'Même graine et mêmes options, classement selon le score ou le temps.' },
      { id: 'coopScore', label: 'Coopération · score cumulé', description: 'Chaque joueur joue sa partie et les scores sont additionnés.' },
      { id: 'teams', label: 'Équipes · scores cumulés', description: 'Les scores des partenaires sont regroupés dans un classement par équipes.' }
    ];
    return [{ id: 'standard', label: 'Mode multijoueur standard', description: 'Les règles multijoueur propres à ce jeu sont utilisées.' }];
  }

  function multiplayerFormatOptions() {
    return multiplayerFormats().map(format => `<option value="${format.id}">${format.label}</option>`).join('');
  }

  function selectedMultiplayerFormat() {
    const selected = document.getElementById('lanFormat')?.value;
    return multiplayerFormats().some(format => format.id === selected) ? selected : multiplayerFormats()[0].id;
  }

  function selectedTeamCount() {
    return Math.max(2, Math.min(4, selectedSeatCount(), Number(document.getElementById('lanTeamCount')?.value) || 2));
  }

  function collectRoomOptions() {
    return { ...collectOptions(), multiplayerFormat: selectedMultiplayerFormat(), teamCount: selectedTeamCount() };
  }

  function roomFormat() {
    return room?.options?.multiplayerFormat || selectedMultiplayerFormat();
  }

  function seatTeam(index) {
    const explicit = room?.seats?.[index]?.team ?? room?.players?.[index]?.team;
    return Math.max(0, Number(explicit ?? index) || 0) % Math.max(2, Number(room?.options?.teamCount) || 2);
  }

  function playerTeam(playerId) {
    const index = room?.seats?.findIndex(seat => seat.playerId === playerId) ?? -1;
    return index < 0 ? -1 : seatTeam(index);
  }

  function receivesActionFrom(playerId) {
    if (playerId === credentials?.playerId) return true;
    const format = roomFormat();
    if (['race', 'versus', 'coopScore'].includes(format)) return false;
    if (format !== 'teams') return true;
    return playerTeam(playerId) >= 0 && playerTeam(playerId) === playerTeam(credentials?.playerId);
  }

  function sha256Fallback(buffer) {
    const source = new Uint8Array(buffer);
    const bitLength = source.length * 8;
    const paddedLength = Math.ceil((source.length + 9) / 64) * 64;
    const bytes = new Uint8Array(paddedLength);
    bytes.set(source);
    bytes[source.length] = 0x80;
    const view = new DataView(bytes.buffer);
    view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
    view.setUint32(paddedLength - 4, bitLength >>> 0, false);
    const constants = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const hash = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const words = new Uint32Array(64);
    const rotate = (value, amount) => value >>> amount | value << 32 - amount;
    for (let offset = 0; offset < paddedLength; offset += 64) {
      for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
      for (let index = 16; index < 64; index += 1) {
        const first = rotate(words[index - 15], 7) ^ rotate(words[index - 15], 18) ^ words[index - 15] >>> 3;
        const second = rotate(words[index - 2], 17) ^ rotate(words[index - 2], 19) ^ words[index - 2] >>> 10;
        words[index] = (words[index - 16] + first + words[index - 7] + second) >>> 0;
      }
      let [a,b,c,d,e,f,g,h] = hash;
      for (let index = 0; index < 64; index += 1) {
        const sigma1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
        const choice = e & f ^ ~e & g;
        const temporary1 = (h + sigma1 + choice + constants[index] + words[index]) >>> 0;
        const sigma0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
        const majority = a & b ^ a & c ^ b & c;
        const temporary2 = (sigma0 + majority) >>> 0;
        h = g; g = f; f = e; e = (d + temporary1) >>> 0; d = c; c = b; b = a; a = (temporary1 + temporary2) >>> 0;
      }
      [a,b,c,d,e,f,g,h].forEach((value, index) => { hash[index] = (hash[index] + value) >>> 0; });
    }
    return hash.map(value => value.toString(16).padStart(8, '0')).join('');
  }

  async function localAsset() {
    const inputs = game === 'games/rhythm/karaoke.html'
      ? [...document.querySelectorAll('#scoreFile[type="file"],#backingFile[type="file"]')]
      : [document.querySelector('#file[type="file"],#scoreFile[type="file"],#imageInput[type="file"]')].filter(Boolean);
    const files = inputs.flatMap(input => [...(input.files || [])]);
    const descriptor = await adapter?.assetDescriptor?.();
    if (!files.length && descriptor == null) return null;
    const parts = (await Promise.all(files.map(async file => [`${file.name}:${file.size}:`, await file.arrayBuffer()]))).flat();
    if (descriptor != null) parts.push(`descriptor:${JSON.stringify(descriptor)}`);
    const buffer = await new Blob(parts).arrayBuffer();
    const hash = crypto.subtle?.digest
      ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(value => value.toString(16).padStart(2, '0')).join('')
      : sha256Fallback(buffer);
    return { name: files.map(file => file.name).join(' + ') || 'Configuration locale', size: files.reduce((total, file) => total + file.size, 0), hash };
  }

  function command(commandName, payload = {}) {
    if (!credentials) return Promise.reject(new Error('Aucun salon actif.'));
    return post(`/api/rooms/${credentials.code}/command`, { command: commandName, payload }).then(result => {
      if (result.room) updateRoom(result.room);
      return result.room;
    });
  }

  function isHost() { return room?.hostId === credentials?.playerId; }
  function currentPlayer() { return room?.players?.find(player => player.id === credentials?.playerId); }

  function setLobbyCover(visible, message = '') {
    let cover = document.getElementById('lanLobbyCover');
    if (!cover && visible) {
      cover = document.createElement('div');
      cover.id = 'lanLobbyCover';
      cover.dataset.lanUi = 'true';
      cover.innerHTML = '<div><strong>Partie LAN en préparation</strong><p></p><button type="button" data-open-lan>Ouvrir le salon</button></div>';
      document.body.appendChild(cover);
      cover.querySelector('[data-open-lan]').onclick = openDialog;
    }
    if (cover) {
      cover.hidden = !visible;
      cover.querySelector('p').textContent = message || 'La grille et les cartes restent masquées jusqu’au départ commun.';
    }
  }

  function setPauseCover(visible) {
    let cover = document.getElementById('lanPauseCover');
    if (!cover && visible) {
      cover = document.createElement('div');
      cover.id = 'lanPauseCover';
      cover.dataset.lanUi = 'true';
      cover.innerHTML = '<div><strong>Partie en pause</strong><p>Un joueur a mis la partie en pause pour tout le salon.</p><button type="button">Ouvrir le salon</button></div>';
      cover.querySelector('button').onclick = openDialog;
      document.body.appendChild(cover);
    }
    if (cover) cover.hidden = !visible;
  }

  function currentResultKey() {
    return room ? `${room.code}:${room.seed || 'partie'}` : '';
  }

  function setResultCover(visible) {
    let cover = document.getElementById('lanResultCover');
    if (!cover && visible) {
      cover = document.createElement('div');
      cover.id = 'lanResultCover';
      cover.dataset.lanUi = 'true';
      cover.innerHTML = '<div><span class="lan-result-kicker">Partie terminée</span><strong data-lan-result-title></strong><ol class="lan-result-ranking" data-lan-result-ranking></ol><p data-lan-result-votes></p><p>Voulez-vous continuer avec une nouvelle partie ?</p><div class="lan-result-actions"><button type="button" data-lan-rematch>Oui, rejouer</button><button type="button" data-lan-decline>Non</button><button type="button" data-lan-export-replay>Exporter le replay</button><button type="button" data-lan-result-room>Ouvrir le salon</button><button type="button" data-lan-result-close>Voir le plateau</button></div></div>';
      cover.querySelector('[data-lan-rematch]').onclick = () => run(() => command('rematch', { accept: true }));
      cover.querySelector('[data-lan-decline]').onclick = () => run(async () => {
        await command('rematch', { accept: false });
        dismissedResultKey = currentResultKey();
        cover.hidden = true;
      });
      cover.querySelector('[data-lan-result-room]').onclick = () => {
        dismissedResultKey = currentResultKey();
        cover.hidden = true;
        openDialog();
      };
      cover.querySelector('[data-lan-export-replay]').onclick = exportReplay;
      cover.querySelector('[data-lan-result-close]').onclick = () => {
        dismissedResultKey = currentResultKey();
        cover.hidden = true;
      };
      document.body.appendChild(cover);
    }
    if (!cover) return;
    const resultKey = currentResultKey();
    cover.hidden = !visible || dismissedResultKey === resultKey;
    if (!visible || !room) return;
    cover.querySelector('[data-lan-result-title]').textContent = winnerSummary();
    cover.querySelector('[data-lan-result-ranking]').innerHTML = rankedResults().map((entry, index) => `<li><strong>${index + 1}. ${safeText(entry.name)}</strong><span>${safeText(entry.label)}</span></li>`).join('');
    const votes = room.rematchVotes || [];
    const declines = room.rematchDeclines || [];
    cover.querySelector('[data-lan-result-votes]').textContent = `${votes.length}/${room.players.length} joueur${room.players.length > 1 ? 's' : ''} souhaite${room.players.length > 1 ? 'nt' : ''} rejouer${declines.length ? ` · ${declines.length} refus` : ''}.`;
    cover.querySelector('[data-lan-rematch]').disabled = votes.includes(credentials?.playerId);
    cover.querySelector('[data-lan-decline]').disabled = declines.includes(credentials?.playerId);
  }

  function lockOptions(locked) {
    document.querySelectorAll('main select[id],main input[id],main button[id^="type"],main #newGame,main #generate,main #randomVariants').forEach(control => {
      if (control.closest('[data-lan-ui]') || control.dataset.lanPersonal !== undefined || personalOptions.test(control.id)) return;
      if (locked) {
        if (!control.disabled) control.dataset.lanDisabled = 'true';
        control.disabled = true;
      } else if (control.dataset.lanDisabled) {
        control.disabled = false;
        delete control.dataset.lanDisabled;
      }
    });
  }

  function lockGameplay(locked) {
    document.querySelectorAll('main button,main [role="button"],main input,main select,main textarea').forEach(control => {
      if (control.closest('[data-lan-ui]') || control.dataset.lanPersonal !== undefined || personalOptions.test(control.id)) return;
      if (locked) {
        if (!control.disabled) control.dataset.lanGameDisabled = 'true';
        control.disabled = true;
      } else if (control.dataset.lanGameDisabled) {
        control.disabled = false;
        delete control.dataset.lanGameDisabled;
      }
    });
  }

  function renderRoom() {
    const panel = document.getElementById('lanRoomPanel');
    const disconnected = document.getElementById('lanDisconnected');
    if (!panel || !disconnected) return;
    disconnected.hidden = Boolean(room);
    panel.hidden = !room;
    if (!room) { setResultCover(false); return; }
    document.getElementById('lanRoomCode').textContent = room.code;
    const formatLabel = multiplayerFormats().find(entry => entry.id === roomFormat())?.label || 'Mode standard';
    document.getElementById('lanRoomVisibility').textContent = `${room.visibility === 'public' ? 'Public aléatoire' : 'Privé'} · ${formatLabel}`;
    const participants = room.phase === 'lobby'
      ? [
          ...room.players.map(player => ({ label: player.name, playerId: player.id, connected: player.connected, ready: player.ready, controller: player.connected ? 'human' : 'bot' })),
          ...Array.from({ length: Math.max(0, room.seatCount - room.players.length) }, (_, index) => ({ label: `Bot ${index + 1} au départ`, controller: 'bot', ready: true }))
        ]
      : room.seats;
    const format = roomFormat();
    document.getElementById('lanPlayers').innerHTML = participants.map((participant, index) => {
      const host = participant.playerId === room.hostId ? '👑 ' : '';
      const self = participant.playerId === credentials.playerId ? ' · vous' : '';
      const state = participant.controller === 'bot' ? '🤖' : participant.ready || room.phase !== 'lobby' ? '✅' : '⌛';
      const team = format === 'teams' ? ` · équipe ${seatTeam(index) + 1}` : '';
      const ghost = participant.playerId ? ghostSnapshots.get(participant.playerId) : null;
      const progress = ghost && Number.isFinite(ghost.progress) ? ` · ${Math.round(ghost.progress * 100)} %` : '';
      return `<li>${host}${safeText(participant.label || participant.name)} ${state}${team}${progress}${self}</li>`;
    }).join('');
    const formatControl = document.getElementById('lanFormat');
    if (formatControl) formatControl.value = multiplayerFormats().some(entry => entry.id === room.options?.multiplayerFormat) ? room.options.multiplayerFormat : multiplayerFormats()[0].id;
    const teamControl = document.getElementById('lanTeamCount');
    if (teamControl) { teamControl.value = String(room.options?.teamCount || 2); teamControl.closest('label').hidden = roomFormat() !== 'teams'; }
    const myTeamControl = document.getElementById('lanMyTeam');
    if (myTeamControl) {
      const teamCount = Math.max(2, Number(room.options?.teamCount) || 2);
      myTeamControl.replaceChildren(...Array.from({ length: teamCount }, (_, index) => {
        const option = document.createElement('option'); option.value = String(index); option.textContent = `Équipe ${index + 1}`; return option;
      }));
      myTeamControl.value = String(currentPlayer()?.team ?? playerTeam(credentials?.playerId) ?? 0);
      myTeamControl.closest('label').hidden = roomFormat() !== 'teams' || room.phase !== 'lobby';
    }
    const formatDescription = multiplayerFormats().find(entry => entry.id === roomFormat())?.description || '';
    const formatOutput = document.getElementById('lanFormatDescription');
    if (formatOutput) formatOutput.textContent = formatDescription;
    const ready = document.getElementById('lanReady');
    ready.textContent = currentPlayer()?.ready ? 'Ne plus être prêt' : 'Je suis prêt';
    ready.disabled = room.phase !== 'lobby';
    const start = document.getElementById('lanStart');
    start.hidden = !isHost();
    start.disabled = room.phase !== 'lobby' || room.players.filter(player => player.connected).length < 1 || room.players.some(player => player.connected && !player.ready);
    document.getElementById('lanPause').hidden = room.phase !== 'playing';
    document.getElementById('lanPause').textContent = room.paused ? 'Reprendre pour tous' : 'Pause pour tous';
    document.getElementById('lanRematch').hidden = room.phase !== 'finished';
    document.getElementById('lanDeclineRematch').hidden = room.phase !== 'finished';
    document.getElementById('lanRoomStatus').textContent = room.phase === 'lobby' ? 'En attente du lancement.' : room.phase === 'playing' ? room.paused ? 'Partie en pause.' : 'Partie en cours.' : winnerSummary();
    if (room.phase === 'lobby') {
      lockGameplay(false);
      applyOptions(room.options);
      lockOptions(!isHost());
      setLobbyCover(true);
    } else {
      lockOptions(true);
      lockGameplay(room.phase === 'finished');
      const waitingForStart = room.phase === 'playing' && Number(room.startAt || 0) * 1000 > Date.now();
      setLobbyCover(waitingForStart, waitingForStart ? 'Tout le monde démarre dans quelques secondes…' : '');
    }
    setPauseCover(room.phase === 'playing' && room.paused);
    setResultCover(room.phase === 'finished');
  }

  function winnerSummary() {
    const ranked = rankedResults();
    if (!ranked.length) return 'Partie terminée.';
    if (['coop', 'coopScore'].includes(roomFormat())) return `${ranked[0].result.won ? 'Objectif coopératif réussi' : 'Session coopérative terminée'} avec ${ranked[0].label}.`;
    if (roomFormat() === 'teams') return `${ranked[0].name} termine en tête avec ${ranked[0].label}.`;
    const everyoneLost = ranked.length > 0 && ranked.every(entry => entry.result.won === false);
    const winner = everyoneLost
      ? 'Aucun joueur n’a gagné cette partie.'
      : ranked[0] ? `${ranked[0].name} remporte la partie avec ${ranked[0].label}.` : 'Partie terminée.';
    const declines = (room.rematchDeclines || []).map(playerId => room.players.find(player => player.id === playerId)?.name).filter(Boolean);
    return `${winner}${declines.length ? ` ${declines.join(', ')} ne souhaite${declines.length > 1 ? 'nt' : ''} pas rejouer.` : ''}`;
  }

  function rankedResults() {
    const entries = Object.entries(room?.results || {}).map(([playerId, result]) => {
      const seat = room?.seats?.[result.seatIndex] || room?.seats?.find(item => item.playerId === playerId);
      const player = room?.players?.find(item => item.id === playerId);
      const seatIndex = room?.seats?.indexOf(seat) ?? Number(result.seatIndex || 0);
      return { name: seat?.label || player?.name || `Joueur ${seatIndex + 1}`, label: result.scoreLabel || (result.time ? `${result.time} s` : `${result.score || 0} point(s)`), result, seatIndex };
    });
    if (['coop', 'coopScore'].includes(roomFormat())) {
      const scores = entries.map(entry => Number(entry.result.score || 0));
      const score = roomFormat() === 'coop' ? Math.max(0, ...scores) : scores.reduce((total, value) => total + value, 0);
      return [{ name: 'Équipe coopérative', label: `${score.toLocaleString('fr-FR')} points`, result: { score, won: entries.some(entry => entry.result.won) } }];
    }
    if (roomFormat() === 'teams') {
      const teams = new Map();
      entries.forEach(entry => {
        const team = seatTeam(entry.seatIndex);
        const current = teams.get(team) || { name: `Équipe ${team + 1}`, score: 0, won: false };
        current.score += Number(entry.result.score || 0);
        current.won ||= Boolean(entry.result.won);
        teams.set(team, current);
      });
      return [...teams.values()].map(team => ({ name: team.name, label: `${team.score.toLocaleString('fr-FR')} points`, result: { score: team.score, won: team.won } })).sort((left, right) => right.result.score - left.result.score);
    }
    return entries.sort((left, right) => {
      if (Boolean(left.result.won) !== Boolean(right.result.won)) return Number(right.result.won) - Number(left.result.won);
      if (left.result.lowerIsBetter || right.result.lowerIsBetter) return Number(left.result.score ?? left.result.time ?? Infinity) - Number(right.result.score ?? right.result.time ?? Infinity);
      return Number(right.result.score || 0) - Number(left.result.score || 0);
    });
  }

  function exportReplay() {
    if (!room) return;
    const payload = {
      format: 'ludotheque-lan-replay', version: 2, exportedAt: new Date().toISOString(),
      game: room.game, options: room.options, seed: room.seed, seats: (room.seats || []).map(seat => ({ index: seat.index, label: seat.label, kind: seat.kind })),
      events: replayEvents, results: rankedResults().map(entry => ({ name: entry.name, label: entry.label, won: Boolean(entry.result.won) })),
      duration: replayEvents.length > 1 ? Math.max(0, replayEvents.at(-1).at - replayEvents[0].at) : 0
    };
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    link.download = `replay-${room.game.split('/').pop().replace('.html', '')}-${room.code}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function scheduleStart() {
    if (!room?.seed || startScheduledFor === room.startAt) return;
    const url = new URL(location.href);
    const currentSeed = url.searchParams.get('seed');
    const preservePage = game === 'games/rhythm/rhythm.html' || game === 'games/rhythm/karaoke.html' || game === 'games/cards/modern/derniere-couleur.html' || game === 'games/cards/modern/sixieme-carte.html' || game === 'games/cards/modern/roi-pirate.html' || game === 'games/cards/modern/course-1000.html' || game === 'games/cards/modern/chatastrophe.html' || game === 'games/cards/modern/grille-zero.html' || game === 'games/cards/classic/rami-cartes.html' || game === 'games/board/rami-tuiles.html' || (game === 'games/grid/nonogram.html' && document.querySelector('#imageInput')?.files?.length);
    if (!preservePage && currentSeed !== room.seed) {
      url.searchParams.set('seed', room.seed);
      url.searchParams.set('lan', room.code);
      url.searchParams.set('lanOptions', encodeOptions(room.options || {}));
      if (game === 'games/grid/sudoku.html') {
        if (room.options?.sudokuVariants) url.searchParams.set('variants', room.options.sudokuVariants);
        else url.searchParams.delete('variants');
      }
      location.replace(url);
      return;
    }
    if (preservePage) applyOptions(room.options || {});
    startScheduledFor = room.startAt || Date.now() / 1000;
    const delay = Math.max(0, startScheduledFor * 1000 - Date.now());
    window.setTimeout(() => {
      setLobbyCover(false);
      window.dispatchEvent(new CustomEvent('lan:start', { detail: { room, delay } }));
    }, delay);
  }

  function processEvents(events = []) {
    events.forEach(event => {
      sequence = Math.max(sequence, event.sequence || 0);
      if (event.type === 'ghost') {
        if (event.playerId !== credentials?.playerId) {
          const snapshot = { ...event.payload.snapshot, playerId: event.playerId, receivedAt: performance.now() };
          ghostSnapshots.set(event.playerId, snapshot);
          window.dispatchEvent(new CustomEvent('lan:ghost', { detail: snapshot }));
        }
        return;
      }
      if (!replayEvents.some(item => item.sequence === event.sequence)) replayEvents.push(event);
      replayEvents = replayEvents.slice(-MAX_REPLAY_EVENTS);
      if (event.playerId === credentials?.playerId && event.type === 'action' && !adapter?.receiveOwn) return;
      if (event.type === 'pause') window.dispatchEvent(new CustomEvent('lan:pause', { detail: event.payload }));
      if (event.type === 'action') {
        if (!receivesActionFrom(event.playerId)) return;
        adapter?.receive?.(event.payload.action, event.playerId);
        window.dispatchEvent(new CustomEvent('lan:action', { detail: { ...event.payload, playerId: event.playerId } }));
      }
      if (event.type === 'finished') window.dispatchEvent(new CustomEvent('lan:finished', { detail: event.payload }));
    });
  }

  function updateRoom(nextRoom) {
    if (!nextRoom) { clearCredentials(); renderRoom(); return; }
    const previousSequence = sequence;
    if (room?.seed !== nextRoom.seed || room?.code !== nextRoom.code) replayEvents = [];
    const events = (nextRoom.events || []).filter(event => Number(event.sequence || 0) > previousSequence);
    const ghostOnly = events.length > 0 && events.every(event => event.type === 'ghost');
    room = nextRoom;
    sequence = Math.max(sequence, room.sequence || 0);
    processEvents(events);
    if (!ghostOnly) {
      renderRoom();
      window.dispatchEvent(new CustomEvent('lan:room', { detail: { room } }));
    }
    if (room.phase !== 'lobby') scheduleStart();
  }

  async function poll() {
    if (!credentials) return;
    if (roomSocket?.readyState === WebSocket.OPEN) return;
    try {
      const state = await request(`/api/rooms/${credentials.code}?since=${sequence}`);
      online = true;
      updateRoom(state);
    } catch (error) {
      online = false;
      document.getElementById('lanRoomStatus').textContent = `Connexion interrompue : ${error.message}`;
      if (/introuvable|invalide|expiré/i.test(error.message)) clearCredentials();
    }
    clearTimeout(pollTimer);
    if (credentials) pollTimer = window.setTimeout(poll, online ? 650 : 2000);
  }

  function connectRealtime() {
    clearTimeout(socketTimer);
    if (!credentials || typeof WebSocket !== 'function') { poll(); return; }
    if (roomSocket && [WebSocket.CONNECTING, WebSocket.OPEN].includes(roomSocket.readyState)) return;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    roomSocket = new WebSocket(`${protocol}//${location.host}/api/rooms/${credentials.code}/socket`, ['ludotheque-v1', credentials.token]);
    roomSocket.onopen = () => { online = true; clearTimeout(pollTimer); };
    roomSocket.onmessage = event => {
      try {
        const state = JSON.parse(event.data);
        if (state.heartbeat) return;
        online = true;
        updateRoom(state);
      } catch (error) { showError(new Error(`État LAN temps réel invalide : ${error.message}`)); }
    };
    roomSocket.onerror = () => roomSocket?.close();
    roomSocket.onclose = () => {
      roomSocket = null;
      if (!credentials) return;
      poll();
      socketTimer = window.setTimeout(connectRealtime, online ? 1500 : 3500);
    };
  }

  async function createRoom(visibility) {
    const result = await post('/api/rooms/create', { name: playerName(), game, visibility, seatCount: selectedSeatCount(), options: collectRoomOptions() });
    saveCredentials(result.room, result.token);
    updateRoom(result.room);
    connectRealtime();
  }

  async function joinRoom(random = false) {
    const code = document.getElementById('lanJoinCode').value.trim().toUpperCase();
    const result = await post(random ? '/api/rooms/random' : '/api/rooms/join', { name: playerName(), game, code, seatCount: selectedSeatCount(), ...(random ? { options: collectRoomOptions() } : {}) });
    saveCredentials(result.room, result.token);
    updateRoom(result.room);
    connectRealtime();
  }

  function showError(error) {
    const output = document.getElementById('lanError');
    output.textContent = error.message || String(error);
    output.hidden = false;
  }

  function run(action) {
    document.getElementById('lanError').hidden = true;
    Promise.resolve().then(action).catch(showError);
  }

  function openDialog() {
    const dialog = document.getElementById('lanDialog');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function installUi() {
    document.documentElement.classList.add('lan-ui-installed');
    const button = document.createElement('button');
    button.id = 'lanButton';
    button.type = 'button';
    button.dataset.lanUi = 'true';
    button.textContent = '🌐 Jouer en LAN';
    button.onclick = openDialog;
    document.body.appendChild(button);

    const dialog = document.createElement('dialog');
    dialog.id = 'lanDialog';
    dialog.dataset.lanUi = 'true';
    dialog.innerHTML = `
      <form method="dialog" class="lan-title"><strong>Partie en réseau local</strong><button aria-label="Fermer">×</button></form>
      <section id="lanDisconnected">
        <label>Votre nom <input id="lanPlayerName" maxlength="24" value="${safeText(localStorage.getItem('ludotheque:lan:name') || 'Joueur')}"></label>
        <label>Places de la partie <select id="lanSeatCount">${seatCountOptions()}</select></label>
        <label>Format multijoueur <select id="lanFormat">${multiplayerFormatOptions()}</select></label>
        <p id="lanFormatDescription" class="lan-format-description">${safeText(multiplayerFormats()[0].description)}</p>
        <label id="lanTeamCountLabel" hidden>Nombre d’équipes <select id="lanTeamCount"><option value="2">2 équipes</option><option value="3">3 équipes</option><option value="4">4 équipes</option></select></label>
        <div class="lan-actions"><button id="lanCreatePrivate" type="button">Créer un salon privé</button><button id="lanCreatePublic" type="button">Créer un salon public</button></div>
        <label>Code privé <input id="lanJoinCode" maxlength="6" autocomplete="off"></label>
        <div class="lan-actions"><button id="lanJoin" type="button">Rejoindre ce code</button><button id="lanRandom" type="button">Salon public aléatoire</button></div>
      </section>
      <section id="lanRoomPanel" hidden>
        <p><strong>Salon <span id="lanRoomCode"></span></strong> · <span id="lanRoomVisibility"></span> <button id="lanCopyCode" type="button">Copier le code</button></p>
        <label id="lanMyTeamLabel" hidden>Mon équipe <select id="lanMyTeam"></select></label>
        <ul id="lanPlayers"></ul><p id="lanRoomStatus"></p>
        <div class="lan-actions"><button id="lanReady" type="button">Je suis prêt</button><button id="lanStart" type="button">Lancer</button><button id="lanPause" type="button" hidden>Pause pour tous</button><button id="lanRematch" type="button" hidden>Rejouer</button><button id="lanDeclineRematch" type="button" hidden>Ne pas rejouer</button><button id="lanExportReplay" type="button">Exporter le replay</button><button id="lanLeave" type="button">Quitter</button></div>
      </section>
      <p id="lanError" class="lan-error" hidden></p>`;
    document.body.appendChild(dialog);
    document.getElementById('lanCreatePrivate').onclick = () => run(() => createRoom('private'));
    document.getElementById('lanCreatePublic').onclick = () => run(() => createRoom('public'));
    document.getElementById('lanJoin').onclick = () => run(() => joinRoom(false));
    document.getElementById('lanRandom').onclick = () => run(() => joinRoom(true));
    const updateFormatUi = () => {
      const format = selectedMultiplayerFormat();
      document.getElementById('lanTeamCountLabel').hidden = format !== 'teams';
      document.getElementById('lanFormatDescription').textContent = multiplayerFormats().find(entry => entry.id === format)?.description || '';
    };
    document.getElementById('lanFormat').onchange = () => {
      updateFormatUi();
      if (room?.phase === 'lobby' && isHost()) run(() => command('set-options', { options: collectRoomOptions() }));
    };
    document.getElementById('lanTeamCount').onchange = () => { if (room?.phase === 'lobby' && isHost()) run(() => command('set-options', { options: collectRoomOptions() })); };
    document.getElementById('lanMyTeam').onchange = event => { if (room?.phase === 'lobby') run(() => command('set-team', { team: Number(event.target.value) })); };
    updateFormatUi();
    document.getElementById('lanReady').onclick = () => run(async () => {
      const ready = !currentPlayer()?.ready;
      if (ready) await adapter?.prepareReady?.();
      await command('ready', { ready, asset: ready ? await localAsset() : null });
    });
    document.getElementById('lanStart').onclick = () => run(() => command('start'));
    document.getElementById('lanPause').onclick = () => run(() => command('pause', { paused: !room.paused }));
    document.getElementById('lanRematch').onclick = () => run(() => command('rematch', { accept: true }));
    document.getElementById('lanDeclineRematch').onclick = () => run(() => command('rematch', { accept: false }));
    document.getElementById('lanExportReplay').onclick = exportReplay;
    document.getElementById('lanCopyCode').onclick = () => run(async () => {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(room.code);
      else {
        const field = document.createElement('textarea');
        field.value = room.code;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        document.execCommand('copy');
        field.remove();
      }
      document.getElementById('lanRoomStatus').textContent = `Code ${room.code} copié.`;
    });
    document.getElementById('lanLeave').onclick = () => run(async () => { await command('leave'); clearCredentials(); renderRoom(); });
    if (!synchronizationAvailable) {
      ['lanCreatePrivate', 'lanCreatePublic', 'lanJoin', 'lanRandom'].forEach(id => { document.getElementById(id).disabled = true; });
      const error = document.getElementById('lanError');
      error.hidden = false;
      error.textContent = 'Le lobby LAN est prêt, mais ce jeu attend encore son adaptateur serveur afin de ne jamais révéler les mains ou informations privées.';
    }
  }

  function installStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #lanButton{position:fixed;left:14px;right:auto;bottom:14px;z-index:2147480000;border:0;border-radius:999px;padding:11px 16px;background:#0f766e;color:white;font:700 14px system-ui;box-shadow:0 5px 18px #0005;cursor:pointer}
      #lanDialog{z-index:2147481000;width:min(520px,calc(100vw - 30px));max-height:calc(100vh - 30px);box-sizing:border-box;border:1px solid #64748b;border-radius:16px;padding:18px;background:#fff;color:#172033;box-shadow:0 20px 70px #0008}
      #lanDialog::backdrop{background:#07111fcc;backdrop-filter:blur(3px)}#lanDialog label{display:grid;gap:5px;margin:10px 0}#lanDialog input,#lanDialog select{box-sizing:border-box;width:100%;padding:9px;border:1px solid #94a3b8;border-radius:8px;font:inherit;background:#fff;color:#172033}.lan-format-description{margin:7px 0 12px;padding:9px 11px;border-radius:9px;background:#ecfeff;color:#155e75;font-size:13px;line-height:1.4}
      .lan-title,.lan-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.lan-title{justify-content:space-between;font-size:20px}.lan-title button{font-size:24px}.lan-actions button,#lanDialog button{padding:8px 11px;border:1px solid #94a3b8;border-radius:9px;background:#f8fafc;color:#172033;cursor:pointer}.lan-actions button:hover,#lanDialog button:hover{background:#0f766e;color:#fff}.lan-actions button:disabled{opacity:.45;cursor:not-allowed}#lanPlayers{line-height:1.7}.lan-error{padding:9px;border-radius:8px;background:#fee2e2;color:#991b1b}
      #lanLobbyCover,#lanPauseCover,#lanResultCover{position:fixed;inset:0;z-index:2147479000;display:grid;place-items:center;padding:24px;background:#0f172acc;color:#fff;text-align:center;backdrop-filter:blur(4px)}#lanLobbyCover[hidden],#lanPauseCover[hidden],#lanResultCover[hidden]{display:none}#lanLobbyCover>div,#lanPauseCover>div,#lanResultCover>div{width:min(520px,calc(100vw - 40px));box-sizing:border-box;padding:28px;border:1px solid #64748b;border-radius:18px;background:#172554;box-shadow:0 22px 70px #0009}#lanLobbyCover strong,#lanPauseCover strong,#lanResultCover strong{display:block;font-size:24px}#lanLobbyCover button,#lanPauseCover button,#lanResultCover button{padding:10px 14px;border:0;border-radius:9px;background:#fff;color:#172554;font-weight:700;cursor:pointer}#lanResultCover{z-index:2147481500}.lan-result-kicker{display:block;margin-bottom:8px;color:#99f6e4;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.lan-result-ranking{display:grid;gap:6px;margin:16px 0;padding:0;list-style:none;text-align:left}.lan-result-ranking li{display:flex;justify-content:space-between;gap:12px;padding:8px 10px;border-radius:8px;background:#ffffff12}.lan-result-ranking li span{color:#cbd5e1}.lan-result-actions{display:flex;gap:9px;justify-content:center;flex-wrap:wrap}.lan-result-actions button:first-child{background:#14b8a6;color:#042f2e}.lan-result-actions button:disabled{opacity:.55;cursor:default}
      @media(prefers-color-scheme:dark){#lanDialog{background:#172235;color:#e5edf8}#lanDialog input,#lanDialog select,#lanDialog button{background:#25344b;color:#e5edf8;border-color:#64748b}.lan-format-description{background:#164e63;color:#cffafe}}
    `;
    document.head.appendChild(style);
  }

  async function detectLanServer() {
    try {
      const status = await request('/api/lan/status');
      return status.lan === true;
    } catch { return false; }
  }

  function registerAdapter(nextAdapter) { adapter = nextAdapter || null; }
  function sendAction(action) { return command('action', { action }); }
  function sendPrivateAction(action) { return command('game-action', { action }); }
  function sendGhost(snapshot) {
    if (!credentials || !room || room.phase !== 'playing' || room.paused || !['coop', 'race', 'versus', 'teams'].includes(roomFormat())) return Promise.resolve(false);
    const now = performance.now();
    if (now - lastGhostSentAt < 125) return Promise.resolve(false);
    lastGhostSentAt = now;
    return command('ghost', { snapshot }).then(() => true);
  }
  function finish(result) {
    if (!credentials || finishing) return Promise.resolve();
    finishing = true;
    return command('finish', { result }).finally(() => { finishing = false; });
  }

  window.LanMultiplayer = {
    get active() { return Boolean(credentials && room); },
    get room() { return room; },
    get playerId() { return credentials?.playerId || null; },
    get playerIndex() {
      const seatIndex = room?.seats?.findIndex(seat => seat.playerId === credentials?.playerId) ?? -1;
      return seatIndex >= 0 ? seatIndex : room?.players?.findIndex(player => player.id === credentials?.playerId) ?? -1;
    },
    get format() { return roomFormat(); },
    get teamIndex() { return playerTeam(credentials?.playerId); },
    get formats() { return multiplayerFormats().map(format => ({ ...format })); },
    registerAdapter,
    sendAction,
    sendPrivateAction,
    sendGhost,
    get ghosts() { return new Map(ghostSnapshots); },
    requestPause(paused) { return command('pause', { paused }); },
    finish,
    open: openDialog,
  };
  window.dispatchEvent(new CustomEvent('lan:available'));

  window.addEventListener('game:finished', event => finish(event.detail || {}));
  document.addEventListener('click', event => {
    if (!room || room.phase !== 'playing' || event.target.id !== 'pauseGame') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    command('pause', { paused: !room.paused }).catch(showError);
  }, true);
  document.addEventListener('change', event => {
    if (!room || room.phase !== 'lobby' || !isHost() || applyingOptions || !event.target.matches('main input[id],main select[id]')) return;
    clearTimeout(optionTimer);
    optionTimer = window.setTimeout(() => command('set-options', { options: collectRoomOptions() }).catch(showError), 120);
  });
  document.addEventListener('click', event => {
    if (!room || room.phase !== 'lobby' || !isHost() || !event.target.closest('main button[id^="type"]')) return;
    clearTimeout(optionTimer);
    optionTimer = window.setTimeout(() => command('set-options', { options: collectRoomOptions() }).catch(showError), 120);
  });

  const boot = async () => {
    if (!await detectLanServer()) return;
    installStyles();
    installUi();
    if (credentials?.code && credentials?.token) connectRealtime();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
