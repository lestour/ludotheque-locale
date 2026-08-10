(() => {
  const storageKey = 'game-hub:records';
  const pageId = location.pathname.split('/').pop().replace('.html', '') || 'hub';
  let startedAt = performance.now();
  let finished = false;
  function settings() { return [...document.querySelectorAll('select, input[type="checkbox"], input[type="radio"]')].filter(control => control.id && !['errors', 'showErrors', 'sound'].includes(control.id)).map(control => `${control.id}=${control.type === 'checkbox' || control.type === 'radio' ? control.checked : control.value}`).sort().join('&') || 'default'; }
  function read() { try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; } }
  function key() { return `${pageId}|${settings()}`; }
  function format(seconds) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
  function render() { const result = read()[key()]; badge.innerHTML = result ? `🏆 ${result.scoreLabel || format(result.time)}<small>${result.date}</small>` : '🏆 Aucun record'; badge.title = `Record pour : ${settings()}`; }
  function finish({ score = 0, scoreLabel = '', lowerIsBetter = false } = {}) { if (finished) return; finished = true; const time = Math.max(1, Math.round((performance.now() - startedAt) / 1000)); const entry = { score, scoreLabel, lowerIsBetter, time, date: new Date().toLocaleDateString('fr-FR') }; const all = read(); const old = all[key()]; const improved = !old || (scoreLabel ? (lowerIsBetter ? score < old.score : score > old.score) : time < old.time); if (improved) { all[key()] = entry; try { localStorage.setItem(storageKey, JSON.stringify(all)); } catch {} } render(); }
  function reset() { startedAt = performance.now(); finished = false; window.setTimeout(render); }
  const badge = document.createElement('button'); badge.type = 'button'; badge.className = 'game-record-badge'; badge.addEventListener('click', render); document.body.append(badge);
  const style = document.createElement('style'); style.textContent = '.game-record-badge{position:fixed;z-index:9000;right:14px;bottom:14px;padding:8px 11px;border:1px solid #64748b;border-radius:999px;background:#fff;color:#17243a;box-shadow:0 5px 18px #0003;font:700 12px Arial,sans-serif}.game-record-badge small{display:block;font-size:9px;font-weight:400}@media(prefers-color-scheme:dark){.game-record-badge{background:#1e293b;color:#f8fafc}}'; document.head.append(style);
  document.querySelectorAll('#newGame, #reset, [data-new-game]').forEach(button => button.addEventListener('click', reset));
  document.addEventListener('change', event => { if (event.target.matches('select, input[type="checkbox"], input[type="radio"]')) reset(); });
  const observer = new MutationObserver(() => { if (finished) return; const text = document.body.innerText.toLowerCase(); if (!/(vous gagnez|vous avez gagné|partie terminée|grille complétée|résolu|victoire)/.test(text)) return; const scoreMatch = text.match(/(?:score|points?)\s*[:·]?\s*(-?\d+)/i); finish(scoreMatch ? { score: Number(scoreMatch[1]), scoreLabel: `${scoreMatch[1]} points` } : {}); });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.GameRecords = { finish, reset, render, key };
  render();
})();
