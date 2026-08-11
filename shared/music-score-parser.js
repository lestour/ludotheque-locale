window.MusicScoreParser = (() => {
  const durationTypes = { longa: 16, breve: 8, whole: 4, half: 2, quarter: 1, eighth: .5, '16th': .25, '32nd': .125, '64th': .0625, '128th': .03125 };
  const dynamicLevels = { pppp: 20, ppp: 28, pp: 38, p: 50, mp: 64, mf: 78, f: 94, ff: 108, fff: 120, ffff: 127, sfz: 116, sf: 108, fp: 72 };

  function text(element, selector, fallback = '') { return element?.querySelector(selector)?.textContent.trim() || fallback; }
  function duration(element) {
    const type = text(element, ':scope > durationType');
    const fraction = text(element, ':scope > duration');
    const base = durationTypes[type] || (fraction.includes('/') ? 4 * Number(fraction.split('/')[0]) / Number(fraction.split('/')[1]) : 1);
    const dots = Number(text(element, ':scope > dots', '0'));
    let beats = base;
    for (let dot = 1; dot <= dots; dot += 1) beats += base / 2 ** dot;
    return beats;
  }
  function velocity(value, fallback = 78) { return dynamicLevels[String(value).toLowerCase().replace(/[^a-z]/g, '')] || fallback; }
  function lyric(element) { return [...element.querySelectorAll(':scope > Lyrics, :scope > Note > Lyrics, :scope > lyric')].map(node => text(node, ':scope > text') || text(node, ':scope > text')).filter(Boolean)[0] || ''; }
  function measureOrder(measures) {
    const order = [];
    let repeatStart = 0;
    const played = new Map();
    for (let index = 0; index < measures.length && order.length < measures.length * 8; index += 1) {
      const measure = measures[index];
      if (measure.querySelector('startRepeat, barline[location="left"] repeat[direction="forward"]')) repeatStart = index;
      order.push(index);
      const endRepeat = measure.querySelector('endRepeat, barline[location="right"] repeat[direction="backward"]');
      if (!endRepeat) continue;
      const count = Math.max(2, Number(endRepeat.textContent || endRepeat.getAttribute?.('times') || 2));
      const current = played.get(index) || 1;
      if (current < count) { played.set(index, current + 1); index = repeatStart - 1; }
    }
    return order;
  }

  async function unzipMscz(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const decoder = new TextDecoder();
    const documents = [];
    for (let cursor = 0; cursor + 46 <= bytes.length; cursor += 1) {
      if (view.getUint32(cursor, true) !== 0x02014b50) continue;
      const method = view.getUint16(cursor + 10, true);
      const compressed = view.getUint32(cursor + 20, true);
      const nameLength = view.getUint16(cursor + 28, true);
      const extraLength = view.getUint16(cursor + 30, true);
      const commentLength = view.getUint16(cursor + 32, true);
      const local = view.getUint32(cursor + 42, true);
      const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
      cursor += 45 + nameLength + extraLength + commentLength;
      if (!name.toLowerCase().endsWith('.mscx') || local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) continue;
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const data = bytes.slice(start, start + compressed);
      let xml;
      if (method === 0) xml = decoder.decode(data);
      else if (method === 8 && 'DecompressionStream' in window) xml = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
      else throw new Error('Cette archive MSCZ nécessite un navigateur prenant en charge DecompressionStream.');
      documents.push({ name, xml });
    }
    if (!documents.length) throw new Error('Aucune partition MSCX trouvée dans l’archive.');
    return documents;
  }

  function mergeTies(events) {
    const merged = [];
    events.sort((left, right) => left.startBeat - right.startBeat || left.midi - right.midi).forEach(event => {
      const previous = merged.at(-1);
      if (event.tieStop && previous && previous.midi === event.midi && Math.abs(previous.startBeat + previous.beats - event.startBeat) < .01) {
        previous.beats += event.beats;
        previous.tie = true;
        if (!previous.lyric) previous.lyric = event.lyric;
      } else merged.push({ ...event });
    });
    return merged;
  }

  function parseMuseScore(xml, sourceName = 'partition.mscx') {
    const documentNode = new DOMParser().parseFromString(xml, 'application/xml');
    if (documentNode.querySelector('parsererror')) throw new Error('Partition MuseScore XML invalide.');
    const metadata = new Map();
    documentNode.querySelectorAll('Score > Part').forEach((part, partIndex) => {
      const name = text(part, ':scope > trackName') || text(part, ':scope > Instrument > longName') || `Piste ${partIndex + 1}`;
      part.querySelectorAll(':scope > Staff').forEach(staff => metadata.set(staff.getAttribute('id'), name));
    });
    const tempoRaw = Number(text(documentNode, 'Score Tempo tempo', '1.6667'));
    const tempo = Math.max(30, Math.min(300, Math.round(tempoRaw * 60)));
    return [...documentNode.querySelectorAll('Score > Staff')].flatMap((staff, staffIndex) => {
      const measures = [...staff.children].filter(element => element.tagName === 'Measure');
      const order = measureOrder(measures);
      const events = [];
      let absoluteBeat = 0;
      let currentVelocity = 78;
      order.forEach(measureIndex => {
        const measure = measures[measureIndex];
        const voices = [...measure.children].filter(element => element.tagName === 'voice');
        let longestVoice = 0;
        voices.forEach((voice, voiceIndex) => {
          let beat = absoluteBeat;
          [...voice.children].forEach(element => {
            if (element.tagName === 'Dynamic') { currentVelocity = velocity(text(element, ':scope > subtype'), currentVelocity); return; }
            if (element.tagName !== 'Chord' && element.tagName !== 'Rest') return;
            const beats = duration(element);
            if (element.tagName === 'Chord') {
              const note = element.querySelector(':scope > Note');
              const midi = Number(text(note, ':scope > pitch', 'NaN'));
              if (Number.isFinite(midi)) events.push({ midi, startBeat: beat, beats, lyric: lyric(element), velocity: currentVelocity, voice: voiceIndex + 1, tieStop: Boolean(note.querySelector('endSpanner, Spanner[type="Tie"] > prev')), tieStart: Boolean(note.querySelector('Spanner[type="Tie"], Tie')) });
            }
            beat += beats;
          });
          longestVoice = Math.max(longestVoice, beat - absoluteBeat);
        });
        const time = measure.querySelector('TimeSig');
        const expected = time ? Number(text(time, 'sigN', '4')) * 4 / Number(text(time, 'sigD', '4')) : 4;
        absoluteBeat += Math.max(longestVoice, expected);
      });
      const baseName = metadata.get(staff.getAttribute('id')) || `Piste ${staffIndex + 1}`;
      const voices = [...new Set(events.map(event => event.voice))];
      return voices.map(voice => ({ name: voices.length > 1 ? `${baseName} · voix ${voice}` : baseName, sourceName, tempo, events: mergeTies(events.filter(event => event.voice === voice)) }));
    }).filter(track => track.events.length);
  }

  function parseMusicXml(xml, sourceName = 'partition.musicxml') {
    const documentNode = new DOMParser().parseFromString(xml, 'application/xml');
    if (documentNode.querySelector('parsererror')) throw new Error('MusicXML invalide.');
    const names = new Map([...documentNode.querySelectorAll('score-part')].map(part => [part.getAttribute('id'), text(part, 'part-name') || part.getAttribute('id')]));
    return [...documentNode.querySelectorAll('score-partwise > part')].flatMap((part, partIndex) => {
      let divisions = 1;
      let tempo = 120;
      let currentVelocity = 78;
      let absoluteBeat = 0;
      const byVoice = new Map();
      const measures = [...part.querySelectorAll(':scope > measure')];
      measureOrder(measures).forEach(measureIndex => {
        const measure = measures[measureIndex];
        divisions = Number(text(measure, 'attributes divisions', String(divisions))) || divisions;
        const tempoNode = measure.querySelector('direction sound[tempo], direction per-minute');
        if (tempoNode) tempo = Number(tempoNode.getAttribute?.('tempo') || tempoNode.textContent || tempo);
        const dynamicNode = measure.querySelector('direction-type dynamics > *, direction sound[dynamics]');
        if (dynamicNode) currentVelocity = dynamicNode.getAttribute?.('dynamics') ? Math.max(1, Math.min(127, Math.round(Number(dynamicNode.getAttribute('dynamics')) * 1.27))) : velocity(dynamicNode.tagName, currentVelocity);
        const voiceBeats = new Map();
        let chordStart = absoluteBeat;
        [...measure.querySelectorAll(':scope > note')].forEach(note => {
          const voice = text(note, ':scope > voice', '1');
          const cursor = voiceBeats.get(voice) || absoluteBeat;
          const isChord = Boolean(note.querySelector(':scope > chord'));
          const startBeat = isChord ? chordStart : cursor;
          if (!isChord) chordStart = startBeat;
          const beats = Number(text(note, ':scope > duration', String(divisions))) / divisions;
          if (!note.querySelector(':scope > rest')) {
            const step = text(note, ':scope > pitch > step');
            const alter = Number(text(note, ':scope > pitch > alter', '0'));
            const octave = Number(text(note, ':scope > pitch > octave', '4'));
            const semitone = { C:0,D:2,E:4,F:5,G:7,A:9,B:11 }[step];
            if (semitone !== undefined) {
              if (!byVoice.has(voice)) byVoice.set(voice, []);
              byVoice.get(voice).push({ midi: (octave + 1) * 12 + semitone + alter, startBeat, beats, lyric: text(note, ':scope > lyric > text'), velocity: currentVelocity, voice: Number(voice) || 1, tieStart: Boolean(note.querySelector('tie[type="start"]')), tieStop: Boolean(note.querySelector('tie[type="stop"]')) });
            }
          }
          if (!isChord) voiceBeats.set(voice, cursor + beats);
        });
        const numerator = Number(text(measure, 'attributes time beats', '4'));
        const denominator = Number(text(measure, 'attributes time beat-type', '4'));
        absoluteBeat += Math.max(numerator * 4 / denominator, ...[...voiceBeats.values()].map(value => value - absoluteBeat), 0);
      });
      const partName = names.get(part.getAttribute('id')) || `Piste ${partIndex + 1}`;
      return [...byVoice.entries()].map(([voice, events]) => ({ name: byVoice.size > 1 ? `${partName} · voix ${voice}` : partName, sourceName, tempo, events: mergeTies(events) }));
    }).filter(track => track.events.length);
  }

  function parseXml(xml, sourceName) { return /<score-partwise\b/i.test(xml) ? parseMusicXml(xml, sourceName) : parseMuseScore(xml, sourceName); }
  async function parseFile(file) {
    const buffer = await file.arrayBuffer();
    if (file.name.toLowerCase().endsWith('.mscz')) {
      const documents = await unzipMscz(buffer);
      return documents.flatMap(document => parseMuseScore(document.xml, document.name));
    }
    return parseXml(new TextDecoder().decode(buffer), file.name);
  }

  return { parseFile, parseXml, parseMuseScore, parseMusicXml, unzipMscz, duration, velocity };
})();
