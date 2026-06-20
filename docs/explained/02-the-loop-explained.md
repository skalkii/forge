# Part 2 — The Loop, Explained Step by Step

> **Who this is for:** everyone, non-engineers especially. If you've read [Part 1](01-architecture-explained.md) you know the parts; here we watch them work together by following **one developer's journey** from "stuck on GitHub" to "active VideoDB user." Terms are re-defined as they appear, and collected in the glossary at the end.

---

## The loop in one picture

The system runs the same six-stage loop over and over. Here it is. We'll then walk each stage slowly.

```mermaid
flowchart LR
    S1["1️⃣ SENSE"] --> S2["2️⃣ QUALIFY"] --> S3["3️⃣ CRAFT"] --> S4["4️⃣ HUMAN GATE"] --> S5["5️⃣ ACT"] --> S6["6️⃣ OBSERVE"]
    S6 -.->|"what we learn feeds<br/>back into judgment"| S2
    style S4 fill:#fde68a,stroke:#d97706,color:#000
```

> **Why a "loop"?** Because it never really ends. New problems appear on GitHub every hour, so the system keeps sensing, and what it *observes* at the end makes its future judgments better. Round and round.

A real-world analogy: it works like a **thoughtful, honest salesperson who only ever helps** — they read the room (sense), check the product genuinely fits (qualify), write a useful answer (craft), run it past their manager (gate), send it (act), and see if it landed (observe) — then do it again, a little wiser.

---

## Meet our example: "Dana"

To make this concrete, follow **Dana**, a developer who posts this on GitHub:

> *"I'm writing a script to pull one frame every 5 seconds out of a video with ffmpeg, but it keeps choking on large files. Anyone have a cleaner way?"*

Dana is hand-rolling something VideoDB does natively. Perfect fit. Let's trace her journey.

---

## Stage 1 — SENSE: find developers who are publicly stuck

**Goal:** discover GitHub threads where a developer is struggling with a problem VideoDB solves — *before* spending any money or thought on them.

```mermaid
flowchart TB
    Q["📝 Search terms<br/>(from the 'strategy')<br/>e.g. 'extract frames every n seconds'"] --> SEARCH["🔍 Search GitHub"]
    SEARCH --> RAW["Raw threads found<br/>(Dana's post is one)"]
    RAW --> DEDUP["🧮 Remove near-duplicates<br/>(same problem, different person?)"]
    DEDUP --> SIGNALS["🗄️ Saved as <b>signals</b>"]
    SIGNALS --> TRIAGE{"🪶 TRIAGE<br/>cheap AI:<br/>'real pain, worth it?'"}
    TRIAGE -->|"yes (~few)"| CAND["🗄️ Saved as <b>candidates</b>"]
    TRIAGE -->|"no (most)"| DROP["🗑️ Dropped & logged"]

    style CAND fill:#bbf7d0,stroke:#16a34a,color:#000
```

**What happens, in order:**

1. **Search.** On a timer (e.g. every 20 minutes), the **Discovery workflow** searches GitHub using a fixed set of search terms. Those terms live in one place called the **strategy** — the only part of the system that "knows" what we're hunting for. (We can swap the strategy to hunt for something else without touching anything else.)

2. **Each result is a "signal."** A **signal** = one raw GitHub thread we found, before any judgment. Dana's post becomes a signal. We store only what we need: the username, the link, the repo, and a short excerpt — *no emails, no profile scraping* (a deliberate data-minimization rule).

3. **Remove duplicates.** The same problem often appears in many threads. The system converts each signal's text into an **embedding** (a list of numbers capturing its *meaning*) and compares it to existing ones. If two are nearly identical, the later one is marked a duplicate of the first. This stops us paying to think about the same pain twice.

4. **Triage** (the first of our three AI agents). The **cheap, fast AI** reads each signal and answers one question: *"Is this a real, painful problem that's worth us spending money to pursue?"* Most signals are rejected right here (vendors advertising, already-solved questions, off-topic noise). The survivors are saved as **candidates**.

> **Why a cheap AI first?** Money. Research and the smart AI cost real money per use. Triage is a cheap filter so we only spend on threads that already look promising. **No money is spent before triage passes.**

Dana's signal is clearly real pain and a clean fit → it becomes a **candidate**. Discovery's job is done; it never waits for approval, it just keeps producing candidates.

---

## Stage 2 — QUALIFY: is VideoDB *genuinely* the best answer?

Now the **dispatcher** notices Dana's new candidate and starts a brand-new **Touch workflow** run just for her. (Remember from Part 1: one Touch run per candidate, so nobody blocks anybody.)

```mermaid
flowchart TB
    START["🚦 Dispatcher starts<br/>Dana's Touch run"] --> ENRICH["🔎 Research (Exa/Parallel)<br/>gather context — costs money,<br/>only now that she's promising"]
    ENRICH --> QUAL{"💪 QUALIFY<br/>strong AI:<br/>'Is VideoDB truly the best<br/>answer? How well does it fit?'"}
    QUAL -->|"fit score ≥ threshold"| GO["✅ Proceed to Craft"]
    QUAL -->|"fit score too low"| STOP["🗑️ Drop — don't touch"]

    style GO fill:#bbf7d0,stroke:#16a34a,color:#000
    style STOP fill:#fecaca,stroke:#dc2626,color:#000
```

**What happens:**

1. **Research ("enrich").** Only now — because Dana already passed the cheap filter — do we spend money on **Exa** and **Parallel** (outside web-research services). They pull extra context about the problem. Every penny is recorded in the database, and there's a **daily budget**: if we hit it, research shuts off automatically ("fails closed").

2. **Qualify** (the second AI agent, using the **strong, smarter AI**). It answers: *"Is VideoDB genuinely the best answer here — not a stretch?"* and produces a **fit score** (a number, e.g. 0.0–1.0). Only candidates scoring above a set threshold continue. If VideoDB is a poor fit, we drop the candidate and *don't* reach out. This is the "value-first" rule in action.

Dana's problem (frame extraction) is exactly what VideoDB does → high fit score → proceed.

---

## Stage 3 — CRAFT: write a genuinely helpful, honest reply

```mermaid
flowchart TB
    PICK["✍️ CRAFT (strong AI)"] --> LIB{"Is there a pre-tested<br/>code example that<br/>fits Dana's problem?"}
    LIB -->|"yes"| FILL["Pick that <b>snippet</b> +<br/>fill in Dana's specifics +<br/>write a friendly reply"]
    LIB -->|"no"| NOPE["🗑️ No example fits →<br/>don't reply<br/>(never invent code)"]
    FILL --> DISC["➕ Add the required<br/><b>disclosure line</b><br/>('I work on VideoDB…')"]
    DISC --> DRAFT["📄 Draft reply ready"]

    style DRAFT fill:#bbf7d0,stroke:#16a34a,color:#000
    style NOPE fill:#fecaca,stroke:#dc2626,color:#000
```

**What happens:**

1. **Pick a code example, don't invent one.** The **Craft** agent (third AI agent) does *not* write code from scratch. It chooses from a **library of pre-written, pre-tested code examples** ("snippets") and fills in Dana's specifics. There's a snippet for frame extraction, so it uses that. If *no* snippet fit her problem, the system would simply not reply. (This protects VideoDB's brand — no AI-improvised code ever goes out under VideoDB's name.)

2. **Write the reply** around that example: a warm, useful answer that actually solves Dana's problem.

3. **Add the disclosure.** A short honesty line — e.g. *"(I help build VideoDB — sharing because it fits this.)"* — is attached. This is mandatory.

The result is a **draft**: a complete reply, not yet posted.

---

## Stage 3.5 — The automatic graders (scorers)

Before any human sees Dana's draft, two **scorers** grade it:

```mermaid
flowchart LR
    DRAFT["📄 Dana's draft"] --> Q["🛡️ Quality scorer (AI)<br/>'Is this genuinely helpful?'<br/>(advisory)"]
    DRAFT --> G{"🛡️ Spam-guardrail (strict rules)<br/>• disclosure present?<br/>• under daily cap?<br/>• not a repeat contact?<br/>• kill-switch off?"}
    G -->|"all pass"| READY["✅ Goes to the human queue"]
    G -->|"any fail"| BLOCK["❌ Hard-blocked"]

    style READY fill:#bbf7d0,stroke:#16a34a,color:#000
    style BLOCK fill:#fecaca,stroke:#dc2626,color:#000
```

- The **quality scorer** uses AI to judge helpfulness — it's *advisory*, to inform the human.
- The **spam-guardrail** is deliberately *not* AI — it's simple, exact rules you can fully trust. Missing disclosure, over the cap, a repeat contact, or kill-switch on → the draft is **hard-blocked** and never reaches a human. Dana's draft passes all checks.

---

## Stage 4 — THE HUMAN GATE: a person decides

This is the heart of the whole design. The Touch workflow now **pauses** and waits. Dana's draft appears in the **dashboard** for a human reviewer.

```mermaid
flowchart TB
    PAUSE["⏸️ Touch run PAUSES<br/>(can sit for hours or days —<br/>everything is saved)"] --> SHOW["🖥️ Draft shown in dashboard:<br/>the reply, the disclosure (highlighted),<br/>the scores, the original thread"]
    SHOW --> HUMAN{"👤 Human reviewer<br/>chooses"}
    HUMAN -->|"Approve"| RESUME["▶️ Run resumes → ACT"]
    HUMAN -->|"Edit then approve"| EDIT["✏️ Edits saved first,<br/>then run resumes → ACT"]
    HUMAN -->|"Reject"| REJ["🗑️ Logged, no post,<br/>run ends"]

    style PAUSE fill:#fde68a,stroke:#d97706,color:#000
    style RESUME fill:#bbf7d0,stroke:#16a34a,color:#000
    style EDIT fill:#bbf7d0,stroke:#16a34a,color:#000
```

**What "pause" really means:** the system saves the entire half-finished run to the database and stops. It uses no resources while waiting. When the reviewer clicks **Approve**, the dashboard sends a "resume" message and the *same* run picks up exactly where it left off. This is why the workflow had to be split per-candidate (Part 1): so each pause blocks only its own draft.

The reviewer can **approve**, **edit then approve** (their edits are saved before posting), or **reject**. Nothing about Dana's draft becomes public until a human clicks approve.

> **The security view:** the dashboard is the *only* path to posting in public. So it's locked behind a password, every decision records *who* made it, and the reviewer can see exactly what will go out — disclosure and all.

Dana's reviewer reads the draft, sees it's genuinely helpful and properly disclosed, and clicks **Approve**.

---

## Stage 5 — ACT: post the reply (with a tracking tag)

```mermaid
flowchart TB
    APPROVED["✅ Approved"] --> CHECK{"Final safety checks:<br/>kill-switch off?<br/>posting enabled?"}
    CHECK -->|"no"| HOLD["⏸️ Held"]
    CHECK -->|"yes"| TAG["🔗 Add a <b>UTM tag</b> to the link<br/>(an invisible label that says<br/>'this visit came from Dana's reply')"]
    TAG --> POST["✋ Operate tool posts the reply<br/>to Dana's GitHub thread<br/>(as a real human account)"]
    POST --> DONE["🗄️ Recorded in <b>touches</b>"]

    style POST fill:#fde68a,stroke:#d97706,color:#000
    style DONE fill:#bbf7d0,stroke:#16a34a,color:#000
```

**What happens:**

1. **Final checks.** Even after approval, the system re-checks the kill-switch and a master "posting enabled" switch. Either can stop the post.

2. **Add a UTM tag.** Before posting, any link in the reply gets a **UTM tag**. A UTM is a small, invisible label added to a web link (you've clicked thousands of them). Ours encodes *which touch* this is. So if Dana later clicks the link and signs up, the system can connect that signup back to *this exact reply*. The tag's key piece is set to Dana's **touch ID**.

3. **Post.** The **operate tool** posts the reply to Dana's GitHub thread — using a real human account, never a bot. (Recall: this tool is connected to no AI; it runs only here, after approval.) The post is recorded in the `touches` table with the time it went out.

---

## Stage 6 — OBSERVE: did it actually work? (attribution)

Posting isn't success. **A developer becoming active is success.** The final stage connects the dots.

```mermaid
flowchart TB
    SIGNUP["Dana later clicks the link,<br/>signs up, and makes her<br/>first successful VideoDB API call"] --> EVENT["📥 A 'signup event' arrives<br/>carrying the UTM tag<br/>(= Dana's touch ID)"]
    EVENT --> JOIN{"🔗 Attribution join:<br/>match the event's tag to a touch,<br/>within the allowed time window"}
    JOIN -->|"match within window"| OUT["🗄️ Recorded in <b>outcomes</b><br/>= one ACTIVATED developer ✅"]
    JOIN -->|"no match / too late"| IGNORE["Counted as not attributable"]

    OUT --> METRIC["💰 Updates the headline number:<br/>cost per activated developer"]

    style OUT fill:#bbf7d0,stroke:#16a34a,color:#000
    style METRIC fill:#dbeafe,stroke:#2563eb,color:#000
```

**What happens:**

1. **The success event.** Our defined success is a developer's **first successful VideoDB API call** — proof they didn't just sign up, they actually *used* the product.

2. **Attribution.** A regular job matches incoming signup events to our posted touches by the **UTM tag** — *if* the activation happened within an allowed **time window** (e.g. 21 days). "Attribution" just means *proving the cause*: Dana became active *because of* the reply we posted on her thread. A match is recorded in the `outcomes` table as one **activated developer**.

3. **The metric updates.** Now the headline number can be computed:

> **Cost per activated developer = total money spent ÷ activated developers.**

We report this honestly — a confident lower bound, never an inflated guess. If attribution is uncertain, we don't claim it.

4. **Learning.** Outcomes feed back: which kinds of threads, replies, and templates actually lead to activation? That sharpens future triage and qualify decisions. The loop comes full circle.

---

## The honest funnel (why numbers shrink at each stage)

Lots goes in the top; few come out the bottom — and that's *correct*. Each stage is a filter that saves money and protects quality.

```mermaid
flowchart TB
    A["🔍 <b>Signals</b> — every thread we found<br/>(lots)"] --> B["🪶 <b>Triaged</b> — cheap AI said 'real pain'<br/>(fewer)"]
    B --> C["💪 <b>Qualified</b> — strong AI said 'VideoDB fits'<br/>(fewer still)"]
    C --> D["✍️ <b>Drafted</b> — a reply was written"]
    D --> E["👤 <b>Approved</b> — a human said yes"]
    E --> F["✋ <b>Posted</b> — live on GitHub"]
    F --> G["✅ <b>Activated</b> — first successful API call<br/>(the prize)"]

    style A fill:#f1f5f9,color:#000
    style G fill:#bbf7d0,stroke:#16a34a,color:#000
```

> **Important honesty note:** we never present a projected conversion rate as a *target*. The dashboard shows the *real* count at each stage. Early on, the bottom stages may read zero — that's truthful, not a failure.

---

## Two things happening in the background, always

### A) Cost metering — every penny, every time
Every paid action — each AI call, each web search — writes a row to the `cost_events` table the moment it happens. This is what makes "cost per activated developer" trustworthy: it's measured, not estimated. There's also a daily research budget that shuts spending off when hit.

### B) Experiments — learning what works (A/B tests)
We don't guess which approach works best; we **test**. An **experiment** (an "A/B test") tries two versions of something — say, two different disclosure wordings — and compares which leads to more activations.

```mermaid
flowchart LR
    CAND["A new touch"] --> ASSIGN{"Assign a variant<br/>(deterministic —<br/>same touch always<br/>gets the same one)"}
    ASSIGN -->|"Variant A"| VA["Wording A"]
    ASSIGN -->|"Variant B"| VB["Wording B"]
    VA --> OUTA["Outcomes for A"]
    VB --> OUTB["Outcomes for B"]
    OUTA --> CMP["📊 Compare activation rates<br/>per variant"]
    OUTB --> CMP
```

Each touch carries its experiment and variant label, and the same UTM machinery that proves activation also tells us *which variant* earned it. That's how we improve with evidence instead of opinion.

---

## When things go wrong (the system is honest about it)

Not every run succeeds — GitHub might rate-limit us, an AI call might fail, a search might error. The system is built to fail *safely and visibly*:

```mermaid
flowchart TB
    ERR["⚠️ Something fails<br/>(AI error, GitHub limit, etc.)"] --> CATCH["The failure is caught<br/>(not hidden)"]
    CATCH --> LOG["🗄️ Written to the <b>errors</b> table"]
    LOG --> SHOW["🖥️ Shown on the dashboard's<br/>Errors screen, with context"]
    SHOW --> RETRY["🔁 A human can re-queue it<br/>to try again"]

    style ERR fill:#fecaca,stroke:#dc2626,color:#000
```

- **GitHub politeness:** the system respects GitHub's rate limits (how often you're allowed to ask), spaces out its actions, and backs off when told to. It's a careful, low-frequency guest, never a hammer.
- **Nothing fails silently:** errors are logged and surfaced, never swallowed.

---

## The whole journey, one final diagram

```mermaid
flowchart TB
    GH["🌐 Dana posts on GitHub"]
    GH --> SENSE["1️⃣ SENSE: found → deduped →<br/>triaged → saved as candidate"]
    SENSE --> QUAL["2️⃣ QUALIFY: researched →<br/>strong AI confirms VideoDB fits"]
    QUAL --> CRAFT["3️⃣ CRAFT: picks a tested code example,<br/>writes reply, adds disclosure"]
    CRAFT --> SCORE["🛡️ Scorers grade it<br/>(disclosure check is strict)"]
    SCORE --> GATE{"4️⃣ HUMAN GATE<br/>approve / edit / reject"}
    GATE -->|approved| ACT["5️⃣ ACT: UTM-tag the link,<br/>post as a real human"]
    GATE -->|rejected| ENDR["logged, ends"]
    ACT --> OBS["6️⃣ OBSERVE: Dana signs up &<br/>makes first API call → attributed"]
    OBS --> WIN["✅ +1 activated developer"]
    WIN --> METRIC["💰 cost per activated developer updates"]
    OBS -.->|lessons| QUAL

    style GATE fill:#fde68a,stroke:#d97706,color:#000
    style WIN fill:#bbf7d0,stroke:#16a34a,color:#000
    style METRIC fill:#dbeafe,stroke:#2563eb,color:#000
```

That's the complete loop. **Part 3** now shows you the dashboard — the window through which humans watch every stage above and approve the one step that matters.

---

## Glossary (loop-specific terms)

| Term | Meaning |
|---|---|
| **A/B test / experiment** | Running two versions of something to see which performs better. |
| **Attribution** | Proving a developer's activity was *caused* by a reply we posted. |
| **Attribution window** | The time limit (e.g. 21 days) within which a signup must happen to count as caused by our touch. |
| **Candidate** | A signal that passed triage — worth pursuing. |
| **Cost metering** | Recording every penny spent, as it's spent. |
| **Dispatcher** | Starts one Touch run per new candidate. |
| **Embedding** | Numbers representing a text's meaning; used to find duplicate threads. |
| **Enrich / research** | Paid web look-up (Exa/Parallel) done only after triage passes. |
| **Fail closed** | When unsure or over-budget, *stop* rather than risk acting. |
| **Fit score** | The qualify agent's number for how well VideoDB fits a problem. |
| **Outcome** | A recorded activation — a developer who made their first successful API call, attributed to us. |
| **Signal** | A raw GitHub thread we found, before judgment. |
| **Snippet** | A pre-tested code example the Craft agent fills in (never freehand). |
| **Strategy** | The single place defining what we hunt for and how we measure success. |
| **Touch** | One outreach to one developer about one thread — the basic unit of work. |
| **Touch ID** | The unique label for a touch, carried by the UTM tag to enable attribution. |
| **Triage** | The cheap first AI filter: "real pain, worth spending on?" |
| **UTM tag** | An invisible label on a link that records which reply a visit/signup came from. |
| **Variant** | One version (A or B) within an experiment. |
