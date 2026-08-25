const $ = (selector) => document.querySelector(selector);

function createParticipantId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const randomPart = globalThis.crypto?.getRandomValues
    ? Array.from(globalThis.crypto.getRandomValues(new Uint32Array(2)), (value) => value.toString(36)).join("")
    : Math.random().toString(36).slice(2);
  return `device-${Date.now().toString(36)}-${randomPart}`;
}

const state = {
  roomCode: location.pathname.startsWith("/room/") ? location.pathname.split("/")[2]?.toUpperCase() : null,
  participantId: localStorage.getItem("lt-lab-participant") || createParticipantId(),
  speakerName: "Guest",
  sourceLanguage: "zh",
  websocket: null,
  recorder: null,
  mediaStream: null,
  chunks: [],
  recordingStartedAt: null,
  timer: null,
};
localStorage.setItem("lt-lab-participant", state.participantId);

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 3200);
}

async function api(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `请求失败 (${response.status})`;
    try {
      const payload = await response.json();
      message = payload.detail || message;
    } catch (_) {}
    throw new Error(message);
  }
  return response.json();
}

function languageLabel(language) {
  return language === "zh" ? "中文" : "English";
}

function directionLabel(language) {
  return language === "zh" ? "中文 → English" : "English → 中文";
}

function renderMessages(messages) {
  const list = $("#messageList");
  list.querySelectorAll(".message-card").forEach((card) => card.remove());
  $("#emptyState").classList.toggle("hidden", messages.length > 0);
  messages.forEach(appendMessage);
}

function appendMessage(message) {
  if (document.querySelector(`[data-message-id="${message.id}"]`)) return;
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
    $("#connectionLabel").textContent = "实时连接正常";
  });
  state.websocket.addEventListener("close", () => {
    $("#connectionDot").classList.remove("online");
    $("#connectionLabel").textContent = "连接已断开";
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
  $("#recordButtonLabel").textContent = available ? "开始发言" : "需要 HTTPS";
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
  $("#recordButtonLabel").textContent = "结束发言";
  state.timer = window.setInterval(() => {
    const seconds = Math.floor((Date.now() - state.recordingStartedAt) / 1000);
    $("#recordStatus").textContent = `正在录音 · ${seconds}s`;
  }, 250);
}

function stopRecording() {
  if (state.recorder?.state === "recording") state.recorder.stop();
  window.clearInterval(state.timer);
  $("#recordButton").classList.remove("recording");
  $("#recordButtonLabel").textContent = "开始发言";
  $("#recordStatus").textContent = "正在识别和翻译…";
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
    $("#recordStatus").textContent = "已同步到会议室";
  } catch (error) {
    $("#recordStatus").textContent = "处理失败";
    showToast(error.message);
  }
}

async function sendDemo() {
  $("#demoButton").disabled = true;
  $("#recordStatus").textContent = "正在发送真实英文测试音频…";
  const form = new FormData();
  form.append("participant_id", state.participantId);
  form.append("speaker_name", state.speakerName);
  try {
    await api(`/api/rooms/${state.roomCode}/demo`, { method: "POST", body: form });
    $("#recordStatus").textContent = "示例音频已转写并同步";
  } catch (error) {
    $("#recordStatus").textContent = "示例处理失败";
    showToast(error.message);
  } finally {
    $("#demoButton").disabled = false;
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
  if (code.length !== 6) return showToast("请输入 6 位房间码");
  location.href = `/room/${code}`;
});

$("#profileForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.speakerName = $("#speakerName").value.trim() || "Guest";
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
    else showToast("直接发言需要 HTTPS 地址，请改用上传录音文件");
  } catch (error) {
    showToast(error.message);
  }
});

$("#uploadAudioButton").addEventListener("click", () => {
  $("#audioFileInput").value = "";
  $("#recordStatus").textContent = "请选择已经录好的音频文件…";
  $("#audioFileInput").click();
});

$("#audioFileInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    $("#recordStatus").textContent = "准备就绪";
    return;
  }
  $("#recordStatus").textContent = "正在上传、识别和翻译…";
  await uploadAudio(file, file.name || "mobile-recording.m4a");
});

$("#demoButton").addEventListener("click", sendDemo);
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
  showToast("加入链接已复制");
});

if (state.roomCode) initRoom();
else $("#landingView").classList.remove("hidden");
