# Argue Against the Machine

A Human vs. AI debate platform where players argue legal/ethical dilemmas against an AI opponent, with an AI judge determining the winner.

## Educational Purpose

This game teaches legal argumentation by:
- **Active Learning**: Forces players to construct persuasive arguments under adversarial pressure
- **Socratic Method**: Mirrors the dialectic approach underlying legal education
- **Anticipating Counterarguments**: Players cannot win without addressing the opposing view - building the "thinking like a lawyer" skill
- **Immediate Feedback**: AI judge provides instant, detailed feedback on argument quality
- **Accessible Practice**: AI opponent ensures every player faces a competent adversary regardless of study group availability

## Features

- **8 Legal Dilemmas** including classics like The Speluncean Explorers
- **Choose Your Side**: Play as Prosecution or Defense
- **3-Round Debates**: Build your case across multiple exchanges
- **AI Opponent**: Argues aggressively using legal principles
- **AI Judge**: Provides detailed scores and feedback
- **Persistent Debates**: SQLite storage with shareable private links
- **Privacy-First**: Debates use hard-to-guess 21-character IDs, not indexed by search engines

## Local Setup

### 1. Get a Free Groq API Key

1. Go to [https://console.groq.com/keys](https://console.groq.com/keys)
2. Sign up for free (no credit card required)
3. Create a new API key
4. Copy the key

### 2. Configure the Application

Edit the `.env` file:

```
GROQ_API_KEY=gsk_your_actual_key_here
PORT=3000
```

### 3. Install & Run

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Railway (Free)

Railway offers free hosting with persistent storage - perfect for this app.

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 2. Deploy on Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click "New Project" > "Deploy from GitHub repo"
3. Select your repository
4. Add environment variable: `GROQ_API_KEY` = your key
5. Railway auto-detects Node.js and deploys

Your app will be live at a random URL like `your-app-name.up.railway.app`

### Privacy Features

- Debates are stored with 21-character nanoid URLs (e.g., `/debate/V1StGXR8_Z5jdHi6B-myT`)
- URLs are not guessable or enumerable
- `robots.txt` blocks search engine indexing
- `X-Robots-Tag: noindex` header on all responses
- No public listing of debates - only accessible via direct link

## Alternative Deployment: Render

1. Push to GitHub
2. Go to [render.com](https://render.com)
3. New > Web Service > Connect your repo
4. Environment: Node
5. Add `GROQ_API_KEY` environment variable
6. Deploy

## Technology Stack

- **Backend**: Node.js + Express
- **Database**: SQLite (better-sqlite3)
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **AI**: Groq API with Llama 3.3 70B model (free tier)

## Why Groq?

- No credit card required
- Fast inference
- Llama 3.3 70B is highly capable
- Generous free tier for educational use

## Legal Dilemmas Included

1. **The Speluncean Explorers** - Necessity defense and natural law
2. **The Trolley Problem** - Legal Edition
3. **The Autonomous Vehicle Dilemma** - AI liability
4. **The Whistleblower's Dilemma** - National security vs civil liberties
5. **The Right to Die** - Medical ethics and autonomy
6. **The AI Art Theft** - Copyright in the digital age
7. **The Corporate Manslaughter** - Executive liability
8. **The Stand Your Ground Case** - Self-defense and proportionality

## License

MIT
