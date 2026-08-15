Top SOTA Models for Coding/Architecture/Security Audits/Planning - (Preferred thinking levels)

1a Fable 5 (Medium-High)
1b Sol 5.6 (Extra-High-Max)
1c Opus 5 (Me-H)
1d Terra 5.6 (xH-Mx)
---

2nd Level Sota

2 deepseek-v4-pro-0813
3 Kimi k-3 (H-xH)
4 GLM 5.2 (H-xH)
5 Luna 5.6 (xH-Mx)

---

3rd Level

6 deepseek-v4-flash-0731
7 Sonnet 5 (M-H)
8 Gemini 3.6 flash (H-xH)
9 Gemini 3.1 Pro (H-xH)
10 Nemotron Ultra (M-H)

---

4th Level

MiniMax M3 (M-H)
Nemotron Super (M-H)
nemotron-3.5-lightning-30b-a3b
muse-glimmer-30b
Llama 4 Maverick (M-H)
step 3.7 flash (M-H)
Inkling (M-H)
OSS-120B (M-H)
llama-4-scout (M-H)

---

=============

Agents

All Purpose Workhorses
deepseek-v4-pro-0813
deepseek-v4-flash-0731
GLM 5.2 (H-xH)
Kimi k-3 (H-xH)
Luna 5.6 (xH-Mx)
Terra 5.6 (xH-Mx)
Sol 5.6 (Extra-High-Max)
Opus 5 (Me-H)

---

Coding
Fable 5 (Medium-High)
Sol 5.6 (Extra-High-Max)
Opus 5 (Me-H)
Terra 5.6 (xH-Mx)
GLM 5.2 (H-xH)
Kimi k-3 (H-xH)
deepseek-v4-pro-0813
deepseek-v4-flash-0731
Luna 5.6 (xH-Mx)

---

Research
deepseek-v4-flash-0731
Sonnet 5 (M-H)
Gemini 3.7 flash (H-xH) (when avail)
Gemini 3.6 flash (H-xH)
Gemini 3.1 Pro (H-xH)
MiniMax M3 (M-H)
Nemotron Ultra (M-H)
Nemotron Super (M-H)
Llama 4 Maverick (M-H)
nemotron-3.5-lightning-30b-a3b
muse-glimmer-30b

---

Audits
Fable 5 (Medium-High)
Sol 5.6 (Extra-High-Max)
deepseek-v4-pro-0813
deepseek-v4-flash-0731
Opus 5 (Me-H)
Terra 5.6 (xH-Mx)
GLM 5.2 (H-xH)
Kimi k-3 (H-xH)
Luna 5.6 (xH-Mx)

---

Creative Writing (Marketing Content)
Sonnet 5 (M-H)
deepseek-v4-flash-0731
Gemini 3.7 flash (H-xH) (when avail)
Gemini 3.6 flash (H-xH)
Gemini 3.1 Pro (H-xH)
MiniMax M3 (M-H)
Nemotron Super (M-H)
Llama 4 Maverick (M-H)
nemotron-3.5-lightning-30b-a3b
muse-glimmer-30b

---

Intent Routing + Agent Orchestration
To keep the rate limited accounts from accruing these tokens keep routing agent to Cloudflare models
deepseek-v4-pro-0813
deepseek-v4-flash-0731
glm 5.2
kimi k2.7

---

Bounded Trivial Tasks

- Well-defined Tasks under supervision
- Trivial Data processing tasks
- Intent Routing
- Web Search
- Computer-use
- Work Must Always be Verifiable

nemotron-3.5-lightning-30b-a3b
muse-glimmer-30b
Sonnet 5 (M-H)
Gemini 3.7 flash (H-xH) (when avail)
Gemini 3.6 flash (H-xH)
Gemini 3.1 Pro (H-xH)
MiniMax M3 (M-H)
Nemotron Ultra (M-H)
Nemotron Super (M-H)
Llama 4 Maverick (M-H)
step 3.7 flash (M-H)
Inkling (M-H)
OSS-120B (M-H)
llama-4-scout (M-H)

---

Media Generation
@cf/black-forest-labs/flux-2-klein-9b
@cf/black-forest-labs/flux-2-klein-4b
@cf/leonardo/lucid-origin
@cf/leonardo/phoenix-1.0
@cf/llava-hf/llava-1.5-7b-hf

---

Audio Models
@cf/deepgram/aura-2-en
@cf/deepgram/flux
@cf/pipecat-ai/smart-turn-v2
@cf/deepgram/nova-3
@cf/myshell-ai/melotts
@cf/openai/whisper-large-v3-turbo
@cf/openai/whisper-tiny-en
---

Routing Strategy:

Free Account Dependability --Neon provides the BEST models. Sol, Fable followed by Opus and Terra are the top level models that would be the 1st attempt. as we work well be able to collect data on the neon perf. and decide if the neon api can handle the major workhorse type work wed love to get from one of these guys. likely Sol or Terra as they seem to have the best cost per quality on cursor bench type work.

After Neon - Comes Nvidia - another FREE endpoint.

Top models here are GLM 5.2, Kimi k2.7, followed by several mid-range research and trivial task models. But GLM and Kimi are acceptable for long horizon, coding, research, and audits.

Then we have Two paid accounts through cloudflare. Tons of useless models for edge devices and deprecated endpoints etc. hopefully they upgrade their provider models soon. we can NOT use ai gateway with our 20k credit.s but weCAN use workers AI so we will use it Up!

OH THEY JUST DROPPED DEEPSEEK PRO AND FLASH!! LETS GOO!!

@cf/deepseek-ai/deepseek-v4-pro-0813
@cf/deepseek-ai/deepseek-v4-flash-0731

these are obv there top two models, followed by glm 5.2 kimi k2.7 followed by several other mid-tier models that are great for research, trivial stuff, creative, media gen, stt<>tts, embeddings, etc.,

We should hook these models up NOW and syn our surfaces :) i cant wait to try them out!

Nvidia also dropped the meta muse glimmer and the nemotron lightning. wire em and sync agency/surfaces.

==========

Valid Entry (optional): ElevenLabs Agent + Video = Always on voice/avatar stream with a continual feed from Eve
Valid Entry (required): Eve = Orchestrator + Intent Router
Valid Entry (optional): Subagents = 2/3rd level All Purpose, Coding, Audits, Research, Marketing Content
Valid Entry (optional): Sub-Subagents = 4th level bounded tasks working in well-defined roadmaps with verifiable gates and 1st level Model Audits

==========
