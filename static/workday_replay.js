const byId = (id) => document.getElementById(id);
const role = document.body.dataset.role;
const scenarios = {
  OPERATOR: { title: "Operator shift replay", description: "Work an interactive container move from badge-in through credited-hours closeout.", summary: "You badged in, cleared the gate, accepted dispatch, checked out equipment, moved cargo and closed your shift.", steps: [["Badge in", "Present your signed worker QR at the hiring hall credential station."], ["Clear terminal gate", "Scan the same credential for authorized access to the operating area."], ["Accept dispatch", "Confirm container MSCU1234567, CHIQUITA EXPLORER Bay 08 and Import Block A."], ["Check out equipment", "Scan your credential to accept YT-17 and complete the safety inspection."], ["Move and deliver cargo", "Receive the box from CRANE2, verify the number and deliver it to A-03-12-2."], ["Return and close shift", "Return YT-17, record operating time and review credited hours."]] },
  SUPERVISOR: { title: "Supervisor workday replay", description: "Make the decisions that keep vessel, yard and workforce operations moving.", summary: "You approved the plan, managed an exception, balanced the yard and completed shift handoff.", steps: [["Open command center", "Review CHIQUITA EXPLORER progress, staffing, safety and capacity."], ["Approve crane plan", "Confirm CRANE1–CRANE4 sequence and priority moves."], ["Monitor production", "Compare live crane moves, trucks and yard availability."], ["Resolve safety pause", "Review the reported condition and authorize a safe recovery."], ["Balance yard", "Redirect discharge away from the high-occupancy block."], ["Shift handoff", "Record performance and brief the incoming supervisor."]] },
  DISPATCHER: { title: "Dispatcher workday replay", description: "Build and actively manage the terminal move queue.", summary: "You matched resources, released work and kept vessel discharge flowing around congestion.", steps: [["Review queue", "Inspect open assignments, holds and priority cargo."], ["Match resources", "Pair qualified workers with available equipment."], ["Release work", "Send the move to the operator portal."], ["Track movement", "Watch the box move from CRANE2 to YT-17."], ["Rebalance dispatch", "Reroute the next move around yard congestion."], ["Complete handoff", "Confirm remaining work for the next dispatcher."]] },
  SECURITY: { title: "Security workday replay", description: "Use QR access, risk review and custody controls to protect the terminal.", summary: "You verified access, inspected selected cargo and recorded an auditable disposition.", steps: [["Scan gate credential", "Verify worker identity and terminal access authorization."], ["Review security alerts", "Inspect overnight access events and active holds."], ["Assess cargo risk", "Score route, shipper and manifest anomalies."], ["Control inspection", "Record seal, location and custody transfer."], ["Document findings", "Attach evidence and inspection notes."], ["Release or escalate", "Record the final controlled disposition."]] },
  HR_PAYROLL: { title: "Payroll workday replay", description: "Validate workforce eligibility, time and protected payroll records.", summary: "You verified worker status, approved credited time and protected private payroll information.", steps: [["Review workforce", "Confirm active workers and union classifications."], ["Validate schedules", "Compare reporting time with scheduled shifts."], ["Audit credited hours", "Review container, cargo and overtime credits."], ["Check documents", "Identify expiring credentials and worker records."], ["Approve payroll export", "Send validated credits to the source payroll system."], ["Close audit", "Record completion without exposing private information."]] },
  ADMIN: { title: "Administrator workday replay", description: "Configure and verify every layer of the integrated terminal platform.", summary: "You reviewed access, configuration, security and operational health across IronHook.", steps: [["Verify system health", "Confirm database, authentication and terminal status."], ["Review role access", "Audit users, roles and terminal permissions."], ["Configure the yard", "Adjust zones, blocks and cargo rules in the live preview."], ["Review policies", "Confirm security and inspection thresholds."], ["Audit operations", "Inspect vessel, yard, workforce and cargo workflows."], ["Publish configuration", "Advance the version and close the audit trail."]] }
};
const scenario = scenarios[role] || scenarios.OPERATOR;
let current = -1, cameraStream = null, barcodeDetector = null, scanLoopActive = false, scanInProgress = false, pickupConfirmed = false;

function render() {
  byId("replayTitle").textContent = scenario.title;
  byId("replayDescription").textContent = scenario.description;
  byId("summaryText").textContent = scenario.summary;
  byId("replaySteps").innerHTML = scenario.steps.map((step, index) => `<button class="timeline-step" data-step="${index}" ${index ? "disabled" : ""}><span class="step-dot">${index + 1}</span><span><strong>${step[0]}</strong><small>${step[1]}</small></span></button>`).join("");
}
function setScanStatus(message, state = "") { const node = byId("replayScanStatus"); if (node) { node.textContent = message; node.className = `scan-status ${state}`; } }
function showOperatorAction(index) {
  const actions = byId("operatorActions"); if (!actions) return;
  actions.classList.remove("hidden");
  actions.querySelectorAll("[data-operator-step]").forEach((panel) => panel.classList.toggle("active", Number(panel.dataset.operatorStep) === index));
  byId("scannerCheckpoint").textContent = scenario.steps[index][0];
  setScanStatus([0, 1, 3, 5].includes(index) ? "Open the camera and present your signed QR credential." : "Credential retained securely for the next scan checkpoint.");
}
function showStep(index) {
  current = index; const [title, detail] = scenario.steps[index];
  document.querySelectorAll(".timeline-step").forEach((node, i) => { node.className = `timeline-step ${i < index ? "done" : i === index ? "active" : ""}`; node.disabled = i > index; });
  byId("activeStep").textContent = title; byId("activeDetail").textContent = detail; byId("sceneLocation").textContent = title;
  byId("stepCounter").textContent = `${index + 1} / ${scenario.steps.length}`; byId("progressLabel").textContent = title; byId("progressBar").style.width = `${index / scenario.steps.length * 100}%`;
  byId("completeStep").classList.toggle("hidden", role === "OPERATOR"); byId("completeStep").textContent = index === scenario.steps.length - 1 ? "Complete shift →" : "Complete this step →";
  if (role === "OPERATOR") showOperatorAction(index); document.body.classList.add("replaying");
}
function begin() {
  current = -1; pickupConfirmed = false; byId("replaySummary").classList.add("hidden"); byId("startReplay").textContent = "Restart Workday";
  if (byId("confirmPickup")) {
    byId("operatorActions").querySelectorAll("button").forEach((button) => { button.disabled = false; });
    byId("acceptDispatch").textContent = "Accept dispatch"; byId("confirmPickup").textContent = "Confirm"; byId("confirmDelivery").disabled = true; byId("confirmDelivery").textContent = "Confirm";
    byId("authorizeEquipment").textContent = "Scan & authorize equipment"; byId("finishShift").textContent = "Scan out & finish shift";
    byId("walkaroundCheck").checked = false; byId("equipmentReturned").checked = false;
  }
  showStep(0);
}
function complete() {
  if (current < 0) return;
  if (current === scenario.steps.length - 1) {
    document.querySelectorAll(".timeline-step").forEach((node) => node.classList.add("done")); byId("progressBar").style.width = "100%"; byId("progressLabel").textContent = "Shift replay complete";
    byId("activeStep").textContent = "Workday complete"; byId("activeDetail").textContent = scenario.summary; byId("sceneLocation").textContent = "Shift closed"; byId("completeStep").classList.add("hidden");
    byId("operatorActions")?.classList.add("hidden"); byId("replaySummary").classList.remove("hidden"); document.body.classList.remove("replaying"); stopCamera(); return;
  }
  showStep(current + 1);
}
async function postJson(url, body) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json().catch(() => ({}));
  if (response.status === 401) { location.href = "/login"; throw new Error("Your session expired."); } if (!response.ok) throw new Error(data.error || "The checkpoint could not be recorded."); return data;
}
async function scanCheckpoint(scanType, button) {
  const payload = byId("replayCredentialPayload")?.value.trim();
  if (!payload) { setScanStatus("No QR detected yet. Open the camera and scan your credential.", "denied"); return; }
  if (scanType === "EQUIPMENT_ASSIGNMENT" && !byId("walkaroundCheck").checked) { setScanStatus("Complete the equipment walkaround before authorization.", "denied"); return; }
  if (scanType === "BADGE_OUT" && !byId("equipmentReturned").checked) { setScanStatus("Confirm that the assigned equipment was returned and secured.", "denied"); return; }
  const body = { payload, scan_type: scanType, device_code: "OPERATOR-DEMO", location_label: scanType === "BADGE_IN" ? "Hiring Hall" : scanType === "GATE_ACCESS" ? "Terminal Gate 1" : scanType === "BADGE_OUT" ? "Operator Services" : "Equipment Dispatch" };
  if (scanType === "EQUIPMENT_ASSIGNMENT") { if (!byId("replayEquipment").value) { setScanStatus("Select available equipment before scanning.", "denied"); return; } body.equipment_id = Number(byId("replayEquipment").value); }
  button.disabled = true; setScanStatus("Verifying signed credential…");
  try { const result = await postJson("/api/credentials/scan", body); if (!result.authorized) throw new Error(result.denial_reason || "Credential denied."); setScanStatus(`Access granted · ${result.credential?.worker_name || "operator"} · audit event #${result.scan_event_id}`, "granted"); window.setTimeout(complete, 650); }
  catch (error) { setScanStatus(error.message, "denied"); button.disabled = false; }
}
async function detectCodes() {
  if (!scanLoopActive || !barcodeDetector || scanInProgress) return;
  try { scanInProgress = true; const codes = await barcodeDetector.detect(byId("replayCamera")); const value = codes.find((code) => code.rawValue)?.rawValue; if (value) { byId("replayCredentialPayload").value = value; setScanStatus("QR captured. Use the highlighted checkpoint action to verify it.", "granted"); stopCamera(); return; } }
  catch (_) { /* Frames can fail while the camera focuses. */ } finally { scanInProgress = false; }
  if (scanLoopActive) window.requestAnimationFrame(detectCodes);
}
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) { setScanStatus("Camera access is unavailable. Open the manual QR payload option below.", "denied"); return; }
  if (!("BarcodeDetector" in window)) { setScanStatus("This browser cannot decode QR codes directly. Use Chrome/Edge or enter the payload manually.", "denied"); return; }
  try {
    const supported = await BarcodeDetector.getSupportedFormats(); if (!supported.includes("qr_code")) throw new Error("QR recognition is not supported by this browser."); barcodeDetector = new BarcodeDetector({ formats: ["qr_code"] });
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }); const video = byId("replayCamera"); video.srcObject = cameraStream; await video.play();
    byId("cameraPlaceholder").classList.add("hidden"); byId("stopReplayCamera").classList.remove("hidden"); byId("startReplayCamera").textContent = "Camera active"; byId("startReplayCamera").disabled = true; scanLoopActive = true; setScanStatus("Camera active · hold the QR inside the frame."); detectCodes();
  } catch (error) { setScanStatus(error.message || "Camera permission was not granted.", "denied"); stopCamera(); }
}
function stopCamera() {
  scanLoopActive = false; if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop()); cameraStream = null;
  if (byId("replayCamera")) byId("replayCamera").srcObject = null; byId("cameraPlaceholder")?.classList.remove("hidden"); byId("stopReplayCamera")?.classList.add("hidden");
  if (byId("startReplayCamera")) { byId("startReplayCamera").disabled = false; byId("startReplayCamera").textContent = "Open camera scanner"; }
}
async function loadEquipment() {
  const select = byId("replayEquipment"); if (!select) return;
  try { const response = await fetch("/api/equipment"); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Equipment unavailable"); const available = data.equipment.filter((item) => !["DOWN", "MAINTENANCE", "RESTRICTED"].includes(item.operating_status)); select.innerHTML = available.map((item) => `<option value="${item.equipment_id}">${item.equipment_code} · ${item.equipment_type.replaceAll("_", " ")} · ${item.operating_status}</option>`).join("") || '<option value="">No equipment currently available</option>'; const yt17 = [...select.options].find((option) => option.text.startsWith("YT-17")); if (yt17) select.value = yt17.value; }
  catch (_) { select.innerHTML = '<option value="">Equipment feed unavailable</option>'; }
}
byId("startReplay").addEventListener("click", begin); byId("completeStep").addEventListener("click", complete); byId("replayAgain").addEventListener("click", begin);
byId("replaySteps").addEventListener("click", (event) => { const step = event.target.closest("[data-step]"); if (step && !step.disabled) showStep(Number(step.dataset.step)); });
byId("replayLogout").addEventListener("click", async () => { await fetch("/api/auth/logout", { method: "POST" }); location.href = "/login"; });
if (role === "OPERATOR") {
  byId("startReplayCamera").addEventListener("click", startCamera); byId("stopReplayCamera").addEventListener("click", stopCamera);
  byId("operatorActions").addEventListener("click", (event) => { const button = event.target.closest("[data-scan-type]"); if (button) scanCheckpoint(button.dataset.scanType, button); });
  byId("acceptDispatch").addEventListener("click", (event) => { event.currentTarget.textContent = "Dispatch accepted ✓"; event.currentTarget.disabled = true; window.setTimeout(complete, 500); });
  byId("confirmPickup").addEventListener("click", (event) => { pickupConfirmed = true; event.currentTarget.textContent = "Picked up ✓"; event.currentTarget.disabled = true; byId("confirmDelivery").disabled = false; });
  byId("confirmDelivery").addEventListener("click", (event) => { if (pickupConfirmed) { event.currentTarget.textContent = "Delivered ✓"; event.currentTarget.disabled = true; window.setTimeout(complete, 500); } });
  window.addEventListener("beforeunload", stopCamera); loadEquipment();
}
render();
