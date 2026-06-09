const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data.json');

// ─────────────────────────────────────────────
// DATA HELPERS
// ─────────────────────────────────────────────
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const init = { settings: { botToken: '', adminChatId: '' }, clients: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(init, null, 2));
    return init;
  }
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch(e) { console.error('Data read error:', e); return { settings:{}, clients:[] }; }
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ─────────────────────────────────────────────
// STEP SEQUENCES
// ─────────────────────────────────────────────
const STEPS = {
  company: [
    { id:'pre_evisa_notify',    phase:'입국 전',    name:'eVISA 신청 안내 발송',   timing:'입국 3주 전',
      msg:`안녕하세요 {rep}님 👋\n\nUAE 입국 준비를 시작합니다!\n입국 약 3주 전 eVISA 신청이 필요합니다.\n\n📋 준비 서류:\n• 여권 스캔본 (6개월 이상 유효)\n• 증명사진 (흰 배경)\n• 신청서 (저희가 안내드립니다)\n\n준비 완료 후 "완료" 라고 답장 주세요 😊` },
    { id:'pre_evisa_received',  phase:'입국 전',    name:'eVISA 발급 확인',        timing:'입국 2주 전',
      msg:`eVISA가 발급되었나요? 📧\n\n이메일로 eVISA를 수령하셨으면 "완료" 라고 답장 주세요.\n아직 못 받으셨다면 알려주세요!` },
    { id:'entry',               phase:'입국',       name:'입국 완료',              timing:'D-Day',
      msg:`UAE 입국을 환영합니다! 🇦🇪✈️\n\n앞으로 약 2.5주 내 다음 절차가 진행됩니다:\n1️⃣ Medical Test (1-3일)\n2️⃣ Biometrics 등록 (3-5일)\n3️⃣ Immigration Card (5-7일)\n4️⃣ Emirates ID Card (7-10일)\n5️⃣ 개인 은행 계좌 (10-14일)\n6️⃣ 법인 은행 계좌 (12-17일)\n\n일정에 따라 안내드리겠습니다!` },
    { id:'medical',             phase:'입국 후',    name:'Medical Test 완료',      timing:'입국 후 1-3일',
      msg:`안녕하세요! Medical Test 일정입니다 🏥\n\n예약 정보를 아래와 같이 안내드립니다.\n완료 후 "완료" 라고 답장 주세요!` },
    { id:'biometrics',          phase:'입국 후',    name:'Biometrics 등록',        timing:'입국 후 3-5일',
      msg:`Biometrics 등록 안내 👆\n\n지문 및 안면 등록이 필요합니다.\n장소와 시간을 안내드리겠습니다.\n완료 후 "완료" 라고 답장 주세요!` },
    { id:'immigration_card',    phase:'입국 후',    name:'Immigration Card 발급',  timing:'입국 후 5-7일',
      msg:`Immigration Card 발급 단계입니다 📄\n\n카드 수령 후 "완료" 라고 답장 주세요!` },
    { id:'emirates_id',         phase:'입국 후',    name:'Emirates ID Card',       timing:'입국 후 7-10일',
      msg:`Emirates ID Card 신청이 완료되었습니다 🪪\n\n카드 수령 시 "완료" 라고 답장 주세요!` },
    { id:'personal_bank',       phase:'입국 후',    name:'개인 은행 계좌 개설',    timing:'입국 후 10-14일',
      msg:`개인 은행 계좌 개설 안내 🏦\n\n은행 방문 일정을 안내드립니다.\n개설 완료 후 "완료" 라고 답장 주세요!` },
    { id:'corp_bank',           phase:'입국 후',    name:'법인 은행 계좌 개설',    timing:'입국 후 12-17일',
      msg:`법인 은행 계좌 개설 안내 🏢🏦\n\n마지막 중요 단계입니다!\n개설 완료 후 "완료" 라고 답장 주세요! 🎉` },
  ],

  doctor: [
    { id:'d_docs',      phase:'서류',       name:'서류 수신 완료',              timing:'Week 1',    week:1,
      msg:`안녕하세요 {rep}님! 의사면허 서비스를 시작합니다 👨‍⚕️\n\n📋 필요 서류:\n• 여권 사본\n• 의대 졸업증명서 (영문)\n• 의사면허증 (영문)\n• 경력증명서 / 성적증명서\n\n서류를 이메일로 보내주시면 진행하겠습니다!\n완료 후 "완료" 라고 답장 주세요.` },
    { id:'d_dha',       phase:'계정',       name:'DHA 계정 개설',               timing:'Week 1-2',  week:2,
      msg:`DHA 계정이 개설되었습니다 ✅\n\n로그인 정보를 안내해 드리겠습니다.\n확인 후 "완료" 라고 답장 주세요.` },
    { id:'d_dataflow',  phase:'검증',       name:'DataFlow 등록/Credentialing', timing:'Week 2-4',  week:4,
      msg:`DataFlow 등록이 시작되었습니다 📊\n\n학력 및 경력 검증 과정으로 약 2-4주 소요됩니다.\n진행 상황을 알려드리겠습니다.` },
    { id:'d_psv',       phase:'검증',       name:'PSV 완료',                    timing:'Week 4-6',  week:6,
      msg:`PSV (Primary Source Verification) 진행 중입니다 🔍\n\n원본 기관에서 직접 자격을 검증하는 단계입니다.\n완료 시 즉시 알려드리겠습니다.` },
    { id:'d_cbt_sch',   phase:'시험',       name:'DHA Licensing Test 일정 확정', timing:'Week 6-8', week:8,
      msg:`DHA Licensing Test (Prometric) 일정이 확정되었습니다 📅\n\n시험 준비 자료를 함께 보내드리겠습니다.\n궁금하신 점은 언제든 문의주세요!` },
    { id:'d_cbt_done',  phase:'시험',       name:'CBT 시험 완료',               timing:'Week 8-10', week:10,
      msg:`시험 결과가 어떠셨나요? 🤞\n\n"합격" 또는 "불합격" 으로 답장 주세요!` },
    { id:'d_translation',phase:'서류',      name:'문서 번역/공증/Attestation',  timing:'Week 10-11',week:11,
      msg:`문서 번역 및 공증 절차를 진행합니다 📜\n\n번역, 공증, Attestation 포함\n약 1-2주 소요됩니다.` },
    { id:'d_activation',phase:'최종',       name:'License Activation',          timing:'Week 11',   week:11,
      msg:`License Activation 신청이 완료되었습니다 🎯\n\n공식 UAE 의사면허가 곧 발급됩니다!` },
    { id:'d_submit',    phase:'최종',       name:'DataFlow Submission 완료',    timing:'Week 11-12',week:12,
      msg:`DataFlow 최종 제출이 완료되었습니다 ✉️\n\n심사 결과를 기다리는 중입니다.` },
    { id:'d_issued',    phase:'완료',       name:'🏆 License 발급 완료',        timing:'Week 12',   week:12,
      msg:`🎉🎊 축하드립니다, {rep}님!\n\nUAE DHA 의사면허가 공식 발급되었습니다!\n\n면허번호와 서류를 이메일로 보내드리겠습니다.\nUAE에서의 새로운 시작을 응원합니다! 🇦🇪👨‍⚕️` },
  ],

  goldenvisa: [
    { id:'g_notify',    phase:'입국 전',    name:'입국 3-4주 전 안내 발송',    timing:'입국 3-4주 전',
      msg:`안녕하세요 {rep}님! 🌟\n\n골든비자 준비를 시작할 시기가 되었습니다!\n\n📋 필요 사항:\n• 여권 (6개월 이상 유효)\n• 자격 서류 (부동산/투자/전문직)\n• 증명사진\n\neVISA 신청 준비가 되시면 "준비완료" 라고 답장 주세요!` },
    { id:'g_evisa_app', phase:'입국 전',    name:'eVISA 신청 완료',            timing:'입국 3주 전',
      msg:`eVISA 신청이 접수되었습니다 ✅\n\n발급까지 약 5-7영업일 소요됩니다.\n이메일 수령 시 "완료" 라고 답장 주세요.` },
    { id:'g_evisa_rcv', phase:'입국 전',    name:'eVISA 수령 확인',            timing:'입국 2주 전',
      msg:`eVISA를 이메일로 받으셨나요? 📧\n\n"완료" 라고 답장 주세요.\n아직 못 받으셨다면 즉시 연락주세요!` },
    { id:'g_entry',     phase:'입국',       name:'입국 완료',                  timing:'D-Day',
      msg:`UAE에 오신 것을 환영합니다! 🇦🇪\n\n골든비자 취득을 위한 현지 절차를 진행합니다.\n일정에 맞춰 안내드리겠습니다!` },
    { id:'g_medical',   phase:'입국 후',    name:'Medical Test 완료',          timing:'입국 후 1-3일',
      msg:`Medical Test 안내입니다 🏥\n\n장소와 시간을 안내드리겠습니다.\n완료 후 "완료" 라고 답장 주세요!` },
    { id:'g_biometrics',phase:'입국 후',    name:'Biometrics 등록 완료',       timing:'입국 후 3-5일',
      msg:`Biometrics 등록 안내 👆\n\n완료 후 "완료" 라고 답장 주세요!` },
    { id:'g_issued',    phase:'완료',       name:'🏆 골든비자 발급 완료',      timing:'심사 후',
      msg:`🏆🎉 축하드립니다, {rep}님!\n\nUAE 골든비자가 발급되었습니다!\n\n10년 장기 체류 프리미엄 비자를 취득하셨습니다.\n앞으로도 잘 부탁드립니다! 🌟` },
  ],

  realestate: [
    { id:'r_contract',  phase:'계약',       name:'계약서 서명 + 텔레그램 발송', timing:'계약일',
      msg:`안녕하세요 {rep}님! 부동산 계약을 축하드립니다 🏠\n\n계약서를 아래와 함께 보내드립니다.\n확인 후 "수신완료" 라고 답장 주세요.` },
    { id:'r_pay1',      phase:'납입',       name:'1차 납입 완료',              timing:'계약 후 즉시',
      msg:`1차 납입금이 확인되었습니다 ✅\n\n감사합니다! 다음 납입 일정을 안내드리겠습니다.` },
    { id:'r_dld',       phase:'등기',       name:'DLD 등록 완료',              timing:'계약 후 2주',
      msg:`DLD (Dubai Land Department) 등록이 완료되었습니다 🏛️\n\n공식 부동산 등기가 완료되었습니다.\n등기증을 이메일로 보내드리겠습니다.` },
    { id:'r_pay2',      phase:'납입',       name:'2차 납입 안내',              timing:'납입 일정',
      msg:`2차 납입 일정을 안내드립니다 💰\n\n납부 완료 후 "완료" 라고 답장 주세요!` },
    { id:'r_pay3',      phase:'납입',       name:'3차 납입 안내',              timing:'납입 일정',
      msg:`3차 납입 일정을 안내드립니다 💰\n\n납부 완료 후 "완료" 라고 답장 주세요!` },
    { id:'r_gv_notify', phase:'골든비자',   name:'골든비자 신청 안내',         timing:'완공 6개월 전',
      msg:`부동산 투자를 통한 골든비자 신청이 가능합니다! 🌟\n\n골든비자 서비스를 신청하시겠습니까?\n"네" 또는 "아니오" 로 답장 주세요.` },
    { id:'r_handover',  phase:'완료',       name:'🏠 부동산 인도 완료',        timing:'완공 후',
      msg:`🎉 축하드립니다, {rep}님!\n\n부동산 인도가 완료되었습니다! 🏠\n\n새 집에서의 행복한 생활을 응원합니다! 🙏` },
  ]
};

const COMPANY_SERVICES = [
  "Freezone Dubai 설립 (라이센스)",
  "비자발급 ($3,650/1명당)",
  "메디컬 테스트",
  "바이오메트릭스 등록",
  "Emirate ID Card 등록 신청",
  "가상 사무실 렌트비",
  "월별 기장 서비스",
  "개인 은행 계좌개설",
  "법인 은행 계좌개설",
  "현지 핸드폰 번호개설 가이드",
  "법인인증, 사업자등록증서, Memorandum",
  "대표자 인증 KYC",
  "사업자등록증 발급",
  "법인등기 수수료 납부 가이드",
  "전체 등기 문서 번역 제출",
  "법률문서 (Letter Head) Template 제작"
];

const DOCTOR_SERVICES = [
  "Doctor licensing Data flow 등록 / credentialing / application fee",
  "Primary Source Verification (PSV) / 문서검증",
  "DHA Doctor Licensing Test (Prometric Test, service fee 포함)",
  "License activation (공식 라이센스 발급 비용) 1년",
  "문서 검토, 번역, 공증, attestation 비용 + 행정 대행",
  "DataFlow Submission, DHA Communication, Report Management",
  "(선택) 취업 알선, 병원 지원 서비스 비용",
  "(선택) 병의원 개업시 핸들링 피 (총 비용 대비 5%)",
  "이주/정착 지원 (숙소, 초기 정착, 라이프라인 세팅, 보험, 비자)"
];

// ─────────────────────────────────────────────
// TELEGRAM BOT
// ─────────────────────────────────────────────
let bot = null;

function initBot(token) {
  if (!token) return;
  if (bot) { try { bot.stopPolling(); } catch(e) {} bot = null; }

  try {
    bot = new TelegramBot(token, { polling: { interval: 2000, autoStart: true } });

    bot.on('message', (msg) => {
      const chatId = String(msg.chat.id);
      const text = (msg.text || '').trim();

      // /start command — register
      if (text === '/start') {
        bot.sendMessage(chatId,
          `안녕하세요! 👋\n귀하의 Telegram Chat ID: *${chatId}*\n\n이 번호를 관리자에게 알려주세요.`,
          { parse_mode: 'Markdown' });
        return;
      }

      const data = loadData();
      const client = data.clients.find(c => String(c.telegramChatId) === chatId);
      if (!client) return;

      const keyword = text.toLowerCase();
      const isConfirm = ['완료','done','확인','ok','수신완료','준비완료','합격','네'].some(k => keyword.includes(k));

      if (isConfirm) {
        const steps = STEPS[client.category] || [];
        const completedSet = new Set(client.completedSteps || []);
        const nextStep = steps.find(s => !completedSet.has(s.id));

        if (!nextStep) {
          bot.sendMessage(chatId, '✅ 모든 단계가 완료되었습니다! 감사합니다 🎉');
          return;
        }

        // Mark as done
        completedSet.add(nextStep.id);
        client.completedSteps = Array.from(completedSet);
        saveData(data);

        bot.sendMessage(chatId, `✅ *${nextStep.name}* 완료 확인!\n\n감사합니다.`, { parse_mode: 'Markdown' });

        // Send next step message
        const nextIdx = steps.indexOf(nextStep) + 1;
        if (nextIdx < steps.length) {
          const ns = steps[nextIdx];
          setTimeout(() => {
            bot.sendMessage(chatId,
              `⏭️ *다음 단계: ${ns.name}*\n(${ns.timing})\n\n${ns.msg.replace('{rep}', client.rep)}`,
              { parse_mode: 'Markdown' });
          }, 1000);
        }

        // Notify admin
        const adminId = data.settings.adminChatId;
        if (adminId) {
          bot.sendMessage(adminId,
            `🔔 *[${client.company}]* ${client.rep}\n✅ "${nextStep.name}" 고객 확인 완료\n⏭️ 다음: ${steps[nextIdx]?.name || '전체 완료'}`,
            { parse_mode: 'Markdown' });
        }
      }
    });

    bot.on('polling_error', (err) => {
      if (!err.message.includes('ETELEGRAM: 409')) {
        console.error('[Bot polling error]', err.message);
      }
    });

    console.log('✅ Telegram 봇 초기화 완료');
  } catch(e) {
    console.error('Bot init error:', e.message);
  }
}

// ─────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────

app.get('/api/data', (req, res) => res.json(loadData()));

app.get('/api/steps', (req, res) => res.json(STEPS));

app.get('/api/services', (req, res) => res.json({ company: COMPANY_SERVICES, doctor: DOCTOR_SERVICES }));

// Settings
app.post('/api/settings', (req, res) => {
  const data = loadData();
  data.settings = { ...data.settings, ...req.body };
  saveData(data);
  if (req.body.botToken) initBot(req.body.botToken);
  res.json({ success: true });
});

// Add client
app.post('/api/clients', (req, res) => {
  const data = loadData();
  const client = { id: Date.now(), completedSteps: [], services: [], createdAt: new Date().toISOString(), ...req.body };
  data.clients.push(client);
  saveData(data);
  res.json(client);
});

// Update client
app.put('/api/clients/:id', (req, res) => {
  const data = loadData();
  const idx = data.clients.findIndex(c => c.id == req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  data.clients[idx] = { ...data.clients[idx], ...req.body };
  saveData(data);
  res.json(data.clients[idx]);
});

// Delete client
app.delete('/api/clients/:id', (req, res) => {
  const data = loadData();
  data.clients = data.clients.filter(c => c.id != req.params.id);
  saveData(data);
  res.json({ success: true });
});

// Complete a step (admin action → send Telegram to client)
app.post('/api/clients/:id/step', (req, res) => {
  const data = loadData();
  const client = data.clients.find(c => c.id == req.params.id);
  if (!client) return res.status(404).json({ error: 'Not found' });

  const { stepId, action } = req.body; // action: 'complete' | 'undo'

  if (!client.completedSteps) client.completedSteps = [];

  if (action === 'complete') {
    if (!client.completedSteps.includes(stepId)) client.completedSteps.push(stepId);

    // Send Telegram message to next step
    if (bot && client.telegramChatId) {
      const steps = STEPS[client.category] || [];
      const doneIdx = steps.findIndex(s => s.id === stepId);
      const currentStep = steps[doneIdx];
      const nextStep = steps[doneIdx + 1];

      if (currentStep && nextStep) {
        const msg = `✅ *${currentStep.name}* 완료!\n\n⏭️ *다음 단계 안내*\n\n${nextStep.msg.replace('{rep}', client.rep)}`;
        bot.sendMessage(String(client.telegramChatId), msg, { parse_mode: 'Markdown' })
          .catch(e => console.error('Send error:', e.message));
      } else if (currentStep && !nextStep) {
        // Last step completed
        bot.sendMessage(String(client.telegramChatId),
          `🎉 모든 서비스가 완료되었습니다!\n\n${client.rep}님, 함께 해주셔서 감사합니다!`,
          { parse_mode: 'Markdown' })
          .catch(e => console.error('Send error:', e.message));
      }
    }
  } else if (action === 'undo') {
    client.completedSteps = client.completedSteps.filter(s => s !== stepId);
  }

  saveData(data);
  res.json({ success: true, client });
});

// Toggle service item (company/doctor)
app.post('/api/clients/:id/service', (req, res) => {
  const data = loadData();
  const client = data.clients.find(c => c.id == req.params.id);
  if (!client) return res.status(404).json({ error: 'Not found' });
  const { idx, val } = req.body;
  if (!client.services) client.services = [];
  client.services[idx] = val;
  saveData(data);
  res.json({ success: true });
});

// Send custom Telegram message
app.post('/api/clients/:id/message', (req, res) => {
  const data = loadData();
  const client = data.clients.find(c => c.id == req.params.id);
  if (!client) return res.status(404).json({ error: 'Not found' });
  if (!bot) return res.status(400).json({ error: 'Bot not initialized. Set bot token in Settings.' });
  if (!client.telegramChatId) return res.status(400).json({ error: 'No Telegram Chat ID for this client.' });

  bot.sendMessage(String(client.telegramChatId), req.body.message)
    .then(() => res.json({ success: true }))
    .catch(e => res.status(500).json({ error: e.message }));
});

// Bot status
app.get('/api/bot-status', (req, res) => {
  res.json({ active: !!bot });
});

// ─────────────────────────────────────────────
// DOCUSIGN INTEGRATION
// ─────────────────────────────────────────────

// Auto-schedule offsets for company clients (days from entry date)
const COMPANY_STEP_OFFSETS = {
  pre_evisa_notify:  -21,
  pre_evisa_received: -10,
  entry:              0,
  medical:            2,
  biometrics:         4,
  immigration_card:   6,
  emirates_id:        9,
  personal_bank:      12,
  corp_bank:          14
};

function autoScheduleFromEntry(entryDateStr) {
  const stepDates = {};
  if (!entryDateStr || entryDateStr === 'TBD') return stepDates;
  const clean = entryDateStr.trim().replace(/\./g, '-');
  const parts = clean.split('-');
  if (parts.length === 2) parts.push('01');
  const base = new Date(parts.join('-') + 'T00:00:00');
  if (isNaN(base.getTime())) return stepDates;
  Object.entries(COMPANY_STEP_OFFSETS).forEach(([stepId, offset]) => {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    stepDates[stepId] = `${y}-${m}-${day}`;
  });
  return stepDates;
}

// DocuSign Connect webhook — fires when envelope status = completed
// Configure in DocuSign: Admin → Connect → Add Configuration
// URL: http://your-server:3000/api/docusign-webhook
app.post('/api/docusign-webhook', (req, res) => {
  try {
    const payload = req.body;

    // Only process completed envelopes
    const status = (payload.status || payload.envelopeStatus || '').toLowerCase();
    if (status && status !== 'completed') {
      return res.json({ ok: true, skipped: true, status });
    }

    // Extract signer info
    const signers = payload.recipients?.signers
      || payload.envelopeDocument?.recipients?.signers
      || payload.signers
      || [];
    const signer = signers[0] || {};

    // Extract custom fields
    const cfArr = payload.customFields?.textCustomFields
      || payload.envelopeDocument?.customFields?.textCustomFields
      || [];
    const cf = {};
    cfArr.forEach(f => { if (f.name) cf[f.name.trim()] = (f.value || '').trim(); });

    // Determine category
    const rawCat = (cf['카테고리'] || cf['category'] || 'company').toLowerCase();
    const catMap = { company: 'company', 법인: 'company', doctor: 'doctor', 의사: 'doctor', goldenvisa: 'goldenvisa', 골든: 'goldenvisa', realestate: 'realestate', 부동산: 'realestate' };
    const cat = catMap[rawCat] || 'company';

    // Services array length by category
    const svcLen = { company: 16, doctor: 9, goldenvisa: 7, realestate: 7 }[cat] || 16;

    const entryDate = cf['입국예정일'] || cf['entryDate'] || '';
    const envelopeId = payload.envelopeId || payload.envelopeSummary?.envelopeId || '';

    const data = loadData();

    // Skip if this envelope was already imported
    if (data.clients.find(c => c.docusignId && c.docusignId === envelopeId)) {
      return res.json({ ok: true, skipped: true, reason: 'duplicate' });
    }

    const newId = Math.max(1000, ...data.clients.map(c => Number(c.id) || 0)) + 1;

    const newClient = {
      id: newId,
      company: cf['회사명'] || cf['company'] || signer.name || '(DocuSign 계약)',
      rep:     cf['대표자'] || cf['representative'] || signer.name || '(미입력)',
      category: cat,
      contractDate: cf['계약일'] || cf['contractDate'] || new Date().toISOString().slice(0, 7).replace('-', '.'),
      paymentAmount:  cf['계약금액'] || cf['amount'] || '',
      paymentAccount: cf['결제계좌'] || cf['account'] || '',
      email:    cf['이메일'] || cf['email'] || signer.email || '',
      phone:    cf['한국연락처'] || cf['phone'] || '',
      phoneUae: cf['두바이번호'] || cf['phoneUae'] || '',
      entryDate,
      telegramChatId: '',
      completedSteps: [],
      services: Array(svcLen).fill(0),
      stepDates: cat === 'company' ? autoScheduleFromEntry(entryDate) : {},
      notes: `DocuSign 자동 등록 (${envelopeId})`,
      docusignId: envelopeId,
      createdAt: new Date().toISOString()
    };

    data.clients.push(newClient);
    saveData(data);

    console.log(`✅ DocuSign 신규 고객 등록: [${newId}] ${newClient.company} (${cat})`);

    // Notify admin via Telegram if bot is active
    if (bot) {
      const d = loadData();
      const adminId = d.settings?.adminChatId;
      if (adminId) {
        const msg = `📋 DocuSign 신규 계약 자동 등록\n고객사: ${newClient.company}\n카테고리: ${cat}\n담당자: ${newClient.rep}\n계약서 ID: ${envelopeId}`;
        bot.sendMessage(String(adminId), msg).catch(() => {});
      }
    }

    res.json({ ok: true, clientId: newClient.id });
  } catch (err) {
    console.error('DocuSign webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Polling endpoint — standalone HTML polls this every 8 seconds
// Returns clients registered via DocuSign in the last 5 minutes
app.get('/api/docusign-new', (req, res) => {
  try {
    const data = loadData();
    const since = Date.now() - 5 * 60 * 1000; // 5 minutes
    const recent = data.clients.filter(c => {
      if (!c.docusignId) return false;
      if (!c.createdAt) return false;
      return new Date(c.createdAt).getTime() > since;
    });
    res.json({ newClients: recent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 VIP CRM Dashboard: http://localhost:${PORT}`);
  console.log('────────────────────────────────────────');
  const d = loadData();
  if (d.settings.botToken) {
    initBot(d.settings.botToken);
  } else {
    console.log('⚠️  Telegram 봇 미설정. 브라우저에서 Settings 탭 열고 Bot Token 입력 필요.');
  }
});
