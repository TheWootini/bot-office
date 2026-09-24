'use strict';

/**
 * Bot Office — cozy sprite stage
 * Positions are % of the room (left/top of character anchor near feet).
 */

const DESK_SPOTS = {
  ceo: { x: 34, y: 62 },
  'ceo-f': { x: 44, y: 60 },
  'game-maker': { x: 54, y: 62 },
  'game-artist': { x: 22, y: 58 },
  helen: { x: 68, y: 60 },
};

const COFFEE_SPOTS = [
  { x: 78, y: 66 },
  { x: 84, y: 62 },
  { x: 74, y: 70 },
  { x: 88, y: 68 },
  { x: 80, y: 72 },
];

const WANDER_SPOTS = [
  { x: 18, y: 72 },
  { x: 28, y: 78 },
  { x: 42, y: 74 },
  { x: 50, y: 80 },
  { x: 60, y: 72 },
  { x: 70, y: 76 },
  { x: 38, y: 68 },
  { x: 48, y: 66 },
  { x: 15, y: 64 },
  { x: 62, y: 58 },
];

const IDLE_LINES = {
  ceo: [
    'Status: all systems cozy.',
    'BookLooky sync looks green.',
    'Anyone need a briefing?',
    'I filed the vibes under A+.',
  ],
  'ceo-f': [
    'Marketing mood: warm.',
    'Campaign draft looks soft.',
    'Shall we sync?',
    'Clipboard synced.',
  ],
  'game-maker': [
    'What if the next level is… soft?',
    'Prototyping a tiny quest.',
    'Hitboxes? More like hugboxes.',
    'Ship when it feels warm.',
  ],
  'game-artist': [
    'Palette check: peach & sage.',
    'Adding one more plant…',
    'Shadows should feel buttery.',
    'Pixel dust, but make it cozy.',
  ],
  helen: [
    "Helen's Game says hi!",
    'High score: being kind.',
    'Ready when you are.',
    'Coffee first, then levels.',
  ],
};

const MEET_LINES = [
  ['Got a minute?', 'Always.'],
  ['Quick sync?', 'Love that.'],
  ['Idea brewing…', 'Spill it!'],
  ['Shall we?', 'High five energy.'],
];

const SEPARATION_MIN = 7.2; // % distance to keep between characters
const WALK_MS = 2800;

const state = {
  characters: [],
  nodes: new Map(),
  toastTimer: null,
  meetBusy: false,
  meetTimers: [],
};

function hsl(h, s, l, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function wait(ms) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    state.meetTimers.push(t);
  });
}

function clearMeetTimers() {
  for (const t of state.meetTimers) clearTimeout(t);
  state.meetTimers = [];
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  el.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    el.classList.remove('show');
  }, 2200);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createCharElement(ch) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'char';
  el.dataset.id = ch.id;
  el.setAttribute('aria-label', `${ch.name}, ${ch.title}`);

  const hue = ch.hue ?? 200;
  el.style.setProperty('--blob-a', hsl(hue, 55, 72));
  el.style.setProperty('--blob-b', hsl((hue + 28) % 360, 48, 58));

  el.innerHTML = `
    <div class="bubble" aria-live="polite"></div>
    <div class="char-inner">
      <div class="sprite">
        <div class="placeholder">
          <div class="placeholder-face">
            <span class="initials">${escapeHtml(ch.initials || '?')}</span>
            <div class="dots" aria-hidden="true"><span></span><span></span></div>
          </div>
        </div>
      </div>
      <div class="nameplate">
        <span class="name">${escapeHtml(ch.name)}</span>
        <span class="title">${escapeHtml(ch.title)}</span>
      </div>
    </div>
  `;

  el.addEventListener('click', () => onCharClick(ch.id));
  return el;
}

function setPosition(node, x, y, { fast = false, walking = true, separate = true } = {}) {
  let nx = clamp(x, 10, 92);
  let ny = clamp(y, 50, 84);

  const prev = node.pos;
  if (prev) {
    const dx = nx - prev.x;
    if (Math.abs(dx) > 0.5) {
      node.facing = dx < 0 ? 'left' : 'right';
    }
  }

  node.pos = { x: nx, y: ny };
  node.el.style.left = `${nx}%`;
  node.el.style.top = `${ny}%`;
  node.el.classList.toggle('is-fast', fast);
  node.el.classList.toggle('is-walking', walking && !fast);
  node.el.classList.toggle('facing-left', node.facing === 'left');
  node.el.style.zIndex = String(10 + Math.round(ny));

  if (separate) {
    requestAnimationFrame(() => separateOverlaps(node.id));
  }
}

function setMode(node, mode) {
  node.mode = mode;
  node.el.classList.toggle('is-sitting', mode === 'work' || mode === 'sit');
  node.el.classList.toggle('is-talking', mode === 'talk');
  node.el.classList.toggle('is-walking', mode === 'walk');
  node.el.classList.toggle('is-celebrating', mode === 'celebrate');
  applyVisual(node);
}

function clearMedia(sprite) {
  sprite.querySelectorAll('img, video').forEach((n) => n.remove());
}

function resolveVideoSrc(assets, mode) {
  if (!assets) return null;
  if (mode === 'walk' && assets.walk) return assets.walk;
  if ((mode === 'work' || mode === 'sit') && (assets.work || assets.sit)) return assets.work || assets.sit;
  if (mode === 'talk' && assets.talk) return assets.talk;
  if (mode === 'idle' && assets.idle) return assets.idle;
  if (mode === 'highfive' && assets['movie-highfive']) return assets['movie-highfive'];
  if (mode === 'celebrate' && assets['movie-highfive']) return assets['movie-highfive'];
  return null;
}

function applyVisual(node) {
  const { el, data, mode } = node;
  const sprite = el.querySelector('.sprite');
  const placeholder = sprite.querySelector('.placeholder');
  const assets = data.assets || {};

  const videoSrc = resolveVideoSrc(assets, mode);
  const stillSrc = assets.still || null;

  clearMedia(sprite);

  if (videoSrc) {
    const v = document.createElement('video');
    v.src = videoSrc;
    v.muted = true;
    v.loop = mode !== 'highfive' && mode !== 'celebrate';
    v.playsInline = true;
    v.autoplay = true;
    v.setAttribute('playsinline', '');
    v.addEventListener('error', () => {
      v.remove();
      if (stillSrc) showStill(sprite, placeholder, stillSrc);
      else if (placeholder) placeholder.hidden = false;
    });
    if (placeholder) placeholder.hidden = true;
    sprite.appendChild(v);
    v.play().catch(() => {});
    return;
  }

  if (stillSrc) {
    showStill(sprite, placeholder, stillSrc);
    return;
  }

  if (placeholder) placeholder.hidden = false;
}

function showStill(sprite, placeholder, src) {
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.draggable = false;
  img.addEventListener('error', () => {
    img.remove();
    if (placeholder) placeholder.hidden = false;
  });
  if (placeholder) placeholder.hidden = true;
  sprite.appendChild(img);
}

function showBubble(node, text, ms = 3200) {
  const bubble = node.el.querySelector('.bubble');
  bubble.textContent = text;
  bubble.classList.add('show');
  clearTimeout(node.bubbleTimer);
  node.bubbleTimer = setTimeout(() => {
    bubble.classList.remove('show');
    if (node.mode === 'talk' && !node.inMeet) {
      setMode(node, node.afterTalk || 'idle');
    }
  }, ms);
}

function hideBubble(node) {
  const bubble = node.el.querySelector('.bubble');
  bubble.classList.remove('show');
  clearTimeout(node.bubbleTimer);
}

/** Push overlapping characters apart (simple pairwise separation). */
function separateOverlaps(priorityId) {
  const nodes = [...state.nodes.values()].filter((n) => n.pos);
  if (nodes.length < 2) return;

  // A few iterations for stability
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        if (a.locked || b.locked) {
          // only nudge the unlocked one
        }
        const dx = b.pos.x - a.pos.x;
        const dy = (b.pos.y - a.pos.y) * 1.35; // y feels tighter visually
        const dist = Math.hypot(dx, dy) || 0.001;
        if (dist >= SEPARATION_MIN) continue;

        const push = (SEPARATION_MIN - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;

        const moveA = !a.locked && (priorityId !== b.id || a.locked === false);
        const moveB = !b.locked;

        if (a.locked && b.locked) continue;

        if (!a.locked && !b.locked) {
          a.pos.x = clamp(a.pos.x - ux * push, 10, 92);
          a.pos.y = clamp(a.pos.y - (uy * push) / 1.35, 50, 84);
          b.pos.x = clamp(b.pos.x + ux * push, 10, 92);
          b.pos.y = clamp(b.pos.y + (uy * push) / 1.35, 50, 84);
        } else if (a.locked && !b.locked) {
          b.pos.x = clamp(b.pos.x + ux * push * 2, 10, 92);
          b.pos.y = clamp(b.pos.y + (uy * push * 2) / 1.35, 50, 84);
        } else if (!a.locked && b.locked) {
          a.pos.x = clamp(a.pos.x - ux * push * 2, 10, 92);
          a.pos.y = clamp(a.pos.y - (uy * push * 2) / 1.35, 50, 84);
        }

        applyPosDom(a);
        applyPosDom(b);
      }
    }
  }
}

function applyPosDom(node) {
  node.el.style.left = `${node.pos.x}%`;
  node.el.style.top = `${node.pos.y}%`;
  node.el.style.zIndex = String(10 + Math.round(node.pos.y));
}

async function poke(id) {
  try {
    await fetch('/api/poke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  } catch (err) {
    console.warn('poke failed', err);
  }
}

function onCharClick(id) {
  if (state.meetBusy) return;
  const node = state.nodes.get(id);
  if (!node) return;
  const lines = IDLE_LINES[id] || ['Hello!'];
  node.afterTalk = node.mode === 'walk' ? 'walk' : node.mode === 'work' || node.mode === 'sit' ? 'work' : 'idle';
  setMode(node, 'talk');
  showBubble(node, pick(lines));
  poke(id);
}

function scheduleWork(node, delay) {
  clearTimeout(node.arriveTimer);
  node.arriveTimer = setTimeout(() => {
    if (node.inMeet) return;
    setMode(node, 'work');
    node.el.classList.remove('is-walking', 'is-fast');
  }, delay);
}

function goToDesks() {
  if (state.meetBusy) return;
  for (const [id, node] of state.nodes) {
    const spot = DESK_SPOTS[id] || { x: 50, y: 70 };
    clearTimeout(node.arriveTimer);
    setMode(node, 'walk');
    setPosition(node, spot.x, spot.y, { walking: true });
    scheduleWork(node, WALK_MS);
  }
  showToast('Everyone to desks');
}

function wanderAll() {
  if (state.meetBusy) return;
  const spots = shuffle(WANDER_SPOTS);
  let i = 0;
  for (const [, node] of state.nodes) {
    const spot = spots[i % spots.length];
    i += 1;
    clearTimeout(node.arriveTimer);
    setMode(node, 'walk');
    setPosition(node, spot.x + (Math.random() * 4 - 2), spot.y + (Math.random() * 3 - 1.5), {
      walking: true,
    });
    node.arriveTimer = setTimeout(() => {
      if (node.inMeet) return;
      node.el.classList.remove('is-walking');
      setMode(node, 'idle');
    }, 2900);
  }
  showToast('Wander time');
}

function coffeeBreak() {
  if (state.meetBusy) return;
  const spots = shuffle(COFFEE_SPOTS);
  let i = 0;
  for (const [, node] of state.nodes) {
    const spot = spots[i % spots.length];
    i += 1;
    clearTimeout(node.arriveTimer);
    setMode(node, 'walk');
    setPosition(node, spot.x + (Math.random() * 2 - 1), spot.y + (Math.random() * 2 - 1), {
      walking: true,
    });
    node.arriveTimer = setTimeout(() => {
      if (node.inMeet) return;
      node.el.classList.remove('is-walking');
      setMode(node, 'idle');
      showBubble(node, pick(['Mmm, warm.', 'Refill?', 'Take a break ♥', 'Sip sip.']), 2400);
    }, 2700 + i * 120);
  }
  showToast('Coffee break');
}

function midpointFor(a, b) {
  const mx = (a.pos.x + b.pos.x) / 2;
  const my = (a.pos.y + b.pos.y) / 2;
  // Prefer open floor center-ish if desks are too close to walls
  return {
    x: clamp(mx || 48, 28, 72),
    y: clamp(my || 72, 66, 78),
  };
}

async function runMeet(idA, idB) {
  if (state.meetBusy) return;
  const a = state.nodes.get(idA);
  const b = state.nodes.get(idB);
  if (!a || !b || idA === idB) {
    showToast('Pick two different bots');
    return;
  }

  state.meetBusy = true;
  clearMeetTimers();
  const meetBtn = document.getElementById('btn-meet');
  if (meetBtn) meetBtn.disabled = true;

  const nameA = a.data.name;
  const nameB = b.data.name;
  showToast(`${nameA} × ${nameB} meet`);

  // Cancel ambient timers
  clearTimeout(a.arriveTimer);
  clearTimeout(b.arriveTimer);
  hideBubble(a);
  hideBubble(b);

  a.inMeet = true;
  b.inMeet = true;
  a.locked = false;
  b.locked = false;

  // 1) Leave desks → walk toward midpoint (stand slightly apart)
  const mid = midpointFor(a, b);
  const offset = 4.2;
  setMode(a, 'walk');
  setMode(b, 'walk');
  setPosition(a, mid.x - offset, mid.y, { walking: true, separate: false });
  setPosition(b, mid.x + offset, mid.y, { walking: true, separate: false });

  // Face each other
  a.facing = 'right';
  b.facing = 'left';
  a.el.classList.toggle('facing-left', false);
  b.el.classList.toggle('facing-left', true);

  await wait(WALK_MS + 100);

  a.el.classList.remove('is-walking');
  b.el.classList.remove('is-walking');

  // 2) Talk bubbles + talk anim
  const [lineA, lineB] = pick(MEET_LINES);
  setMode(a, 'talk');
  setMode(b, 'talk');
  showBubble(a, lineA, 2800);
  await wait(700);
  showBubble(b, lineB, 2600);
  await wait(2600);

  hideBubble(a);
  hideBubble(b);

  // 3) High-five movie / celebrate bounce
  const hasHfA = a.data.assets && a.data.assets['movie-highfive'];
  const hasHfB = b.data.assets && b.data.assets['movie-highfive'];

  if (hasHfA || hasHfB) {
    if (hasHfA) setMode(a, 'highfive');
    else setMode(a, 'celebrate');
    if (hasHfB) setMode(b, 'highfive');
    else setMode(b, 'celebrate');
  } else {
    setMode(a, 'celebrate');
    setMode(b, 'celebrate');
  }
  a.el.classList.add('is-celebrating');
  b.el.classList.add('is-celebrating');
  showBubble(a, 'High five!', 1800);
  showBubble(b, 'Yes!', 1800);
  await wait(2200);

  a.el.classList.remove('is-celebrating');
  b.el.classList.remove('is-celebrating');
  hideBubble(a);
  hideBubble(b);

  // 4) Return to desks → work/idle
  const deskA = DESK_SPOTS[idA] || { x: 40, y: 65 };
  const deskB = DESK_SPOTS[idB] || { x: 55, y: 65 };
  setMode(a, 'walk');
  setMode(b, 'walk');
  setPosition(a, deskA.x, deskA.y, { walking: true });
  setPosition(b, deskB.x, deskB.y, { walking: true });
  await wait(WALK_MS + 100);

  a.inMeet = false;
  b.inMeet = false;
  setMode(a, 'work');
  setMode(b, 'work');
  a.el.classList.remove('is-walking', 'is-fast');
  b.el.classList.remove('is-walking', 'is-fast');

  state.meetBusy = false;
  if (meetBtn) meetBtn.disabled = false;
  showToast('Back to desks');
}

function populateMeetSelects(characters) {
  const selA = document.getElementById('meet-a');
  const selB = document.getElementById('meet-b');
  if (!selA || !selB) return;

  const fill = (sel, prefer) => {
    const prev = sel.value;
    sel.innerHTML = '';
    for (const ch of characters) {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = ch.name;
      sel.appendChild(opt);
    }
    if (prefer && characters.some((c) => c.id === prefer)) sel.value = prefer;
    else if (prev && characters.some((c) => c.id === prev)) sel.value = prev;
  };

  fill(selA, 'ceo');
  fill(selB, characters.some((c) => c.id === 'ceo-f') ? 'ceo-f' : characters[1]?.id);
}

function mountCharacters(characters) {
  const root = document.getElementById('chars');
  root.innerHTML = '';
  state.nodes.clear();
  state.characters = characters;

  characters.forEach((ch, index) => {
    const el = createCharElement(ch);
    root.appendChild(el);
    const desk = DESK_SPOTS[ch.id] || { x: 30 + index * 12, y: 65 };
    const node = {
      id: ch.id,
      el,
      data: ch,
      pos: null,
      mode: 'idle',
      facing: 'right',
      bubbleTimer: null,
      arriveTimer: null,
      afterTalk: 'idle',
      inMeet: false,
      locked: false,
    };
    state.nodes.set(ch.id, node);
    setPosition(node, desk.x + 8, desk.y + 10, { fast: true, walking: false, separate: false });
    requestAnimationFrame(() => {
      setPosition(node, desk.x, desk.y, { walking: true });
      scheduleWork(node, 2200 + index * 180);
    });
    applyVisual(node);
  });

  populateMeetSelects(characters);
  // Initial separation pass after settle
  setTimeout(() => separateOverlaps(null), 400);
}

async function loadCast() {
  const res = await fetch('/api/cast');
  if (!res.ok) throw new Error('cast fetch failed');
  return res.json();
}

function startIdleWander() {
  setInterval(() => {
    if (state.meetBusy) return;
    for (const [, node] of state.nodes) {
      if (node.mode !== 'idle') continue;
      if (Math.random() > 0.35) continue;
      const jx = node.pos.x + (Math.random() * 2.4 - 1.2);
      const jy = node.pos.y + (Math.random() * 1.6 - 0.8);
      setPosition(node, clamp(jx, 12, 90), clamp(jy, 52, 82), { walking: false, fast: false });
    }
  }, 5200);
}

function startCollisionLoop() {
  setInterval(() => {
    if (state.nodes.size < 2) return;
    separateOverlaps(null);
  }, 900);
}

function wireButtons() {
  document.getElementById('btn-wander').addEventListener('click', wanderAll);
  document.getElementById('btn-desks').addEventListener('click', goToDesks);
  document.getElementById('btn-coffee').addEventListener('click', coffeeBreak);

  const meetBtn = document.getElementById('btn-meet');
  if (meetBtn) {
    meetBtn.addEventListener('click', () => {
      const a = document.getElementById('meet-a')?.value;
      const b = document.getElementById('meet-b')?.value;
      runMeet(a, b);
    });
  }

  const quick = document.getElementById('btn-meet-quick');
  if (quick) {
    quick.addEventListener('click', () => {
      const a = state.nodes.has('ceo') ? 'ceo' : state.characters[0]?.id;
      const b = state.nodes.has('ceo-f')
        ? 'ceo-f'
        : state.characters.find((c) => c.id !== a)?.id;
      if (a && b) {
        const selA = document.getElementById('meet-a');
        const selB = document.getElementById('meet-b');
        if (selA) selA.value = a;
        if (selB) selB.value = b;
        runMeet(a, b);
      }
    });
  }
}

function pollAssets() {
  setInterval(async () => {
    try {
      const data = await loadCast();
      if (data.room) {
        const img = document.getElementById('room-bg');
        if (img.src !== new URL(data.room, location.origin).href) {
          img.src = data.room;
        }
      }
      const chars = data.characters || [];
      // Remount if cast membership changed
      const ids = chars.map((c) => c.id).join(',');
      const prevIds = state.characters.map((c) => c.id).join(',');
      if (ids !== prevIds) {
        if (!state.meetBusy) mountCharacters(chars);
        return;
      }
      for (const ch of chars) {
        const node = state.nodes.get(ch.id);
        if (!node) continue;
        const prev = JSON.stringify(node.data.assets);
        const next = JSON.stringify(ch.assets);
        if (prev !== next) {
          node.data = ch;
          applyVisual(node);
        }
      }
    } catch {
      /* ignore transient poll errors */
    }
  }, 4000);
}

async function init() {
  wireButtons();
  const data = await loadCast();
  const bg = document.getElementById('room-bg');
  bg.src = data.room || '/assets/office-room.png';
  bg.onerror = () => {
    bg.style.display = 'none';
  };
  mountCharacters(data.characters || []);
  startIdleWander();
  startCollisionLoop();
  pollAssets();
}

init().catch((err) => {
  console.error(err);
  showToast('Could not load office');
});
