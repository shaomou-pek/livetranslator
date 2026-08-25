const $ = (selector) => document.querySelector(selector);

const UI_TEXT = {
  zh: {
    "document.title": "LiveTranslator 双语会议",
    "brand.subtitle": "本地测试实验室",
    "brand.lab": "本地测试模式",
    "landing.eyebrow": "中英双语讨论空间",
    "landing.title": "扫码加入，开口说话，双语内容同步出现。",
    "landing.subtitle": "无需安装。创建一个临时房间，用第二个浏览器或手机加入，测试中文与英文的语音转写和翻译。",
    "landing.flowCreate": "创建房间",
    "landing.flowScan": "扫码加入",
    "landing.flowSpeak": "点击发言",
    "landing.flowSync": "同步字幕",
    "landing.roomName": "会议名称",
    "landing.defaultRoomTitle": "中英双语讨论",
    "landing.create": "创建测试房间",
    "landing.enterCode": "输入房间码",
    "common.or": "或",
    "common.join": "加入",
    "room.eyebrow": "实时房间",
    "room.code": "房间码",
    "room.scanHelp": "用另一个浏览器扫码或打开加入链接",
    "room.copyLink": "复制加入链接",
    "room.waiting": "等待加入",
    "room.connected": "实时连接正常",
    "room.disconnected": "连接已断开",
    "room.onlineSuffix": "个页面在线",
    "profile.eyebrow": "加入房间",
    "profile.title": "先设置你的发言身份",
    "profile.name": "昵称",
    "profile.language": "主要发言语言（系统会自动校正）",
    "profile.zhDirection": "中文 → English",
    "profile.enDirection": "English → 中文",
    "profile.enter": "进入会议室",
    "profile.guest": "访客",
    "conversation.eyebrow": "实时字幕",
    "conversation.title": "双语会议记录",
    "conversation.emptyTitle": "还没有发言",
    "conversation.emptyBody": "点击下方按钮开始录音，停止后会自动生成原文和译文。",
    "conversation.privacy": "直接录音只在 HTTPS 或 localhost 可用；测试模式不持久化保存原始音频。",
    "warning.title": "直接发言需要 HTTPS",
    "warning.body": "当前地址不能安全调用麦克风，请使用 HTTPS 测试地址。",
    "action.start": "开始发言",
    "action.stop": "结束发言",
    "action.https": "需要 HTTPS",
    "status.ready": "准备就绪",
    "status.recording": "正在录音 · {seconds}s",
    "status.processing": "正在识别和翻译…",
    "status.synced": "已同步到会议室",
    "status.failed": "处理失败",
    "toast.invalidCode": "请输入 6 位房间码",
    "toast.secureRequired": "直接发言需要 HTTPS 地址",
    "toast.linkCopied": "加入链接已复制",
    "error.requestFailed": "请求失败",
    "language.zh": "中文",
    "language.en": "English",
  },
  en: {
    "document.title": "LiveTranslator Bilingual Meeting",
    "brand.subtitle": "local test lab",
    "brand.lab": "LOCAL TEST MODE",
    "landing.eyebrow": "BILINGUAL DISCUSSION ROOMS",
    "landing.title": "Scan to join. Speak naturally. See both languages together.",
    "landing.subtitle": "No installation required. Create a temporary room, join from another browser or phone, and test Chinese–English transcription and translation.",
    "landing.flowCreate": "Create room",
    "landing.flowScan": "Scan to join",
    "landing.flowSpeak": "Start speaking",
    "landing.flowSync": "Sync captions",
    "landing.roomName": "Meeting name",
    "landing.defaultRoomTitle": "Chinese–English discussion",
    "landing.create": "Create test room",
    "landing.enterCode": "Enter room code",
    "common.or": "or",
    "common.join": "Join",
    "room.eyebrow": "LIVE ROOM",
    "room.code": "Room code",
    "room.scanHelp": "Scan with another browser or open the join link",
    "room.copyLink": "Copy join link",
    "room.waiting": "Waiting to join",
    "room.connected": "Live connection active",
    "room.disconnected": "Connection closed",
    "room.onlineSuffix": "pages online",
    "profile.eyebrow": "JOIN THE ROOM",
    "profile.title": "Set your speaking identity",
    "profile.name": "Display name",
    "profile.language": "Primary speaking language (auto-corrected)",
    "profile.zhDirection": "Chinese → English",
    "profile.enDirection": "English → Chinese",
    "profile.enter": "Enter room",
    "profile.guest": "Guest",
    "conversation.eyebrow": "LIVE TRANSCRIPT",
    "conversation.title": "Bilingual meeting transcript",
    "conversation.emptyTitle": "No one has spoken yet",
    "conversation.emptyBody": "Select Start speaking below. When you stop, the original transcript and translation will appear automatically.",
    "conversation.privacy": "Direct recording requires HTTPS or localhost. Raw audio is not stored in test mode.",
    "warning.title": "Direct speaking requires HTTPS",
    "warning.body": "This address cannot access the microphone securely. Please use the HTTPS test URL.",
    "action.start": "Start speaking",
    "action.stop": "Stop speaking",
    "action.https": "HTTPS required",
    "status.ready": "Ready",
    "status.recording": "Recording · {seconds}s",
    "status.processing": "Transcribing and translating…",
    "status.synced": "Synced to the room",
    "status.failed": "Processing failed",
    "toast.invalidCode": "Enter a 6-character room code",
    "toast.secureRequired": "Direct speaking requires an HTTPS address",
    "toast.linkCopied": "Join link copied",
    "error.requestFailed": "Request failed",
    "language.zh": "Chinese",
    "language.en": "English",
  },
};

function safeStorageGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}

function safeStorageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (_) {}
}

function defaultUiLanguage() {
  return navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function t(key, variables = {}) {
  let value = UI_TEXT[state?.uiLanguage || "zh"]?.[key] || UI_TEXT.zh[key] || key;
  for (const [name, replacement] of Object.entries(variables)) value = value.replace(`{${name}}`, replacement);
  return value;
}

function createParticipantId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const randomPart = globalThis.crypto?.getRandomValues
    ? Array.from(globalThis.crypto.getRandomValues(new Uint32Array(2)), (value) => value.toString(36)).join("")
    : Math.random().toString(36).slice(2);
  return `device-${Date.now().toString(36)}-${randomPart}`;
}

const state = {
  roomCode: location.pathname.startsWith("/room/") ? location.pathname.split("/")[2]?.toUpperCase() : null,
  participantId: safeStorageGet("lt-lab-participant") || createParticipantId(),
  uiLanguage: safeStorageGet("lt-lab-ui-language") || defaultUiLanguage(),
  speakerName: "Guest",
  sourceLanguage: "zh",
  websocket: null,
  recorder: null,
  mediaStream: null,
  chunks: [],
  recordingStartedAt: null,
  timer: null,
  messages: [],
};
safeStorageSet("lt-lab-participant", state.participantId);

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 3200);
}

function applyUiLanguage() {
  document.documentElement.lang = state.uiLanguage === "zh" ? "zh-CN" : "en";
  document.title = t("document.title");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  $("#uiLanguageToggle").textContent = state.uiLanguage === "zh" ? "EN" : "中文";
  $("#uiLanguageToggle").setAttribute(
    "aria-label",
    state.uiLanguage === "zh" ? "Switch interface to English" : "切换为中文界面",
  );

  const roomTitle = $("#roomTitle");
  const defaultTitles = [UI_TEXT.zh["landing.defaultRoomTitle"], UI_TEXT.en["landing.defaultRoomTitle"]];
  if (roomTitle && defaultTitles.includes(roomTitle.value)) roomTitle.value = t("landing.defaultRoomTitle");
  if (!$("#sessionPanel").classList.contains("hidden")) {
    $("#identityDirection").textContent = directionLabel(state.sourceLanguage);
    updateRecordingAvailability();
    renderMessages(state.messages);
  }
}

async function api(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `${t("error.requestFailed")} (${response.status})`;
    try {
      const payload = await response.json();
      message = payload.detail || message;
    } catch (_) {}
    throw new Error(message);
  }
  return response.json();
}

function languageLabel(language) {
  return language === "zh" ? t("language.zh") : t("language.en");
}

function directionLabel(language) {
  return language === "zh" ? "中文 → English" : "English → 中文";
}

function renderMessages(messages) {
  state.messages = [...messages];
  const list = $("#messageList");
  list.querySelectorAll(".message-card").forEach((card) => card.remove());
  $("#emptyState").classList.toggle("hidden", messages.length > 0);
  messages.forEach(renderMessageCard);
}

function appendMessage(message) {
  if (document.querySelector(`[data-message-id="${message.id}"]`)) return;
  state.messages.push(message);
  renderMessageCard(message);
}

function renderMessageCard(message) {
  $("#emptyState").classList.add("hidden");
  const card = document.createElement("article");
  card.className = "message-card";
  card.dataset.messageId = message.id;

  const meta = document.createElement("div");
  meta.className = "message-meta";
  const avatar = document.createElement("span");
  avatar.className = "speaker-avatar";
  avatar.textContent = (message.speaker_name || "G").slice(0, 2).toUpperCase();
  const identity = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = message.speaker_name;
  const route = document.createElement("div");
  route.className = "language-route";
  route.textContent = `${languageLabel(message.source_language)} → ${languageLabel(message.target_language)}`;
  identity.append(name, route);
  meta.append(avatar, identity);

  const source = document.createElement("p");
  source.className = "source-text";
  source.textContent = message.source_text;
  const translated = document.createElement("p");
  translated.className = "translated-text";
  translated.textContent = message.translated_text;
  card.append(meta, source, translated);
  $("#messageList").append(card);
  $("#messageList").scrollTop = $("#messageList").scrollHeight;
}

function connectRoom() {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  state.websocket = new WebSocket(`${protocol}://${location.host}/ws/rooms/${state.roomCode}`);
  state.websocket.addEventListener("open", () => {
    $("#connectionDot").classList.add("online");
    $("#connectionLabel").textContent = t("room.connected");
  });
  state.websocket.addEventListener("close", () => {
    $("#connectionDot").classList.remove("online");
    $("#connectionLabel").textContent = t("room.disconnected");
  });
  state.websocket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "snapshot") {
      renderMessages(payload.messages || []);
      $("#onlineCount").textContent = payload.online || 1;
    }
    if (payload.type === "presence") $("#onlineCount").textContent = payload.online;
    if (payload.type === "message") appendMessage(payload.message);
  });
}

function recordingMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
  return candidates.find((type) => window.MediaRecorder?.isTypeSupported(type)) || "";
}

function directRecordingAvailable() {
  return Boolean(window.isSecureContext && navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

function updateRecordingAvailability() {
  const available = directRecordingAvailable();
  $("#recordButton").disabled = !available;
  $("#recordButtonLabel").textContent = available ? t("action.start") : t("action.https");
  $("#httpsWarning").classList.toggle("hidden", available);
}

async function startRecording() {
  state.mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  });
  state.chunks = [];
  const mimeType = recordingMimeType();
  state.recorder = new MediaRecorder(state.mediaStream, mimeType ? { mimeType } : undefined);
  state.recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size) state.chunks.push(event.data);
  });
  state.recorder.addEventListener("stop", uploadRecording);
  state.recorder.start(250);
  state.recordingStartedAt = Date.now();
  $("#recordButton").classList.add("recording");
  $("#recordButtonLabel").textContent = t("action.stop");
  state.timer = window.setInterval(() => {
    const seconds = Math.floor((Date.now() - state.recordingStartedAt) / 1000);
    $("#recordStatus").textContent = t("status.recording", { seconds });
  }, 250);
}

function stopRecording() {
  if (state.recorder?.state === "recording") state.recorder.stop();
  window.clearInterval(state.timer);
  $("#recordButton").classList.remove("recording");
  $("#recordButtonLabel").textContent = t("action.start");
  $("#recordStatus").textContent = t("status.processing");
}

async function uploadRecording() {
  const mimeType = state.recorder.mimeType || "audio/webm";
  const extension = mimeType.includes("mp4") ? "mp4" : "webm";
  const blob = new Blob(state.chunks, { type: mimeType });
  state.mediaStream?.getTracks().forEach((track) => track.stop());
  await uploadAudio(blob, `speech.${extension}`);
}

async function uploadAudio(blob, filename) {
  const form = new FormData();
  form.append("participant_id", state.participantId);
  form.append("speaker_name", state.speakerName);
  form.append("source_language", state.sourceLanguage);
  form.append("audio", blob, filename);
  try {
    await api(`/api/rooms/${state.roomCode}/utterances`, { method: "POST", body: form });
    $("#recordStatus").textContent = t("status.synced");
  } catch (error) {
    $("#recordStatus").textContent = t("status.failed");
    showToast(error.message);
  }
}

async function initRoom() {
  $("#roomView").classList.remove("hidden");
  try {
    const room = await api(`/api/rooms/${state.roomCode}`);
    $("#roomName").textContent = room.title;
    $("#roomCode").textContent = room.code;
    $("#roomQr").src = `/api/rooms/${room.code}/qr.svg`;
    $("#onlineCount").textContent = room.online;
  } catch (error) {
    showToast(error.message);
    window.setTimeout(() => (location.href = "/"), 1500);
  }
}

$("#createRoomForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const room = await api("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: $("#roomTitle").value.trim() }),
    });
    location.href = `/room/${room.code}`;
  } catch (error) {
    showToast(error.message);
    button.disabled = false;
  }
});

$("#joinCodeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const code = $("#joinCode").value.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (code.length !== 6) return showToast(t("toast.invalidCode"));
  location.href = `/room/${code}`;
});

$("#profileForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.speakerName = $("#speakerName").value.trim() || t("profile.guest");
  state.sourceLanguage = $("#speakerLanguage").value;
  $("#identityName").textContent = state.speakerName;
  $("#identityDirection").textContent = directionLabel(state.sourceLanguage);
  $("#profilePanel").classList.add("hidden");
  $("#sessionPanel").classList.remove("hidden");
  updateRecordingAvailability();
  connectRoom();
});

$("#recordButton").addEventListener("click", async () => {
  try {
    if (state.recorder?.state === "recording") stopRecording();
    else if (directRecordingAvailable()) await startRecording();
    else showToast(t("toast.secureRequired"));
  } catch (error) {
    showToast(error.message);
  }
});

$("#copyLinkButton").addEventListener("click", async () => {
  const joinUrl = `${location.origin}/room/${state.roomCode}`;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(joinUrl);
  } else {
    const input = document.createElement("textarea");
    input.value = joinUrl;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  showToast(t("toast.linkCopied"));
});

$("#uiLanguageToggle").addEventListener("click", () => {
  state.uiLanguage = state.uiLanguage === "zh" ? "en" : "zh";
  safeStorageSet("lt-lab-ui-language", state.uiLanguage);
  applyUiLanguage();
});

applyUiLanguage();
if (state.roomCode) initRoom();
else $("#landingView").classList.remove("hidden");
