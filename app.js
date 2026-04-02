// ACUITY — App Script v2

// ─── THEME (IIFE — runs before paint) ─────────────────────────────────────
(function () {
  const saved = localStorage.getItem('acuity_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = saved === 'dark' ? '☀' : '☾';
})();

// ─── STATE ──────────────────────────────────────────────────────────────────
const state = {
  user: null,
  screen: 'auth',
  prevScreen: null,

  // Stats
  streak: 0,
  cardsStudied: 0,
  interviews: 0,
  accuracy: 74,

  // Interview
  interviewMode: null,
  interviewConfig: null,
  interviewStation: 1,
  interviewTotalStations: 6,
  interviewTimerInterval: null,
  interviewTimeLeft: 480,
  thinkTimerInterval: null,
  thinkTimeLeft: 120,
  interviewPhase: 'idle', // 'reading'|'think'|'respond'|'evaluating'|'follow-up'|'complete'
  isRecording: false,
  currentQuestion: null,
  speechTranscript: '',
  followUpQuestion: null,
  isFollowUpRound: false,

  // Audio — AI interviewer TTS
  aiTtsCtx: null,
  aiTtsSource: null,
  aiTtsPending: false,

  // Speech recognition
  recognition: null,

  // Tutor
  tutorTyping: false,
};

// ─── INTERVIEW QUESTION BANKS ────────────────────────────────────────────────
const MMI_QUESTIONS = [
  {
    topic: 'Medical Ethics · Patient Autonomy',
    stationType: 'Ethics',
    question: 'A patient with full decision-making capacity refuses a blood transfusion on religious grounds. Without it, they will likely die within 24 hours. The family is urging you to override the refusal. As the treating physician, how do you proceed?',
  },
  {
    topic: 'Collaboration & Hierarchy',
    stationType: 'Collaboration',
    question: 'You are a third-year medical student on rounds. You overhear your supervising resident give a patient discharge instructions that you believe contain a significant medication error. The attending has already signed off and left. What do you do?',
  },
  {
    topic: 'Critical Thinking · Evidence',
    stationType: 'Critical Thinking',
    question: 'A widely shared social media post claims that a common vaccine causes autism, citing a single study. A parent in your clinic refuses vaccination for their 4-year-old based on this post. The child has a younger sibling with a compromised immune system. How do you approach this situation?',
  },
  {
    topic: 'Professionalism · Accountability',
    stationType: 'Professionalism',
    question: 'You discover that a close colleague and friend — a fellow resident — has been submitting falsified patient notes to cover up errors in care. No patients have been visibly harmed yet, but the pattern is clear. What do you do?',
  },
  {
    topic: 'Health Equity · Access',
    stationType: 'Health Policy',
    question: 'Your hospital has one ICU bed remaining. Two patients need it urgently: a 67-year-old uninsured undocumented immigrant with a treatable infection, and a 45-year-old insured veteran with a chronic condition in acute exacerbation. Both have similar survival probabilities. How do you think through this allocation decision?',
  },
  {
    topic: 'Communication · Difficult Conversations',
    stationType: 'Communication',
    question: 'A family is demanding that you continue aggressive life-prolonging measures for their 84-year-old mother who has advanced dementia and end-stage heart failure. She left no advance directive. The care team believes further intervention causes suffering with no meaningful benefit. You need to have this conversation with the family today.',
  },
  {
    topic: 'Ethics · Confidentiality vs. Public Safety',
    stationType: 'Ethics',
    question: 'A patient confides during a routine visit that they have been driving commercially as a truck driver despite being diagnosed with epilepsy — a condition that legally disqualifies them. They beg you not to report it, saying they will lose their livelihood and cannot support their family. What do you do?',
  },
  {
    topic: 'Resilience · Self-Awareness',
    stationType: 'Behavioral',
    question: 'You are halfway through your third year of medical school and are seriously questioning whether medicine is right for you. You feel burned out, disconnected from patients, and increasingly resentful. A classmate notices and asks what is going on. What do you tell them, and what do you do?',
  },
  {
    topic: 'Systemic Bias · Cultural Competence',
    stationType: 'Cultural Competence',
    question: 'Research shows that Black patients are systematically undertreated for pain compared to white patients — in part because some medical training historically included false biological beliefs about pain tolerance. As a future physician, what is your responsibility when you know this bias exists in the system you are entering?',
  },
  {
    topic: 'AI & Emerging Technology in Medicine',
    stationType: 'Critical Thinking',
    question: 'An AI diagnostic tool your hospital has adopted flags a patient as high-risk for sepsis. The AI has a 94% accuracy rate but a known pattern of false positives in patients of a certain demographic. You are skeptical of the flag, but the patient is asking if they should be worried. How do you handle this?',
  },
];

const PANEL_QUESTIONS = [
  {
    topic: 'Motivation & Self-Awareness',
    stationType: 'Behavioral',
    question: 'Tell me about yourself — not your CV, but the person behind it. And be honest: why medicine specifically? Why not nursing, social work, or public health, which might let you help more people with less gatekeeping?',
  },
  {
    topic: 'Failure & Growth',
    stationType: 'Behavioral',
    question: 'Describe the most significant failure of your academic or professional life. Not a challenge you overcame heroically — an actual failure where you fell short. What did it reveal about you, and what have you actually changed because of it?',
  },
  {
    topic: 'Situational · Speaking Up',
    stationType: 'Professionalism',
    question: 'You are a first-year resident. During a procedure, your supervising attending makes a decision you believe is wrong and potentially harmful. You voice your concern quietly and are dismissed. The patient has not yet been harmed. What is your next move?',
  },
  {
    topic: 'Healthcare Systems',
    stationType: 'Health Policy',
    question: 'The U.S. spends more per capita on healthcare than any other developed nation, yet has worse outcomes on nearly every population health metric. As a future physician, what do you see as your specific responsibility in this system?',
  },
  {
    topic: 'Bias & Blind Spots',
    stationType: 'Cultural Competence',
    question: 'Every physician carries implicit biases shaped by their upbringing, training, and culture. Can you name a bias you are aware of in yourself, describe where you think it comes from, and explain what you actively do to counter it?',
  },
];

const VIRTUAL_QUESTIONS = [
  {
    topic: 'Introduction · Authenticity',
    stationType: 'Behavioral',
    question: 'In 90 seconds, tell us who you are — not your application, not your accomplishments. What should we know about you as a person that would never appear on a transcript?',
  },
  {
    topic: 'Formative Experience',
    stationType: 'Behavioral',
    question: 'Describe the clinical or research experience that most changed how you think about medicine — not the one that looks best on paper, but the one that actually shifted your perspective.',
  },
  {
    topic: 'Health Equity',
    stationType: 'Health Policy',
    question: 'Many physicians enter medicine with good intentions and still perpetuate health disparities unconsciously. What specific steps are you taking — right now, before you are even a physician — to ensure you will be part of the solution rather than the problem?',
  },
  {
    topic: 'Future Vision',
    stationType: 'Behavioral',
    question: 'If you could spend your career solving one problem in medicine — not the most prestigious problem, but the one that feels most urgent to you personally — what would it be and why?',
  },
];

const PHONE_QUESTIONS = [
  {
    topic: 'Program Fit',
    stationType: 'Behavioral',
    question: 'Thanks for taking the time to speak with us today. Our program has a strong emphasis on primary care and underserved communities. Given your background, what specifically draws you to that focus, and how does it connect to the kind of physician you want to become?',
  },
  {
    topic: 'Key Experience',
    stationType: 'Behavioral',
    question: 'Walk me through the experience — clinical, research, or personal — that you think best demonstrates your readiness for medical school. Not necessarily the most impressive one, but the one that most honestly represents who you are.',
  },
  {
    topic: 'Teamwork',
    stationType: 'Collaboration',
    question: 'Medicine is deeply collaborative. Tell me about a time you had to work effectively with someone whose style, background, or approach was very different from your own. What did you learn from that experience?',
  },
];

// ─── DOM REFS ────────────────────────────────────────────────────────────────
const screens    = document.querySelectorAll('.screen');
const bottomNav  = document.getElementById('bottomNav');
const backBtn    = document.getElementById('backBtn');
const topbarLogo = document.getElementById('topbarLogo');
const topbarScore= document.getElementById('topbarScore');
const toast      = document.getElementById('toast');

// ─── NAVIGATION ─────────────────────────────────────────────────────────────
function showScreen(id, opts = {}) {
  const prev = state.screen;
  state.prevScreen = prev;
  state.screen = id;

  if (prev === 'interview-active') clearTimers();

  screens.forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${id}`);
  if (target) target.classList.add('active');

  const noNav  = ['auth', 'interview-active'];
  const noBack = ['auth', 'home', 'mcat', 'interview-hub', 'tutor'];
  bottomNav.style.display  = noNav.includes(id)  ? 'none' : 'flex';
  backBtn.style.display    = noBack.includes(id) ? 'none' : 'block';
  topbarLogo.style.display = id === 'interview-active' ? 'none' : 'flex';
  topbarScore.style.display = (id !== 'auth' && id !== 'interview-active') ? 'flex' : 'none';

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === id);
  });

  if (id === 'home')               initHome();
  if (id === 'interview-active')   startInterviewSession();
}

// ─── AUTH ────────────────────────────────────────────────────────────────────
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const w = tab.dataset.tab;
    document.getElementById('authSignin').style.display = w === 'signin' ? 'block' : 'none';
    document.getElementById('authSignup').style.display = w === 'signup' ? 'block' : 'none';
  });
});

document.getElementById('signinBtn').addEventListener('click', () => {
  const email = document.getElementById('signinEmail').value.trim();
  const pass  = document.getElementById('signinPass').value;
  if (!email || !pass) { showToast('Please fill in all fields'); return; }
  loginUser({ name: email.split('@')[0], email });
});

document.getElementById('signupBtn').addEventListener('click', () => {
  const name  = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const pass  = document.getElementById('signupPass').value;
  if (!name || !email || !pass) { showToast('Please fill in all fields'); return; }
  if (pass.length < 6) { showToast('Password must be at least 6 characters'); return; }
  loginUser({ name, email });
});

document.getElementById('demoBtn').addEventListener('click', () => {
  loginUser({ name: 'Future Physician', email: 'guest@acuity.app', isGuest: true });
});

function loginUser(user) {
  state.user = user;
  localStorage.setItem('acuity_user', JSON.stringify(user));
  loadStats();
  showScreen('home');
}

// ─── HOME ────────────────────────────────────────────────────────────────────
function initHome() {
  const hr = new Date().getHours();
  const tod = hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening';
  const firstName = state.user?.name?.split(' ')[0] || 'Doctor';
  document.getElementById('homeGreeting').textContent = `Good ${tod}, ${firstName}.`;
  document.getElementById('statStreak').textContent     = state.streak;
  document.getElementById('statCards').textContent      = state.cardsStudied;
  document.getElementById('statInterviews').textContent = state.interviews;
  document.getElementById('statAccuracy').textContent   = state.accuracy + '%';
}

function loadStats() {
  const saved = localStorage.getItem('acuity_stats');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      state.streak       = s.streak       || 0;
      state.cardsStudied = s.cardsStudied || 0;
      state.interviews   = s.interviews   || 0;
      state.accuracy     = s.accuracy     || 74;
    } catch(e) {}
  }
}

function saveStats() {
  localStorage.setItem('acuity_stats', JSON.stringify({
    streak: state.streak, cardsStudied: state.cardsStudied,
    interviews: state.interviews, accuracy: state.accuracy,
  }));
}

// Quick actions + subject cards
document.querySelectorAll('[data-screen]').forEach(el => {
  el.addEventListener('click', () => { if (el.dataset.screen) showScreen(el.dataset.screen); });
});

document.querySelectorAll('.subject-card').forEach(card => {
  card.addEventListener('click', () => {
    const labels = { bb: 'B/B · Biological & Biochemical', cp: 'C/P · Chemical & Physical', cars: 'CARS · Critical Analysis', ps: 'P/S · Psychological & Social' };
    showScreen('tutor');
    setTimeout(() => {
      document.getElementById('tutorInput').value = `I want to study ${labels[card.dataset.subject] || card.dataset.subject}. What are the highest-yield topics I should focus on?`;
      document.getElementById('tutorInput').focus();
    }, 300);
  });
});

// ─── INTERVIEW SETUP ─────────────────────────────────────────────────────────
document.querySelectorAll('.interview-mode-card').forEach(card => {
  card.addEventListener('click', () => {
    state.interviewMode    = card.dataset.mode;
    state.interviewStation = 1;
    state.isFollowUpRound  = false;
    setupInterviewMode(card.dataset.mode);
    showScreen('interview-active');
  });
});

function setupInterviewMode(mode) {
  const configs = {
    mmi:    { label: 'MMI',    total: 6, timeMin: 8, thinkMin: 2, questions: MMI_QUESTIONS },
    panel:  { label: 'Panel',  total: 5, timeMin: 8, thinkMin: 1, questions: PANEL_QUESTIONS },
    virtual:{ label: 'Virtual',total: 4, timeMin: 3, thinkMin: 1, questions: VIRTUAL_QUESTIONS },
    phone:  { label: 'Phone',  total: 3, timeMin: 5, thinkMin: 1, questions: PHONE_QUESTIONS },
  };
  state.interviewConfig = configs[mode] || configs.mmi;
  state.interviewTotalStations = state.interviewConfig.total;
  state.interviewTimeLeft  = state.interviewConfig.timeMin  * 60;
  state.thinkTimeLeft      = state.interviewConfig.thinkMin * 60;
  state.interviewPhase = 'idle';
}

// ─── INTERVIEW SESSION ───────────────────────────────────────────────────────
function startInterviewSession() {
  stopRecognition();
  stopInterviewTTS();
  clearTimers();

  const cfg = state.interviewConfig;
  const idx = Math.min(state.interviewStation - 1, cfg.questions.length - 1);
  const q   = cfg.questions[idx];
  state.currentQuestion  = q;
  state.speechTranscript = '';
  state.followUpQuestion = null;
  state.isFollowUpRound  = false;

  const stationLabel = state.interviewMode === 'mmi' ? 'Station' : 'Question';
  document.getElementById('interviewType').textContent =
    `${cfg.label} · ${stationLabel} ${state.interviewStation} of ${state.interviewTotalStations}`;
  document.getElementById('interviewTopic').textContent    = q.topic;
  document.getElementById('interviewQuestion').textContent = q.question;

  // Reset candidate panel
  document.getElementById('candidateTranscript').innerHTML =
    '<p class="transcript-placeholder">Your response will appear here as you speak...</p>';
  document.getElementById('liveFeedback').innerHTML =
    '<div class="live-feedback__header">Live Feedback</div>';

  // Remove any follow-up box
  const existing = document.getElementById('followUpBox');
  if (existing) existing.remove();

  setMicState('idle');
  setStatus('reading', 'Reading question…');
  document.getElementById('soundBars').classList.remove('active');
  document.getElementById('interviewTimer').style.color = '';
  document.getElementById('thinkTimeBox').style.display = 'block';

  // Reset timers
  state.interviewTimeLeft = cfg.timeMin  * 60;
  state.thinkTimeLeft     = cfg.thinkMin * 60;
  updateTimerDisplay(document.getElementById('thinkTimer'), state.thinkTimeLeft);
  updateTimerDisplay(document.getElementById('interviewTimer'), state.interviewTimeLeft);

  // Update next button
  const nextBtn = document.getElementById('nextStationBtn');
  const isLast = state.interviewStation >= state.interviewTotalStations;
  nextBtn.textContent = isLast ? 'Finish Session →' : 'Next Station →';
  nextBtn.disabled = false;

  // AI interviewer reads the question, then think timer starts
  state.interviewPhase = 'reading';
  speakInterviewText(q.question, () => startThinkTimer());
}

// ─── THINK TIMER ─────────────────────────────────────────────────────────────
function startThinkTimer() {
  state.interviewPhase = 'think';
  setStatus('think', 'Preparation time');
  document.getElementById('thinkTimeBox').style.display = 'block';

  let t = state.thinkTimeLeft;
  updateTimerDisplay(document.getElementById('thinkTimer'), t);
  updateTimerDisplay(document.getElementById('interviewTimer'), state.interviewTimeLeft);

  state.thinkTimerInterval = setInterval(() => {
    t--;
    state.thinkTimeLeft = t;
    updateTimerDisplay(document.getElementById('thinkTimer'), t);
    if (t <= 0) {
      clearInterval(state.thinkTimerInterval);
      transitionToRespond();
    }
  }, 1000);
}

function transitionToRespond() {
  state.interviewPhase = 'respond';
  document.getElementById('thinkTimeBox').style.display = 'none';
  setStatus('ready', 'Ready — start speaking');
  setMicState('idle');

  let t = state.interviewTimeLeft;
  const timerEl = document.getElementById('interviewTimer');
  updateTimerDisplay(timerEl, t);

  state.interviewTimerInterval = setInterval(() => {
    t--;
    state.interviewTimeLeft = t;
    updateTimerDisplay(timerEl, t);
    if (t <= 30) timerEl.style.color = '#EF4444';
    else if (t <= 60) timerEl.style.color = '#F59E0B';
    else timerEl.style.color = '';
    if (t <= 0) { clearInterval(state.interviewTimerInterval); autoTimeUp(); }
  }, 1000);
}

function autoTimeUp() {
  if (state.isRecording) {
    stopRecognition();
    if (state.speechTranscript.trim()) {
      evaluateAnswer(state.speechTranscript);
    } else {
      setStatus('idle', 'Time\'s up');
      showToast('Time\'s up — move to next station');
    }
  } else {
    setStatus('idle', 'Time\'s up');
    showToast('Time\'s up');
  }
}

// ─── MIC BUTTON ──────────────────────────────────────────────────────────────
document.getElementById('micBtn').addEventListener('click', () => {
  if (state.interviewPhase === 'evaluating') {
    showToast('Please wait — evaluating your response…');
    return;
  }
  if (state.interviewPhase === 'reading' || state.interviewPhase === 'think') {
    // Allow early start by skipping think time
    clearInterval(state.thinkTimerInterval);
    stopInterviewTTS();
    transitionToRespond();
    // Small delay then auto-start recording
    setTimeout(() => startRecording(), 300);
    return;
  }
  if (state.interviewPhase !== 'respond' && state.interviewPhase !== 'follow-up') return;

  if (state.isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});

function startRecording() {
  state.isRecording = true;
  state.speechTranscript = '';
  setMicState('recording');
  setStatus('recording', 'Recording — speak now');
  document.getElementById('soundBars').classList.add('active');
  document.getElementById('candidateTranscript').innerHTML = '<p></p>';

  const recognized = initSpeechRecognition();
  if (!recognized) {
    // Fallback: no speech API — show manual input
    showManualInput();
  }
}

function stopRecording() {
  state.isRecording = false;
  setMicState('idle');
  setStatus('ready', 'Processing your response…');
  document.getElementById('soundBars').classList.remove('active');
  stopRecognition();

  const transcript = state.speechTranscript.trim();
  if (transcript.length > 5) {
    evaluateAnswer(transcript);
  } else {
    setStatus('ready', 'Nothing recorded — try again');
    showToast('No speech detected — try again');
  }
}

// ─── SPEECH RECOGNITION ─────────────────────────────────────────────────────
function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Speech recognition not available in this browser'); return false; }

  if (state.recognition) {
    try { state.recognition.stop(); } catch(e) {}
  }

  const r = new SR();
  r.continuous      = true;
  r.interimResults  = true;
  r.lang            = 'en-US';
  r.maxAlternatives = 1;

  let finalTranscript = '';

  r.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += t + ' ';
      } else {
        interim = t;
      }
    }
    state.speechTranscript = finalTranscript;
    const display = (finalTranscript + interim).trim();
    const el = document.getElementById('candidateTranscript');
    el.innerHTML = `<p>${escapeHtml(display)}</p>`;
    el.scrollTop = el.scrollHeight;
  };

  r.onerror = (e) => {
    if (e.error === 'not-allowed') {
      showToast('Microphone permission denied — please allow access');
      stopRecording();
    } else if (e.error === 'no-speech') {
      // ignore — user just paused
    }
  };

  r.onend = () => {
    // Auto-restart if still in recording state (handles natural pauses)
    if (state.isRecording) {
      try { r.start(); } catch(e) {}
    }
  };

  state.recognition = r;
  try { r.start(); return true; }
  catch(e) { showToast('Could not start microphone'); return false; }
}

function stopRecognition() {
  if (state.recognition) {
    try { state.recognition.stop(); } catch(e) {}
    state.recognition = null;
  }
  state.isRecording = false;
}

// Manual input fallback (Firefox / unsupported browsers)
function showManualInput() {
  const transcript = document.getElementById('candidateTranscript');
  transcript.innerHTML = `
    <textarea id="manualInput" placeholder="Type your response here (speech recognition not available in this browser)…"
      style="width:100%;height:120px;background:transparent;border:1px solid var(--border);border-radius:8px;
             color:var(--text);padding:10px;font-family:var(--font-body);font-size:14px;resize:none;outline:none;"></textarea>`;
  document.getElementById('manualInput').addEventListener('input', e => {
    state.speechTranscript = e.target.value;
  });
}

// ─── AI EVALUATION ───────────────────────────────────────────────────────────
async function evaluateAnswer(transcript) {
  clearTimers();
  state.interviewPhase = 'evaluating';
  setStatus('evaluating', 'Dr. Reyes is evaluating…');
  setMicState('disabled');
  document.getElementById('soundBars').classList.remove('active');
  document.getElementById('interviewTimer').style.color = '';

  // Show evaluating state in feedback panel
  const feedbackEl = document.getElementById('liveFeedback');
  feedbackEl.innerHTML = `
    <div class="live-feedback__header">Live Feedback</div>
    <div class="evaluating-indicator">
      <span></span><span></span><span></span>
      Evaluating your response…
    </div>`;

  try {
    const res = await fetch('/.netlify/functions/interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question:     state.currentQuestion.question,
        topic:        state.currentQuestion.topic,
        stationType:  state.currentQuestion.stationType || null,
        mode:         state.interviewMode,
        userAnswer:   transcript,
        isFollowUp:   state.isFollowUpRound,
      }),
    });

    const data = await res.json();
    renderEvaluation(data, transcript);

  } catch (err) {
    // Offline fallback
    renderEvaluation({
      score: 72,
      feedback: [
        { type: 'good', text: 'You engaged with the core issue directly' },
        { type: 'tip', text: 'Consider addressing all relevant stakeholders' },
      ],
      followUp: 'How would your approach change if the patient were a minor?',
      summary: 'Solid response with room to expand your reasoning.',
    }, transcript);
  }
}

function renderEvaluation(data, transcript) {
  const feedbackEl = document.getElementById('liveFeedback');

  // Score badge
  const scoreColor = data.score >= 85 ? '#34D399' : data.score >= 70 ? '#4F8EF7' : data.score >= 55 ? '#F0B429' : '#EF4444';
  const scoreLabel = data.score >= 85 ? 'Exceptional' : data.score >= 80 ? 'Strong' : data.score >= 65 ? 'Adequate' : data.score >= 50 ? 'Concerning' : 'Needs Work';

  feedbackEl.innerHTML = `
    <div class="live-feedback__header">
      <div>
        Evaluation
        ${data.competency ? `<span class="eval-competency">${data.competency}</span>` : ''}
      </div>
      <span class="eval-score" style="color:${scoreColor}" title="${scoreLabel}">${data.score}/100</span>
    </div>`;

  // Feedback items
  (data.feedback || []).forEach(item => {
    const el = document.createElement('div');
    el.className = `live-feedback-item live-feedback-item--${item.type}`;
    el.style.opacity = '0';
    el.innerHTML = `<span>${item.type === 'good' ? '◈' : '△'}</span> ${escapeHtml(item.text)}`;
    feedbackEl.appendChild(el);
    requestAnimationFrame(() => { el.style.transition = 'opacity 0.4s ease'; el.style.opacity = '1'; });
  });

  // Summary
  if (data.summary) {
    const sum = document.createElement('div');
    sum.className = 'eval-summary';
    sum.textContent = data.summary;
    feedbackEl.appendChild(sum);
  }

  // Follow-up question
  if (data.followUp && !state.isFollowUpRound) {
    state.followUpQuestion = data.followUp;
    state.interviewPhase = 'follow-up';
    showFollowUpQuestion(data.followUp);
  } else {
    state.interviewPhase = 'complete';
    setStatus('complete', 'Station complete');
    setMicState('idle');
  }
}

function showFollowUpQuestion(question) {
  // Remove existing
  const existing = document.getElementById('followUpBox');
  if (existing) existing.remove();

  const box = document.createElement('div');
  box.id = 'followUpBox';
  box.className = 'follow-up-box';
  box.innerHTML = `
    <div class="follow-up-label">◈ Follow-up Question</div>
    <p class="follow-up-text">${escapeHtml(question)}</p>`;

  const interviewerPanel = document.querySelector('.interviewer-panel');
  interviewerPanel.appendChild(box);

  // Update question display
  document.getElementById('interviewQuestion').textContent = question;

  // Reset for follow-up round
  state.isFollowUpRound  = true;
  state.speechTranscript = '';
  state.interviewTimeLeft = (state.interviewConfig.timeMin) * 60;
  document.getElementById('candidateTranscript').innerHTML =
    '<p class="transcript-placeholder">Respond to the follow-up question…</p>';

  setStatus('ready', 'Follow-up — respond when ready');
  setMicState('idle');

  // AI speaks the follow-up question
  speakInterviewText(question);

  // Start response timer for follow-up
  startFollowUpTimer();
}

function startFollowUpTimer() {
  clearTimers();
  let t = state.interviewTimeLeft;
  const timerEl = document.getElementById('interviewTimer');
  updateTimerDisplay(timerEl, t);

  state.interviewTimerInterval = setInterval(() => {
    t--;
    state.interviewTimeLeft = t;
    updateTimerDisplay(timerEl, t);
    if (t <= 30) timerEl.style.color = '#EF4444';
    else if (t <= 60) timerEl.style.color = '#F59E0B';
    else timerEl.style.color = '';
    if (t <= 0) { clearInterval(state.interviewTimerInterval); autoTimeUp(); }
  }, 1000);
}

// ─── NEXT STATION ────────────────────────────────────────────────────────────
document.getElementById('nextStationBtn').addEventListener('click', () => {
  if (state.interviewPhase === 'evaluating') {
    showToast('Please wait for evaluation to complete');
    return;
  }
  if (state.interviewStation >= state.interviewTotalStations) {
    endInterviewSession();
    return;
  }
  state.interviewStation++;
  state.isFollowUpRound = false;
  state.interviewPhase  = 'idle';
  state.interviewTimeLeft = state.interviewConfig.timeMin  * 60;
  state.thinkTimeLeft     = state.interviewConfig.thinkMin * 60;
  document.getElementById('interviewTimer').style.color = '';

  const stationLabel = state.interviewMode === 'mmi' ? 'Station' : 'Question';
  showToast(`${stationLabel} ${state.interviewStation} of ${state.interviewTotalStations}`);
  startInterviewSession();
});

// End session
document.getElementById('endInterviewBtn').addEventListener('click', () => {
  if (confirm('End this interview session?')) endInterviewSession();
});

function endInterviewSession() {
  stopRecognition();
  stopInterviewTTS();
  clearTimers();
  state.interviews++;
  saveStats();
  showToast('Session complete — great work!');
  showScreen('interview-hub');
}

// Back button
backBtn.addEventListener('click', () => {
  if (state.screen === 'interview-active') {
    if (confirm('Exit this interview session?')) {
      stopRecognition();
      stopInterviewTTS();
      clearTimers();
      showScreen('interview-hub');
    }
    return;
  }
  showScreen(state.prevScreen || 'home');
});

// ─── INTERVIEW TTS (AI INTERVIEWER SPEAKS) ───────────────────────────────────
async function speakInterviewText(text, onComplete) {
  stopInterviewTTS();
  state.aiTtsPending = true;
  document.getElementById('soundBars').classList.add('active');

  try {
    const res = await fetch('/.netlify/functions/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) throw new Error(`TTS ${res.status}`);

    const arrayBuffer = await res.arrayBuffer();

    if (!state.aiTtsCtx || state.aiTtsCtx.state === 'closed') {
      state.aiTtsCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.aiTtsCtx.state === 'suspended') await state.aiTtsCtx.resume();

    const audioBuffer = await state.aiTtsCtx.decodeAudioData(arrayBuffer);
    const source = state.aiTtsCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(state.aiTtsCtx.destination);

    source.onended = () => {
      state.aiTtsSource = null;
      state.aiTtsPending = false;
      document.getElementById('soundBars').classList.remove('active');
      if (onComplete) onComplete();
    };

    state.aiTtsSource = source;
    source.start(0);

  } catch (err) {
    // Fallback: Web Speech Synthesis
    state.aiTtsPending = false;
    document.getElementById('soundBars').classList.remove('active');
    if (window.speechSynthesis) {
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.92;
      utt.pitch = 1.0;
      utt.onend = () => { if (onComplete) onComplete(); };
      window.speechSynthesis.speak(utt);
    } else {
      if (onComplete) onComplete();
    }
  }
}

function stopInterviewTTS() {
  if (state.aiTtsSource) {
    try { state.aiTtsSource.stop(); } catch(e) {}
    state.aiTtsSource = null;
  }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  state.aiTtsPending = false;
  document.getElementById('soundBars').classList.remove('active');
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function clearTimers() {
  if (state.interviewTimerInterval) clearInterval(state.interviewTimerInterval);
  if (state.thinkTimerInterval)     clearInterval(state.thinkTimerInterval);
  state.interviewTimerInterval = null;
  state.thinkTimerInterval     = null;
}

function updateTimerDisplay(el, seconds) {
  if (!el) return;
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

function setStatus(type, label) {
  const el = document.getElementById('candidateStatus');
  const dotClass = {
    recording: 'candidate-status-dot--recording',
    ready:     'candidate-status-dot--ready',
    evaluating:'candidate-status-dot--evaluating',
    complete:  'candidate-status-dot--ready',
  }[type] || '';
  el.innerHTML = `<span class="candidate-status-dot ${dotClass}"></span> ${label}`;
}

function setMicState(mode) {
  const btn = document.getElementById('micBtn');
  btn.classList.remove('recording');
  btn.disabled = false;
  if (mode === 'recording') {
    btn.classList.add('recording');
    btn.innerHTML = '<span class="mic-icon">◉</span> Stop Recording';
  } else if (mode === 'disabled') {
    btn.disabled = true;
    btn.innerHTML = '<span class="mic-icon">◎</span> Please wait…';
  } else {
    btn.innerHTML = '<span class="mic-icon">◎</span> Start Speaking';
  }
}

// ─── TUTOR ───────────────────────────────────────────────────────────────────
const tutorMessages   = document.getElementById('tutorMessages');
const tutorInput      = document.getElementById('tutorInput');
const tutorSend       = document.getElementById('tutorSend');
const tutorSuggestions= document.getElementById('tutorSuggestions');

tutorSend.addEventListener('click', sendTutorMessage);
tutorInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTutorMessage(); }
});

document.querySelectorAll('.tutor-suggest').forEach(btn => {
  btn.addEventListener('click', () => {
    tutorInput.value = btn.textContent;
    sendTutorMessage();
    tutorSuggestions.style.display = 'none';
  });
});

async function sendTutorMessage() {
  const text = tutorInput.value.trim();
  if (!text || state.tutorTyping) return;
  tutorInput.value = '';
  tutorSuggestions.style.display = 'none';
  appendTutorMsg(text, 'user');
  state.tutorTyping = true;

  const typingId = appendTypingIndicator();
  try {
    const res = await fetch('/.netlify/functions/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    removeTypingIndicator(typingId);
    appendTutorMsg(data.reply || 'No response generated.', 'ai');
  } catch (err) {
    removeTypingIndicator(typingId);
    appendTutorMsg(getDemoResponse(text), 'ai');
  }
  state.tutorTyping = false;
}

function appendTutorMsg(text, role) {
  const div = document.createElement('div');
  div.className = `tutor-msg tutor-msg--${role}`;
  div.innerHTML = role === 'ai'
    ? `<div class="tutor-msg__avatar">A</div><div class="tutor-msg__bubble">${escapeHtml(text)}</div>`
    : `<div class="tutor-msg__bubble">${escapeHtml(text)}</div>`;
  tutorMessages.appendChild(div);
  tutorMessages.scrollTop = tutorMessages.scrollHeight;
}

function appendTypingIndicator() {
  const id  = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.className = 'tutor-msg tutor-msg--ai';
  div.id = id;
  div.innerHTML = `<div class="tutor-msg__avatar">A</div><div class="tutor-msg__bubble tutor-msg__typing"><span></span><span></span><span></span></div>`;
  tutorMessages.appendChild(div);
  tutorMessages.scrollTop = tutorMessages.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function getDemoResponse(text) {
  const t = text.toLowerCase();
  if (t.includes('oxidative phosphorylation') || t.includes('oxphos')) {
    return 'Oxidative phosphorylation occurs in the inner mitochondrial membrane and is the primary ATP source in aerobic cells.\n\nMCAT high-yield points:\n• Complexes I–IV form the ETC; Complex V is ATP synthase\n• NADH yields ~2.5 ATP; FADH₂ yields ~1.5 ATP\n• Net ATP from glucose: ~30–32 (aerobic)\n• Uncouplers (e.g. DNP) dissipate the proton gradient as heat\n\nCommon trap: knowing that cyanide blocks Complex IV → no ATP production → cell death.';
  }
  if (t.includes('mmi') || t.includes('ethics')) {
    return 'For MMI ethics stations, use this framework:\n\n1. Identify the tension — autonomy vs. beneficence? Individual vs. public?\n2. Acknowledge all perspectives — patient, family, care team, institution\n3. Apply the four principles (ABCD): Autonomy, Beneficence, Non-maleficence, Justice\n4. Propose a structured course of action\n5. Acknowledge complexity — there is rarely one right answer\n\nTip: Think out loud. Interviewers want to see your reasoning process, not just a conclusion.';
  }
  if (t.includes('cars') || t.includes('timing')) {
    return 'CARS timing strategy:\n\n• Budget 3–4 min per passage (53 min / 9 passages)\n• Skim for main idea and author\'s tone first — don\'t try to memorize details\n• Every answer is in the passage — go back and verify\n• For "main idea" questions: check paragraph 1 and the conclusion\n• Flag and skip: if stuck after 60 sec, move on\n• Never leave blank — educated guess beats zero\n\nKey insight: CARS tests inference, not recall. The correct answer often paraphrases something the passage implies, not states directly.';
  }
  return 'That\'s a great question. As your ACUITY tutor, I can help with specific MCAT concepts, interview frameworks, or study strategy.\n\nTry asking:\n• "Explain enzyme kinetics for the MCAT"\n• "How do I structure an MMI ethics response?"\n• "What are the highest-yield CARS strategies?"\n\nNote: Deploy to Netlify with ANTHROPIC_API_KEY for full AI-powered responses.';
}

// ─── THEME TOGGLE ────────────────────────────────────────────────────────────
document.getElementById('themeToggle').addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('acuity_theme', next);
  document.getElementById('themeToggle').textContent = next === 'dark' ? '☀' : '☾';
});

// ─── TOAST ───────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, duration = 2800) {
  if (toastTimer) clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ─── INIT ────────────────────────────────────────────────────────────────────
(function init() {
  const savedUser = localStorage.getItem('acuity_user');
  if (savedUser) {
    try { state.user = JSON.parse(savedUser); loadStats(); showScreen('home'); return; }
    catch(e) {}
  }
  showScreen('auth');
})();
