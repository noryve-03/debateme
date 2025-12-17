// Theme management
function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  if (current === 'dark') {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  }
}

// Initialize theme immediately
initTheme();

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
  isReplay: false,
  config: null,
  selectedDifficulty: 'associate',
  selectedModel: null,
  advancedOpen: false,
  loadedDebate: null, // Cache for loaded debate data
  inputMode: 'manual', // 'manual' or 'assist'
  generatedArgument: null,
  lastAssistMode: null, // 'scratch' or 'expand'
  customCase: null, // User-created or AI-generated custom case
  generatedCase: null, // Temp storage for AI-generated case before confirmation
  selectedComplexity: 'simple'
};

// DOM Elements
const screens = {
  welcome: document.getElementById('welcome-screen'),
  case: document.getElementById('case-screen'),
  customCase: document.getElementById('custom-case-screen'),
  aiCase: document.getElementById('ai-case-screen'),
  side: document.getElementById('side-screen'),
  debate: document.getElementById('debate-screen'),
  verdict: document.getElementById('verdict-screen')
};

// Navigation history for back button
const navHistory = [];

// ===================
// ROUTER
// ===================

const routes = {
  '/': () => navigateToWelcome(),
  '/cases': () => navigateToCases(),
  '/cases/new': () => navigateToCustomCase(),
  '/cases/generate': () => navigateToAiCase(),
  '/case/:id': (params) => navigateToCase(params.id),
  '/debate/:id': (params) => navigateToDebate(params.id),
  '/debate/:id/verdict': (params) => navigateToVerdict(params.id)
};

function matchRoute(path) {
  for (const [pattern, handler] of Object.entries(routes)) {
    const paramNames = [];
    const regexPattern = pattern.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    const regex = new RegExp(`^${regexPattern}$`);
    const match = path.match(regex);

    if (match) {
      const params = {};
      paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      return { handler, params };
    }
  }
  return null;
}

function navigate(path, replace = false) {
  const currentPath = window.location.pathname;
  if (!replace && currentPath !== path) {
    navHistory.push(currentPath);
  }
  if (replace) {
    window.history.replaceState({ path }, '', path);
  } else {
    window.history.pushState({ path }, '', path);
  }
  handleRoute(path);
}

function goBack() {
  if (navHistory.length > 0) {
    const prevPath = navHistory.pop();
    window.history.back();
  } else {
    navigate('/');
  }
}

function goHome() {
  navHistory.length = 0;
  navigate('/');
}

function handleRoute(path) {
  const route = matchRoute(path);
  if (route) {
    route.handler(route.params);
  } else {
    // Default to welcome for unknown routes
    navigate('/', true);
  }
}

// Handle browser back/forward
window.addEventListener('popstate', (e) => {
  const path = window.location.pathname;
  handleRoute(path);
});

// ===================
// ROUTE HANDLERS
// ===================

async function navigateToWelcome() {
  resetGame();
  showScreen('welcome');
}

async function navigateToCases() {
  if (state.dilemmas.length === 0) {
    await loadDilemmas();
  }
  renderDilemmas();
  showScreen('case');
}

async function navigateToCase(caseId) {
  // Check if it's a custom case
  if (caseId === 'custom' && state.customCase) {
    state.selectedDilemma = state.customCase;
    showSideSelection();
    return;
  }

  if (state.dilemmas.length === 0) {
    await loadDilemmas();
  }

  const dilemma = state.dilemmas.find(d => d.id === parseInt(caseId));
  if (!dilemma) {
    navigate('/', true);
    return;
  }

  state.selectedDilemma = dilemma;
  showSideSelection();
}

function navigateToCustomCase() {
  clearCustomCaseForm();
  showScreen('customCase');
}

function navigateToAiCase() {
  document.getElementById('ai-case-topic').value = '';
  document.getElementById('generated-case-preview').classList.add('hidden');
  state.generatedCase = null;
  showScreen('aiCase');
}

function clearCustomCaseForm() {
  document.getElementById('custom-title').value = '';
  document.getElementById('custom-description').value = '';
  document.getElementById('custom-context').value = '';
  document.getElementById('custom-prosecution').value = '';
  document.getElementById('custom-defense').value = '';
}

async function navigateToDebate(debateId) {
  // Check if we have an active session for this debate
  if (state.sessionId === debateId && state.debateInfo) {
    showScreen('debate');
    return;
  }

  // Show loading state
  showScreen('debate');
  const debateLog = document.getElementById('debate-log');
  debateLog.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading debate...</span></div>';
  document.getElementById('input-area').classList.add('hidden');
  document.getElementById('request-verdict').classList.add('hidden');

  // Load debate from server
  try {
    const response = await fetch(`/api/debate/${debateId}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      debateLog.innerHTML = `<div class="error-message">
        <h3>Debate Not Found</h3>
        <p>${errorData.error || 'This debate link may be invalid or the debate may have been deleted.'}</p>
        <button class="btn btn-primary" onclick="navigate('/')">Go Home</button>
      </div>`;
      return;
    }

    const debate = await response.json();
    state.loadedDebate = debate;
    state.sessionId = debate.id;

    displayDebate(debate);
  } catch (error) {
    console.error('Failed to load debate:', error);
    debateLog.innerHTML = `<div class="error-message">
      <h3>Error Loading Debate</h3>
      <p>Could not connect to the server. Please check your internet connection.</p>
      <button class="btn btn-primary" onclick="navigate('/')">Go Home</button>
    </div>`;
  }
}

async function navigateToVerdict(debateId) {
  // If we don't have the debate loaded, load it first
  if (!state.loadedDebate || state.loadedDebate.id !== debateId) {
    // Show loading state using the winner div (preserves structure)
    showScreen('verdict');
    const winnerDiv = document.getElementById('verdict-winner');
    if (winnerDiv) {
      winnerDiv.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading verdict...</span></div>';
    }

    try {
      const response = await fetch(`/api/debate/${debateId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (winnerDiv) {
          winnerDiv.innerHTML = `<div class="error-message">
            <h3>Debate Not Found</h3>
            <p>${errorData.error || 'This debate link may be invalid or the debate may have been deleted.'}</p>
            <button class="btn btn-primary" onclick="navigate('/')">Go Home</button>
          </div>`;
        }
        return;
      }
      state.loadedDebate = await response.json();
      state.sessionId = debateId;
    } catch (error) {
      console.error('Failed to load verdict:', error);
      if (winnerDiv) {
        winnerDiv.innerHTML = `<div class="error-message">
          <h3>Error Loading Verdict</h3>
          <p>Could not connect to the server. Please check your internet connection.</p>
          <button class="btn btn-primary" onclick="navigate('/')">Go Home</button>
        </div>`;
      }
      return;
    }
  }

  if (state.loadedDebate.verdict) {
    state.selectedSide = state.loadedDebate.playerSide;
    state.debateInfo = { aiSide: state.loadedDebate.aiSide };
    renderVerdict(state.loadedDebate.verdict, true);
    showScreen('verdict');
  } else {
    // No verdict yet, go to debate
    navigate(`/debate/${debateId}`, true);
  }
}

// ===================
// SCREEN DISPLAY
// ===================

function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenName].classList.add('active');
  state.currentScreen = screenName;
}

function displayDebate(debate) {
  state.isReplay = debate.status === 'completed';
  state.selectedSide = debate.playerSide;
  state.debateInfo = {
    dilemma: debate.dilemma,
    aiSide: debate.aiSide,
    difficulty: debate.difficulty || 'Unknown',
    model: debate.model || 'Unknown'
  };

  // Safely extract dilemma data with fallbacks
  const dilemma = debate.dilemma || {};
  const title = dilemma.title || 'Unknown Case';
  const description = dilemma.description || 'Case details not available.';
  const context = dilemma.context || 'Legal context not available.';
  const positions = dilemma.positions || {};
  const humanPosition = positions[debate.playerSide] || 'Position not available.';

  document.getElementById('debate-title').textContent = title;
  document.getElementById('current-turn').textContent = debate.turns?.length || 0;
  document.getElementById('max-turns').textContent = '3';
  document.getElementById('your-side').textContent = capitalize(debate.playerSide);
  document.getElementById('ai-side').textContent = capitalize(debate.aiSide);

  const debateLog = document.getElementById('debate-log');

  // Show replay badge for completed debates
  const replayBadge = debate.status === 'completed'
    ? '<div class="replay-badge">Viewing Saved Debate</div>'
    : '';

  debateLog.innerHTML = `
    ${replayBadge}
    <div class="context-box">
      <h4>Case Background</h4>
      <p>${escapeHtml(description)}</p>
      <p><strong>Legal Context:</strong> ${escapeHtml(context)}</p>
      <p><strong>Human Position (${capitalize(debate.playerSide)}):</strong> ${escapeHtml(humanPosition)}</p>
    </div>
  `;

  // Add all turns
  if (debate.turns) {
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

    state.currentTurn = debate.turns.length;
  }

  // Remove any existing verdict buttons
  const existingBtn = document.querySelector('.btn-verdict:not(#request-verdict)');
  if (existingBtn) existingBtn.remove();

  // Handle input area and verdict button based on status
  if (debate.status === 'completed' || debate.status === 'judging') {
    document.getElementById('input-area').classList.add('hidden');
    document.getElementById('request-verdict').classList.add('hidden');

    if (debate.verdict) {
      const viewVerdictBtn = document.createElement('button');
      viewVerdictBtn.className = 'btn btn-verdict';
      viewVerdictBtn.textContent = 'View Verdict';
      viewVerdictBtn.onclick = () => navigate(`/debate/${debate.id}/verdict`);
      debateLog.parentNode.appendChild(viewVerdictBtn);
    }
  } else if (debate.status === 'active') {
    // Active debate - can continue
    if (debate.turns && debate.turns.length >= 3) {
      document.getElementById('input-area').classList.add('hidden');
      document.getElementById('request-verdict').classList.remove('hidden');
      document.getElementById('request-verdict').disabled = false;
      document.getElementById('request-verdict').textContent = 'Request Final Verdict';
    } else {
      document.getElementById('input-area').classList.remove('hidden');
      document.getElementById('request-verdict').classList.add('hidden');
      document.getElementById('argument-input').value = '';
      document.getElementById('argument-input').disabled = false;
      document.getElementById('submit-argument').disabled = false;
    }
  }

  showScreen('debate');
}

// ===================
// INITIALIZATION
// ===================

async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    state.config = await response.json();
    state.selectedDifficulty = state.config.defaults.difficulty;
    populateAssistModelDropdown();
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

function populateAssistModelDropdown() {
  if (!state.config) return;
  const select = document.getElementById('assist-model');
  select.innerHTML = state.config.models.map(m =>
    `<option value="${m.id}" ${m.id === 'llama-3.3-70b-versatile' ? 'selected' : ''}>${m.name}</option>`
  ).join('');
}

async function loadDilemmas() {
  try {
    const response = await fetch('/api/dilemmas');
    state.dilemmas = await response.json();
  } catch (error) {
    console.error('Failed to load dilemmas:', error);
    alert('Failed to load cases. Please refresh the page.');
  }
}

async function init() {
  await loadConfig();

  // Handle initial route
  const path = window.location.pathname;
  handleRoute(path);
}

// ===================
// EVENT LISTENERS
// ===================

document.getElementById('start-btn').addEventListener('click', () => {
  navigate('/cases');
});

document.getElementById('play-again').addEventListener('click', () => {
  navigate('/');
});

document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

// Navigation buttons
document.getElementById('nav-back').addEventListener('click', goBack);
document.getElementById('nav-home').addEventListener('click', goHome);
document.getElementById('header-home').addEventListener('click', goHome);

// Custom case buttons
document.getElementById('create-custom-case').addEventListener('click', () => navigate('/cases/new'));
document.getElementById('generate-ai-case').addEventListener('click', () => navigate('/cases/generate'));
document.getElementById('cancel-custom-case').addEventListener('click', () => navigate('/cases'));
document.getElementById('save-custom-case').addEventListener('click', saveCustomCase);

// AI case generator buttons
document.getElementById('generate-case-btn').addEventListener('click', generateAiCase);
document.getElementById('regenerate-case').addEventListener('click', generateAiCase);
document.getElementById('use-generated-case').addEventListener('click', useGeneratedCase);

// Complexity selection
document.querySelectorAll('.complexity-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.complexity-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.selectedComplexity = btn.dataset.complexity;
  });
});

function saveCustomCase() {
  const title = document.getElementById('custom-title').value.trim();
  const description = document.getElementById('custom-description').value.trim();
  const context = document.getElementById('custom-context').value.trim();
  const prosecution = document.getElementById('custom-prosecution').value.trim();
  const defense = document.getElementById('custom-defense').value.trim();

  if (!title || !description || !prosecution || !defense) {
    alert('Please fill in the case title, description, and both positions.');
    return;
  }

  state.customCase = {
    id: 'custom',
    title: title,
    description: description,
    context: context || 'Custom case created by user.',
    positions: {
      prosecution: prosecution,
      defense: defense
    }
  };

  navigate('/case/custom');
}

async function generateAiCase() {
  const topic = document.getElementById('ai-case-topic').value.trim();

  if (!topic) {
    alert('Please describe the type of case you want to generate.');
    return;
  }

  const btn = document.getElementById('generate-case-btn');
  const preview = document.getElementById('generated-case-preview');
  btn.disabled = true;
  btn.textContent = 'Generating...';
  preview.classList.add('hidden');

  try {
    const response = await fetch('/api/cases/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: topic,
        complexity: state.selectedComplexity
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    state.generatedCase = data;

    document.getElementById('gen-case-title').textContent = data.title;
    document.getElementById('gen-case-description').textContent = data.description;
    document.getElementById('gen-case-prosecution').textContent = data.positions.prosecution;
    document.getElementById('gen-case-defense').textContent = data.positions.defense;

    preview.classList.remove('hidden');

  } catch (error) {
    console.error('Failed to generate case:', error);
    alert('Failed to generate case: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Case';
  }
}

function useGeneratedCase() {
  if (!state.generatedCase) return;

  state.customCase = {
    id: 'custom',
    ...state.generatedCase
  };

  navigate('/case/custom');
}

// AI Assist mode toggle
document.getElementById('mode-manual').addEventListener('click', () => switchInputMode('manual'));
document.getElementById('mode-assist').addEventListener('click', () => switchInputMode('assist'));

// AI Assist actions
document.getElementById('generate-scratch').addEventListener('click', () => generateAssist('scratch'));
document.getElementById('expand-prompt').addEventListener('click', () => generateAssist('expand'));
document.getElementById('regenerate').addEventListener('click', () => generateAssist(state.lastAssistMode));
document.getElementById('edit-generated').addEventListener('click', editGenerated);
document.getElementById('use-generated').addEventListener('click', useGenerated);

// AI Assist settings toggle
document.getElementById('toggle-assist-settings').addEventListener('click', () => {
  const settings = document.getElementById('assist-settings');
  settings.classList.toggle('hidden');
});

function switchInputMode(mode) {
  state.inputMode = mode;

  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`mode-${mode}`).classList.add('active');

  document.getElementById('manual-mode').classList.toggle('hidden', mode !== 'manual');
  document.getElementById('assist-mode').classList.toggle('hidden', mode !== 'assist');

  // Reset preview when switching modes
  document.getElementById('generated-preview').classList.add('hidden');
  state.generatedArgument = null;
}

async function generateAssist(mode) {
  const prompt = document.getElementById('assist-prompt').value.trim();
  const selectedModel = document.getElementById('assist-model').value;
  const selectedStyle = document.getElementById('assist-style').value;

  if (mode === 'expand' && !prompt) {
    alert('Please describe your argument idea first.');
    return;
  }

  state.lastAssistMode = mode;

  // Show loading state
  const previewEl = document.getElementById('generated-preview');
  const contentEl = document.getElementById('preview-content');
  previewEl.classList.remove('hidden');
  contentEl.innerHTML = '<div class="assist-loading"><div class="spinner"></div><span>Generating argument...</span></div>';

  // Disable buttons during generation
  document.getElementById('generate-scratch').disabled = true;
  document.getElementById('expand-prompt').disabled = true;

  try {
    const response = await fetch('/api/debate/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: state.sessionId,
        prompt: prompt,
        mode: mode,
        model: selectedModel,
        style: selectedStyle
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    state.generatedArgument = data.argument;
    contentEl.textContent = data.argument;

  } catch (error) {
    console.error('AI assist error:', error);
    contentEl.innerHTML = `<span style="color: var(--red);">Error: ${error.message}</span>`;
    state.generatedArgument = null;
  } finally {
    document.getElementById('generate-scratch').disabled = false;
    document.getElementById('expand-prompt').disabled = false;
  }
}

function editGenerated() {
  if (!state.generatedArgument) return;

  // Switch to manual mode with the generated text
  switchInputMode('manual');
  document.getElementById('argument-input').value = state.generatedArgument;
  document.getElementById('char-count').textContent = `${state.generatedArgument.length} / 1000`;
}

function useGenerated() {
  if (!state.generatedArgument) return;

  // Put the generated argument in the main input and submit
  document.getElementById('argument-input').value = state.generatedArgument;
  document.getElementById('char-count').textContent = `${state.generatedArgument.length} / 1000`;

  // Switch to manual mode visually but keep the text
  switchInputMode('manual');
}

// ===================
// UI RENDERING
// ===================

function renderDilemmas() {
  const container = document.getElementById('cases-list');
  container.innerHTML = state.dilemmas.map(d => `
    <div class="case-card" data-id="${d.id}">
      <h3>${d.title}</h3>
      <p>${d.description.substring(0, 200)}...</p>
    </div>
  `).join('');

  container.querySelectorAll('.case-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      navigate(`/case/${id}`);
    });
  });
}

function showSideSelection() {
  const preview = document.getElementById('case-preview');
  preview.innerHTML = `
    <h3>${state.selectedDilemma.title}</h3>
    <p>${state.selectedDilemma.description}</p>
  `;

  renderDifficultyOptions();
  renderModelOptions();
  showScreen('side');
}

function renderDifficultyOptions() {
  if (!state.config) return;

  const container = document.getElementById('difficulty-options');
  container.innerHTML = state.config.difficulties.map(d => `
    <div class="difficulty-option ${d.id} ${d.id === state.selectedDifficulty ? 'selected' : ''}" data-id="${d.id}">
      <div class="diff-name">${d.name}</div>
      <div class="diff-desc">${d.description}</div>
    </div>
  `).join('');

  container.querySelectorAll('.difficulty-option').forEach(option => {
    option.addEventListener('click', () => {
      state.selectedDifficulty = option.dataset.id;
      state.selectedModel = null;
      container.querySelectorAll('.difficulty-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      renderModelOptions();
    });
  });
}

function renderModelOptions() {
  if (!state.config) return;

  const container = document.getElementById('model-options');
  const currentDifficulty = state.config.difficulties.find(d => d.id === state.selectedDifficulty);
  const defaultModel = currentDifficulty?.defaultModel;

  container.innerHTML = state.config.models.map(m => {
    const isDefault = m.id === defaultModel;
    const isSelected = state.selectedModel === m.id || (!state.selectedModel && isDefault);
    return `
      <div class="model-option ${isSelected ? 'selected' : ''} ${isDefault && !state.selectedModel ? 'default-for-difficulty' : ''}" data-id="${m.id}">
        <div class="model-name">${m.name}</div>
        <div class="model-desc">${m.description}</div>
        <div class="model-speed">${m.speed}</div>
        ${isDefault ? '<div class="model-desc">(default)</div>' : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('.model-option').forEach(option => {
    option.addEventListener('click', () => {
      state.selectedModel = option.dataset.id;
      container.querySelectorAll('.model-option').forEach(o => {
        o.classList.remove('selected');
        o.classList.remove('default-for-difficulty');
      });
      option.classList.add('selected');
    });
  });
}

document.getElementById('toggle-advanced').addEventListener('click', () => {
  const panel = document.getElementById('advanced-settings');
  const btn = document.getElementById('toggle-advanced');
  state.advancedOpen = !state.advancedOpen;

  if (state.advancedOpen) {
    panel.classList.remove('hidden');
    btn.textContent = 'Hide Advanced Settings';
  } else {
    panel.classList.add('hidden');
    btn.textContent = 'Advanced Settings';
  }
});

// Side selection handlers
document.querySelectorAll('.btn-side').forEach(btn => {
  btn.addEventListener('click', async () => {
    state.selectedSide = btn.dataset.side;
    await startDebate();
  });
});

// ===================
// DEBATE ACTIONS
// ===================

async function startDebate() {
  try {
    const payload = {
      dilemmaId: state.selectedDilemma.id,
      playerSide: state.selectedSide,
      difficulty: state.selectedDifficulty
    };

    // If this is a custom case, send the full case data
    if (state.selectedDilemma.id === 'custom') {
      payload.customCase = {
        title: state.selectedDilemma.title,
        description: state.selectedDilemma.description,
        context: state.selectedDilemma.context,
        positions: state.selectedDilemma.positions
      };
    }

    if (state.selectedModel) {
      payload.model = state.selectedModel;
    }

    const response = await fetch('/api/debate/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    state.sessionId = data.sessionId;
    state.debateInfo = data;
    state.currentTurn = 0;
    state.maxTurns = data.maxTurns;
    state.isReplay = false;
    state.loadedDebate = null;

    setupDebateScreen();
    navigate(`/debate/${data.sessionId}`, true);
  } catch (error) {
    console.error('Failed to start debate:', error);
    alert('Failed to start debate. Please try again.');
  }
}

function setupDebateScreen() {
  document.getElementById('debate-title').textContent = state.debateInfo.dilemma.title;
  document.getElementById('current-turn').textContent = '1';
  document.getElementById('max-turns').textContent = state.maxTurns;
  document.getElementById('your-side').textContent = capitalize(state.selectedSide);
  document.getElementById('ai-side').textContent = capitalize(state.debateInfo.aiSide);

  const debateLog = document.getElementById('debate-log');
  debateLog.innerHTML = `
    <div class="debate-info-badge">
      <span class="info-tag">Difficulty: <span>${state.debateInfo.difficulty}</span></span>
      <span class="info-tag">Model: <span>${state.debateInfo.model}</span></span>
    </div>
    <div class="context-box">
      <h4>Case Background</h4>
      <p>${state.debateInfo.dilemma.description}</p>
      <p><strong>Legal Context:</strong> ${state.debateInfo.dilemma.context}</p>
      <p><strong>Your Position (${capitalize(state.selectedSide)}):</strong> ${state.debateInfo.playerPosition}</p>
    </div>
  `;

  // Remove any existing verdict buttons
  const existingBtn = document.querySelector('.btn-verdict:not(#request-verdict)');
  if (existingBtn) existingBtn.remove();

  document.getElementById('argument-input').value = '';
  document.getElementById('argument-input').disabled = false;
  document.getElementById('submit-argument').disabled = false;
  document.getElementById('char-count').textContent = '0 / 1000';
  document.getElementById('request-verdict').classList.add('hidden');
  document.getElementById('input-area').classList.remove('hidden');

  // Reset AI assist state
  switchInputMode('manual');
  document.getElementById('assist-prompt').value = '';
  document.getElementById('generated-preview').classList.add('hidden');
  state.generatedArgument = null;

  showScreen('debate');
}

document.getElementById('argument-input').addEventListener('input', (e) => {
  const count = e.target.value.length;
  document.getElementById('char-count').textContent = `${count} / 1000`;
});

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

  input.disabled = true;
  document.getElementById('submit-argument').disabled = true;
  document.getElementById('loading-indicator').classList.remove('hidden');

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

    addToDebateLog('ai', data.aiResponse, data.turn);

    state.currentTurn = data.turn;
    document.getElementById('current-turn').textContent = data.turn;

    input.value = '';
    document.getElementById('char-count').textContent = '0 / 1000';

    if (data.isLastTurn) {
      document.getElementById('input-area').classList.add('hidden');
      document.getElementById('request-verdict').classList.remove('hidden');
    } else {
      input.disabled = false;
      document.getElementById('submit-argument').disabled = false;
    }

  } catch (error) {
    console.error('Failed to submit argument:', error);
    alert('Failed to submit argument: ' + error.message);
    input.disabled = false;
    document.getElementById('submit-argument').disabled = false;
  } finally {
    document.getElementById('loading-indicator').classList.add('hidden');
  }
}

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

    state.loadedDebate = { ...state.loadedDebate, verdict };
    renderVerdict(verdict, false);
    navigate(`/debate/${state.sessionId}/verdict`, true);

  } catch (error) {
    console.error('Failed to get verdict:', error);
    alert('Failed to get verdict. Please try again.');
    document.getElementById('request-verdict').disabled = false;
    document.getElementById('request-verdict').textContent = 'Request Final Verdict';
  }
});

function renderVerdict(verdict, isReplay = false) {
  const isWin = verdict.winner === 'human';

  const winnerDiv = document.getElementById('verdict-winner');
  winnerDiv.className = `verdict-winner ${isWin ? 'win' : 'lose'}`;

  const shareUrl = `${window.location.origin}/debate/${state.sessionId}`;

  winnerDiv.innerHTML = `
    <h2>${isWin ? 'Victory!' : 'Defeat'}</h2>
    <p>${isWin ? 'Congratulations! The human won the debate.' : 'The AI opponent won this round.'}</p>
    <div class="share-link">
      <p>Share this debate:</p>
      <input type="text" readonly value="${shareUrl}" id="share-url-input">
      <button class="btn btn-secondary" id="copy-link-btn">Copy Link</button>
    </div>
  `;

  // Add copy button functionality
  setTimeout(() => {
    const copyBtn = document.getElementById('copy-link-btn');
    const shareInput = document.getElementById('share-url-input');
    if (copyBtn && shareInput) {
      copyBtn.addEventListener('click', () => {
        shareInput.select();
        navigator.clipboard.writeText(shareInput.value).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => copyBtn.textContent = 'Copy Link', 2000);
        }).catch(() => {
          document.execCommand('copy');
          copyBtn.textContent = 'Copied!';
          setTimeout(() => copyBtn.textContent = 'Copy Link', 2000);
        });
      });
    }
  }, 0);

  document.getElementById('human-scores').innerHTML = renderScoreItems(verdict.humanScores);
  document.getElementById('ai-scores').innerHTML = renderScoreItems(verdict.aiScores);

  document.getElementById('strengths-list').innerHTML = (verdict.humanStrengths || [])
    .map(s => `<li>${escapeHtml(s)}</li>`).join('');

  document.getElementById('improvements-list').innerHTML = (verdict.humanImprovements || [])
    .map(s => `<li>${escapeHtml(s)}</li>`).join('');

  document.getElementById('concepts-list').innerHTML = (verdict.conceptsToStudy || [])
    .map(c => `<span class="concept-tag">${escapeHtml(c)}</span>`).join('');

  document.getElementById('key-takeaway').textContent = verdict.keyTakeaway || '';
  document.getElementById('judge-summary-text').textContent = verdict.judgeSummary || '';

  showScreen('verdict');
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

function resetGame() {
  state.selectedDilemma = null;
  state.selectedSide = null;
  state.sessionId = null;
  state.debateInfo = null;
  state.currentTurn = 0;
  state.isReplay = false;
  state.selectedModel = null;
  state.advancedOpen = false;
  state.loadedDebate = null;

  document.getElementById('advanced-settings').classList.add('hidden');
  document.getElementById('toggle-advanced').textContent = 'Advanced Settings';
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Start the app
init();
