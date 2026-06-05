# 10-Day Interview Preparation Plan & Tools Guide

## For Staff Engineer & AI Architect — DelegateCart Project

---

## RECOMMENDED TOOLS

### 1. Google NotebookLM (HIGHLY RECOMMENDED)
**What**: AI-powered research assistant by Google that creates podcasts and study guides from your documents.  
**How to use for DelegateCart**:
1. Upload ALL your interview-prep docs (01-04 + this guide) into a single NotebookLM notebook
2. Upload your `ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, `FUNCTIONAL_REQUIREMENTS.md`
3. Use the **Audio Overview** feature — it generates a podcast-style discussion between two AI hosts covering your documents
4. Listen during commute/gym — retention through passive listening
5. Use the **Q&A** feature to ask questions about your own codebase
6. Generate study guides and flashcards from your documents

**Verdict**: Extremely helpful. The podcast feature alone gives you a way to review material passively. Upload all docs from `docs/interview-prep/` plus the root-level markdown files.

### 2. ChatGPT / Claude (ESSENTIAL)
**What**: Conversational AI for mock interviews  
**How to use**:
- Paste your architecture doc, ask: "Interview me as a Staff Engineer panel. Ask hard follow-up questions."
- Paste a specific answer, ask: "What holes would a principal engineer find in this answer?"
- Practice explaining trade-offs: "Why Kafka over RabbitMQ? Play devil's advocate."
- Ask for system design mock interviews

### 3. Excalidraw (FREE)
**What**: Whiteboard tool for system design diagrams  
**How to use**: Practice drawing DelegateCart's architecture from memory. In Staff Engineer interviews, you'll often whiteboard. Practice until you can draw the full system in 5 minutes.  
**URL**: https://excalidraw.com

### 4. Anki (Flashcards)
**What**: Spaced repetition flashcard app  
**How to use**: Create cards from Section M (Rapid-Fire Questions) of the Q&A document. Review daily — spaced repetition optimizes memorization.

### 5. Mermaid Live Editor (Diagrams)
**What**: Text-to-diagram tool  
**How to use**: Practice converting architectures to Mermaid syntax. Shows deep understanding when you can describe systems both verbally and diagrammatically.  
**URL**: https://mermaid.live

### 6. System Design Primer (GitHub)
**What**: Free comprehensive system design resource  
**How to use**: Cross-reference DelegateCart's patterns with industry patterns. Strengthens your vocabulary.  
**URL**: github.com/donnemartin/system-design-primer

---

## 10-DAY PREPARATION PLAN

### Day 1-2: Foundation (Read & Absorb)
- [ ] Read `01_TECHNICAL_ARCHITECTURE_DEEP_DIVE.md` end-to-end (2 hrs)
- [ ] Read `02_FUNCTIONAL_KT_DOCUMENTATION.md` end-to-end (2 hrs)
- [ ] Upload all docs to NotebookLM, generate and listen to Audio Overviews
- [ ] Create Anki flashcards for all 14 sections of Q&A doc (Section A-N)

### Day 3-4: Deep Dive Code (Hands-On)
- [ ] Walk through the codebase — open every file referenced in docs
- [ ] Run `docker-compose up` and interact with every feature
- [ ] Trace a buy request end-to-end through Kafka topics (use logs)
- [ ] Read `03_TECHNICAL_KT_DOCUMENTATION.md` alongside actual code
- [ ] Understand every NestJS module: open the controller → service → DTO

### Day 5-6: AI/ML Focus
- [ ] Read the AI service Python code (`apps/ai-service/app/`)
- [ ] Understand the recommendation engine scoring algorithm
- [ ] Practice explaining the 5-factor ranking formula with numbers
- [ ] Study the Intent Parser prompt engineering
- [ ] Review Autopilot Engine decision engine and safety layers
- [ ] Practice explaining AI safety measures (5 layers)

### Day 7-8: Mock Interviews
- [ ] Use ChatGPT/Claude for 3 mock system design interviews (1 hr each)
- [ ] Practice whiteboarding DelegateCart on Excalidraw (repeat until fluent)
- [ ] Practice Q&A from Section L (Behavioral) — record yourself and review
- [ ] Have a friend ask you random questions from the Q&A doc
- [ ] Practice "reverse interviewing" — prepare questions about THEIR architecture

### Day 9: Weak Spots & Polish
- [ ] Review Anki cards (focus on cards you keep getting wrong)
- [ ] Re-listen to NotebookLM Audio Overview
- [ ] Practice explaining the most complex flows: Autonomous Shopping, HITL Approval, Wallet Security
- [ ] Prepare "Tell me about yourself" with DelegateCart as the centerpiece
- [ ] Prepare 2-minute and 10-minute versions of the project overview

### Day 10: Final Review & Rest
- [ ] Speed review all 4 documents (skim, not deep read)
- [ ] Do one final mock interview
- [ ] Review SVG diagrams — memorize the flow directions
- [ ] Prepare your laptop with code ready to show (keep VS Code open on DelegateCart)
- [ ] Get good sleep

---

## KEY TALKING POINTS TO MEMORIZE

### The 30-Second Pitch
"DelegateCart is an AI-powered autonomous commerce platform. Users delegate shopping tasks to AI agents that search multiple merchants, rank products using ML, and execute purchases autonomously — all within safety guardrails like spending limits, confidence thresholds, and human-in-the-loop approvals."

### The 2-Minute Deep Dive
Add to the pitch: "The system is built as a monorepo with 7 microservices — NestJS backend, Next.js frontend, 4 Python AI services, and an Autopilot Engine. Services communicate via Kafka using choreography pattern. The Agentic Commerce Protocol standardizes how AI agents interface with heterogeneous merchant APIs. Security includes 9-layer defense-in-depth, RBAC with 7 roles, wallet fraud detection, and comprehensive audit trails."

### The "Why This Architecture" Answer
"I chose event-driven microservices because autonomous shopping is inherently asynchronous — a buy request might take seconds to minutes to process through intent parsing, product aggregation, ranking, and decision-making. Kafka gives us durability for replay, ordered processing per user, and independent service scaling. The trade-off is operational complexity, which we manage with Docker Compose for dev and Kubernetes for production."

### The AI Safety Answer
"We take a defense-in-depth approach to AI safety. Five layers: decision guardrails validate every AI output, intent guardrails check for reasonable inputs, execution guardrails verify purchases before they happen, confidence thresholds ensure uncertain decisions get human review, and wallet-level spending limits cap AI spending. Every decision stores explainable reasoning that users can review."

---

## TOOLS COMPARISON TABLE

| Tool | Cost | Best For | Time Investment |
|------|------|----------|-----------------|
| NotebookLM | Free | Passive learning (podcasts) | 30 min setup, then listen |
| ChatGPT/Claude | $20/mo | Mock interviews, Q&A practice | 1 hr/day |
| Excalidraw | Free | Whiteboard practice | 30 min/day |
| Anki | Free | Memorizing facts & patterns | 15 min/day |
| System Design Primer | Free | Architecture vocabulary | 2 hrs total |

---

## RED FLAGS TO AVOID IN INTERVIEW

1. **Don't say "vibe coded"** — You "rapidly prototyped with AI-assisted development"
2. **Don't be vague** — Always cite specific numbers (30+ models, 7 services, 11 Kafka topics)
3. **Don't just describe** — Explain WHY you chose each technology
4. **Don't forget trade-offs** — Every answer should include "the trade-off is..."
5. **Don't oversell** — Be honest about what's production-ready vs. demo-quality
6. **Don't ignore failures** — Mention what you'd do differently (Q42 in Q&A doc)

---

## VOCABULARY CHEAT SHEET

Use these terms naturally in interviews:
- **Choreography** (not orchestration) — for your event-driven flow
- **Saga pattern** — for distributed transactions
- **Circuit breaker** — for fault tolerance
- **Idempotency** — for payment safety
- **Defense-in-depth** — for security layers
- **Explainable AI** — for decision transparency
- **Human-in-the-loop** — for approval workflows
- **Agentic commerce** — for autonomous shopping
- **Cache-aside pattern** — for Redis caching
- **BFF pattern** — for Next.js API routes
- **Consumer groups** — for Kafka scaling
- **Compensating transactions** — for rollback
