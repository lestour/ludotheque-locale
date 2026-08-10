(function attachBrassFingering(root) {
  const standardFingerings = ['0', '123', '13', '23', '12', '1', '2', '0', '23', '12', '1', '2'];
  const valveCombinations = [
    { label: '0', drop: 0, penalty: 0 },
    { label: '2', drop: 1, penalty: 0 },
    { label: '1', drop: 2, penalty: 0 },
    { label: '12', drop: 3, penalty: 0 },
    { label: '3', drop: 3, penalty: 12 },
    { label: '23', drop: 4, penalty: 0 },
    { label: '13', drop: 5, penalty: 0 },
    { label: '123', drop: 6, penalty: 0 }
  ];

  function normalized(value = '') {
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function pitchClass(value) {
    return ((Math.round(value) % 12) + 12) % 12;
  }

  function midiAtOrAbove(noteClass, minimum) {
    let pitch = Math.ceil((minimum - noteClass) / 12) * 12 + noteClass;
    while (pitch < minimum) pitch += 12;
    return pitch;
  }

  function detectedKeyClass(text, transpose, fallback) {
    if (/b\s*flat|b-flat|bflat|bbb?(?:\b|-)|si\s*[b♭](?:emol)?|en\s*si\s*[b♭]/.test(text)) return 10;
    if (/e\s*flat|e-flat|eflat|eb(?:\b|-)|mi\s*[b♭](?:emol)?|en\s*mi\s*[b♭]/.test(text)) return 3;
    if (/(?:^|[^a-z])f(?:[^a-z]|$)|en\s*fa/.test(text)) return 5;
    if (/(?:^|[^a-z])c(?:[^a-z]|$)|en\s*ut|en\s*do/.test(text)) return 0;
    if (Number.isFinite(transpose) && transpose !== 0) return pitchClass(transpose);
    return fallback;
  }

  function profileFor({ instrumentId = '', instrument = '', name = '', transpose = 0 } = {}) {
    const text = normalized(`${instrumentId} ${instrument} ${name}`);
    if (/sousaph/.test(text)) return { id: 'sousaphone-bb', name: 'Sousaphone BB♭', fundamental: 22, standardThroughPartial: 8 };
    if (/euphon|baritone(?!\s*sax)/.test(text)) return { id: 'euphonium-bb', name: 'Euphonium/Baritone BB♭', fundamental: 34, standardThroughPartial: 8 };
    if (/alto\s*horn|tenor\s*horn|saxhorn\s*alto/.test(text)) return { id: 'alto-horn-eb', name: 'Saxhorn alto E♭', fundamental: 39, standardThroughPartial: 7 };
    if (/french\s*horn|brass\.horn|cor\s*(?:en\s*)?fa|\bcor\b/.test(text)) return { id: 'horn-f', name: 'Cor en F', fundamental: 41, standardThroughPartial: 6 };
    if (/tuba/.test(text)) {
      const keyClass = detectedKeyClass(text, Number(transpose), 0);
      const fundamental = midiAtOrAbove(keyClass, 22);
      const labels = { 0: 'CC', 3: 'E♭', 5: 'F', 10: 'BB♭' };
      return { id: `tuba-${keyClass}`, name: `Tuba ${labels[keyClass] || 'accordé'}`, fundamental, standardThroughPartial: 8 };
    }
    if (/piccolo/.test(text) && /trump|cornet/.test(text)) {
      const keyClass = detectedKeyClass(text, Number(transpose), 10);
      return { id: `piccolo-trumpet-${keyClass}`, name: 'Trompette piccolo', fundamental: midiAtOrAbove(keyClass, 57), standardThroughPartial: 4 };
    }
    if (/trump|trompette|cornet|flugel|bugle/.test(text)) {
      const keyClass = detectedKeyClass(text, Number(transpose), 10);
      const labels = { 0: 'C', 2: 'D', 3: 'E♭', 5: 'F', 10: 'B♭' };
      return { id: `trumpet-${keyClass}`, name: `Trompette/Cornet ${labels[keyClass] || 'accordé'}`, fundamental: midiAtOrAbove(keyClass, 46), standardThroughPartial: 4 };
    }
    return { id: 'generic-c-brass', name: 'Cuivre à pistons en C', fundamental: 48, standardThroughPartial: 4 };
  }

  function standardFingering(pitch, profile) {
    const writtenClass = pitchClass(pitch - pitchClass(profile.fundamental));
    return standardFingerings[writtenClass];
  }

  function harmonicCandidates(pitch, profile) {
    const candidates = [];
    valveCombinations.forEach(combination => {
      for (let partial = 1; partial <= 18; partial += 1) {
        const resonance = profile.fundamental - combination.drop + 12 * Math.log2(partial);
        const errorCents = Math.abs(resonance - pitch) * 100;
        if (errorCents > 48) continue;
        candidates.push({
          fingering: combination.label,
          partial,
          errorCents,
          score: errorCents + combination.drop * 4 + combination.label.length + combination.penalty
        });
      }
    });
    return candidates.sort((left, right) => left.score - right.score || left.errorCents - right.errorCents);
  }

  function fingeringsFor({ pitch, instrumentId = '', instrument = '', name = '', transpose = 0 } = {}) {
    const roundedPitch = Math.round(Number(pitch));
    const profile = profileFor({ instrumentId, instrument, name, transpose });
    if (!Number.isFinite(roundedPitch)) return { primary: '0', alternatives: [], accepted: ['0'], profile };
    const calculated = harmonicCandidates(roundedPitch, profile);
    const standard = standardFingering(roundedPitch, profile);
    const standardCeiling = profile.fundamental + 12 * Math.log2(profile.standardThroughPartial);
    const primary = roundedPitch <= standardCeiling ? standard : (calculated[0]?.fingering || standard);
    const accepted = [primary, ...calculated.map(candidate => candidate.fingering)].filter((value, index, values) => values.indexOf(value) === index);
    return { primary, alternatives: accepted.slice(1), accepted, profile, candidates: calculated };
  }

  root.BrassFingering = { fingeringsFor, profileFor };
})(typeof window === 'undefined' ? globalThis : window);
