const byId = (id) => document.getElementById(id);
let sessionUser = {
  user_id: Number(document.body.dataset.userId),
  worker_id: Number(document.body.dataset.workerId),
  display_name: document.body.dataset.displayName,
  role: document.body.dataset.role,
  employee_number: document.body.dataset.employeeNumber,
  job_classification: document.body.dataset.jobClassification,
  union_local_code: document.body.dataset.unionLocal,
};

function esc(value) {
  const element = document.createElement("div");
  element.textContent = value ?? "—";
  return element.innerHTML;
}

async function json(url, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.href = "/login";
      throw new Error("Session expired");
    }
    if (!response.ok) throw new Error(body.error || "Request failed");
    return body;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The server took too long to respond. You can still use the other portal tabs.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
const dateLabel = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) : "Not set";
const location = (item, prefix) => item[`${prefix}_zone`] ? `${item[`${prefix}_zone`]} · ${item[`${prefix}_block`]}-${item[`${prefix}_row`]}-${item[`${prefix}_bay`]}-${item[`${prefix}_tier`]}` : "Not assigned";
const profileItem = (label, value) => `<div class="profile-item"><span>${esc(label)}</span><strong>${esc(value || "—")}</strong></div>`;

function actionButtons(item) {
  const start = ["QUEUED", "ASSIGNED", "ACCEPTED"].includes(item.assignment_status);
  const active = item.assignment_status === "IN_PROGRESS";
  const safe = ["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "PAUSED"].includes(item.assignment_status);
  const buttons = [];
  if (start) buttons.push(`<button class="start" data-action="start" data-id="${item.assignment_id}">Start move</button>`);
  if (active) buttons.push(`<button class="complete" data-action="complete" data-id="${item.assignment_id}">Complete move</button>`);
  if (safe) buttons.push(`<button class="safety ${buttons.length ? "" : "single"}" data-action="safety-stop" data-id="${item.assignment_id}">Safety stop</button>`);
  return buttons.join("");
}

function assignmentCard(item) {
  const hold = item.customs_hold || item.security_hold;
  const statusClass = item.assignment_status === "IN_PROGRESS" ? "in-progress" : item.assignment_status === "PAUSED" ? "paused" : "";
  return `<article class="assignment-card"><div class="assignment-main">
    <div class="assignment-top"><div><p class="overline">PRIORITY ${esc(item.priority_number)}</p><strong class="container-number">${esc(item.container_number)}</strong></div><span class="status ${statusClass}">${esc(item.assignment_status.replaceAll("_", " "))}</span></div>
    <div class="route"><div><span>PICK UP</span><strong>${esc(location(item, "pickup"))}</strong></div><b class="route-arrow">→</b><div><span>DELIVER</span><strong>${esc(location(item, "delivery"))}</strong></div></div>
    <div class="detail-grid"><div><span>Operator</span><strong>${esc(item.worker_name)}</strong></div><div><span>Equipment</span><strong>${esc(item.equipment_code)} · ${esc(item.equipment_status)}</strong></div></div>
    ${hold ? '<p class="hold-warning">Hold active — this container cannot be moved.</p>' : ""}</div><div class="card-actions">${actionButtons(item)}</div></article>`;
}

async function loadIdentity() {
  if (!sessionUser.worker_id) throw new Error("Account is not linked to a worker profile");
  byId("worker-name").textContent = sessionUser.display_name;
  byId("identity-line").textContent = `${sessionUser.display_name} · ${sessionUser.role}`;
  byId("worker-meta").textContent = `${sessionUser.employee_number || "Employee"} · ${sessionUser.job_classification || "Operator"} · ${sessionUser.union_local_code || "Union status unavailable"}`;
}

async function loadAssignments() {
  const status = byId("connection-status");
  status.className = "connection-status";
  status.querySelector("span").textContent = "Refreshing dispatch…";
  try {
    const data = await json("/api/assignments");
    byId("assignment-count").textContent = data.count;
    byId("assignments").innerHTML = data.assignments.map(assignmentCard).join("") || '<article class="empty-state">No active assignments right now.</article>';
    status.className = "connection-status connected";
    status.querySelector("span").textContent = `Live · ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  } catch (error) {
    status.className = "connection-status failed";
    status.querySelector("span").textContent = error.message;
    if (!byId("assignments").querySelector(".assignment-card")) byId("assignments").innerHTML = '<article class="empty-state">Dispatch is unavailable. Use Replay Operations for the guided demo.</article>';
  }
}

async function loadOverview() {
  const data = await json("/api/worker/me/overview");
  const hours = data.hours || {};
  byId("container-hours").textContent = Number(hours.container_hours || 0).toFixed(2);
  byId("cargo-hours").textContent = Number(hours.general_cargo_hours || 0).toFixed(2);
  byId("overtime-hours").textContent = Number(hours.overtime_hours || 0).toFixed(2);
  byId("credited-hours").textContent = Number(hours.credited_hours || 0).toFixed(2);
  byId("shift-history").innerHTML = data.recent_shifts.map((row) => `<div class="history-row"><div><span>SHIFT</span><strong>${esc(row.starts_at ? new Date(row.starts_at).toLocaleDateString() : "—")} · ${esc(row.shift_name)}</strong></div><div><span>GANG</span><strong>${esc(row.gang_code || row.gang_name || "Not recorded")}</strong></div><div><span>CREDITED</span><strong>${Number(row.credited_hours || 0).toFixed(2)} hrs</strong></div></div>`).join("") || '<div class="empty-state">No credited shifts yet.</div>';
  byId("credential-list").innerHTML = data.certifications.map((item) => `<article class="credential-card certification-record ${item.is_current ? "current" : "past"}"><div class="cert-title"><p class="overline">${esc(item.certification_code)}</p><span class="cert-status ${item.status === "ACTIVE" ? "active" : ""}">${esc(item.status)}</span></div><h3>${esc(item.certification_name)}</h3><dl><div><dt>Certified</dt><dd>${esc(dateLabel(item.issued_at))}</dd></div><div><dt>Expires</dt><dd>${esc(dateLabel(item.expires_at))}</dd></div><div><dt>Issuing authority</dt><dd>${esc(item.issuing_authority || "Not recorded")}</dd></div><div><dt>Signed off by</dt><dd>${esc(item.signed_off_by || "Not recorded")}</dd></div><div><dt>Credential #</dt><dd>${esc(item.credential_number || "Not recorded")}</dd></div><div><dt>Training</dt><dd>${item.training_hours ? `${Number(item.training_hours).toFixed(1)} hours` : "Not recorded"}</dd></div></dl>${item.notes ? `<p class="cert-notes">${esc(item.notes)}</p>` : ""}<small class="record-type">${item.is_current ? "Current qualification" : "Historical record"}</small></article>`).join("") || '<div class="empty-state">No certification records on file.</div>';
  const p = data.profile || {};
  byId("profile-card").innerHTML = profileItem("Full name", `${p.first_name || ""} ${p.last_name || ""}`.trim()) + profileItem("Employee number", p.employee_number) + profileItem("Worker status", p.active ? "Active" : "Inactive") + profileItem("Classification", p.job_classification) + profileItem("Union local", p.union_local_code) + profileItem("Union status", p.union_status) + profileItem("Union join year", p.union_join_year) + profileItem("Seniority date", dateLabel(p.seniority_date)) + profileItem("Email", p.email) + profileItem("Phone", p.phone) + profileItem("Emergency contact", p.emergency_contact_name) + profileItem("Emergency phone", p.emergency_contact_phone) + profileItem("Direct deposit", p.direct_deposit_last4 ? `•••• ${p.direct_deposit_last4}` : "Not on file");
}

async function loadPay() {
  const data = await json("/api/worker/me/pay");
  const ytd = data.ytd || {};
  byId("gross-ytd").textContent = money(ytd.gross_earnings);
  byId("net-ytd").textContent = money(ytd.net_pay);
  byId("tax-ytd").textContent = money(ytd.tax_withholding);
  byId("retirement-ytd").textContent = money(ytd.retirement_contribution);
  byId("pay-history").innerHTML = data.pay_periods.map((p) => `<div class="history-row"><div><span>PAY PERIOD</span><strong>${esc(p.period_start)} – ${esc(p.period_end)}</strong></div><div><span>GROSS</span><strong>${money(p.gross_earnings)}</strong></div><div><span>NET</span><strong>${money(p.net_pay)}</strong></div></div>`).join("") || '<div class="empty-state">No pay periods available.</div>';
}

async function loadSchedule() {
  try {
    const data = await json("/api/worker/me/schedule");
    byId("schedule-list").innerHTML = data.schedule.map((s) => `<div class="history-row"><div><span>${esc(s.schedule_status)}</span><strong>${esc(new Date(s.scheduled_start).toLocaleString())}–${esc(new Date(s.scheduled_end).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))}</strong></div><div><span>GANG</span><strong>${esc(s.gang_code || "Unassigned")} · ${esc(s.gang_name || s.shift_name || "Shift")}</strong></div><div><span>REPORT TO</span><strong>${esc(s.reporting_location || "Dispatch")}</strong></div></div>`).join("") || '<div class="empty-state">No upcoming shifts are currently posted.</div>';
  } catch (error) { byId("schedule-list").insertAdjacentHTML("beforeend", `<p class="inline-notice">Live schedule unavailable: ${esc(error.message)}. Showing the demo shift.</p>`); }
}

async function loadDocuments() {
  try {
    const data = await json("/api/worker/me/documents");
    byId("document-list").innerHTML = data.documents.map((d) => `<article class="credential-card document-record"><div class="cert-title"><p class="overline">${esc(d.document_type)}</p><span class="cert-status ${d.status === "CURRENT" ? "active" : ""}">${esc(d.status)}</span></div><h3>${esc(d.document_name)}</h3><dl><div><dt>Issued</dt><dd>${esc(dateLabel(d.issued_at))}</dd></div><div><dt>Expires</dt><dd>${esc(dateLabel(d.expires_at))}</dd></div><div><dt>Reference</dt><dd>${esc(d.external_reference || "Not recorded")}</dd></div></dl></article>`).join("") || '<div class="empty-state">No worker documents are currently on file.</div>';
  } catch (error) { byId("document-list").insertAdjacentHTML("beforeend", `<p class="inline-notice">Live documents unavailable: ${esc(error.message)}. Showing the demo record.</p>`); }
}

function openAction(action, id) {
  byId("dialog-action").value = action;
  byId("dialog-assignment-id").value = id;
  byId("dialog-error").textContent = "";
  byId("start-fields").hidden = action !== "start";
  byId("complete-fields").hidden = action !== "complete";
  byId("safety-fields").hidden = action !== "safety-stop";
  const titles = { start: ["BEGIN MOVE", `Start assignment #${id}?`, "Start move"], complete: ["FINISH MOVE", `Complete assignment #${id}`, "Confirm completion"], "safety-stop": ["STOP WORK", `Safety stop assignment #${id}`, "Stop work now"] }[action];
  byId("dialog-overline").textContent = titles[0];
  byId("dialog-title").textContent = titles[1];
  byId("confirm-action").textContent = titles[2];
  byId("action-dialog").showModal();
}

function activateView(viewName) {
  document.querySelectorAll(".nav-tab").forEach((item) => item.classList.toggle("active", item.dataset.view === viewName));
  document.querySelectorAll(".portal-view").forEach((view) => view.classList.toggle("active", view.id === `view-${viewName}`));
  if (viewName === "pay") loadPay().catch(() => {});
  if (viewName === "schedule") loadSchedule().catch(() => {});
  if (viewName === "documents") loadDocuments().catch(() => {});
}

document.querySelectorAll(".nav-tab").forEach((button) => button.addEventListener("click", () => {
  activateView(button.dataset.view);
}));
window.addEventListener("hashchange", () => activateView(location.hash.replace("#view-", "") || "dispatch"));
byId("assignments").addEventListener("click", (event) => { const button = event.target.closest("button[data-action]"); if (button) openAction(button.dataset.action, button.dataset.id); });
byId("action-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const action = byId("dialog-action").value;
  const id = byId("dialog-assignment-id").value;
  let body = { worker_id: sessionUser.worker_id };
  if (action === "start" && byId("credential-scan-event-id").value) body.credential_scan_event_id = Number(byId("credential-scan-event-id").value);
  if (action === "complete") body = { ...body, confirmation_method: byId("confirmation-method").value, operating_minutes: byId("operating-minutes").value, notes: byId("completion-notes").value.trim() };
  if (action === "safety-stop") body.reason = byId("safety-reason").value.trim();
  const button = byId("confirm-action");
  button.disabled = true;
  try {
    await json(`/api/assignments/${id}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    byId("action-dialog").close();
    await loadAssignments();
  } catch (error) { byId("dialog-error").textContent = error.message; } finally { button.disabled = false; }
});
byId("close-dialog").addEventListener("click", () => byId("action-dialog").close());
byId("refresh-button").addEventListener("click", loadAssignments);
byId("logout-button").addEventListener("click", async () => { await json("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; });

async function boot() {
  try {
    await loadIdentity();
    await Promise.allSettled([loadAssignments(), loadOverview()]);
    setInterval(loadAssignments, 30000);
  } catch (error) {
    byId("worker-name").textContent = "Unable to load worker session";
    byId("worker-meta").textContent = error.message;
  }
}
activateView(window.location.hash.replace("#view-", "") || "dispatch");
boot();
