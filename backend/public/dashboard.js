
async function fetchActivity() {
  try {
    const res = await fetch("/api/activity");
    const data = await res.json();
    renderDashboard(data);
  } catch (err) {
    console.error("Error fetching activity:", err);
  }
}

function renderDashboard(data) {
  let totalTime = 0, productiveTime = 0, unproductiveTime = 0;
  const tableBody = document.getElementById("activityTable");
  tableBody.innerHTML = "";

  data.forEach(item => {
    totalTime += item.duration;

    if (item.category === "Productive") productiveTime += item.duration;
    if (item.category === "Unproductive") unproductiveTime += item.duration;

    const row = `<tr>
      <td>${item.website}</td>
      <td>${item.category}</td>
      <td>${item.duration}</td>
      <td>${new Date(item.timestamp).toLocaleString()}</td>
    </tr>`;
    tableBody.innerHTML += row;
  });

  document.getElementById("totalTime").innerText = totalTime;
  document.getElementById("productiveTime").innerText = productiveTime;
  document.getElementById("unproductiveTime").innerText = unproductiveTime;

  renderCharts(productiveTime, unproductiveTime, totalTime);
}

function renderCharts(productiveTime, unproductiveTime, totalTime) {
  new Chart(document.getElementById("categoryChart"), {
    type: "pie",
    data: {
      labels: ["Productive", "Unproductive", "Neutral"],
      datasets: [{
        data: [productiveTime, unproductiveTime, totalTime - productiveTime - unproductiveTime],
        backgroundColor: ["#4caf50", "#f44336", "#9e9e9e"]
      }]
    }
  });

  new Chart(document.getElementById("timeChart"), {
    type: "bar",
    data: {
      labels: ["Total Time", "Productive Time", "Unproductive Time"],
      datasets: [{
        label: "Minutes",
        data: [totalTime, productiveTime, unproductiveTime],
        backgroundColor: ["#2196f3", "#4caf50", "#f44336"]
      }]
    }
  });
}

fetchActivity();
