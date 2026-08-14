if (!window.GameRecords) {
  if (!document.querySelector('script[data-options-help]')) {
    const source = document.currentScript?.src;
    const script = document.createElement('script');
    script.src = source ? new URL('options-help.js?v=4', source).href : '../../shared/options-help.js?v=4';
    script.dataset.optionsHelp = 'true';
    document.head.append(script);
  }

  (() => {
    const recordsKey = window.GameRuntime?.profileKey('game-hub:records') || 'game-hub:records';
    const statisticsKey = window.GameRuntime?.profileKey('game-hub:statistics') || 'game-hub:statistics';
    const basePageId = location.pathname.split('/').pop().replace('.html', '') || 'hub';
    const routeVariant = new URLSearchParams(location.search).get('variant');
    const pageId = routeVariant ? `${basePageId}:${routeVariant}` : basePageId;
    let startedAt = performance.now();
    let finished = false;

    function settings() {
      if (window.GameRuntime) return GameRuntime.settingsSignature(document);
      return [...document.querySelectorAll('select, input[type="checkbox"], input[type="radio"]')]
        .filter(control => control.id && !['errors', 'showErrors', 'sound'].includes(control.id))
        .map(control => `${control.id}=${control.type === 'checkbox' || control.type === 'radio' ? control.checked : control.value}`)
        .sort().join('&') || 'default';
    }
    function read(key = recordsKey) { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } }
    function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
    function recordKey() { return `${pageId}|${settings()}`; }
    function format(seconds) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
    function pageStatistics() { return read(statisticsKey)[pageId] || { plays: 0, finishes: 0, wins: 0, totalSeconds: 0 }; }
    function updateStatistics(changes) {
      const all = read(statisticsKey);
      const current = all[pageId] || { plays: 0, finishes: 0, wins: 0, totalSeconds: 0 };
      Object.entries(changes).forEach(([key, value]) => { current[key] = (current[key] || 0) + value; });
      all[pageId] = current;
      write(statisticsKey, all);
    }
    function render() {
      const result = read()[recordKey()];
      const statistics = pageStatistics();
      badge.innerHTML = result ? `🏆 ${result.scoreLabel || format(result.time)}<small>${statistics.plays} partie${statistics.plays > 1 ? 's' : ''} · ${result.date}</small>` : `🏆 Aucun record<small>${statistics.plays} partie${statistics.plays > 1 ? 's' : ''}</small>`;
      badge.dataset.help = `Record pour les paramètres : ${settings()}`;
    }
    function finish({ score = 0, scoreLabel = '', lowerIsBetter = false, won = true, ...details } = {}) {
      if (finished) return;
      finished = true;
      const time = Math.max(1, Math.round((performance.now() - startedAt) / 1000));
      const entry = { score, scoreLabel, lowerIsBetter, time, date: new Date().toLocaleDateString('fr-FR') };
      const all = read();
      const old = all[recordKey()];
      const improved = !old || (scoreLabel ? (lowerIsBetter ? score < old.score : score > old.score) : time < old.time);
      if (won && improved) { all[recordKey()] = entry; write(recordsKey, all); }
      updateStatistics({ finishes: 1, wins: Number(won), totalSeconds: time });
      render();
      window.dispatchEvent(new CustomEvent('game:finished', { detail: { score, scoreLabel, lowerIsBetter, won, time, ...details } }));
      if (!window.LanMultiplayer?.active) showResult({ score, scoreLabel, won, time });
    }
    function reset() {
      startedAt = performance.now();
      finished = false;
      resultDialog?.close?.();
      resultDialog?.removeAttribute('open');
      updateStatistics({ plays: 1 });
      window.setTimeout(render);
    }
    function exportData() {
      const payload = JSON.stringify({ exportedAt: new Date().toISOString(), records: read(), statistics: read(statisticsKey) }, null, 2);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
      link.download = `ludotheque-records-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }
    function showPanel() {
      const entries = Object.entries(read()).filter(([key]) => key.startsWith(`${pageId}|`));
      const statistics = pageStatistics();
      dialog.querySelector('[data-record-content]').innerHTML = `<p><strong>${statistics.plays}</strong> parties · <strong>${statistics.finishes}</strong> terminées · <strong>${statistics.wins}</strong> victoires</p>${entries.length ? `<ul>${entries.map(([key, value]) => `<li><strong>${value.scoreLabel || format(value.time)}</strong> · ${key.split('|')[1]} · ${value.date}</li>`).join('')}</ul>` : '<p>Aucun record pour ce jeu.</p>'}`;
      dialog.showModal();
    }
    function showResult(result) {
      resultDialog.querySelector('[data-result-title]').textContent = result.won ? 'Partie gagnée !' : 'Partie terminée';
      resultDialog.querySelector('[data-result-summary]').textContent = result.scoreLabel || (result.score ? `${result.score} points` : `Temps : ${format(result.time)}`);
      if (typeof resultDialog.showModal === 'function' && !resultDialog.open) resultDialog.showModal();
      else resultDialog.setAttribute('open', '');
    }
    function replay() {
      resultDialog.close?.();
      const trigger = document.querySelector('#newGame, #reset, #generate, [data-new-game], #start');
      if (trigger && !trigger.disabled) trigger.click();
      else location.reload();
    }

    const badge = document.createElement('button');
    badge.type = 'button'; badge.className = 'game-record-badge'; badge.addEventListener('click', showPanel); document.body.append(badge);
    const dialog = document.createElement('dialog');
    dialog.className = 'game-record-dialog';
    dialog.innerHTML = '<h2>Records et statistiques</h2><div data-record-content></div><div class="record-actions"><button type="button" data-export>Exporter</button><button type="button" data-close>Fermer</button></div>';
    dialog.querySelector('[data-export]').addEventListener('click', exportData);
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    document.body.append(dialog);
    const resultDialog = document.createElement('dialog');
    resultDialog.className = 'game-result-dialog';
    resultDialog.innerHTML = '<h2 data-result-title>Partie terminée</h2><p data-result-summary></p><p>Voulez-vous continuer avec une nouvelle partie ?</p><div class="record-actions"><button type="button" data-replay>Oui, rejouer</button><button type="button" data-result-close>Non, voir le plateau</button></div>';
    resultDialog.querySelector('[data-replay]').addEventListener('click', replay);
    resultDialog.querySelector('[data-result-close]').addEventListener('click', () => resultDialog.close?.());
    document.body.append(resultDialog);
    const style = document.createElement('style');
    style.textContent = '.game-record-badge{position:fixed;z-index:9000;right:max(14px,env(safe-area-inset-right));bottom:max(14px,env(safe-area-inset-bottom));padding:8px 11px;border:1px solid #64748b;border-radius:999px;background:#fff;color:#17243a;box-shadow:0 5px 18px #0003;font:700 12px Arial,sans-serif}.game-record-badge small{display:block;font-size:9px;font-weight:400}.game-record-dialog,.game-result-dialog{max-width:min(680px,calc(100vw - 28px));max-height:calc(100dvh - 28px);overflow:auto;overscroll-behavior:contain;padding:18px;border:1px solid #64748b;border-radius:14px;background:#fff;color:#17243a;box-shadow:0 16px 45px #0008}.game-result-dialog{width:min(430px,calc(100vw - 28px));text-align:center}.game-record-dialog::backdrop,.game-result-dialog::backdrop{background:#0f172a99;backdrop-filter:blur(3px)}.game-record-dialog li{margin:7px 0;overflow-wrap:anywhere}.record-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}.game-result-dialog .record-actions{justify-content:center}.game-result-dialog [data-replay]{background:#0f766e;color:#fff}@media(max-width:520px){.game-record-badge{max-width:42vw}.record-actions>button{flex:1 1 130px}}@media(prefers-color-scheme:dark){.game-record-badge,.game-record-dialog,.game-result-dialog{background:#1e293b;color:#f8fafc}}';
    document.head.append(style);
    document.querySelectorAll('#newGame, #reset, [data-new-game]').forEach(button => button.addEventListener('click', reset));
    document.addEventListener('click', event => {
      const button = event.target.closest('button,[role="button"]');
      if (!button || button.matches('.game-record-badge,[data-replay],[data-result-close]')) return;
      if (/^(nouvelle (partie|manche|grille)|recommencer|réinitialiser)$/i.test(button.textContent.trim())) reset();
    }, true);
    document.addEventListener('change', event => { if (event.target.matches('select, input[type="checkbox"], input[type="radio"]')) reset(); });
    // Les jeux récents déclarent explicitement leur résultat. L’ancien détecteur
    // textuel interprétait des règles ou une trace de solveur comme une victoire.
    // Il reste disponible uniquement pour une page historique qui l’active volontairement.
    if (document.documentElement.dataset.legacyAutoFinish === 'true') {
      const observer = new MutationObserver(() => {
        if (finished) return;
        const text = document.body.innerText.toLowerCase();
        if (!/(vous gagnez|vous avez gagné|partie terminée|grille complétée|résolu|victoire|mahjong !)/.test(text)) return;
        const scoreMatch = text.match(/(?:score|points?)\s*[:·]?\s*(-?\d+)/i);
        const lost = /(vous avez perdu|vous perdez|défaite|le bot gagne|bot \d* gagne|mine explosée|partie perdue)/.test(text);
        finish(scoreMatch ? { score: Number(scoreMatch[1]), scoreLabel: `${scoreMatch[1]} points`, won: !lost } : { won: !lost });
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    window.GameRecords = { finish, reset, render, key: recordKey, exportData, showPanel };
    reset();
  })();
}
