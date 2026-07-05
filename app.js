const STORAGE_KEY = "coze-workflow-ui-config";

const defaultConfig = {
  mode: "published",
  endpoint: "https://api.coze.cn",
  workflowId: "7658482627423731718",
  workflowToken: "",
  accessToken: "",
};

const state = {
  config: loadConfig(),
  flow: createInitialFlow(),
  schema: null,
  schemaLoadedAt: null,
  runtime: createRuntimeState(),
};

const elements = {
  surface: document.querySelector("[data-surface]"),
  entryShell: document.querySelector("[data-entry-shell]"),
  chatShell: document.querySelector("[data-chat-shell]"),
  devSettings: document.querySelector(".dev-settings"),
  configMode: document.querySelector("[data-config-mode]"),
  configEndpoint: document.querySelector("[data-config-endpoint]"),
  configWorkflowId: document.querySelector("[data-config-workflow-id]"),
  configWorkflowToken: document.querySelector("[data-config-workflow-token]"),
  configAccessToken: document.querySelector("[data-config-access-token]"),
  saveConfig: document.querySelector("[data-save-config]"),
  loadSchema: document.querySelector("[data-load-schema]"),
  schemaStatus: document.querySelector("[data-schema-status]"),
  fileInput: document.querySelector("[data-file-input]"),
  uploadCard: document.querySelector("[data-upload-card]"),
  fileName: document.querySelector("[data-file-name]"),
  requestType: document.querySelector("[data-request-type]"),
  targetPosition: document.querySelector("[data-target-position]"),
  entryMessage: document.querySelector("[data-entry-message]"),
  entryError: document.querySelector("[data-entry-error]"),
  sessionHint: document.querySelector("[data-session-hint]"),
  entryForm: document.querySelector("[data-entry-form]"),
  chatForm: document.querySelector("[data-chat-form]"),
  chatInput: document.querySelector("[data-chat-input]"),
  chatLabel: document.querySelector("[data-chat-label]"),
  chatSession: document.querySelector("[data-chat-session]"),
  roundInline: document.querySelector("[data-round-inline]"),
  roundInput: document.querySelector("[data-round-inline] input[name='totalRounds']"),
  generateSession: document.querySelector("[data-generate-session]"),
  backHome: document.querySelector("[data-back-home]"),
  thread: document.querySelector("[data-thread]"),
  flowTitle: document.querySelector("[data-flow-title]"),
  flowPhase: document.querySelector("[data-flow-phase]"),
  intentPill: document.querySelector("[data-intent-pill]"),
  summaryRequest: document.querySelector("[data-summary-request]"),
  summaryPosition: document.querySelector("[data-summary-position]"),
  summaryFile: document.querySelector("[data-summary-file]"),
  mainTitle: document.querySelector("[data-main-title]"),
  mainCopy: document.querySelector("[data-main-copy]"),
};

bootstrap().catch((error) => {
  console.error(error);
});

async function bootstrap() {
  await detectHostedProxy();
  hydrateConfig();
  bindEvents();
  resetConversation();
  applyUrlPrefill();
  render();
}

function createRuntimeState() {
  return {
    proxyEnabled: false,
    apiBase: "",
    workflowId: "",
  };
}

async function detectHostedProxy() {
  if (typeof fetch !== "function") {
    return;
  }

  const origin = String(globalThis.location?.origin || "");
  if (!/^https?:\/\//i.test(origin)) {
    return;
  }

  try {
    const response = await fetch("/api/config", {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    if (!data?.proxyEnabled) {
      return;
    }

    state.runtime.proxyEnabled = true;
    state.runtime.apiBase = String(data.apiBase || "/api");
    state.runtime.workflowId = String(data.workflowId || state.config.workflowId || "");
    applyHostedRuntimeConfig();
  } catch (error) {
    state.runtime = createRuntimeState();
  }
}

function applyHostedRuntimeConfig() {
  if (!hasHostedProxy()) {
    return;
  }

  state.config.mode = "published";
  state.config.endpoint = String(globalThis.location?.origin || state.config.endpoint || "");
  if (state.runtime.workflowId) {
    state.config.workflowId = state.runtime.workflowId;
  }
}

function hasHostedProxy() {
  return Boolean(state.runtime.proxyEnabled);
}

function createInitialFlow() {
  return {
    phase: "idle",
    sessionId: createSessionId(),
    intent: null,
    requestType: "diagnosis",
    targetPosition: "",
    entryDetails: "",
    rounds: 0,
    currentRound: 0,
    waitingForRounds: false,
    chatMode: false,
    resumeFile: null,
    uploadedResume: null,
    uploadedResumeKey: "",
    resumeDocumentKey: "",
    resumeDocumentValue: "",
    resumeTextKey: "",
    resumeTextValue: "",
    pendingInterviewBootstrap: null,
    diagnosisReport: "",
    interviewHistory: [],
    interviewReport: "",
    thread: [],
    lastQuestion: "",
    pendingInterrupt: null,
    busy: false,
  };
}

function hydrateConfig() {
  applyHostedRuntimeConfig();
  elements.configMode.value = state.config.mode;
  elements.configEndpoint.value = state.config.endpoint;
  elements.configWorkflowId.value = state.config.workflowId;
  elements.configWorkflowToken.value = state.config.workflowToken;
  elements.configAccessToken.value = state.config.accessToken;
  updateSchemaStatus();
}

function bindEvents() {
  elements.saveConfig.addEventListener("click", () => {
    syncConfigFromForm({ persist: true });
    pushSystemMessage("配置已保存。");
    render();
  });

  elements.loadSchema.addEventListener("click", async () => {
    try {
      syncConfigFromForm({ persist: true });
      const schema = await workflowClient().fetchSchema();
      state.schema = schema;
      state.schemaLoadedAt = new Date();
      updateSchemaStatus();
      pushSystemMessage("已读取工作流 Schema。");
      render();
    } catch (error) {
      showEntryError(normalizeError(error));
      updateSchemaStatus(normalizeError(error));
      render();
    }
  });

  [
    elements.configMode,
    elements.configEndpoint,
    elements.configWorkflowId,
    elements.configWorkflowToken,
    elements.configAccessToken,
  ].forEach((field) => {
    field.addEventListener("input", () => {
      syncConfigFromForm({ persist: true });
      updateSchemaStatus();
    });
    field.addEventListener("change", () => {
      syncConfigFromForm({ persist: true });
      updateSchemaStatus();
    });
  });

  elements.uploadCard.addEventListener("click", () => {
    elements.fileInput.click();
  });

  elements.fileInput.addEventListener("change", () => {
    state.flow.resumeFile = elements.fileInput.files?.[0] || null;
    state.flow.uploadedResume = null;
    state.flow.uploadedResumeKey = "";
    state.flow.resumeDocumentKey = "";
    state.flow.resumeDocumentValue = "";
    state.flow.resumeTextKey = "";
    state.flow.resumeTextValue = "";
    clearEntryError();
    render();
  });

  elements.requestType.addEventListener("change", () => {
    state.flow.requestType = elements.requestType.value;
    state.flow.intent = elements.requestType.value;
    clearEntryError();
    render();
  });

  elements.targetPosition.addEventListener("input", () => {
    state.flow.targetPosition = elements.targetPosition.value.trim();
    clearEntryError();
  });

  elements.entryMessage.addEventListener("input", () => {
    clearEntryError();
  });

  elements.generateSession.addEventListener("click", () => {
    resetConversation();
    applyUrlPrefill();
  });

  elements.backHome.addEventListener("click", () => {
    state.flow.chatMode = false;
    state.flow.waitingForRounds = false;
    state.flow.phase = "idle";
    render();
  });

  elements.entryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (state.flow.busy) {
      return;
    }

    const payload = collectInitialPayload();

    if (!payload.targetPosition) {
      showEntryError("请先填写目标岗位，例如“产品经理”。");
      render();
      return;
    }

    if (!state.flow.resumeFile) {
      showEntryError("请先上传简历文件。若你刚刷新过页面，需要重新上传一次。");
      render();
      return;
    }

    clearEntryError();
    state.flow.chatMode = true;
    pushUserMessage(buildUserSummary(payload));
    render();
    await handleInitialIntent(payload);
  });

  elements.chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (state.flow.busy) {
      return;
    }

    const message = elements.chatInput.value.trim();
    if (!message) {
      return;
    }

    pushUserMessage(message);
    elements.chatInput.value = "";
    render();

    if (state.flow.waitingForRounds) {
      await handleRoundsReply(message);
      return;
    }

    if (state.flow.phase === "interview") {
      await handleInterviewAnswer(message);
    }
  });
}

function collectConfigFromForm() {
  return {
    mode: elements.configMode.value,
    endpoint: elements.configEndpoint.value.trim(),
    workflowId: elements.configWorkflowId.value.trim(),
    workflowToken: elements.configWorkflowToken.value.trim(),
    accessToken: elements.configAccessToken.value.trim(),
  };
}

function syncConfigFromForm({ persist = false } = {}) {
  state.config = collectConfigFromForm();
  if (persist) {
    saveConfig(state.config);
  }
  return state.config;
}

function applyUrlPrefill() {
  const params = new URLSearchParams(window.location.search);
  const message = params.get("message");
  const totalRounds = params.get("totalRounds");

  if (message) {
    elements.entryMessage.value = message;
    const guessedIntent = inferIntentFromText(message);
    elements.requestType.value = guessedIntent;
    state.flow.requestType = guessedIntent;
    state.flow.intent = guessedIntent;
    const guessedPosition = extractTargetPosition(message);
    if (guessedPosition) {
      elements.targetPosition.value = guessedPosition;
      state.flow.targetPosition = guessedPosition;
    }
  }

  if (totalRounds) {
    elements.roundInput.value = totalRounds;
  }
}

function collectInitialPayload() {
  const requestType = elements.requestType.value;
  const targetPosition = elements.targetPosition.value.trim();
  const details = elements.entryMessage.value.trim();

  state.flow.requestType = requestType;
  state.flow.intent = requestType;
  state.flow.targetPosition = targetPosition;
  state.flow.entryDetails = details;

  return {
    requestType,
    targetPosition,
    details,
  };
}

function buildUserSummary(payload) {
  const intentText = payload.requestType === "interview" ? "模拟面试" : "生成 / 优化简历";
  return payload.details
    ? `诉求：${intentText}\n目标岗位：${payload.targetPosition}\n补充说明：${payload.details}`
    : `诉求：${intentText}\n目标岗位：${payload.targetPosition}`;
}

async function handleInitialIntent(payload) {
  const intentResult = inferIntent(payload.requestType, payload.details);
  state.flow.intent = intentResult.intent;

  pushAssistantMessage({
    title: `已识别为${formatIntent(intentResult.intent)}`,
    body: intentResult.reason,
    meta: [
      `session_id：${state.flow.sessionId}`,
      `目标岗位：${payload.targetPosition}`,
      `简历文件：${state.flow.resumeFile?.name || "未上传"}`,
    ],
  });

  if (intentResult.intent === "diagnosis") {
    await runDiagnosis(payload);
    return;
  }

  state.flow.phase = "need-rounds";
  state.flow.waitingForRounds = true;
  state.flow.pendingInterviewBootstrap = {
    targetPosition: payload.targetPosition,
    details: payload.details,
  };
  pushAssistantMessage({
    title: "请输入模拟面试轮次",
    body: "直接输入 1 到 6 之间的数字即可。确认轮次后，我会调用 Coze 工作流并展示它返回的内容。",
  });
  render();
  focusChat();
}

async function runDiagnosis(payload) {
  if (!state.flow.resumeFile) {
    showEntryError("请先上传简历文件。当前这次调用不能带着空简历进入 Coze 工作流。");
    state.flow.chatMode = false;
    state.flow.phase = "idle";
    render();
    return;
  }
  setBusy(true);
  state.flow.phase = "diagnosis";
  pushSystemMessage("正在调用工作流，请稍等。");
  render();

  try {
    const result = await workflowClient().runDiagnosis({
      sessionId: state.flow.sessionId,
      targetPosition: payload.targetPosition,
      userMessage: payload.details,
      requestType: payload.requestType,
      resumeFile: state.flow.resumeFile,
      history: state.flow.interviewHistory,
    });

    state.flow.diagnosisReport = stringifyResult(result.raw);
    state.flow.phase = "diagnosis-done";
    pushAssistantMessage({
      title: "简历优化结果",
      html: formatWorkflowHtml(result.raw, result.primaryText),
      meta: result.meta,
    });
  } catch (error) {
    pushAssistantMessage({
      label: "调用失败",
      title: "Coze 工作流未成功返回结果",
      body: normalizeError(error),
    });
    state.flow.phase = "idle";
  } finally {
    setBusy(false);
    render();
  }
}

async function handleRoundsReply(message) {
  const rounds = extractRounds(message);
  if (!rounds) {
    pushAssistantMessage({
      title: "没有识别到有效轮次",
      body: "请直接输入 1 到 6 之间的数字，例如 2。",
    });
    render();
    focusChat();
    return;
  }

  if (!state.flow.resumeFile) {
    state.flow.waitingForRounds = false;
    state.flow.chatMode = false;
    state.flow.phase = "idle";
    showEntryError("模拟面试需要先上传简历文件。若你刷新过页面，请先重新上传简历再开始。");
    pushAssistantMessage({
      label: "系统提示",
      title: "缺少简历文件",
      body: "这次启动已被前端拦截。请先回到首页重新上传简历，否则 Coze 工作流会因为空值而报错。",
    });
    render();
    return;
  }

  state.flow.rounds = rounds;
  state.flow.currentRound = 1;
  state.flow.phase = "interview";
  state.flow.waitingForRounds = false;
  render();

  setBusy(true);
  pushSystemMessage("正在启动模拟面试。");
  render();

  try {
    const result = await workflowClient().startInterview({
      requestType: "interview",
      sessionId: state.flow.sessionId,
      targetPosition: state.flow.pendingInterviewBootstrap?.targetPosition || state.flow.targetPosition,
      userMessage: state.flow.pendingInterviewBootstrap?.details || "",
      totalRounds: rounds,
      currentRound: state.flow.currentRound,
      resumeFile: state.flow.resumeFile,
      history: state.flow.interviewHistory,
    });

    if (result.question) {
      state.flow.lastQuestion = result.question;
      pushAssistantMessage({
        title: `第 ${state.flow.currentRound} 题`,
        body: result.question,
        meta: result.meta,
      });
    } else {
      state.flow.phase = "interview-done";
      state.flow.interviewReport = stringifyResult(result.raw);
      pushAssistantMessage({
        title: "工作流返回结果",
        html: formatWorkflowHtml(result.raw, result.primaryText),
        meta: result.meta,
      });
    }
  } catch (error) {
    pushAssistantMessage({
      label: "调用失败",
      title: "模拟面试未成功启动",
      body: normalizeError(error),
    });
    state.flow.phase = "idle";
  } finally {
    setBusy(false);
    render();
    focusChat();
  }
}

async function handleInterviewAnswer(answer) {
  const currentQuestion = state.flow.lastQuestion;
  if (!currentQuestion) {
    pushSystemMessage("当前没有待回答的问题。");
    render();
    focusChat();
    return;
  }

  setBusy(true);
  pushSystemMessage(`正在提交第 ${state.flow.currentRound} 轮回答。`);
  render();

  try {
    const result = await workflowClient().submitInterviewAnswer({
      requestType: "interview",
      sessionId: state.flow.sessionId,
      targetPosition: state.flow.targetPosition,
      userMessage: state.flow.entryDetails,
      totalRounds: state.flow.rounds,
      currentRound: state.flow.currentRound,
      question: currentQuestion,
      answer,
      resumeFile: state.flow.resumeFile,
      history: state.flow.interviewHistory,
    });

    state.flow.interviewHistory.push({
      round: state.flow.currentRound,
      question: currentQuestion,
      answer,
      raw: result.raw,
    });

    if (result.feedback) {
      pushAssistantMessage({
        title: `第 ${state.flow.currentRound} 轮反馈`,
        html: formatWorkflowHtml(result.raw, result.feedback),
        meta: result.meta,
      });
    } else {
      pushAssistantMessage({
        title: `第 ${state.flow.currentRound} 轮返回`,
        html: formatWorkflowHtml(result.raw, result.primaryText),
        meta: result.meta,
      });
    }

    const hasMoreRounds = state.flow.currentRound < state.flow.rounds;

    if (!result.question && hasMoreRounds) {
      const nextRound = state.flow.currentRound + 1;
      pushSystemMessage(`正在获取第 ${nextRound} 题，请稍等。`);
      render();

      const nextQuestionResult = await workflowClient().startInterview({
        requestType: "interview",
        sessionId: state.flow.sessionId,
        targetPosition: state.flow.targetPosition,
        userMessage: state.flow.entryDetails,
        totalRounds: state.flow.rounds,
        currentRound: nextRound,
        resumeFile: state.flow.resumeFile,
        history: state.flow.interviewHistory,
      });

      if (nextQuestionResult.question) {
        state.flow.currentRound = nextRound;
        state.flow.phase = "interview";
        state.flow.lastQuestion = nextQuestionResult.question;
        pushAssistantMessage({
          title: `第 ${state.flow.currentRound} 题`,
          body: nextQuestionResult.question,
          meta: nextQuestionResult.meta,
        });
        render();
        focusChat();
        return;
      }

      state.flow.phase = "interview-done";
      state.flow.interviewReport = stringifyResult(nextQuestionResult.raw || result.raw);
      const nextRoundReport = extractReportLikeText(nextQuestionResult.raw || result.raw);
      pushAssistantMessage({
        title: "模拟面试复盘报告",
        html: formatWorkflowHtml(
          nextQuestionResult.raw || result.raw,
          nextRoundReport || nextQuestionResult.primaryText || result.primaryText,
        ),
        meta: nextQuestionResult.meta || result.meta,
      });
      render();
      focusChat();
      return;
    }

    if (result.finished || !result.question) {
      state.flow.phase = "interview-done";
      state.flow.interviewReport = stringifyResult(result.raw);
      if (result.question) {
        state.flow.lastQuestion = result.question;
      }
      const finalReport = extractReportLikeText(result.raw);
      if (finalReport) {
        pushAssistantMessage({
          title: "模拟面试复盘报告",
          html: formatWorkflowHtml(result.raw, finalReport),
          meta: result.meta,
        });
      } else if (!result.feedback) {
        pushAssistantMessage({
          title: "模拟面试结果",
          html: formatWorkflowHtml(result.raw, result.primaryText),
          meta: result.meta,
        });
      }
      render();
      focusChat();
      return;
    }

    state.flow.currentRound += 1;
    state.flow.lastQuestion = result.question;
    pushAssistantMessage({
      title: `第 ${state.flow.currentRound} 题`,
      body: result.question,
      meta: result.meta,
    });
  } catch (error) {
    pushAssistantMessage({
      label: "调用失败",
      title: "回答提交失败",
      body: normalizeError(error),
    });
  } finally {
    setBusy(false);
    render();
    focusChat();
  }
}

function setBusy(value) {
  state.flow.busy = value;
}

function focusChat() {
  elements.chatShell.scrollIntoView({ behavior: "smooth", block: "start" });
  elements.chatInput.focus();
}

function render() {
  elements.fileName.textContent = state.flow.resumeFile?.name || "点击上传 PDF / DOC / DOCX / TXT";
  elements.sessionHint.textContent = `session_id：${state.flow.sessionId}`;
  elements.chatSession.textContent = `session_id：${state.flow.sessionId}`;
  elements.requestType.value = state.flow.requestType;
  elements.targetPosition.value = state.flow.targetPosition;

  elements.surface.classList.toggle("chat-mode", state.flow.chatMode);
  elements.chatShell.classList.toggle("hidden", !state.flow.chatMode);
  elements.entryShell.classList.toggle("hidden", state.flow.chatMode);
  elements.roundInline.classList.toggle("hidden", !state.flow.waitingForRounds);

  elements.flowTitle.textContent = titleByPhase();
  elements.flowPhase.textContent = phaseLabel();
  elements.intentPill.textContent = formatIntent(state.flow.intent);
  elements.summaryRequest.textContent = formatIntent(state.flow.intent || state.flow.requestType);
  elements.summaryPosition.textContent = state.flow.targetPosition || "未填写";
  elements.summaryFile.textContent = state.flow.resumeFile?.name || "未上传";

  elements.chatLabel.textContent = chatLabelByPhase();
  elements.chatInput.placeholder = chatPlaceholderByPhase();

  if (state.flow.chatMode && state.flow.intent === "interview") {
    elements.mainTitle.textContent = "你已进入模拟面试聊天";
    elements.mainCopy.textContent = "下面会结合 Coze 工作流的真实返回，继续进行轮次确认、提问与反馈。";
  } else if (state.flow.chatMode && state.flow.intent === "diagnosis") {
    elements.mainTitle.textContent = "简历结果已生成";
    elements.mainCopy.textContent = "下面展示的是 Coze 工作流真实返回结果，我会尽量按原样呈现。";
  } else {
    elements.mainTitle.textContent = "先告诉我你想做什么";
    elements.mainCopy.textContent = "输入诉求、目标岗位和简历文件。选择模拟面试后，会切换到聊天界面继续轮次确认和问答。";
  }

  updateHostedUi();
  updateSchemaStatus();
  renderThread();
}

function updateHostedUi() {
  if (!elements.devSettings) {
    return;
  }

  elements.devSettings.hidden = hasHostedProxy();
}

function showEntryError(message) {
  elements.entryError.textContent = message;
  elements.entryError.classList.remove("hidden");
}

function clearEntryError() {
  elements.entryError.textContent = "";
  elements.entryError.classList.add("hidden");
}

function renderThread() {
  elements.thread.innerHTML = state.flow.thread
    .map((message) => {
      const meta = message.meta?.length
        ? `<div class="message-meta">${message.meta
            .map((item) => `<span class="meta-chip">${escapeHtml(item)}</span>`)
            .join("")}</div>`
        : "";

      return `
        <article class="message ${message.role}">
          ${message.role === "assistant" ? '<div class="message-avatar">AI</div>' : ""}
          <div class="message-card">
            ${message.label ? `<p class="message-label">${escapeHtml(message.label)}</p>` : ""}
            ${message.title ? `<h3>${escapeHtml(message.title)}</h3>` : ""}
            ${message.body ? `<p>${escapeHtml(message.body).replaceAll("\n", "<br />")}</p>` : ""}
            ${message.html || ""}
            ${meta}
          </div>
        </article>
      `;
    })
    .join("");

  elements.thread.scrollTop = elements.thread.scrollHeight;
}

function resetConversation() {
  state.flow = createInitialFlow();
  elements.fileInput.value = "";
  elements.entryMessage.value = "";
  elements.chatInput.value = "";
  elements.targetPosition.value = "";
  elements.requestType.value = "diagnosis";
  clearEntryError();
  setInitialThread();
  render();
}

function setInitialThread() {
  const hostedMeta = hasHostedProxy()
    ? ["支持上传 PDF / DOC / DOCX / TXT", "当前为公网托管模式，访问者无需填写 Token"]
    : ["支持上传 PDF / DOC / DOCX / TXT", "真实模式需要部署 API 地址和 Token"];

  state.flow.thread = [
    {
      role: "assistant",
      label: "欢迎使用",
      title: "这里会根据你的诉求自动分流",
      body:
        "如果你选择简历优化，我会直接调用 Coze 工作流并展示结果；如果你选择模拟面试，提交后会切换到聊天界面继续交互。",
      meta: hostedMeta,
    },
  ];
}

function pushUserMessage(text) {
  state.flow.thread.push({
    role: "user",
    body: text,
  });
}

function pushAssistantMessage(message) {
  state.flow.thread.push({
    role: "assistant",
    ...message,
  });
}

function pushSystemMessage(text) {
  state.flow.thread.push({
    role: "assistant",
    label: "系统提示",
    body: text,
  });
}

function inferIntent(requestType, details) {
  if (requestType === "interview") {
    return {
      intent: "interview",
      reason: details
        ? "已进入模拟面试流程。我会结合你的目标岗位和补充说明，调用 Coze 工作流继续追问。"
        : "已进入模拟面试流程。接下来确认轮次后，我会调用 Coze 工作流继续提问。",
    };
  }

  return {
    intent: "diagnosis",
    reason: "已进入简历优化流程。我会围绕目标岗位展示 Coze 工作流的真实返回内容。",
  };
}

function inferIntentFromText(text) {
  return /模拟面试|面试|interview/i.test(String(text || "")) ? "interview" : "diagnosis";
}

function extractTargetPosition(text) {
  const patterns = [
    /目标岗位(?:是|为|:|：)?\s*([^\n，。]+)/,
    /岗位(?:是|为|:|：)?\s*([^\n，。]+)/,
  ];

  for (const pattern of patterns) {
    const match = String(text || "").match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function extractRounds(message) {
  const numberMatch = String(message || "").match(/[1-6]/);
  return numberMatch ? Number(numberMatch[0]) : 0;
}

function chatLabelByPhase() {
  if (state.flow.waitingForRounds) {
    return "输入轮次";
  }
  if (state.flow.phase === "interview") {
    return "你的回答";
  }
  if (state.flow.phase === "interview-done") {
    return "继续交流";
  }
  return "聊天输入";
}

function chatPlaceholderByPhase() {
  if (state.flow.waitingForRounds) {
    return "请输入面试轮次，例如 2";
  }
  if (state.flow.phase === "interview") {
    return "请在这里输入你对当前问题的回答";
  }
  if (state.flow.phase === "interview-done") {
    return "本轮面试已完成，可以返回表单开启新会话";
  }
  return "请在这里输入内容";
}

function titleByPhase() {
  switch (state.flow.phase) {
    case "diagnosis":
      return "简历优化进行中";
    case "diagnosis-done":
      return "简历优化已完成";
    case "need-rounds":
      return "等待确认面试轮次";
    case "interview":
      return `模拟面试第 ${state.flow.currentRound} 轮`;
    case "interview-done":
      return "模拟面试已完成";
    default:
      return "等待输入";
  }
}

function phaseLabel() {
  switch (state.flow.phase) {
    case "diagnosis":
      return "简历优化";
    case "diagnosis-done":
      return "结果已生成";
    case "need-rounds":
      return "等待轮次";
    case "interview":
      return "模拟面试";
    case "interview-done":
      return "结果已生成";
    default:
      return "待开始";
  }
}

function formatIntent(intent) {
  if (intent === "interview") {
    return "模拟面试";
  }
  if (intent === "diagnosis") {
    return "简历优化";
  }
  return "未识别";
}

function updateSchemaStatus(errorMessage = "") {
  if (errorMessage) {
    elements.schemaStatus.textContent = `参数说明读取失败：${errorMessage}`;
    return;
  }

  if (hasHostedProxy()) {
    elements.schemaStatus.textContent =
      `当前为公网托管模式\n` +
      `工作流 ID：${state.config.workflowId || state.runtime.workflowId || "未配置"}\n` +
      "访问者将通过本站安全代理调用 Coze，无需填写 Token";
    return;
  }

  if (!state.schema) {
    elements.schemaStatus.textContent = "将直接调用 Coze 工作流 OpenAPI";
    return;
  }

  const inputFields = Object.keys(state.schema.input_schema?.properties || {});
  const outputFields = Object.keys(state.schema.output_schema?.properties || {});
  const timeText = state.schemaLoadedAt ? `\n最近读取：${state.schemaLoadedAt.toLocaleString("zh-CN")}` : "";

  elements.schemaStatus.textContent =
    `工作流 ID：${state.config.workflowId || "未填写"}\n` +
    `建议输入字段：${inputFields.length ? inputFields.join("、") : "无"}\n` +
    `常见输出字段：${outputFields.length ? outputFields.join("、") : "无"}${timeText}`;
}

function workflowClient() {
  syncConfigFromForm({ persist: true });
  return state.config.mode === "mock" ? mockWorkflowClient : publishedWorkflowClient;
}

const mockWorkflowClient = {
  async fetchSchema() {
    await wait(200);
    return {
      input_schema: {
        type: "object",
        properties: {
          request_type: { type: "string" },
          target_position: { type: "string" },
          user_message: { type: "string" },
          session_id: { type: "string" },
        },
      },
      output_schema: {
        type: "object",
        properties: {
          report: { type: "string" },
          question: { type: "string" },
        },
      },
    };
  },

  async runDiagnosis(payload) {
    await wait(400);
    const raw = {
      report: `#### 整体判断
- 当前简历已具备基本信息，但仍可进一步贴合 ${payload.targetPosition || "目标岗位"}。
#### 优化建议
- 将最相关的项目经历前置\n- 每段经历补齐背景、行动、结果\n- 增加量化指标，例如转化率、用户规模、项目周期
#### 岗位匹配建议
- 如果你投递产品经理，建议强化需求分析、跨团队协作、上线复盘与结果导向`,
      session_id: payload.sessionId,
    };

    return {
      raw,
      primaryText: raw.report,
      meta: [`模式：Mock`, `session_id：${payload.sessionId}`],
    };
  },

  async startInterview(payload) {
    await wait(300);
    const raw = {
      question: `请先做一个 1 到 2 分钟的自我介绍，并重点说明哪些经历最能支撑你应聘 ${payload.targetPosition || "当前岗位"}。`,
      total_rounds: payload.totalRounds,
    };

    return {
      raw,
      question: raw.question,
      primaryText: raw.question,
      meta: [`模式：Mock`, `总轮次：${payload.totalRounds}`],
    };
  },

  async submitInterviewAnswer(payload) {
    await wait(280);
    const score = Math.max(60, Math.min(95, 70 + (payload.answer.length % 15)));
    const finished = payload.currentRound >= payload.totalRounds;
    const raw = finished
      ? {
          feedback: `本轮得分 ${score}。你的表达已经比较完整，但案例细节和量化结果还能更扎实。`,
          report: `#### 总体评价
- 这轮模拟面试已完成
#### 改进建议
- 使用 STAR 结构组织表达
- 每个案例至少补充 2 到 3 个可量化结果`,
          score,
        }
      : {
          feedback: `本轮得分 ${score}。建议下一轮把背景、行动和结果说得更具体一些。`,
          question: "请选择一个最能体现你能力的项目，具体说明你如何拆解问题、推动协作，并拿到了什么结果。",
          score,
        };

    return {
      raw,
      question: raw.question || "",
      feedback: raw.feedback || "",
      primaryText: raw.report || raw.feedback || raw.question || stringifyResult(raw),
      finished,
      meta: [`模式：Mock`, `得分：${score}`],
    };
  },
};

const publishedWorkflowClient = {
  async fetchSchema() {
    ensurePublishedConfig({ needWorkflowToken: true });
    return {
      input_schema: {
        type: "object",
        properties: {
          user_message: { type: "string" },
          target_position: { type: "string" },
          user_answers: {
            type: "array",
            items: { type: "string" },
          },
          a: { type: "string" },
          intent: { type: "string" },
        },
      },
      output_schema: {
        type: "object",
        properties: {
          data: { type: "string" },
          interrupt_data: { type: "object" },
          debug_url: { type: "string" },
          usage: { type: "object" },
        },
      },
    };
  },

  async runDiagnosis(payload) {
    const raw = await this.runWorkflow({
      ...payload,
      phase: "diagnosis",
    });

    return {
      raw,
      primaryText: extractPrimaryText(raw),
      meta: buildResponseMeta(raw),
    };
  },

  async startInterview(payload) {
    let raw = await this.runWorkflowStream({
      ...payload,
      phase: "interview-start",
    });

    if (shouldAutoResumeRounds(raw) && payload.totalRounds) {
      raw = await this.resumeWorkflowStream({
        ...payload,
        phase: "interview-rounds",
        resumeData: buildRoundResumeData(payload.totalRounds),
      });
    }

    return {
      raw,
      question: extractQuestion(raw),
      primaryText: extractPrimaryText(raw),
      meta: buildResponseMeta(raw),
    };
  },

  async submitInterviewAnswer(payload) {
    const raw = await this.resumeWorkflowStream({
      ...payload,
      phase: "interview-answer",
    });

    const question = extractQuestion(raw);
    const reportLike = extractReportLikeText(raw);
    return {
      raw,
      question,
      feedback: extractFeedback(raw),
      primaryText: extractPrimaryText(raw),
      finished: !question || Boolean(reportLike) || payload.currentRound >= payload.totalRounds,
      meta: buildResponseMeta(raw),
    };
  },

  async runWorkflowStream(context) {
    ensurePublishedConfig({
      needWorkflowToken: true,
      needAccessToken: Boolean(context.resumeFile),
    });

    state.schema = await this.fetchSchema();
    state.schemaLoadedAt = new Date();

    const uploadedResume = context.resumeFile ? await ensureUploadedResume(context.resumeFile) : null;
    const resumeText = context.resumeFile ? await ensureDiagnosisResumeText(context.resumeFile) : "";
    if (uploadedResume) {
      state.flow.uploadedResume = uploadedResume;
    }

    const body = buildWorkflowRunBody({
      ...context,
      resumeUpload: uploadedResume || state.flow.uploadedResume,
      resumeText,
    });

    const useHostedProxy = hasHostedProxy();

    return requestWorkflowStream(useHostedProxy ? buildRuntimeApiUrl("/workflow/stream_run") : buildCozeApiUrl("/v1/workflow/stream_run"), {
      method: "POST",
      headers: useHostedProxy
        ? {
            "Content-Type": "application/json",
          }
        : {
            ...workflowHeaders(),
            "Content-Type": "application/json",
          },
      body: JSON.stringify(body),
    });
  },

  async resumeWorkflowStream(context) {
    ensurePublishedConfig({ needWorkflowToken: true });

    if (!state.flow.pendingInterrupt?.event_id || !state.flow.pendingInterrupt?.type) {
      return this.runWorkflowStream(context);
    }

    const useHostedProxy = hasHostedProxy();

    return requestWorkflowStream(useHostedProxy ? buildRuntimeApiUrl("/workflow/stream_resume") : buildCozeApiUrl("/v1/workflow/stream_resume"), {
      method: "POST",
      headers: useHostedProxy
        ? {
            "Content-Type": "application/json",
          }
        : {
            ...workflowHeaders(),
            "Content-Type": "application/json",
          },
      body: JSON.stringify({
        workflow_id: state.config.workflowId,
        event_id: state.flow.pendingInterrupt.event_id,
        interrupt_type: state.flow.pendingInterrupt.type,
        resume_data: buildResumeData(context),
      }),
    });
  },

  async runWorkflow(context) {
    ensurePublishedConfig({
      needWorkflowToken: true,
      needAccessToken: Boolean(context.resumeFile),
    });

    state.schema = await this.fetchSchema();
    state.schemaLoadedAt = new Date();

    const uploadedResume = context.resumeFile ? await ensureUploadedResume(context.resumeFile) : null;
    const resumeDocument = context.resumeFile ? await ensureResumeDocumentValue(context.resumeFile) : "";
    const resumeText = context.resumeFile ? await ensureDiagnosisResumeText(context.resumeFile) : "";
    if (uploadedResume) {
      state.flow.uploadedResume = uploadedResume;
    }

    const body = buildWorkflowRunBody({
      ...context,
      resumeUpload: uploadedResume || state.flow.uploadedResume,
      resumeDocument,
      resumeText,
    });

    const useHostedProxy = hasHostedProxy();
    const raw = await requestJson(useHostedProxy ? buildRuntimeApiUrl("/workflow/run") : buildCozeApiUrl("/v1/workflow/run"), {
      method: "POST",
      headers: useHostedProxy
        ? {
            "Content-Type": "application/json",
          }
        : {
            ...workflowHeaders(),
            "Content-Type": "application/json",
          },
      body: JSON.stringify(body),
    });
    return normalizeWorkflowResponse(raw);
  },

  async resumeWorkflow(context) {
    ensurePublishedConfig({ needWorkflowToken: true });

    if (!state.flow.pendingInterrupt?.event_id || !state.flow.pendingInterrupt?.type) {
      return this.runWorkflow(context);
    }

    const useHostedProxy = hasHostedProxy();
    const raw = await requestJson(useHostedProxy ? buildRuntimeApiUrl("/workflow/resume") : buildCozeApiUrl("/v1/workflows/resume"), {
      method: "POST",
      headers: useHostedProxy
        ? {
            "Content-Type": "application/json",
          }
        : {
            ...workflowHeaders(),
            "Content-Type": "application/json",
          },
      body: JSON.stringify({
        workflow_id: state.config.workflowId,
        event_id: state.flow.pendingInterrupt.event_id,
        interrupt_type: state.flow.pendingInterrupt.type,
        resume_data: buildResumeData(context),
      }),
    });
    return normalizeWorkflowResponse(raw);
  },
};

async function uploadResumeFile(file) {
  ensurePublishedConfig({ needAccessToken: true });

  const formData = new FormData();
  formData.append("file", file);

  const useHostedProxy = hasHostedProxy();
  const result = await requestJson(useHostedProxy ? buildRuntimeApiUrl("/files/upload") : "https://api.coze.cn/v1/files/upload", {
    method: "POST",
    headers: useHostedProxy
      ? {}
      : {
          Authorization: `Bearer ${fileUploadToken()}`,
        },
    body: formData,
  });

  if (result?.code !== 0 || !result?.data?.id) {
    throw new Error(result?.msg || "简历文件上传失败。");
  }

  return result.data;
}

async function ensureUploadedResume(file) {
  const nextKey = buildResumeFileCacheKey(file);
  if (
    state.flow.uploadedResume
    && state.flow.uploadedResumeKey
    && nextKey
    && state.flow.uploadedResumeKey === nextKey
  ) {
    return state.flow.uploadedResume;
  }

  const uploaded = await uploadResumeFile(file);
  state.flow.uploadedResumeKey = nextKey;
  return uploaded;
}

async function ensureResumeDocumentValue(file) {
  const nextKey = buildResumeFileCacheKey(file);
  if (
    state.flow.resumeDocumentValue
    && state.flow.resumeDocumentKey
    && nextKey
    && state.flow.resumeDocumentKey === nextKey
  ) {
    return state.flow.resumeDocumentValue;
  }

  const value = await readFileAsBase64(file);
  state.flow.resumeDocumentKey = nextKey;
  state.flow.resumeDocumentValue = value;
  return value;
}

async function ensureDiagnosisResumeText(file) {
  const nextKey = buildResumeFileCacheKey(file);
  if (
    state.flow.resumeTextValue
    && state.flow.resumeTextKey
    && nextKey
    && state.flow.resumeTextKey === nextKey
  ) {
    return state.flow.resumeTextValue;
  }

  const value = await extractResumeText(file);
  state.flow.resumeTextKey = nextKey;
  state.flow.resumeTextValue = value;
  return value;
}

function getMammothGlobal() {
  return globalThis.mammoth || globalThis.Mammoth || globalThis.mammothBrowser || null;
}

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error("缺少脚本地址。"));
      return;
    }

    const existing = Array.from(document.scripts).find((script) => script.src === src);
    if (existing) {
      if (getMammothGlobal()?.extractRawText) {
        resolve(existing);
        return;
      }

      existing.addEventListener("load", () => resolve(existing), { once: true });
      existing.addEventListener("error", () => reject(new Error(`脚本加载失败：${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.addEventListener("load", () => resolve(script), { once: true });
    script.addEventListener("error", () => reject(new Error(`脚本加载失败：${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

async function ensureMammothLoaded() {
  const existing = getMammothGlobal();
  if (existing?.extractRawText) {
    return existing;
  }

  if (!globalThis.__mammothLoaderPromise) {
    globalThis.__mammothLoaderPromise = (async () => {
      const scriptUrls = [
        "https://unpkg.com/mammoth@1.8.0/mammoth.browser.min.js",
        "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js",
      ];

      for (const src of scriptUrls) {
        try {
          await loadExternalScript(src);
        } catch (error) {
          continue;
        }

        const loaded = getMammothGlobal();
        if (loaded?.extractRawText) {
          return loaded;
        }
      }

      try {
        const module = await import("https://esm.sh/mammoth@1.8.0");
        if (module?.extractRawText) {
          globalThis.mammoth = module;
          return module;
        }
      } catch (error) {
        return null;
      }

      return null;
    })();
  }

  const mammoth = await globalThis.__mammothLoaderPromise;
  if (!mammoth?.extractRawText) {
    globalThis.__mammothLoaderPromise = null;
    return null;
  }

  return mammoth;
}

function buildResumeFileCacheKey(file) {
  if (!file) {
    return "";
  }

  return [file.name || "", file.size || 0, file.lastModified || 0].join(":");
}

function buildWorkflowRunBody(context) {
  return {
    workflow_id: state.config.workflowId,
    parameters: buildCozeWorkflowParameters(context),
    connector_id: "1024",
  };
}

function buildCozeWorkflowParameters(context) {
  const composedMessage = composeWorkflowMessage(context);
  const resumeValue = formatUploadedFileValue(context.resumeUpload);
  const resumeDocument = context.resumeDocument || "";
  const resumeText = context.resumeText || "";
  const userAnswers = buildWorkflowUserAnswers(context);
  const workflowIntent = mapWorkflowIntentValue(context.requestType);
  const historyValue = context.history?.length ? JSON.stringify(context.history) : "";
  const parameters = {
    user_message: composedMessage,
    target_position: context.targetPosition || "",
    user_answers: userAnswers,
    intent: workflowIntent,
    input: composedMessage,
    message: composedMessage,
    request: composedMessage,
    job: context.targetPosition || "",
    session_id: context.sessionId || state.flow.sessionId,
    total_rounds: context.totalRounds || 0,
    current_round: context.currentRound || 0,
    question: context.question || state.flow.lastQuestion || "",
    answer: context.answer || "",
    history: historyValue,
  };

  if (resumeValue) {
    parameters.a = resumeValue;
    parameters.document = resumeValue;
    parameters.resume_file = resumeValue;
    parameters.resume = resumeValue;
    parameters.file = resumeValue;
  } else if (resumeDocument) {
    parameters.document = resumeDocument;
  }

  if (resumeText) {
    parameters.resume_text = resumeText;
    parameters.resume_content = resumeText;
    parameters.content = resumeText;
    parameters.resume_name = context.resumeFile?.name || "";
  }

  return parameters;
}

function buildWorkflowUserAnswers(context) {
  const priorAnswers = Array.isArray(context.userAnswers)
    ? context.userAnswers
    : Array.isArray(context.history)
      ? context.history.map((item) => item?.answer).filter(Boolean)
      : [];

  if (context.phase === "interview-answer" && context.answer) {
    return [...priorAnswers, context.answer];
  }

  return priorAnswers;
}

function mapWorkflowIntentValue(requestType) {
  return requestType === "interview" ? "interview" : "diagnosis";
}

function mapWorkflowIntent(requestType) {
  return requestType === "interview" ? "模拟面试" : "生成简历";
}

function formatUploadedFileValue(resumeUpload) {
  if (!resumeUpload?.id) {
    return "";
  }

  return {
    file_id: resumeUpload.id,
  };
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",").pop() || "" : result;
      resolve(base64);
    };
    reader.onerror = () => {
      reject(new Error("无法读取上传的简历文件。"));
    };
    reader.readAsDataURL(file);
  });
}

async function extractResumeText(file) {
  if (!file) {
    return "";
  }

  const lowerName = String(file.name || "").toLowerCase();

  if (lowerName.endsWith(".txt") || file.type.startsWith("text/")) {
    const text = await file.text();
    return normalizeResumeText(text);
  }

  if (lowerName.endsWith(".docx")) {
    try {
      const mammoth = await ensureMammothLoaded();
      if (!mammoth?.extractRawText) {
        return "";
      }
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return normalizeResumeText(result?.value || "");
    } catch (error) {
      return "";
    }
  }

  return "";
}

function normalizeResumeText(text) {
  const normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return normalized.slice(0, 12000);
}

function composeWorkflowMessage(context) {
  const baseIntent = context.requestType === "interview" ? "模拟面试" : "简历优化";
  const parts = [
    `诉求：${baseIntent}`,
    context.targetPosition ? `目标岗位：${context.targetPosition}` : "",
    context.userMessage ? `补充说明：${context.userMessage}` : "",
  ].filter(Boolean);

  if (context.phase === "diagnosis" && context.resumeFile?.name) {
    parts.push(`已上传简历文件：${context.resumeFile.name}`);
  }

  if (context.phase === "diagnosis" && context.resumeText) {
    parts.push("前端已提取简历正文，可结合解析内容继续诊断。");
  }

  if (context.phase === "interview-start" && context.totalRounds) {
    parts.push(`面试轮次：${context.totalRounds}`);
  }

  if (context.phase === "interview-answer") {
    parts.push(`当前轮次：${context.currentRound}`);
    if (context.question) {
      parts.push(`当前问题：${context.question}`);
    }
    parts.push(`我的回答：${context.answer || ""}`);
  }

  if (context.history?.length) {
    parts.push(`历史记录：${JSON.stringify(context.history)}`);
  }

  return parts.join("\n");
}

function ensurePublishedConfig({
  needWorkflowToken = false,
  needAccessToken = false,
} = {}) {
  syncConfigFromForm({ persist: true });

  if (hasHostedProxy()) {
    if (!state.config.workflowId && !state.runtime.workflowId) {
      throw new Error("服务端尚未配置工作流 ID。");
    }
    return;
  }

  if (!state.config.endpoint) {
    throw new Error("请先填写 Coze API 地址。");
  }

  if (!state.config.workflowId) {
    throw new Error("请先填写工作流 ID。");
  }

  if (needWorkflowToken && !state.config.workflowToken) {
    throw new Error("请先填写 Coze PAT / Access Token。");
  }

  if (needAccessToken && !fileUploadToken()) {
    throw new Error("你上传了简历文件，因此还需要可用的文件上传 Token。");
  }
}

function workflowHeaders() {
  return {
    Authorization: `Bearer ${state.config.workflowToken}`,
  };
}

function fileUploadToken() {
  return state.config.accessToken || state.config.workflowToken;
}

function buildCozeApiUrl(pathname) {
  const raw = String(state.config.endpoint || "").trim() || "https://api.coze.cn";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  url.hash = "";
  url.search = "";
  url.pathname = pathname;
  return url.toString();
}

function buildRuntimeApiUrl(pathname) {
  const base = String(state.runtime.apiBase || "/api").replace(/\/$/, "");
  return `${base}${pathname}`;
}

function normalizeWorkflowResponse(raw) {
  if (typeof raw?.code === "number" && raw.code !== 0) {
    throw new Error(raw?.msg || `Coze 工作流调用失败，错误码：${raw.code}`);
  }

  const parsedData = parsePossiblyJson(raw?.data);
  const interrupt = normalizeInterruptData(raw?.interrupt_data);

  state.flow.pendingInterrupt = interrupt;

  return {
    ...raw,
    parsed_data: parsedData,
    interrupt_data: interrupt,
  };
}

async function requestJson(url, options) {
  let response;

  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(
      `请求未成功发出，可能是网络问题、CORS 限制，或部署地址不可访问。原始错误：${error.message}`,
    );
  }

  const text = await response.text();
  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    if (!response.ok) {
      throw new Error(`接口返回了非 JSON 错误：${text || response.statusText}`);
    }
    throw new Error(`接口返回了无法解析的内容：${text.slice(0, 400)}`);
  }

  if (!response.ok) {
    throw new Error(data?.msg || data?.error || response.statusText || "接口调用失败。");
  }

  return data;
}

async function requestWorkflowStream(url, options) {
  let response;

  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(
      `请求未成功发出，可能是网络问题、CORS 限制，或部署地址不可访问。原始错误：${error.message}`,
    );
  }

  if (!response.ok) {
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error(`接口返回了非 JSON 错误：${text || response.statusText}`);
    }
    throw new Error(data?.msg || data?.error || response.statusText || "接口调用失败。");
  }

  if (!response.body) {
    throw new Error("流式接口未返回可读取的数据流。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  const chunks = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const { events, rest } = parseSseBuffer(buffer, done);
    if (events.length) {
      chunks.push(...events);
    }
    buffer = rest;
    if (done) {
      break;
    }
  }

  return normalizeWorkflowStreamResponse(chunks);
}

function extractQuestion(raw) {
  const parsedQuestion =
    extractByKey(raw?.parsed_data, ["question", "next_question", "first_question", "interview_question", "current_question"]) ||
    extractByKey(raw, ["question", "next_question", "first_question", "interview_question", "current_question"]);
  const interruptQuestion = shouldAutoResumeRounds(raw)
    ? ""
    : raw?.interrupt_data?.content || raw?.interrupt_data?.prompt || "";
  return (
    parsedQuestion ||
    interruptQuestion
  );
}

function extractFeedback(raw) {
  return (
    extractByKey(raw?.parsed_data, ["feedback", "comment", "evaluation"]) ||
    extractByKey(raw, ["feedback", "comment", "evaluation"])
  );
}

function extractReportLikeText(raw) {
  return (
    extractByKey(raw?.parsed_data, ["report", "report2", "interview_report", "summary", "result", "analysis", "output"]) ||
    extractByKey(raw, ["report", "report2", "interview_report", "summary", "result", "analysis", "output"])
  );
}

function extractPrimaryText(raw) {
  return (
    extractQuestion(raw) ||
    extractFeedback(raw) ||
    extractReportLikeText(raw) ||
    extractFirstLongString(raw) ||
    stringifyResult(raw)
  );
}

function parsePossiblyJson(value) {
  if (typeof value !== "string") {
    return value;
  }

  const text = value.trim();
  if (!text) {
    return "";
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}

function normalizeInterruptData(interruptData) {
  if (!interruptData) {
    return null;
  }

  const parsed = parsePossiblyJson(interruptData.data);
  return {
    ...interruptData,
    parsed_data: parsed,
    content:
      parsed?.content ||
      (Array.isArray(parsed) ? parsed.map((item) => item?.name).filter(Boolean).join("、") : "") ||
      "",
  };
}

function buildResumeData(context) {
  if (context.resumeData != null) {
    return context.resumeData;
  }

  const answer = String(context.answer ?? "");
  const interrupt = state.flow.pendingInterrupt || {};
  const interruptType = Number(interrupt.type || 0);
  const params = Array.isArray(interrupt.parsed_data)
    ? interrupt.parsed_data
    : [];
  const requiredParameters = (
    interrupt.required_parameters
    && typeof interrupt.required_parameters === "object"
    && !Array.isArray(interrupt.required_parameters)
  )
    ? interrupt.required_parameters
    : {};

  const requiredNames = [
    ...params
      .map((item) => String(item?.name || "").trim())
      .filter(Boolean),
    ...Object.keys(requiredParameters).map((name) => String(name || "").trim()).filter(Boolean),
  ].filter((name, index, list) => list.indexOf(name) === index);

  if (requiredNames.length === 1) {
    const onlyName = requiredNames[0];
    const onlySpec = requiredParameters[onlyName];
    const onlyType = String(onlySpec?.type || "").trim().toLowerCase();

    if (interruptType === 5) {
      return JSON.stringify({
        [onlyName]: answer,
      });
    }

    if (!onlyType || ["string", "number", "integer", "boolean"].includes(onlyType)) {
      return answer;
    }

    return JSON.stringify({
      [onlyName]: answer,
    });
  }

  if (requiredNames.includes("current_answer")) {
    if (interruptType === 5) {
      return JSON.stringify({
        current_answer: answer,
      });
    }
    return answer;
  }

  return answer;
}

function buildRoundResumeData(totalRounds) {
  const interrupt = state.flow.pendingInterrupt || {};
  const params = Array.isArray(interrupt.parsed_data)
    ? interrupt.parsed_data
    : [];
  const requiredParameters = (
    interrupt.required_parameters
    && typeof interrupt.required_parameters === "object"
    && !Array.isArray(interrupt.required_parameters)
  )
    ? interrupt.required_parameters
    : {};

  const requiredNames = [
    ...params
      .map((item) => String(item?.name || "").trim())
      .filter(Boolean),
    ...Object.keys(requiredParameters).map((name) => String(name || "").trim()).filter(Boolean),
  ].filter((name, index, list) => list.indexOf(name) === index);

  const roundValue = Number(totalRounds);
  const normalizedValue = Number.isFinite(roundValue) ? roundValue : String(totalRounds ?? "");
  const roundKey = requiredNames.find((name) => ["total_round", "total_rounds"].includes(name));

  if (roundKey) {
    return JSON.stringify({
      [roundKey]: normalizedValue,
    });
  }

  if (requiredNames.length === 1) {
    return JSON.stringify({
      [requiredNames[0]]: normalizedValue,
    });
  }

  return String(normalizedValue);
}

function parseSseBuffer(buffer, flush = false) {
  const normalized = String(buffer || "").replace(/\r\n/g, "\n");
  const blocks = normalized.split("\n\n");
  const rest = flush ? "" : (blocks.pop() || "");
  const events = blocks
    .map((block) => parseSseEventBlock(block))
    .filter(Boolean);
  return { events, rest };
}

function parseSseEventBlock(block) {
  const text = String(block || "").trim();
  if (!text) {
    return null;
  }

  const event = {
    id: "",
    event: "",
    data: "",
  };
  const dataLines = [];

  text.split("\n").forEach((line) => {
    if (line.startsWith("id:")) {
      event.id = line.slice(3).trim();
    } else if (line.startsWith("event:")) {
      event.event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  });

  const dataText = dataLines.join("\n");
  event.data = parsePossiblyJson(dataText);
  event.raw_data = dataText;
  return event;
}

function normalizeWorkflowStreamResponse(events) {
  const raw = {
    code: 0,
    msg: "",
    stream_events: events,
    parsed_data: {},
    interrupt_data: null,
    usage: null,
    detail: null,
    debug_url: "",
  };

  const parsed = {};
  const outputMessages = [];

  for (const item of events) {
    const eventName = String(item?.event || "");
    const payload = item?.data || {};

    if (eventName === "Error") {
      const errorCode = Number(payload?.error_code ?? payload?.code ?? -1);
      if (!Number.isNaN(errorCode) && errorCode !== 0) {
        throw new Error(payload?.error_message || payload?.msg || `Coze 工作流流式调用失败，错误码：${errorCode}`);
      }
      continue;
    }

    if (payload?.usage) {
      raw.usage = payload.usage;
    }
    if (payload?.detail) {
      raw.detail = payload.detail;
    }
    if (payload?.debug_url) {
      raw.debug_url = payload.debug_url;
    }
    if (typeof payload?.code === "number") {
      raw.code = payload.code;
    }
    if (typeof payload?.msg === "string") {
      raw.msg = payload.msg;
    }

    if (eventName === "Interrupt") {
      raw.interrupt_data = normalizeInterruptData(payload?.interrupt_data || payload);
      continue;
    }

    if (eventName !== "Message") {
      continue;
    }

    const nodeTitle = String(payload?.node_title || "");
    const contentValue = extractStreamContent(payload?.content);
    const contentText = stringifyStreamContent(contentValue);
    outputMessages.push({
      node_title: nodeTitle,
      content: contentText,
      raw_content: payload?.content,
    });

    if (!contentText) {
      continue;
    }

    if (nodeTitle.includes("输出_2") || nodeTitle.includes("输出_4")) {
      parsed.question = contentText;
    } else if (nodeTitle.includes("输出_3")) {
      parsed.feedback = contentText;
    } else if (
      nodeTitle.includes("结束")
      || nodeTitle.toLowerCase() === "end"
      || nodeTitle === ""
    ) {
      if (typeof contentValue === "object" && contentValue && !Array.isArray(contentValue)) {
        Object.assign(parsed, contentValue);
      } else if (!parsed.report && !parsed.report2) {
        parsed.report = contentText;
      }
    }
  }

  raw.output_messages = outputMessages;
  raw.parsed_data = parsed;
  state.flow.pendingInterrupt = raw.interrupt_data;

  if (typeof raw.code === "number" && raw.code !== 0) {
    throw new Error(raw.msg || `Coze 工作流流式调用失败，错误码：${raw.code}`);
  }

  return raw;
}

function extractStreamContent(content) {
  const parsed = parsePossiblyJson(content);
  if (typeof parsed === "string") {
    return parsePossiblyJson(parsed);
  }
  return parsed;
}

function stringifyStreamContent(content) {
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content.map((item) => stringifyStreamContent(item)).filter(Boolean).join("\n");
  }
  if (content && typeof content === "object") {
    const direct =
      extractByKey(content, ["question", "feedback", "report", "report2", "output", "content", "summary", "result"])
      || "";
    if (direct) {
      return direct;
    }
    return JSON.stringify(content);
  }
  return "";
}

function shouldAutoResumeRounds(raw) {
  const interrupt = raw?.interrupt_data;
  if (!interrupt) {
    return false;
  }

  const requiredMap = interrupt.required_parameters || {};
  if (
    Object.prototype.hasOwnProperty.call(requiredMap, "total_round") ||
    Object.prototype.hasOwnProperty.call(requiredMap, "total_rounds")
  ) {
    return true;
  }

  const parsed = interrupt.parsed_data;
  return Array.isArray(parsed)
    && parsed.some((item) => ["total_round", "total_rounds"].includes(String(item?.name || "").trim()));
}

function buildResponseMeta(raw) {
  const meta = [];

  const runId = extractByKey(raw, ["run_id", "runid"]);
  const taskId = extractByKey(raw, ["task_id", "taskid"]);
  const status = extractByKey(raw, ["status"]);
  const executeId = raw?.execute_id;
  const debugUrl = raw?.debug_url;

  if (status) {
    meta.push(`状态：${status}`);
  }
  if (runId) {
    meta.push(`run_id：${runId}`);
  }
  if (taskId) {
    meta.push(`task_id：${taskId}`);
  }
  if (executeId) {
    meta.push(`execute_id：${executeId}`);
  }
  if (raw?.interrupt_data?.event_id) {
    meta.push(`event_id：${raw.interrupt_data.event_id}`);
  }
  if (debugUrl) {
    meta.push(`debug_url：${debugUrl}`);
  }

  return meta;
}

function extractByKey(raw, candidateKeys) {
  const lowerKeys = candidateKeys.map((item) => item.toLowerCase());
  let found = "";

  walkObject(raw, (key, value) => {
    if (found || typeof value !== "string") {
      return;
    }

    const normalizedKey = String(key).toLowerCase();
    if (lowerKeys.some((candidate) => normalizedKey.includes(candidate))) {
      found = value.trim();
    }
  });

  return found;
}

function extractFirstLongString(raw) {
  let found = "";

  walkObject(raw, (_key, value) => {
    if (found || typeof value !== "string") {
      return;
    }
    const text = value.trim();
    if (text.length >= 20) {
      found = text;
    }
  });

  return found;
}

function walkObject(value, visitor) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkObject(item, visitor));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  Object.entries(value).forEach(([key, item]) => {
    visitor(key, item);
    walkObject(item, visitor);
  });
}

function formatWorkflowHtml(raw, preferredText) {
  const sections = [];
  const text = String(preferredText || "").trim();

  if (text) {
    sections.push(`<div class="rich-text">${renderMarkdownLike(text)}</div>`);
  }

  const pretty = escapeHtml(stringifyResult(raw));
  sections.push(
    `<details><summary>查看原始返回</summary><pre>${pretty}</pre></details>`,
  );

  return sections.join("");
}

function renderMarkdownLike(markdown) {
  const lines = String(markdown || "")
    .trim()
    .split("\n")
    .map((line) => line.trim());

  const blocks = [];
  let paragraphLines = [];
  let listType = "";
  let listItems = [];

  const flushParagraph = () => {
    if (!paragraphLines.length) {
      return;
    }

    blocks.push(
      `<p>${paragraphLines.map((line) => renderInlineMarkdown(line)).join("<br />")}</p>`,
    );
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listItems.length || !listType) {
      return;
    }

    blocks.push(
      `<${listType}>${listItems
        .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
        .join("")}</${listType}>`,
    );
    listType = "";
    listItems = [];
  };

  for (const line of lines) {
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();

      const level = Math.min(headingMatch[1].length + 1, 5);
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (/^(-|\*)\s+/.test(line)) {
      flushParagraph();
      const item = line.replace(/^(-|\*)\s+/, "");
      if (listType && listType !== "ul") {
        flushList();
      }
      listType = "ul";
      listItems.push(item);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      const item = line.replace(/^\d+\.\s+/, "");
      if (listType && listType !== "ol") {
        flushList();
      }
      listType = "ol";
      listItems.push(item);
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return blocks.join("");
}

function renderInlineMarkdown(text) {
  let html = escapeHtml(text);

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");

  return html;
}

function stringifyResult(value) {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
}

function loadConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultConfig, ...JSON.parse(saved) } : { ...defaultConfig };
  } catch (error) {
    return { ...defaultConfig };
  }
}

function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function createSessionId() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  return `session_${stamp}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

