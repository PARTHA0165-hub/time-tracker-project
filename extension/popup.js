function secToHM(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}

async function updateUI() {
  const status = await new Promise(res => chrome.runtime.sendMessage({ type: "GET_STATUS" }, res));
  document.getElementById("idleState").innerText = status.idleState || "-";
  document.getElementById("focusState").innerText = status.windowFocused ? "focused" : "blurred";
  document.getElementById("pause").checked = !!status.paused;

  chrome.storage.local.get({ usage: {} }, (r) => {
    const usage = r.usage || {};
    const today = usage[dayKey()] || {};
    const entries = Object.entries(today).sort((a,b) => b[1] - a[1]);
    const totalSec = entries.reduce((s, [,sec]) => s + sec, 0);
    document.getElementById("todayTotal").innerText = secToHM(totalSec);

    const list = entries.slice(0,6).map(([domain, sec]) => `<div><span>${domain}</span><span>${secToHM(sec)}</span></div>`).join("") || "<div class='muted'>No data yet</div>";
    document.getElementById("topList").innerHTML = list;
  });
}

document.getElementById("pause").addEventListener("change", (e) => {
  chrome.runtime.sendMessage({ type: "SET_PAUSED", value: e.target.checked }, (resp) => {
  });
});

document.getElementById("refresh").addEventListener("click", updateUI);

document.getElementById("upload").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "FORCE_UPLOAD" }, (r) => {
    updateUI();
    alert("Upload attempted — check backend logs.");
  });
});

document.getElementById("options").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

updateUI();
