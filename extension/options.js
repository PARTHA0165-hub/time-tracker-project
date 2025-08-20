async function load() {
  chrome.storage.sync.get({
    backendUrl: "http://localhost:5000/api/track",
    idleSeconds: 30,
    userId: "demo-user"
  }, (cfg) => {
    document.getElementById("backendUrl").value = cfg.backendUrl;
    document.getElementById("idleSeconds").value = cfg.idleSeconds;
    document.getElementById("userId").value = cfg.userId;
  });
}

document.getElementById("saveBtn").addEventListener("click", () => {
  const backendUrl = document.getElementById("backendUrl").value.trim();
  const idleSeconds = Number(document.getElementById("idleSeconds").value) || 30;
  const userId = document.getElementById("userId").value.trim() || "demo-user";

  chrome.runtime.sendMessage({ type: "SET_CONFIG", backendUrl, idleSeconds, userId }, (resp) => {
    document.getElementById("msg").innerText = "Saved settings.";
  });
});

document.getElementById("resetToday").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "RESET_TODAY" }, (r) => {
    document.getElementById("msg").innerText = "Today's data cleared.";
  });
});

load();
