const ALARM_NAME = "prodtime_tick";
const UPLOAD_INTERVAL_MIN = 1;
const BATCH_UPLOAD_EVERY = 60;

let lastTick = Date.now();
let currentDomain = null;
let paused = false;
let idleState = "active";
let windowFocused = true;
let accum = {};

const DEFAULTS = {
  backendUrl: "http://localhost:5000/api/track",
  idleSeconds: 30,
  userId: "demo-user"
};

function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function safeHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULTS, (cfg) => resolve(Object.assign({}, DEFAULTS, cfg)));
  });
}

async function getActiveDomain() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.url) return resolve(null);
      resolve(safeHostname(tab.url));
    });
  });
}

function commitSeconds(domain, secs) {
  if (!domain || !secs || secs <= 0) return;
  accum[domain] = (accum[domain] || 0) + secs;
}

async function onTick() {
  const now = Date.now();
  const elapsed = Math.max(0, Math.floor((now - lastTick) / 1000));
  lastTick = now;

  if (!paused && idleState === "active" && windowFocused) {
    const domain = await getActiveDomain();
    if (domain) commitSeconds(domain, Math.min(elapsed, 60));
    currentDomain = domain;
  } else {
    currentDomain = null;
  }

  await persistAccumLocally();
  maybeUploadBatch();
}

async function persistAccumLocally() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ usage: {} }, (res) => {
      const usage = res.usage || {};
      const key = dayKey();
      usage[key] = usage[key] || {};
      for (const [d, s] of Object.entries(accum)) {
        usage[key][d] = (usage[key][d] || 0) + s;
      }
      accum = {};
      chrome.storage.local.set({ usage }, () => resolve());
    });
  });
}

let uploadInProgress = false;
async function maybeUploadBatch() {
  if (uploadInProgress) return;
  uploadInProgress = true;
  try {
    const cfg = await getConfig();
    const backendUrl = cfg.backendUrl;

    const local = await new Promise((res) => chrome.storage.local.get({ usage: {} }, (r) => res(r.usage || {})));
    const entries = [];

    for (const [day, map] of Object.entries(local)) {
      for (const [domain, seconds] of Object.entries(map)) {
        if (seconds && seconds > 0) {
          entries.push({ day, domain, seconds });
        }
      }
    }

    if (entries.length === 0) { uploadInProgress = false; return; }

    const payload = {
      userId: cfg.userId || "demo-user",
      events: entries.map(e => ({ domain: e.domain, seconds: e.seconds, day: e.day, ts: Date.now() }))
    };

    try {
      const resp = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (resp.ok) {
        chrome.storage.local.set({ usage: {} });
      } else {
        console.warn("Upload responded with non-OK status", resp.status);
      }
    } catch (err) {
      console.warn("Upload failed (offline or backend down):", err.message);
    }
  } finally {
    uploadInProgress = false;
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) onTick();
});

chrome.runtime.onInstalled.addListener(async () => {
  lastTick = Date.now();
  const cfg = await getConfig();
  chrome.idle.setDetectionInterval(Number(cfg.idleSeconds) || DEFAULTS.idleSeconds);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: UPLOAD_INTERVAL_MIN });
});

chrome.runtime.onStartup.addListener(async () => {
  lastTick = Date.now();
  const cfg = await getConfig();
  chrome.idle.setDetectionInterval(Number(cfg.idleSeconds) || DEFAULTS.idleSeconds);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: UPLOAD_INTERVAL_MIN });
});

chrome.tabs.onActivated.addListener(async () => {
  await onTick();
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    await onTick();
  }
});
chrome.windows.onFocusChanged.addListener(async (winId) => {
  windowFocused = winId !== chrome.windows.WINDOW_ID_NONE;
  await onTick();
});

chrome.idle.onStateChanged.addListener(async (state) => {
  idleState = state || "active";
  await onTick();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === "GET_STATUS") {
      const cfg = await getConfig();
      sendResponse({ paused, idleState, windowFocused, backendUrl: cfg.backendUrl });
      return;
    }
    if (msg?.type === "SET_PAUSED") {
      paused = !!msg.value; sendResponse({ ok: true, paused }); return;
    }
    if (msg?.type === "FORCE_UPLOAD") {
      await persistAccumLocally(); await maybeUploadBatch(); sendResponse({ ok: true }); return;
    }
    if (msg?.type === "RESET_TODAY") {
      const key = dayKey();
      chrome.storage.local.get({ usage: {} }, (res) => {
        const usage = res.usage || {};
        delete usage[key];
        chrome.storage.local.set({ usage }, () => sendResponse({ ok: true }));
      });
      return;
    }
    if (msg?.type === "SET_CONFIG") {
      const toSet = {};
      if (msg.backendUrl) toSet.backendUrl = msg.backendUrl;
      if (msg.idleSeconds != null) toSet.idleSeconds = Number(msg.idleSeconds);
      if (msg.userId) toSet.userId = msg.userId;
      chrome.storage.sync.set(toSet, async () => {
        if (toSet.idleSeconds) chrome.idle.setDetectionInterval(Number(toSet.idleSeconds));
        sendResponse({ ok: true, saved: toSet });
      });
      return;
    }
  })();
  return true;
});
