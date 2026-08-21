const byId = (id) => document.getElementById(id);

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = value ?? "—";
  return element.innerHTML;
}

function getWorkerId() {
  const value = Number.parseInt(byId("worker-id").value, 10);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function locationText(item, prefix) {
  const zone = item[`${prefix}_zone`];
  if (!zone) return "Not assigned";
  return `${zone} · ${item[`${prefix}_block`]}-${item[`${prefix}_row`]}-${item[`${prefix}_bay`]}-${item[`${prefix}_tier`]}`;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

function statusClass(status) {
  if (status === "IN_PROGRESS") return "in-progress";
  if (status === "PAUSED") return "paused";
  return "";
}

function actionButtons(item) {
  const startable = ["QUEUED", "ASSIGNED", "ACCEPTED"].includes(item.assignment_status);
  const inProgress = item.assignment_status === "IN_PROGRESS";
  const safetyAvailable = ["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "PAUSED"].includes(item.assignment_status);

  const buttons = [];
  if (startable) buttons.push(`<button class="start ${safetyAvailable ? "" : "single"}" data-action="start" data-id="${item.assignment_id}">Start move</button>`);
  if (inProgress) buttons.push(`<button class="complete" data-action="complete" data-id="${item.assignment_id}">Complete move</button>`);
  if (safetyAvailable) buttons.push(`<button class="safety ${buttons.length ? "" : "single"}" data-action="safety-stop" data-id="${item.assignment_id}">Safety stop</button>`);
  return buttons.join("");
}

function renderAssignment(item) {
  const holdActive = item.customs_hold || item.security_hold;
  return `<article class="assignment-card">
    <div class="assignment-main">
      <div class="assignment-top">
        <div><p class="overline">PRIORITY ${escapeHtml(item.priority_number)}</p><strong class="container-number">${escapeHtml(item.container_number)}</strong></div>
        <span class="status ${statusClass(item.assignment_status)}">${escapeHtml(item.assignment_status.replaceAll("_", " "))}</span>
      </div>
      <div class="route">
        <div><span>PICK UP</span><strong>${escapeHtml(locationText(item, "pickup"))}</strong></div>
        <b class="route-arrow">→</b>
        <div><span>DELIVER</span><strong>${escapeHtml(locationText(item, "delivery"))}</strong></div>
      </div>
      <div class="detail-grid">
        <div><span>Operator</span><strong>${escapeHtml(item.worker_name)}</strong></div>
        <div><span>Equipment</span><strong>${escapeHtml(item.equipment_code)} · ${escapeHtml(item.equipment_status)}</strong></div>
      </div>
      ${holdActive ? '<p class="hold-warning">Hold active — this container cannot be moved.</p>' : ""}
    </div>
    <div class="card-actions">${actionButtons(item)}</div>
  </article>`;
}

async function loadAssignments() {
  const status = byId("connection-status");
  status.className = "connection-status";
  status.querySelector("span").textContent = "Refreshing dispatch…";

  try {
    const data = await requestJson("/api/assignments");
    byId("assignment-count").textContent = data.count;
    byId("assignments").innerHTML = data.assignments.map(renderAssignment).join("") ||
      '<article class="empty-state">No active assignments right now.</article>';
    status.className = "connection-status connected";
    status.querySelector("span").textContent =
      `Live · ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  } catch (error) {
    status.className = "connection-status failed";
    status.querySelector("span").textContent = error.message;
    byId("assignments").innerHTML =
      '<article class="empty-state">Dispatch is unavailable. Check the API and database, then refresh.</article>';
  }
}

function openAction(action, assignmentId) {
  const workerId = getWorkerId();
  if (!workerId) {
    byId("worker-message").textContent = "Save your worker ID before updating an assignment.";
    byId("worker-message").className = "helper error";
    byId("worker-id").focus();
    return;
  }

  const dialog = byId("action-dialog");
  byId("dialog-action").value = action;
  byId("dialog-assignment-id").value = assignmentId;
  byId("dialog-error").textContent = "";
  byId("complete-fields").hidden = action !== "complete";
  byId("safety-fields").hidden = action !== "safety-stop";

  if (action === "start") {
    byId("dialog-overline").textContent = "BEGIN MOVE";
    byId("dialog-title").textContent = `Start assignment #${assignmentId}?`;
    byId("confirm-action").textContent = "Start move";
  } else if (action === "complete") {
    byId("dialog-overline").textContent = "FINISH MOVE";
    byId("dialog-title").textContent = `Complete assignment #${assignmentId}`;
    byId("confirm-action").textContent = "Confirm completion";
  } else {
    byId("dialog-overline").textContent = "STOP WORK";
    byId("dialog-title").textContent = `Safety stop assignment #${assignmentId}`;
    byId("confirm-action").textContent = "Stop work now";
  }

  dialog.showModal();
}

byId("worker-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const workerId = getWorkerId();
  if (!workerId) return;
  localStorage.setItem("ironhookWorkerId", workerId);
  byId("worker-message").textContent = `Worker ID ${workerId} saved on this device.`;
  byId("worker-message").className = "helper saved";
});

byId("assignments").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (button) openAction(button.dataset.action, button.dataset.id);
});

byId("action-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const action = byId("dialog-action").value;
  const assignmentId = byId("dialog-assignment-id").value;
  const workerId = getWorkerId();
  const button = byId("confirm-action");
  let body = { worker_id: workerId };

  if (action === "complete") {
    body = {
      ...body,
      confirmation_method: byId("confirmation-method").value,
      operating_minutes: byId("operating-minutes").value,
      notes: byId("completion-notes").value.trim(),
    };
  }

  if (action === "safety-stop") {
    body.reason = byId("safety-reason").value.trim();
  }

  button.disabled = true;
  button.textContent = "Sending…";
  byId("dialog-error").textContent = "";

  try {
    await requestJson(`/api/assignments/${assignmentId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    byId("action-dialog").close();
    await loadAssignments();
  } catch (error) {
    byId("dialog-error").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

byId("close-dialog").addEventListener("click", () => byId("action-dialog").close());
byId("refresh-button").addEventListener("click", loadAssignments);

const savedWorkerId = localStorage.getItem("ironhookWorkerId");
if (savedWorkerId) {
  byId("worker-id").value = savedWorkerId;
  byId("worker-message").textContent = `Worker ID ${savedWorkerId} saved on this device.`;
  byId("worker-message").className = "helper saved";
}

loadAssignments();
setInterval(loadAssignments, 30000);
