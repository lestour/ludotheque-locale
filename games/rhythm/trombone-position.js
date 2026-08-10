(function attachTrombonePosition(root) {
  const preferredPositions = new Map([
    [28,[7]],[29,[6]],[30,[5]],[31,[4]],[32,[3]],[33,[2]],[34,[1]],
    [40,[7]],[41,[6]],[42,[5]],[43,[4]],[44,[3]],[45,[2]],[46,[1]],
    [47,[7]],[48,[6]],[49,[5]],[50,[4]],[51,[3]],[52,[2]],[53,[1]],
    [54,[5]],[55,[4]],[56,[3]],[57,[2]],[58,[1]],
    [59,[4]],[60,[3]],[61,[2]],[62,[1]],
    [63,[3]],[64,[2]],[65,[1]],
    [66,[3]],[67,[2]],[68,[1,3]],[69,[2]],[70,[1]],
    [71,[2]],[72,[1,3]],[73,[2]],[74,[1,2]],[75,[3]],[76,[2]],[77,[1]]
  ]);
  const fAttachmentLowPositions = new Map([[35,[7]],[36,[6]],[37,[5]],[38,[4]],[39,[3]],[40,[2]],[41,[1]]]);

  function harmonicCandidates(pitch) {
    const candidates = [];
    for (let position = 1; position <= 7; position += 1) {
      const fundamental = 35 - position;
      for (let partial = 1; partial <= 32; partial += 1) {
        const resonance = fundamental + 12 * Math.log2(partial);
        const errorCents = Math.abs(resonance - pitch) * 100;
        if (errorCents > 52) continue;
        candidates.push({ position, partial, errorCents, score: errorCents + (position - 1) * 1.5 + Math.max(0, partial - 16) * 2 });
      }
    }
    return candidates.sort((left, right) => left.score - right.score || left.position - right.position);
  }

  function referencePitch(pitch) {
    let reference = pitch;
    while (reference < 28) reference += 12;
    while (reference > 89) reference -= 12;
    return reference;
  }

  function positionsFor(value) {
    const pitch = Math.round(Number(value));
    if (!Number.isFinite(pitch)) return [];
    const reference = referencePitch(pitch);
    const positions = [];
    const add = values => (values || []).forEach(position => { if (!positions.includes(position)) positions.push(position); });
    add(preferredPositions.get(pitch));
    if (reference !== pitch) add(preferredPositions.get(reference));
    add(harmonicCandidates(pitch).map(candidate => candidate.position));
    if (reference !== pitch) add(harmonicCandidates(reference).map(candidate => candidate.position));
    add(fAttachmentLowPositions.get(pitch));
    if (reference !== pitch) add(fAttachmentLowPositions.get(reference));
    if (!positions.length) add(preferredPositions.get(reference) || fAttachmentLowPositions.get(reference));
    return positions.slice(0, 3);
  }

  root.TrombonePosition = { positionsFor };
})(typeof window === 'undefined' ? globalThis : window);
