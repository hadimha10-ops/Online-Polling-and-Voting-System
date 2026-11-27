// ---------- Data ----------
const POLLS_KEY = 'quickpoll:polls';
const VOTES_KEY = 'quickpoll:myvotes';

let polls = [];
let myVotes = {};   // pollId -> index of the option I voted for

function load() {
  try { polls = JSON.parse(localStorage.getItem(POLLS_KEY)) || []; } catch (e) { polls = []; }
  try { myVotes = JSON.parse(localStorage.getItem(VOTES_KEY)) || {}; } catch (e) { myVotes = {}; }

  if (polls.length === 0) {
    polls = [{
      id: 'p1',
      q: 'Which front-end language do you use most?',
      opts: [
        { t: 'JavaScript', v: 12 },
        { t: 'TypeScript', v: 9 },
        { t: 'Python (backend)', v: 4 }
      ]
    }];
  }
}

function save() {
  try {
    localStorage.setItem(POLLS_KEY, JSON.stringify(polls));
    localStorage.setItem(VOTES_KEY, JSON.stringify(myVotes));
  } catch (e) {}
}

// ---------- Helpers ----------
const $ = id => document.getElementById(id);
const findPoll = id => polls.find(p => p.id === id);
const totalVotes = poll => poll.opts.reduce((sum, o) => sum + o.v, 0);
const plural = n => (n === 1 ? '' : 's');

// Prevents user text from being treated as HTML
function esc(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ---------- Create-poll form ----------
function addOptionInput() {
  const n = $('opts').children.length + 1;
  const row = document.createElement('div');
  row.className = 'opt';
  row.innerHTML = `
    <input type="text" maxlength="80" placeholder="Option ${n}" aria-label="Option ${n}">
    <button class="ghost" title="Remove" aria-label="Remove option">✕</button>`;
  row.querySelector('button').onclick = () => {
    if ($('opts').children.length > 2) row.remove();   // keep at least 2
  };
  $('opts').appendChild(row);
}

function resetForm() {
  $('q').value = '';
  $('opts').innerHTML = '';
  addOptionInput();
  addOptionInput();
}

$('addOpt').onclick = () => {
  if ($('opts').children.length < 8) addOptionInput();   // max 8
};

$('create').onclick = () => {
  const question = $('q').value.trim();
  const inputs = Array.from($('opts').querySelectorAll('input'));
  const values = inputs.map(i => i.value.trim()).filter(v => v !== '');
  const options = [...new Set(values)];                  // remove duplicates

  if (!question) { $('err').textContent = 'Please enter a question.'; return; }
  if (options.length < 2) { $('err').textContent = 'Add at least two different options.'; return; }

  $('err').textContent = '';
  polls.unshift({
    id: 'p' + Date.now(),
    q: question,
    opts: options.map(t => ({ t: t, v: 0 }))
  });
  save();
  resetForm();
  render();
};

// ---------- Showing the polls ----------
function pollHtml(poll) {
  const total = totalVotes(poll);
  const myChoice = myVotes[poll.id];
  const hasVoted = myChoice !== undefined;

  const optionsHtml = poll.opts.map((o, i) => {
    if (!hasVoted) {
      return `<button class="choice" data-vote="${poll.id}" data-i="${i}">${esc(o.t)}</button>`;
    }
    const pct = total ? Math.round(o.v / total * 100) : 0;
    const mine = myChoice === i;
    return `
      <div class="res${mine ? ' mine' : ''}">
        <div class="fill" style="width:${pct}%"></div>
        <span>${esc(o.t)}${mine ? ' ✓' : ''}</span>
        <span>${pct}% · ${o.v}</span>
      </div>`;
  }).join('');

  const footer = hasVoted
    ? ` · <button class="ghost" data-undo="${poll.id}">Change vote</button>`
    : ' · Pick an option to see results';

  return `
    <div class="card">
      <div class="poll-head">
        <p class="poll-q">${esc(poll.q)}</p>
        <div>
          <button class="ghost" data-sim="${poll.id}" title="Simulate another person voting">+ Simulate voter</button>
          <button class="ghost danger" data-del="${poll.id}" title="Delete poll">Delete</button>
        </div>
      </div>
      ${optionsHtml}
      <div class="meta">${total} vote${plural(total)}${footer}</div>
    </div>`;
}

function render() {
  renderCharts();
  $('polls').innerHTML = polls.length
    ? polls.map(pollHtml).join('')
    : '<div class="empty">No polls yet. Create the first one above!</div>';
}

// One click listener handles every button inside the poll list
$('polls').addEventListener('click', e => {
  const d = e.target.dataset;

  if (d.vote) {                                   // vote
    const poll = findPoll(d.vote);
    if (poll && myVotes[poll.id] === undefined) {
      poll.opts[+d.i].v++;
      myVotes[poll.id] = +d.i;
    }
  } else if (d.undo) {                            // change vote
    const poll = findPoll(d.undo);
    if (poll && myVotes[poll.id] !== undefined) {
      const opt = poll.opts[myVotes[poll.id]];
      opt.v = Math.max(0, opt.v - 1);
      delete myVotes[poll.id];
    }
  } else if (d.sim) {                             // simulate one voter
    simVote(d.sim);
    return;
  } else if (d.del) {                             // delete poll
    if (!confirm('Delete this poll?')) return;
    polls = polls.filter(p => p.id !== d.del);
    delete myVotes[d.del];
  } else {
    return;
  }

  save();
  render();
});

// ---------- Bar graph (SVG) ----------
function chartSvg(poll) {
  const W = 600, H = 240, L = 36, R = 10, T = 22, B = 44;
  const plotH = H - T - B;
  const slot = (W - L - R) / poll.opts.length;
  const barW = Math.min(56, slot * 0.6);

  const max = Math.max(...poll.opts.map(o => o.v));
  const step = Math.ceil(max / 4) || 1;     // y-axis step
  const top = step * 4;
  const total = totalVotes(poll);

  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar graph for ${esc(poll.q)}">`;

  // horizontal grid lines + y-axis numbers
  for (let k = 0; k <= 4; k++) {
    const y = T + plotH - (k / 4) * plotH;
    svg += `<line class="g" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/>`;
    svg += `<text class="t" x="${L - 6}" y="${y + 4}" text-anchor="end">${k * step}</text>`;
  }

  // one bar per option
  poll.opts.forEach((o, i) => {
    const h = (o.v / top) * plotH;
    const x = L + slot * i + (slot - barW) / 2;
    const y = T + plotH - h;
    const cx = x + barW / 2;
    const label = o.t.length > 11 ? o.t.slice(0, 10) + '…' : o.t;

    svg += `<rect class="b" x="${x}" y="${y}" width="${barW}" height="${h}" rx="4"><title>${esc(o.t)}: ${o.v}</title></rect>`;
    svg += `<text class="v" x="${cx}" y="${y - 5}" text-anchor="middle">${o.v}</text>`;
    svg += `<text class="t" x="${cx}" y="${H - B + 16}" text-anchor="middle">${esc(label)}</text>`;
  });

  return `
    <div class="chart">
      <h3>${esc(poll.q)} <span style="color:var(--muted);font-weight:400">· ${total} vote${plural(total)}</span></h3>
      ${svg}</svg>
    </div>`;
}

function renderCharts() {
  $('charts').innerHTML = polls.length
    ? `<div class="card"><h2>Results graph (all polls)</h2>${polls.map(chartSvg).join('')}</div>`
    : '';
}

// ---------- Simulated voters ----------
let guestNumber = 1;
let autoTimer = null;
let logLines = [];

function simVote(pollId) {
  const poll = findPoll(pollId);
  if (!poll) return;

  // Pick an option at random; popular options are slightly more likely
  const weights = poll.opts.map(o => o.v + 1);
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  let pick = 0;
  while (pick < weights.length - 1 && r >= weights[pick]) {
    r -= weights[pick];
    pick++;
  }
  poll.opts[pick].v++;

  // Show the latest 4 simulated votes
  guestNumber++;
  const shortQ = poll.q.length > 40 ? poll.q.slice(0, 40) + '…' : poll.q;
  logLines.unshift(`Guest ${guestNumber} voted “${poll.opts[pick].t}” in “${shortQ}”`);
  logLines = logLines.slice(0, 4);
  $('log').innerHTML = logLines.map(line => `<div>${esc(line)}</div>`).join('');

  save();
  render();
}

function simRandomVote() {
  if (polls.length === 0) return;
  simVote(polls[Math.floor(Math.random() * polls.length)].id);
}

$('auto').onclick = () => {
  const btn = $('auto');
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
    btn.classList.remove('on');
    btn.textContent = '▶ Auto-simulate other voters';
  } else {
    autoTimer = setInterval(simRandomVote, 1500);
    btn.classList.add('on');
    btn.textContent = '⏸ Stop simulating';
  }
};

$('burst').onclick = () => {
  for (let k = 0; k < 10; k++) simRandomVote();
};

// ---------- Start ----------
load();
resetForm();
render();
