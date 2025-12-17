import express from 'express';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as db from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Prevent search engine indexing for privacy
app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Available models configuration
const MODELS = {
  'llama-3.3-70b-versatile': {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    description: 'Best quality, slower',
    speed: '280 T/sec'
  },
  'llama-3.1-8b-instant': {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B',
    description: 'Fast responses, lighter',
    speed: '560 T/sec'
  },
  'llama3-70b-8192': {
    id: 'llama3-70b-8192',
    name: 'Llama 3 70B',
    description: 'Legacy model, reliable',
    speed: '330 T/sec'
  },
  'mixtral-8x7b-32768': {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B',
    description: 'Good for complex reasoning',
    speed: '480 T/sec'
  },
  'gemma2-9b-it': {
    id: 'gemma2-9b-it',
    name: 'Gemma 2 9B',
    description: 'Google model, balanced',
    speed: '440 T/sec'
  }
};

// Difficulty configurations
const DIFFICULTIES = {
  law_student: {
    id: 'law_student',
    name: 'Law Student',
    description: 'Learning the ropes - makes occasional weak arguments',
    model: 'llama-3.1-8b-instant',
    temperature: 0.8,
    aggressiveness: 'gentle',
    promptModifier: `You are a first-year law student practicing debate. While you try to make good arguments, you sometimes:
- Miss obvious counterpoints
- Make arguments that are emotionally compelling but legally weak
- Occasionally concede good points your opponent makes
- Use simpler legal language
Keep responses under 150 words. Be earnest but not overly sophisticated.`
  },
  associate: {
    id: 'associate',
    name: 'Associate',
    description: 'Competent opponent - solid arguments, some gaps',
    model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
    aggressiveness: 'moderate',
    promptModifier: `You are a junior associate at a law firm with 2-3 years experience. You make solid arguments and know the basics well, but:
- Sometimes miss nuanced counterarguments
- Occasionally over-rely on one line of reasoning
- May not always anticipate every weakness in your position
Keep responses under 180 words. Be professional and competent.`
  },
  partner: {
    id: 'partner',
    name: 'Senior Partner',
    description: 'Aggressive litigator - finds every weakness',
    model: 'llama-3.3-70b-versatile',
    temperature: 0.6,
    aggressiveness: 'aggressive',
    promptModifier: `You are a senior litigation partner with 20+ years of trial experience. You are known for:
- Ruthlessly identifying weaknesses in opposing arguments
- Never conceding any point, always finding a counter
- Using rhetorical techniques to undermine opponent credibility
- Anticipating and preemptively addressing counterarguments
Keep responses under 200 words. Be aggressive but professional - like a real courtroom shark.`
  },
  supreme_court: {
    id: 'supreme_court',
    name: 'Supreme Court',
    description: 'Elite advocate - cites precedents, philosophical depth',
    model: 'llama-3.3-70b-versatile',
    temperature: 0.5,
    aggressiveness: 'masterful',
    promptModifier: `You are a Supreme Court advocate who has argued dozens of cases before the highest courts. You are known for:
- Citing relevant case law and legal precedents by name (e.g., "As established in Dudley and Stephens...")
- Weaving philosophical and jurisprudential frameworks into arguments
- Anticipating not just immediate counterarguments but second and third-order implications
- Using precise legal terminology and impeccable logical structure
- Never making an argument that couldn't withstand strict scrutiny
Keep responses under 220 words. Demonstrate mastery of legal reasoning at the highest level.`
  }
};

// Legal dilemmas database
const DILEMMAS = [
  {
    id: 1,
    title: "The Speluncean Explorers",
    description: "Five cave explorers are trapped after a landslide. After 20 days without food, they learn via radio that rescue will take 10 more days. They calculate that survival requires eating one member. They kill and eat Roger Whetmore (who initially proposed the lottery but withdrew). The survivors are now on trial for murder.",
    positions: {
      prosecution: "The defendants should be convicted of murder. The law is clear: intentional killing is murder. No exception exists for necessity. Allowing such an exception would create dangerous precedent.",
      defense: "The defendants should be acquitted. The law of nature superseded positive law in their extreme circumstances. They acted out of necessity to preserve the greater number of lives."
    },
    context: "This case explores the tension between strict legal positivism and natural law theory, the role of necessity as a defense, and whether judges should consider the spirit versus letter of the law."
  },
  {
    id: 2,
    title: "The Trolley Problem - Legal Edition",
    description: "A railway worker sees a runaway trolley heading toward five workers. The only way to save them is to divert the trolley to a side track where one worker is present. The worker diverts the trolley, killing the one to save the five. They are now charged with manslaughter.",
    positions: {
      prosecution: "The defendant made an active choice to kill. You cannot justify murder by mathematics. The one worker had a right to life that was violated by deliberate action.",
      defense: "The defendant acted reasonably under necessity. The doctrine of lesser evils applies - saving five lives at the cost of one was the morally and legally correct choice."
    },
    context: "This explores the necessity defense, the distinction between acts and omissions, and utilitarian versus deontological approaches to criminal liability."
  },
  {
    id: 3,
    title: "The Autonomous Vehicle Dilemma",
    description: "An AI-driven car's brakes fail. It can either continue straight and kill three pedestrians, or swerve and kill one passenger. The AI swerves. The car manufacturer is sued for wrongful death by the passenger's family.",
    positions: {
      prosecution: "The manufacturer programmed the car to sacrifice its own passenger. This violates the duty of care owed to customers. No person consents to being killed by their own vehicle.",
      defense: "The manufacturer followed sound ethical programming minimizing total harm. The passenger accepted reasonable risks by using an autonomous vehicle. The alternative was greater loss of life."
    },
    context: "This case examines products liability, algorithmic decision-making in life-or-death situations, and informed consent in the age of AI."
  },
  {
    id: 4,
    title: "The Whistleblower's Dilemma",
    description: "A government contractor leaked classified documents revealing illegal mass surveillance of citizens. The leaks caused diplomatic damage but also led to reforms protecting civil liberties. They are charged under the Espionage Act.",
    positions: {
      prosecution: "The defendant broke their oath and the law. They endangered national security and lives of intelligence assets. Proper channels existed for whistleblowing. The ends don't justify illegal means.",
      defense: "The defendant exposed unconstitutional government actions. Civil disobedience is justified when the government itself breaks the law. The public interest defense should apply."
    },
    context: "This explores the tension between national security and civil liberties, the limits of civil disobedience, and whether motive should affect criminal liability."
  },
  {
    id: 5,
    title: "The Right to Die",
    description: "A doctor helped a terminally ill patient end their life at the patient's explicit, documented request. The patient had ALS with 6 months to live and was suffering greatly. The doctor is charged with assisted suicide in a state where it's illegal.",
    positions: {
      prosecution: "The sanctity of life is paramount. Doctors must not kill - it violates the Hippocratic oath. Legalizing this creates a slippery slope endangering vulnerable populations.",
      defense: "Patient autonomy is fundamental. Forcing someone to suffer against their will is cruel. The doctor showed compassion and respected the patient's informed, competent choice."
    },
    context: "This examines bodily autonomy, the role of medical professionals, religious versus secular law, and the state's interest in preserving life."
  },
  {
    id: 6,
    title: "The AI Art Theft",
    description: "An AI company trained their image generator on millions of copyrighted artworks without permission. Artists sue for copyright infringement. The AI can now generate images 'in the style of' specific artists.",
    positions: {
      prosecution: "Training on copyrighted works is unauthorized reproduction. The AI's outputs are derivative works. Artists' livelihoods and creative rights are being stolen at scale.",
      defense: "Training is transformative fair use - like a human learning by studying art. The AI doesn't copy but learns concepts. This is how all learning works, human or machine."
    },
    context: "This explores copyright in the digital age, the boundaries of fair use, and how law should adapt to technologies that challenge traditional frameworks."
  },
  {
    id: 7,
    title: "The Corporate Manslaughter",
    description: "A pharmaceutical company rushed an opioid painkiller to market, downplaying addiction risks. Internal emails show executives knew about the dangers. 50,000 deaths are linked to the drug. Prosecutors seek criminal charges against the CEO personally.",
    positions: {
      prosecution: "The CEO made decisions that foreseeably caused deaths for profit. Corporate executives cannot hide behind the corporate veil for criminal conduct. Deterrence requires individual accountability.",
      defense: "The CEO relied on regulatory approval and scientific advisors. Criminal law requires individual acts and intent. The CEO didn't personally cause any death. Civil remedies are appropriate, not criminal."
    },
    context: "This examines corporate criminal liability, the problem of diffuse responsibility in organizations, and whether executives should face personal criminal consequences for corporate decisions."
  },
  {
    id: 8,
    title: "The Stand Your Ground Case",
    description: "A homeowner shot and killed an unarmed intruder who had broken in at night. The intruder was a teenager who appeared to be trying to steal electronics. The homeowner claims self-defense under the state's stand your ground law.",
    positions: {
      prosecution: "The response was disproportionate. An unarmed teenager stealing property does not justify lethal force. The homeowner had a duty to retreat or use non-lethal means.",
      defense: "The homeowner had no way to know the intruder was unarmed or just a teenager. In the dark, facing an intruder, reasonable fear justified the response. Castle doctrine applies."
    },
    context: "This explores self-defense law, the castle doctrine, proportionality in use of force, and racial dimensions of stand your ground laws."
  }
];

// In-memory cache for active sessions (backed by SQLite)
const sessionCache = new Map();

// API: Get configuration options
app.get('/api/config', (req, res) => {
  res.json({
    models: Object.values(MODELS),
    difficulties: Object.values(DIFFICULTIES).map(d => ({
      id: d.id,
      name: d.name,
      description: d.description,
      defaultModel: d.model
    })),
    defaults: {
      difficulty: 'associate',
      model: 'llama-3.3-70b-versatile'
    }
  });
});

// API: Get all dilemmas
app.get('/api/dilemmas', (req, res) => {
  const simplified = DILEMMAS.map(d => ({
    id: d.id,
    title: d.title,
    description: d.description
  }));
  res.json(simplified);
});

// API: Start a new debate
app.post('/api/debate/start', (req, res) => {
  const { dilemmaId, playerSide, difficulty = 'associate', model, customCase } = req.body;

  let dilemma;
  let isCustomCase = false;

  // Handle custom cases (user-created or AI-generated)
  if (dilemmaId === 'custom' && customCase) {
    // Validate custom case has required fields
    if (!customCase.title || !customCase.description || !customCase.positions?.prosecution || !customCase.positions?.defense) {
      return res.status(400).json({ error: 'Invalid custom case data' });
    }
    dilemma = {
      id: 'custom',
      title: customCase.title,
      description: customCase.description,
      context: customCase.context || 'Custom case created by user.',
      positions: customCase.positions
    };
    isCustomCase = true;
  } else {
    dilemma = DILEMMAS.find(d => d.id === dilemmaId);
    if (!dilemma) {
      return res.status(400).json({ error: 'Invalid dilemma ID' });
    }
  }

  const difficultyConfig = DIFFICULTIES[difficulty] || DIFFICULTIES.associate;
  const selectedModel = model && MODELS[model] ? model : difficultyConfig.model;

  const aiSide = playerSide === 'prosecution' ? 'defense' : 'prosecution';

  // Create in database with hard-to-guess ID
  // For custom cases, store the full case data
  const sessionId = db.createDebate(
    isCustomCase ? 'custom' : dilemmaId,
    dilemma.title,
    playerSide,
    aiSide,
    isCustomCase ? dilemma : null
  );

  const session = {
    id: sessionId,
    dilemma,
    playerSide,
    aiSide,
    turns: [],
    maxTurns: 3,
    currentTurn: 0,
    status: 'active',
    difficulty: difficultyConfig,
    model: selectedModel
  };

  sessionCache.set(sessionId, session);

  res.json({
    sessionId,
    dilemma: {
      title: dilemma.title,
      description: dilemma.description,
      context: dilemma.context
    },
    playerSide,
    aiSide,
    playerPosition: dilemma.positions[playerSide],
    aiPosition: dilemma.positions[aiSide],
    maxTurns: session.maxTurns,
    difficulty: difficultyConfig.name,
    model: MODELS[selectedModel]?.name || selectedModel
  });
});

// API: Submit player argument and get AI response
app.post('/api/debate/argue', async (req, res) => {
  const { sessionId, argument } = req.body;

  let session = sessionCache.get(sessionId);

  // Try to restore from DB if not in cache
  if (!session) {
    const dbDebate = db.getDebate(sessionId);
    if (!dbDebate || dbDebate.status !== 'active') {
      return res.status(400).json({ error: 'Invalid or expired session' });
    }

    let dilemma;
    // Check for custom case data first
    if (dbDebate.custom_case_data) {
      try {
        dilemma = JSON.parse(dbDebate.custom_case_data);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid custom case data' });
      }
    } else {
      dilemma = DILEMMAS.find(d => d.id == dbDebate.dilemma_id);
      if (!dilemma) {
        return res.status(400).json({ error: 'Dilemma not found for this debate' });
      }
    }
    const turns = db.getTurns(sessionId);

    session = {
      id: sessionId,
      dilemma,
      playerSide: dbDebate.player_side,
      aiSide: dbDebate.ai_side,
      turns: turns.map(t => ({ turn: t.turn_number, player: t.player_argument, ai: t.ai_response })),
      maxTurns: 3,
      currentTurn: turns.length,
      status: 'active',
      difficulty: DIFFICULTIES.associate, // Default for restored sessions
      model: 'llama-3.3-70b-versatile'
    };
    sessionCache.set(sessionId, session);
  }

  if (session.status !== 'active') {
    return res.status(400).json({ error: 'Debate has ended' });
  }

  session.currentTurn++;

  try {
    // Generate AI opponent's response
    const aiResponse = await generateAIResponse(session, argument);

    session.turns.push({
      turn: session.currentTurn,
      player: argument,
      ai: aiResponse
    });

    // Persist to database
    db.addTurn(sessionId, session.currentTurn, argument, aiResponse);

    const isLastTurn = session.currentTurn >= session.maxTurns;

    if (isLastTurn) {
      session.status = 'judging';
      db.updateDebateStatus(sessionId, 'judging');
    }

    res.json({
      turn: session.currentTurn,
      aiResponse,
      isLastTurn,
      turnsRemaining: session.maxTurns - session.currentTurn
    });

  } catch (error) {
    console.error('AI response error:', error);
    session.currentTurn--; // Rollback on error
    res.status(500).json({ error: 'Failed to generate AI response: ' + (error.message || 'Unknown error') });
  }
});

// API: Get judge's verdict
app.post('/api/debate/judge', async (req, res) => {
  const { sessionId } = req.body;

  let session = sessionCache.get(sessionId);

  if (!session) {
    const dbDebate = db.getDebate(sessionId);
    if (!dbDebate) {
      return res.status(400).json({ error: 'Invalid session' });
    }

    // Check if verdict already exists
    const existingVerdict = db.getVerdict(sessionId);
    if (existingVerdict) {
      return res.json(existingVerdict);
    }

    let dilemma;
    // Check for custom case data first
    if (dbDebate.custom_case_data) {
      try {
        dilemma = JSON.parse(dbDebate.custom_case_data);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid custom case data' });
      }
    } else {
      dilemma = DILEMMAS.find(d => d.id == dbDebate.dilemma_id);
      if (!dilemma) {
        return res.status(400).json({ error: 'Dilemma not found for this debate' });
      }
    }
    const turns = db.getTurns(sessionId);

    session = {
      id: sessionId,
      dilemma,
      playerSide: dbDebate.player_side,
      aiSide: dbDebate.ai_side,
      turns: turns.map(t => ({ turn: t.turn_number, player: t.player_argument, ai: t.ai_response })),
      maxTurns: 3,
      currentTurn: turns.length,
      status: dbDebate.status,
      model: 'llama-3.3-70b-versatile'
    };
  }

  try {
    const verdict = await generateJudgeVerdict(session);
    session.status = 'completed';
    session.verdict = verdict;

    // Persist verdict
    db.saveVerdict(sessionId, verdict);
    db.updateDebateStatus(sessionId, 'completed');

    // Clean up cache
    sessionCache.delete(sessionId);

    res.json(verdict);

  } catch (error) {
    console.error('Judge error:', error);
    res.status(500).json({ error: 'Failed to generate verdict' });
  }
});

// API: Get a completed debate by ID (for sharing/replay)
app.get('/api/debate/:id', (req, res) => {
  const { id } = req.params;

  const fullDebate = db.getFullDebate(id);
  if (!fullDebate) {
    return res.status(404).json({ error: 'Debate not found' });
  }

  let dilemmaData;

  // Check if this is a custom case with stored data
  if (fullDebate.customCaseData) {
    dilemmaData = {
      title: fullDebate.customCaseData.title,
      description: fullDebate.customCaseData.description,
      context: fullDebate.customCaseData.context || 'Custom case.',
      positions: fullDebate.customCaseData.positions
    };
  } else {
    // Get dilemma details from predefined list (use == for type coercion)
    const dilemma = DILEMMAS.find(d => d.id == fullDebate.dilemma_id);

    // Build complete dilemma object with fallbacks
    dilemmaData = dilemma ? {
      title: dilemma.title,
      description: dilemma.description,
      context: dilemma.context,
      positions: dilemma.positions
    } : {
      title: fullDebate.dilemma_title || 'Unknown Case',
      description: 'Case details not available.',
      context: 'Legal context not available.',
      positions: {
        prosecution: 'Position not available.',
        defense: 'Position not available.'
      }
    };
  }

  res.json({
    id: fullDebate.id,
    dilemma: dilemmaData,
    playerSide: fullDebate.player_side,
    aiSide: fullDebate.ai_side,
    status: fullDebate.status,
    turns: fullDebate.turns,
    verdict: fullDebate.verdict,
    createdAt: fullDebate.created_at
  });
});

// API: Generate a new case with AI
app.post('/api/cases/generate', async (req, res) => {
  const { topic, complexity = 'moderate' } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  try {
    const generatedCase = await generateCase(topic, complexity);
    res.json(generatedCase);
  } catch (error) {
    console.error('Case generation error:', error);
    res.status(500).json({ error: 'Failed to generate case' });
  }
});

// Generate a legal case/dilemma using AI
async function generateCase(topic, complexity) {
  const complexityInstructions = {
    simple: 'Create a straightforward case with clear-cut arguments on both sides. The facts should be simple and the legal principles basic.',
    moderate: 'Create a case with some nuance and complexity. Include multiple relevant factors and legal principles that could apply.',
    complex: 'Create a sophisticated case with deep moral and legal ambiguity. Include competing rights, multiple stakeholders, potential precedents, and philosophical dimensions.'
  };

  const prompt = `You are an expert legal educator creating case studies for law students to debate.

USER'S REQUEST: "${topic}"

COMPLEXITY LEVEL: ${complexity.toUpperCase()}
${complexityInstructions[complexity] || complexityInstructions.moderate}

Generate a compelling legal dilemma/case for debate. The case should:
1. Present a realistic scenario with specific facts and parties
2. Have two defensible positions (prosecution/plaintiff vs defense)
3. Raise interesting legal and ethical questions
4. Be suitable for a structured debate format

Respond in this exact JSON format (no markdown, just raw JSON):
{
  "title": "Short, memorable case name (e.g., 'The Midnight Surgeon Case')",
  "description": "2-4 sentences describing the facts of the case, what happened, and who is involved. Be specific with details.",
  "context": "1-2 sentences about what legal principles, areas of law, or ethical frameworks this case explores.",
  "positions": {
    "prosecution": "1-2 sentences stating the prosecution/plaintiff's core argument and what they seek.",
    "defense": "1-2 sentences stating the defense's core argument and their position."
  }
}`;

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You are a legal case writer. You respond only with valid JSON, no markdown formatting or explanations.'
      },
      { role: 'user', content: prompt }
    ],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.8,
    max_tokens: 600
  });

  const responseText = completion.choices[0]?.message?.content || '{}';

  try {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Validate required fields
      if (parsed.title && parsed.description && parsed.positions?.prosecution && parsed.positions?.defense) {
        return {
          title: parsed.title,
          description: parsed.description,
          context: parsed.context || 'Legal and ethical dilemma for debate.',
          positions: parsed.positions
        };
      }
    }
  } catch (e) {
    console.error('Failed to parse generated case:', e);
  }

  // Fallback if parsing fails
  throw new Error('Failed to generate a valid case. Please try again.');
}

// Serve SPA for all client-side routes
app.get('/debate/:id', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.get('/debate/:id/verdict', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.get('/cases', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.get('/cases/new', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.get('/cases/generate', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.get('/case/:id', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Argument style configurations
const ARGUMENT_STYLES = {
  balanced: {
    name: 'Balanced',
    instruction: 'Present a well-rounded argument that balances logical reasoning with emotional appeal. Use clear structure and acknowledge complexity while maintaining your position firmly.'
  },
  aggressive: {
    name: 'Aggressive',
    instruction: 'Take an assertive, confident stance. Challenge opposing arguments directly and forcefully. Use strong language and rhetorical techniques to dominate the debate. Be relentless in pointing out flaws in the opposition.'
  },
  philosophical: {
    name: 'Philosophical',
    instruction: 'Ground your argument in deeper philosophical and ethical frameworks. Reference moral philosophy, jurisprudence theory, and fundamental principles of justice. Explore the broader implications and underlying values at stake.'
  },
  'precedent-heavy': {
    name: 'Precedent-Heavy',
    instruction: 'Focus heavily on legal precedent and case law. Reference specific cases by name (real or plausible), cite established legal doctrines, and build your argument on the foundation of how similar cases have been decided.'
  }
};

// API: Generate AI-assisted argument for the player
app.post('/api/debate/assist', async (req, res) => {
  const { sessionId, prompt, mode, model, style } = req.body;

  let session = sessionCache.get(sessionId);

  if (!session) {
    const dbDebate = db.getDebate(sessionId);
    if (!dbDebate || dbDebate.status !== 'active') {
      return res.status(400).json({ error: 'Invalid or expired session' });
    }

    let dilemma;
    // Check for custom case data first
    if (dbDebate.custom_case_data) {
      try {
        dilemma = JSON.parse(dbDebate.custom_case_data);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid custom case data' });
      }
    } else {
      dilemma = DILEMMAS.find(d => d.id == dbDebate.dilemma_id);
      if (!dilemma) {
        return res.status(400).json({ error: 'Dilemma not found' });
      }
    }
    const turns = db.getTurns(sessionId);

    session = {
      id: sessionId,
      dilemma,
      playerSide: dbDebate.player_side,
      aiSide: dbDebate.ai_side,
      turns: turns.map(t => ({ turn: t.turn_number, player: t.player_argument, ai: t.ai_response })),
      maxTurns: 3,
      currentTurn: turns.length,
      status: 'active',
      difficulty: DIFFICULTIES.associate,
      model: 'llama-3.3-70b-versatile'
    };
    sessionCache.set(sessionId, session);
  }

  try {
    const selectedModel = model && MODELS[model] ? model : 'llama-3.3-70b-versatile';
    const selectedStyle = style && ARGUMENT_STYLES[style] ? style : 'balanced';
    const generatedArgument = await generatePlayerAssist(session, prompt, mode, selectedModel, selectedStyle);
    res.json({ argument: generatedArgument });
  } catch (error) {
    console.error('AI assist error:', error);
    res.status(500).json({ error: 'Failed to generate argument' });
  }
});

// Generate AI-assisted argument for the player
async function generatePlayerAssist(session, userPrompt, mode, model, style) {
  const styleConfig = ARGUMENT_STYLES[style] || ARGUMENT_STYLES.balanced;

  // Build comprehensive turn history with context
  const turnHistory = session.turns
    .map((t, i) => `=== ROUND ${i + 1} ===\n[YOUR PREVIOUS ARGUMENT - ${session.playerSide.toUpperCase()}]:\n${t.player}\n\n[OPPONENT'S RESPONSE - ${session.aiSide.toUpperCase()}]:\n${t.ai}`)
    .join('\n\n');

  const lastAiArgument = session.turns.length > 0
    ? session.turns[session.turns.length - 1].ai
    : null;

  const turnNumber = session.turns.length + 1;
  const isOpening = session.turns.length === 0;
  const isFinal = turnNumber === 3;

  // Build context about what opponent has argued
  let opponentAnalysis = '';
  if (session.turns.length > 0) {
    const opponentPoints = session.turns.map((t, i) => `Round ${i + 1}: ${t.ai.substring(0, 150)}...`).join('\n');
    opponentAnalysis = `
OPPONENT'S KEY ARGUMENTS SO FAR:
${opponentPoints}

You MUST directly address and counter the opponent's most recent points. Do not ignore what they said.`;
  }

  let promptText;

  if (mode === 'scratch') {
    promptText = `You are an expert legal advocate with decades of courtroom experience. You are arguing the ${session.playerSide.toUpperCase()} position in a formal legal debate.

====== CASE INFORMATION ======
CASE NAME: "${session.dilemma.title}"

FACTS OF THE CASE:
${session.dilemma.description}

YOUR ASSIGNED POSITION (${session.playerSide.toUpperCase()}):
${session.dilemma.positions[session.playerSide]}

OPPOSING POSITION (${session.aiSide.toUpperCase()}):
${session.dilemma.positions[session.aiSide]}

RELEVANT LEGAL CONTEXT:
${session.dilemma.context}

====== DEBATE HISTORY ======
${turnHistory || 'This is the opening round. No previous arguments have been made.'}
${opponentAnalysis}

====== YOUR TASK ======
This is ROUND ${turnNumber} of 3. ${isOpening ? 'This is your OPENING ARGUMENT.' : isFinal ? 'This is your CLOSING ARGUMENT - make it powerful and memorable.' : 'Continue building your case and rebut the opposition.'}

STYLE INSTRUCTION: ${styleConfig.instruction}

${lastAiArgument ? `YOUR OPPONENT JUST ARGUED:\n"${lastAiArgument}"\n\nYou MUST directly respond to their specific points before advancing your own arguments.` : ''}

REQUIREMENTS:
1. Stay STRICTLY in character as ${session.playerSide} - never argue for the other side
2. ${!isOpening ? 'DIRECTLY ADDRESS the opponent\'s most recent arguments point-by-point' : 'Establish your core thesis and key arguments'}
3. Use specific legal principles, doctrines, or precedents to support your position
4. Be persuasive and rhetorically powerful
5. Keep your argument between 150-200 words
6. Write ONLY the argument itself - no meta-commentary or explanations

Generate your ${session.playerSide} argument now:`;
  } else {
    promptText = `You are an expert legal advocate with decades of courtroom experience. You are helping articulate an argument for the ${session.playerSide.toUpperCase()} position.

====== CASE INFORMATION ======
CASE NAME: "${session.dilemma.title}"

FACTS OF THE CASE:
${session.dilemma.description}

YOUR ASSIGNED POSITION (${session.playerSide.toUpperCase()}):
${session.dilemma.positions[session.playerSide]}

OPPOSING POSITION (${session.aiSide.toUpperCase()}):
${session.dilemma.positions[session.aiSide]}

RELEVANT LEGAL CONTEXT:
${session.dilemma.context}

====== DEBATE HISTORY ======
${turnHistory || 'This is the opening round. No previous arguments have been made.'}
${opponentAnalysis}

====== USER'S IDEA ======
The user wants to make this point but needs help articulating it as a legal argument:
"${userPrompt}"

====== YOUR TASK ======
This is ROUND ${turnNumber} of 3. ${isOpening ? 'This is the OPENING ARGUMENT.' : isFinal ? 'This is the CLOSING ARGUMENT.' : 'Continue the debate.'}

STYLE INSTRUCTION: ${styleConfig.instruction}

${lastAiArgument ? `OPPONENT'S LAST ARGUMENT:\n"${lastAiArgument}"\n\nIncorporate a response to this while developing the user's idea.` : ''}

REQUIREMENTS:
1. Transform the user's idea into a polished, professional legal argument
2. Stay STRICTLY faithful to the ${session.playerSide} position
3. Preserve the user's core concept but enhance it with legal reasoning
4. ${!isOpening ? 'Weave in responses to the opponent\'s arguments' : 'Use this to establish a strong opening position'}
5. Add relevant legal principles, precedents, or doctrines
6. Keep between 150-200 words
7. Write ONLY the argument itself - no meta-commentary

Generate the enhanced argument now:`;
  }

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: `You are a world-class legal debater and advocate. You ONLY argue for the ${session.playerSide} position. You never break character or argue for the opposing side. You always directly engage with and rebut opponent arguments. Your responses are the argument itself with no preamble or explanation.`
      },
      { role: 'user', content: promptText }
    ],
    model: model,
    temperature: 0.75,
    max_tokens: 500
  });

  return completion.choices[0]?.message?.content || 'Failed to generate argument.';
}

// Generate AI opponent response
async function generateAIResponse(session, playerArgument) {
  const difficulty = session.difficulty || DIFFICULTIES.associate;
  const model = session.model || difficulty.model;

  const turnHistory = session.turns
    .filter(t => t.ai)
    .map(t => `Human (${session.playerSide}): ${t.player}\nAI (${session.aiSide}): ${t.ai}`)
    .join('\n\n');

  const prompt = `${difficulty.promptModifier}

You are arguing the ${session.aiSide} position in a debate about "${session.dilemma.title}".

CASE BACKGROUND:
${session.dilemma.description}

YOUR POSITION (${session.aiSide.toUpperCase()}):
${session.dilemma.positions[session.aiSide]}

LEGAL CONTEXT:
${session.dilemma.context}

${turnHistory ? `PREVIOUS EXCHANGES:\n${turnHistory}\n\n` : ''}

YOUR OPPONENT JUST ARGUED (${session.playerSide}):
"${playerArgument}"

Respond with a counter-argument for the ${session.aiSide}. Stay in character for your skill level.`;

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: model,
    temperature: difficulty.temperature,
    max_tokens: 500
  });

  return completion.choices[0]?.message?.content || 'The AI opponent could not formulate a response.';
}

// Generate judge's verdict
async function generateJudgeVerdict(session) {
  const model = session.model || 'llama-3.3-70b-versatile';

  const debateTranscript = session.turns
    .map(t => `--- Turn ${t.turn} ---\nHuman (${session.playerSide}): ${t.player}\nAI (${session.aiSide}): ${t.ai}`)
    .join('\n\n');

  const prompt = `You are an impartial AI judge evaluating a legal debate about "${session.dilemma.title}".

CASE BACKGROUND:
${session.dilemma.description}

LEGAL CONTEXT:
${session.dilemma.context}

POSITIONS:
- ${session.playerSide.toUpperCase()}: ${session.dilemma.positions[session.playerSide]}
- ${session.aiSide.toUpperCase()}: ${session.dilemma.positions[session.aiSide]}

FULL DEBATE TRANSCRIPT:
${debateTranscript}

As a judge, evaluate this debate and provide:

1. WINNER: Who won - "human" or "ai"? Base this purely on argument quality, not which side they were on.

2. SCORES (0-100 for each):
   - Legal Reasoning: How well did each side apply legal principles and precedent?
   - Persuasiveness: How compelling and well-structured were the arguments?
   - Rebuttal Quality: How effectively did each side address opposing arguments?
   - Overall: Holistic assessment

3. FEEDBACK FOR THE HUMAN:
   - What they did well (2-3 specific points)
   - Areas for improvement (2-3 specific suggestions)
   - Key legal concepts they should study further

4. KEY TAKEAWAY: One sentence summarizing the main legal lesson from this debate.

Respond in this exact JSON format:
{
  "winner": "human" or "ai",
  "humanScores": { "legalReasoning": X, "persuasiveness": X, "rebuttalQuality": X, "overall": X },
  "aiScores": { "legalReasoning": X, "persuasiveness": X, "rebuttalQuality": X, "overall": X },
  "humanStrengths": ["strength1", "strength2"],
  "humanImprovements": ["improvement1", "improvement2"],
  "conceptsToStudy": ["concept1", "concept2"],
  "keyTakeaway": "One sentence lesson",
  "judgeSummary": "2-3 sentence summary of the ruling"
}`;

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: model,
    temperature: 0.3,
    max_tokens: 800
  });

  const responseText = completion.choices[0]?.message?.content || '{}';

  // Try to parse JSON from response
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse judge response:', e);
  }

  // Fallback response
  return {
    winner: 'ai',
    humanScores: { legalReasoning: 60, persuasiveness: 60, rebuttalQuality: 60, overall: 60 },
    aiScores: { legalReasoning: 70, persuasiveness: 70, rebuttalQuality: 70, overall: 70 },
    humanStrengths: ['Engaged with the material', 'Attempted to make legal arguments'],
    humanImprovements: ['Cite more specific legal principles', 'Anticipate counterarguments better'],
    conceptsToStudy: ['Legal precedent', 'Burden of proof'],
    keyTakeaway: 'Strong legal arguments require both principle and precedent.',
    judgeSummary: 'The debate was competitive. Focus on strengthening your legal reasoning with specific citations and precedents.'
  };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Argue Against the Machine running on http://localhost:${PORT}`);
});
