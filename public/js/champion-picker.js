/* ==========================================================
   CHAMPION PICKER + DRAG & DROP PARA DRAFT
   ========================================================== */
import { state, CHAMPS, esc, saveToFirebase } from './state.js';
import { champIconName } from './riot-api.js';
import { toastIcon } from './ui.js';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const DDRAGON_VERSION = '15.20.1';
const DDRAGON = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}`;

function iconUrl(name) {
  return `${DDRAGON}/img/champion/${champIconName(name)}.png`;
}

function saveAndRender() {
  saveToFirebase().catch(e => console.warn('Save falhou:', e));
  document.dispatchEvent(new CustomEvent('aki:rerender'));
}

function closePicker() {
  $('#modal-root').innerHTML = '';
  document.removeEventListener('keydown', escHandler);
}

function escHandler(e) { if (e.key === 'Escape') closePicker(); }

/* ═══════════════════════════════════════
   ABRIR PICKER
   ═══════════════════════════════════════ */
export function openChampionPicker(side, kind, idx) {
  const d = state.draft;

  // Campeões já usados em outros slots (não bloqueia o próprio slot)
  const used = new Set();
  ['blue', 'red'].forEach(s => {
    ['bans', 'picks'].forEach(k => {
      d[s][k].forEach((champ, i) => {
        if (champ && !(s === side && k === kind && i === idx)) used.add(champ);
      });
    });
  });

  const sideLabel = side === 'blue' ? 'Lado Azul' : 'Lado Vermelho';
  const kindLabel = kind === 'bans' ? 'Ban' : 'Pick';

  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal read-modal picker-modal">
        <div class="modal-head">
          <i class="fa-solid fa-dragon" style="color:var(--primary)"></i>
          <h3>Escolher ${kindLabel} — ${sideLabel}</h3>
          <button class="icon-btn" data-close><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body read-body" style="padding:0 !important">
          <div class="champ-picker-search">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" id="champ-picker-input" placeholder="Buscar campeão..." autocomplete="off">
            <span class="champ-picker-count" id="champ-picker-count">${CHAMPS.length}</span>
          </div>
          <div class="champ-picker-grid" id="champ-picker-grid">
            ${CHAMPS.map(name => {
              const isUsed = used.has(name);
              return `<button type="button" class="champ-pick-item ${isUsed ? 'used' : ''}"
                              data-champ="${esc(name)}" ${isUsed ? 'disabled' : ''}
                              title="${esc(name)}${isUsed ? ' (já usado)' : ''}">
                <img src="${iconUrl(name)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
                <span>${esc(name)}</span>
              </button>`;
            }).join('')}
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn ghost" data-close>Fechar</button>
        </div>
      </div>
    </div>`;

  const backdrop = $('.modal-backdrop', root);
  backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) closePicker(); });
  $$('[data-close]', root).forEach(b => b.addEventListener('click', closePicker));
  document.addEventListener('keydown', escHandler);

  const input = document.getElementById('champ-picker-input');
  const grid = document.getElementById('champ-picker-grid');
  const counter = document.getElementById('champ-picker-count');

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    let visible = 0;
    grid.querySelectorAll('.champ-pick-item').forEach(item => {
      const name = (item.dataset.champ || '').toLowerCase();
      const match = !q || name.includes(q);
      item.style.display = match ? '' : 'none';
      if (match) visible++;
    });
    counter.textContent = visible;
  });

  grid.querySelectorAll('.champ-pick-item:not(.used)').forEach(item => {
    item.addEventListener('click', () => {
      pickChampion(side, kind, idx, item.dataset.champ);
      closePicker();
    });
  });

  setTimeout(() => input.focus(), 80);
}

/* ═══════════════════════════════════════
   APLICAR PICK EM UM SLOT
   ═══════════════════════════════════════ */
export function pickChampion(side, kind, idx, champ) {
  if (!state.draft[side]) state.draft[side] = { bans: ['','','','',''], picks: ['','','','',''] };

  // Bloqueia duplicata
  const used = [];
  ['blue', 'red'].forEach(s => {
    ['bans', 'picks'].forEach(k => {
      state.draft[s][k].forEach((c, i) => {
        if (c && !(s === side && k === kind && i === idx)) used.push(c);
      });
    });
  });
  if (used.includes(champ)) {
    toastIcon('Campeão já está no draft', 'fa-triangle-exclamation');
    return false;
  }

  state.draft[side][kind][idx] = champ;
  saveAndRender();
  toastIcon(`${champ} definido`, 'fa-dragon');
  return true;
}

export function clearDraftSlot(slot) {
  const [side, kind, idx] = slot.split('.');
  if (state.draft[side]?.[kind]) {
    state.draft[side][kind][+idx] = '';
    saveAndRender();
  }
}

/* ═══════════════════════════════════════
   TIMER
   ═══════════════════════════════════════ */
let _timerInterval = null;
let _timerValue = 30;

function updateTimerUI() {
  const el = document.getElementById('draft-timer-value');
  if (el) el.textContent = _timerValue;
  const wrap = document.getElementById('draft-timer');
  if (wrap) {
    wrap.classList.toggle('warning', _timerValue <= 10 && _timerValue > 5);
    wrap.classList.toggle('danger', _timerValue <= 5 && _timerValue > 0);
  }
}

export function startDraftTimer(seconds = 30) {
  stopDraftTimer();
  _timerValue = seconds;
  updateTimerUI();
  _timerInterval = setInterval(() => {
    _timerValue--;
    updateTimerUI();
    if (_timerValue <= 0) {
      stopDraftTimer();
      toastIcon('Tempo esgotado!', 'fa-clock');
    }
  }, 1000);
}

export function stopDraftTimer() {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
}

export function resetDraftTimer(seconds = 30) {
  stopDraftTimer();
  _timerValue = seconds;
  updateTimerUI();
}

/* ═══════════════════════════════════════
   DRAG & DROP
   ═══════════════════════════════════════ */
let _dragInited = false;

export function initDraftDragDrop() {
  if (_dragInited) return;
  _dragInited = true;

  // Iniciar arraste
  document.addEventListener('dragstart', e => {
    const sugg = e.target.closest('.draft-suggestion[draggable="true"]');
    if (!sugg) return;
    const champ = sugg.dataset.champ;
    if (!champ) return;
    e.dataTransfer.setData('text/plain', champ);
    e.dataTransfer.effectAllowed = 'copy';
    sugg.classList.add('dragging');
  });

  document.addEventListener('dragend', e => {
    document.querySelectorAll('.draft-suggestion.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.draft-slot.drag-over').forEach(el => el.classList.remove('drag-over'));
  });

  // Passar por cima do slot
  document.addEventListener('dragover', e => {
    const slot = e.target.closest('.draft-slot');
    if (!slot) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    document.querySelectorAll('.draft-slot.drag-over').forEach(el => {
      if (el !== slot) el.classList.remove('drag-over');
    });
    slot.classList.add('drag-over');
  });

  document.addEventListener('dragleave', e => {
    const slot = e.target.closest('.draft-slot');
    if (slot && !slot.contains(e.relatedTarget)) slot.classList.remove('drag-over');
  });

  // Soltar
  document.addEventListener('drop', e => {
    const slot = e.target.closest('.draft-slot');
    if (!slot) return;
    e.preventDefault();
    slot.classList.remove('drag-over');

    const champ = e.dataTransfer.getData('text/plain');
    if (!champ) return;

    const slotPath = slot.dataset.slot;
    if (!slotPath) return;

    const [side, kind, idx] = slotPath.split('.');
    pickChampion(side, kind, +idx);
  });
}