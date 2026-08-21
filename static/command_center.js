const byId = (id) => document.getElementById(id);

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = value ?? "—";
  return element.innerHTML;
}

async function getJson(url) {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

function statusClass(status) {
  if (["READY", "IN_PROGRESS", "IN_YARD", "RELEASED"].includes(status)) return "good";
  if (["ASSIGNED", "EXPECTED", "RESTRICTED", "PAUSED"].includes(status)) return "warn";
  if (["DOWN", "MAINTENANCE", "ON_HOLD"].includes(status)) return "danger";
  return "";
}

async function loadSummary() {
  const data = await getJson("/api/dashboard/summary");
  byId("containers-in-yard").textContent = data.containers.containers_in_yard;
  byId("container-note").textContent = `${data.containers.containers_on_hold} on hold · ${data.containers.expected_containers} expected`;
  byId("yard-occupancy").textContent = `${data.yard.occupancy_percent}%`;
  byId("yard-note").textContent = `${data.yard.open_spaces} open · ${data.yard.unavailable_spaces} unavailable`;
  byId("equipment-ready").textContent = `${data.equipment.ready}/${data.equipment.total_equipment}`;
  byId("equipment-note").textContent = `${data.equipment.assigned} assigned · ${data.equipment.attention} need attention`;
  byId("assignment-count").textContent = data.assignments.active;
  byId("attention-count").textContent = data.equipment.attention;
}

async function loadYard() {
  const data = await getJson("/api/yard/capacity");
  byId("yard-blocks").innerHTML = data.blocks.map((block) => {
    const percent = Number(block.usable_occupancy_percent || 0);
    const level = percent >= 85 ? "danger" : percent >= 70 ? "warn" : "";
    return `<article class="yard-block">
      <header><strong>${escapeHtml(block.zone_code)} · ${escapeHtml(block.block_code)}</strong><span>${percent}% full</span></header>
      <div class="meter ${level}"><i style="width:${Math.min(percent, 100)}%"></i></div>
      <span>${block.occupied_spaces} occupied · ${block.open_spaces} open · ${block.unavailable_spaces} unavailable</span>
    </article>`;
  }).join("") || '<p class="muted">No yard blocks found.</p>';
}

async function loadAssignments() {
  const data = await getJson("/api/assignments");
  byId("assignments").innerHTML = data.assignments.map((item) => `<div class="list-item">
    <div><strong>${escapeHtml(item.container_number)}</strong><span>${escapeHtml(item.worker_name)} · ${escapeHtml(item.equipment_code)}</span></div>
    <b class="status ${statusClass(item.assignment_status)}">${escapeHtml(item.assignment_status)}</b>
  </div>`).join("") || '<p class="muted">No active assignments.</p>';
  byId("assignment-count").textContent = data.count;
}

async function loadEquipment() {
  const data = await getJson("/api/equipment");
  byId("equipment").innerHTML = data.equipment.map((item) => `<div class="list-item">
    <div><strong>${escapeHtml(item.equipment_code)}</strong><span>${escapeHtml(item.equipment_type.replaceAll("_", " "))} · ${Number(item.total_operating_hours).toLocaleString()} hours</span></div>
    <b class="status ${statusClass(item.operating_status)}">${escapeHtml(item.operating_status)}</b>
  </div>`).join("");
}

async function refreshDashboard() {
  const sync = byId("sync-status");
  sync.className = "sync-status";
  sync.querySelector("span").textContent = "Refreshing…";
  try {
    await Promise.all([loadSummary(), loadYard(), loadAssignments(), loadEquipment()]);
    sync.className = "sync-status connected";
    sync.querySelector("span").textContent = `Live · ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  } catch (error) {
    sync.className = "sync-status failed";
    sync.querySelector("span").textContent = "Connection problem";
  }
}

byId("container-search").addEventListener("submit", async (event) => {
  event.preventDefault();
  const number = byId("container-number").value.trim().replaceAll("-", "").replaceAll(" ", "").toUpperCase();
  const result = byId("container-result");
  if (!number) {
    result.innerHTML = '<p class="error">Enter a container number.</p>';
    return;
  }
  result.innerHTML = '<p class="muted">Searching…</p>';
  try {
    const data = await getJson(`/api/containers/${encodeURIComponent(number)}`);
    const item = data.container;
    const location = item.zone_code ? `${item.zone_code} · ${item.block_code}-${item.row_code}-${item.bay_number}-${item.tier_number}` : "Not currently in yard";
    const history = data.movement_history.map((move) => `<p><strong>${escapeHtml(move.move_type.replaceAll("_", " "))}</strong> · ${escapeHtml(move.worker_name)} · ${escapeHtml(move.equipment_code)}</p>`).join("");
    result.innerHTML = `<div class="container-card">
      <h3>${escapeHtml(item.container_number)} <b class="status ${statusClass(item.current_status)}">${escapeHtml(item.current_status)}</b></h3>
      <div class="container-grid">
        <div><span>Location</span><strong>${escapeHtml(location)}</strong></div>
        <div><span>Destination</span><strong>${escapeHtml(item.outbound_destination)}</strong></div>
        <div><span>Shipping line</span><strong>${escapeHtml(item.shipping_line)}</strong></div>
        <div><span>Hold status</span><strong>${item.customs_hold || item.security_hold ? "HOLD ACTIVE" : "CLEAR"}</strong></div>
      </div>
      <div class="history"><p class="muted">Recent movement history</p>${history || '<p class="muted">No completed moves recorded.</p>'}</div>
    </div>`;
  } catch (error) {
    result.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
});

byId("refresh-button").addEventListener("click", refreshDashboard);
refreshDashboard();
setInterval(refreshDashboard, 30000);
