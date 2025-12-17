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
  const { dilemmaId, playerSide } = req.body;

  const dilemma = DILEMMAS.find(d => d.id === dilemmaId);
  if (!dilemma) {
    return res.status(400).json({ error: 'Invalid dilemma ID' });
  }

  const aiSide = playerSide === 'prosecution' ? 'defense' : 'prosecution';

  // Create in database with hard-to-guess ID
  const sessionId = db.createDebate(dilemmaId, dilemma.title, playerSide, aiSide);

  const session = {
    id: sessionId,
    dilemma,
    playerSide,
    aiSide,
    turns: [],
    maxTurns: 3,
    currentTurn: 0,
    status: 'active'
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
    maxTurns: session.maxTurns
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

    const dilemma = DILEMMAS.find(d => d.id === dbDebate.dilemma_id);
    const turns = db.getTurns(sessionId);

    session = {
      id: sessionId,
      dilemma,
      playerSide: dbDebate.player_side,
      aiSide: dbDebate.ai_side,
      turns: turns.map(t => ({ turn: t.turn_number, player: t.player_argument, ai: t.ai_response })),
      maxTurns: 3,
      currentTurn: turns.length,
      status: 'active'
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
    res.status(500).json({ error: 'Failed to generate AI response' });
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

    const dilemma = DILEMMAS.find(d => d.id === dbDebate.dilemma_id);
    const turns = db.getTurns(sessionId);

    session = {
      id: sessionId,
      dilemma,
      playerSide: dbDebate.player_side,
      aiSide: dbDebate.ai_side,
      turns: turns.map(t => ({ turn: t.turn_number, player: t.player_argument, ai: t.ai_response })),
      maxTurns: 3,
      currentTurn: turns.length,
      status: dbDebate.status
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

  // Get dilemma details
  const dilemma = DILEMMAS.find(d => d.id === fullDebate.dilemma_id);

  res.json({
    id: fullDebate.id,
    dilemma: dilemma ? {
      title: dilemma.title,
      description: dilemma.description,
      context: dilemma.context,
      positions: dilemma.positions
    } : { title: fullDebate.dilemma_title },
    playerSide: fullDebate.player_side,
    aiSide: fullDebate.ai_side,
    status: fullDebate.status,
    turns: fullDebate.turns,
    verdict: fullDebate.verdict,
    createdAt: fullDebate.created_at
  });
});

// Serve debate replay page
app.get('/debate/:id', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Generate AI opponent response
async function generateAIResponse(session, playerArgument) {
  const turnHistory = session.turns
    .filter(t => t.ai)
    .map(t => `Human (${session.playerSide}): ${t.player}\nAI (${session.aiSide}): ${t.ai}`)
    .join('\n\n');

  const prompt = `You are an expert legal debater arguing the ${session.aiSide} position in a debate about "${session.dilemma.title}".

CASE BACKGROUND:
${session.dilemma.description}

YOUR POSITION (${session.aiSide.toUpperCase()}):
${session.dilemma.positions[session.aiSide]}

LEGAL CONTEXT:
${session.dilemma.context}

${turnHistory ? `PREVIOUS EXCHANGES:\n${turnHistory}\n\n` : ''}

YOUR OPPONENT JUST ARGUED (${session.playerSide}):
"${playerArgument}"

Respond with a strong counter-argument for the ${session.aiSide}. Be persuasive, cite relevant legal principles, anticipate their counter-arguments, and point out weaknesses in their reasoning. Keep your response focused and under 200 words. Do not be sycophantic or acknowledge good points - argue aggressively but professionally like a real courtroom lawyer.`;

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
    max_tokens: 400
  });

  return completion.choices[0]?.message?.content || 'The AI opponent could not formulate a response.';
}

// Generate judge's verdict
async function generateJudgeVerdict(session) {
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
    model: 'llama-3.3-70b-versatile',
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
