// State management
const state = {
  currentScreen: 'welcome',
  dilemmas: [],
  selectedDilemma: null,
  selectedSide: null,
  sessionId: null,
  debateInfo: null,
  currentTurn: 0,
  maxTurns: 3,
  isReplay: false
};

// DOM Elements
const screens = {
  welcome: document.getElementById('welcome-screen'),
  case: document.getElementById('case-screen'),
  side: document.getElementById('side-screen'),
  debate: document.getElementById('debate-screen'),
  verdict: document.getElementById('verdict-screen')
};

// Screen Navigation
function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenName].classList.add('active');
  state.currentScreen = screenName;
}

// Check if we're viewing a saved debate
async function checkForSavedDebate() {
  const path = window.location.pathname;
  const match = path.match(/^\/debate\/([a-zA-Z0-9_-]+)$/);

  if (match) {
    const debateId = match[1];
    try {
      const response = await fetch(`/api/debate/${debateId}`);
      if (response.ok) {
        const debate = await response.json();
        displaySavedDebate(debate);
        return true;
      }
    } catch (error) {
      console.error('Failed to load debate:', error);
    }
  }
  return false;
}

// Display a saved/completed debate
function displaySavedDebate(debate) {
  state.isReplay = true;
  state.sessionId = debate.id;
  state.debateInfo = {
    dilemma: debate.dilemma,
    aiSide: debate.aiSide
  };
  state.selectedSide = debate.playerSide;

  // Setup debate screen in replay mode
  document.getElementById('debate-title').textContent = debate.dilemma.title;
  document.getElementById('current-turn').textContent = debate.turns.length;
  document.getElementById('max-turns').textContent = '3';
  document.getElementById('your-side').textContent = capitalize(debate.playerSide);
  document.getElementById('ai-side').textContent = capitalize(debate.aiSide);

  // Build debate log
  const debateLog = document.getElementById('debate-log');
  debateLog.innerHTML = `
    <div class="context-box">
      <h4>Case Background</h4>
      <p>${debate.dilemma.description}</p>
      <p><strong>Legal Context:</strong> ${debate.dilemma.context}</p>
      <p><strong>Human Position (${capitalize(debate.playerSide)}):</strong> ${debate.dilemma.positions[debate.playerSide]}</p>
    </div>
    <div class="replay-badge">Viewing Saved Debate</div>
  `;

  // Add all turns
  debate.turns.forEach(turn => {
    const playerEntry = document.createElement('div');
    playerEntry.className = 'debate-entry player';
    playerEntry.innerHTML = `
      <div class="entry-header">Round ${turn.turn} - Human (${capitalize(debate.playerSide)})</div>
      <div class="entry-content">${escapeHtml(turn.player)}</div>
    `;
    debateLog.appendChild(playerEntry);

    if (turn.ai) {
      const aiEntry = document.createElement('div');
      aiEntry.className = 'debate-entry ai';
      aiEntry.innerHTML = `
        <div class="entry-header">Round ${turn.turn} - AI (${capitalize(debate.aiSide)})</div>
        <div class="entry-content">${escapeHtml(turn.ai)}</div>
      `;
      debateLog.appendChild(aiEntry);
    }
  });

  // Hide input area in replay mode
  document.getElementById('input-area').classList.add('hidden');
  document.getElementById('request-verdict').classList.add('hidden');

  // If verdict exists, show button to view it
  if (debate.verdict) {
    const viewVerdictBtn = document.createElement('button');
    viewVerdictBtn.className = 'btn btn-verdict';
    viewVerdictBtn.textContent = 'View Verdict';
    viewVerdictBtn.onclick = () => {
      renderVerdict(debate.verdict, true);
      showScreen('verdict');
    };
    debateLog.parentNode.appendChild(viewVerdictBtn);
  }

  showScreen('debate');
}

// Initialize
async function init() {
  const isSavedDebate = await checkForSavedDebate();
  if (!isSavedDebate) {
    showScreen('welcome');
  }
}

// Event Listeners
document.getElementById('start-btn').addEventListener('click', async () => {
  await loadDilemmas();
  showScreen('case');
});

document.getElementById('play-again').addEventListener('click', () => {
  resetGame();
  // Clear URL if we were viewing a saved debate
  if (window.location.pathname !== '/') {
    window.history.pushState({}, '', '/');
  }
  showScreen('welcome');
});

// Load dilemmas from API
async function loadDilemmas() {
  try {
    const response = await fetch('/api/dilemmas');
    state.dilemmas = await response.json();
    renderDilemmas();
  } catch (error) {
    console.error('Failed to load dilemmas:', error);
    alert('Failed to load cases. Please refresh the page.');
  }
}

// Render dilemmas list
function renderDilemmas() {
  const container = document.getElementById('cases-list');
  container.innerHTML = state.dilemmas.map(d => `
    <div class="case-card" data-id="${d.id}">
      <h3>${d.title}</h3>
      <p>${d.description.substring(0, 200)}...</p>
    </div>
  `).join('');

  // Add click handlers
  container.querySelectorAll('.case-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = parseInt(card.dataset.id);
      state.selectedDilemma = state.dilemmas.find(d => d.id === id);
      showSideSelection();
    });
  });
}

// Show side selection screen
function showSideSelection() {
  const preview = document.getElementById('case-preview');
  preview.innerHTML = `
    <h3>${state.selectedDilemma.title}</h3>
    <p>${state.selectedDilemma.description}</p>
  `;
  showScreen('side');
}

// Side selection handlers
document.querySelectorAll('.btn-side').forEach(btn => {
  btn.addEventListener('click', async () => {
    state.selectedSide = btn.dataset.side;
    await startDebate();
  });
});

// Start the debate
async function startDebate() {
  try {
    const response = await fetch('/api/debate/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dilemmaId: state.selectedDilemma.id,
        playerSide: state.selectedSide
      })
    });

    const data = await response.json();
    state.sessionId = data.sessionId;
    state.debateInfo = data;
    state.currentTurn = 0;
    state.maxTurns = data.maxTurns;
    state.isReplay = false;

    // Update URL to the debate's unique ID (for bookmarking/sharing)
    window.history.pushState({}, '', `/debate/${data.sessionId}`);

    setupDebateScreen();
    showScreen('debate');
  } catch (error) {
    console.error('Failed to start debate:', error);
    alert('Failed to start debate. Please try again.');
  }
}

// Setup debate screen
function setupDebateScreen() {
  document.getElementById('debate-title').textContent = state.debateInfo.dilemma.title;
  document.getElementById('current-turn').textContent = '1';
  document.getElementById('max-turns').textContent = state.maxTurns;
  document.getElementById('your-side').textContent = capitalize(state.selectedSide);
  document.getElementById('ai-side').textContent = capitalize(state.debateInfo.aiSide);

  // Clear debate log and add context
  const debateLog = document.getElementById('debate-log');
  debateLog.innerHTML = `
    <div class="context-box">
      <h4>Case Background</h4>
      <p>${state.debateInfo.dilemma.description}</p>
      <p><strong>Legal Context:</strong> ${state.debateInfo.dilemma.context}</p>
      <p><strong>Your Position (${capitalize(state.selectedSide)}):</strong> ${state.debateInfo.playerPosition}</p>
    </div>
  `;

  // Reset input
  document.getElementById('argument-input').value = '';
  document.getElementById('argument-input').disabled = false;
  document.getElementById('submit-argument').disabled = false;
  document.getElementById('char-count').textContent = '0 / 1000';
  document.getElementById('request-verdict').classList.add('hidden');
  document.getElementById('input-area').classList.remove('hidden');
}

// Character counter
document.getElementById('argument-input').addEventListener('input', (e) => {
  const count = e.target.value.length;
  document.getElementById('char-count').textContent = `${count} / 1000`;
});

// Submit argument
document.getElementById('submit-argument').addEventListener('click', submitArgument);

document.getElementById('argument-input').addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') {
    submitArgument();
  }
});

async function submitArgument() {
  const input = document.getElementById('argument-input');
  const argument = input.value.trim();

  if (!argument) {
    alert('Please enter your argument before submitting.');
    return;
  }

  if (argument.length < 20) {
    alert('Your argument is too short. Please provide a more substantive argument.');
    return;
  }

  // Disable input while processing
  input.disabled = true;
  document.getElementById('submit-argument').disabled = true;
  document.getElementById('loading-indicator').classList.remove('hidden');

  // Add player's argument to log
  addToDebateLog('player', argument, state.currentTurn + 1);

  try {
    const response = await fetch('/api/debate/argue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: state.sessionId,
        argument
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    // Add AI response to log
    addToDebateLog('ai', data.aiResponse, data.turn);

    state.currentTurn = data.turn;
    document.getElementById('current-turn').textContent = data.turn;

    // Clear input
    input.value = '';
    document.getElementById('char-count').textContent = '0 / 1000';

    if (data.isLastTurn) {
      // Show verdict button, hide input
      document.getElementById('input-area').classList.add('hidden');
      document.getElementById('request-verdict').classList.remove('hidden');
    } else {
      // Re-enable input
      input.disabled = false;
      document.getElementById('submit-argument').disabled = false;
    }

  } catch (error) {
    console.error('Failed to submit argument:', error);
    alert('Failed to submit argument. Please try again.');
    input.disabled = false;
    document.getElementById('submit-argument').disabled = false;
  } finally {
    document.getElementById('loading-indicator').classList.add('hidden');
  }
}

// Add entry to debate log
function addToDebateLog(type, content, turn) {
  const log = document.getElementById('debate-log');
  const label = type === 'player' ? `You (${capitalize(state.selectedSide)})` : `AI (${capitalize(state.debateInfo.aiSide)})`;

  const entry = document.createElement('div');
  entry.className = `debate-entry ${type}`;
  entry.innerHTML = `
    <div class="entry-header">Round ${turn} - ${label}</div>
    <div class="entry-content">${escapeHtml(content)}</div>
  `;

  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

// Request verdict
document.getElementById('request-verdict').addEventListener('click', async () => {
  document.getElementById('request-verdict').disabled = true;
  document.getElementById('request-verdict').textContent = 'Judge is deliberating...';

  try {
    const response = await fetch('/api/debate/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId })
    });

    const verdict = await response.json();

    if (verdict.error) {
      throw new Error(verdict.error);
    }

    renderVerdict(verdict, false);
    showScreen('verdict');

  } catch (error) {
    console.error('Failed to get verdict:', error);
    alert('Failed to get verdict. Please try again.');
    document.getElementById('request-verdict').disabled = false;
    document.getElementById('request-verdict').textContent = 'Request Final Verdict';
  }
});

// Render verdict screen
function renderVerdict(verdict, isReplay = false) {
  const isWin = verdict.winner === 'human';

  // Winner announcement
  const winnerDiv = document.getElementById('verdict-winner');
  winnerDiv.className = `verdict-winner ${isWin ? 'win' : 'lose'}`;
  winnerDiv.innerHTML = `
    <h2>${isWin ? 'Victory!' : 'Defeat'}</h2>
    <p>${isWin ? 'Congratulations! The human won the debate.' : 'The AI opponent won this round.'}</p>
    ${!isReplay ? `
      <div class="share-link">
        <p>Share this debate:</p>
        <input type="text" readonly value="${window.location.origin}/debate/${state.sessionId}" onclick="this.select(); document.execCommand('copy'); alert('Link copied!');">
      </div>
    ` : ''}
  `;

  // Human scores
  const humanScores = document.getElementById('human-scores');
  humanScores.innerHTML = renderScoreItems(verdict.humanScores);

  // AI scores
  const aiScores = document.getElementById('ai-scores');
  aiScores.innerHTML = renderScoreItems(verdict.aiScores);

  // Strengths
  const strengthsList = document.getElementById('strengths-list');
  strengthsList.innerHTML = (verdict.humanStrengths || [])
    .map(s => `<li>${escapeHtml(s)}</li>`).join('');

  // Improvements
  const improvementsList = document.getElementById('improvements-list');
  improvementsList.innerHTML = (verdict.humanImprovements || [])
    .map(s => `<li>${escapeHtml(s)}</li>`).join('');

  // Concepts to study
  const conceptsList = document.getElementById('concepts-list');
  conceptsList.innerHTML = (verdict.conceptsToStudy || [])
    .map(c => `<span class="concept-tag">${escapeHtml(c)}</span>`).join('');

  // Key takeaway
  document.getElementById('key-takeaway').textContent = verdict.keyTakeaway || '';

  // Judge summary
  document.getElementById('judge-summary-text').textContent = verdict.judgeSummary || '';
}

function renderScoreItems(scores) {
  if (!scores) return '';
  return `
    <div class="score-item">
      <span>Legal Reasoning</span>
      <span class="score-value">${scores.legalReasoning || 0}</span>
    </div>
    <div class="score-item">
      <span>Persuasiveness</span>
      <span class="score-value">${scores.persuasiveness || 0}</span>
    </div>
    <div class="score-item">
      <span>Rebuttal Quality</span>
      <span class="score-value">${scores.rebuttalQuality || 0}</span>
    </div>
    <div class="score-item">
      <span>Overall</span>
      <span class="score-value">${scores.overall || 0}</span>
    </div>
  `;
}

// Reset game state
function resetGame() {
  state.selectedDilemma = null;
  state.selectedSide = null;
  state.sessionId = null;
  state.debateInfo = null;
  state.currentTurn = 0;
  state.isReplay = false;
}

// Utility functions
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Start the app
init();
