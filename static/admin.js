const $ = (id) => document.getElementById(id);
let terminalId;
let yardData = { zones: [], blocks: [] };

const esc = (value) => {
  const element = document.createElement("div");
  element.textContent = value ?? "—";
  return element.innerHTML;
};

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) location.href = "/login";
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

function parseJson(id) {
  try { return JSON.parse($(id).value || "{}"); }
  catch { throw new Error(`${id.replaceAll("-", " ")} must be valid JSON`); }
}

function message(id, value, ok = true) {
  $(id).textContent = value;
  $(id).className = `form-message ${ok ? "success" : "error"}`;
}

function geometryValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function renderYard() {
  const preview = $("admin-yard-preview");
  $("zone-count").textContent = yardData.zones.length;
  $("block-count").textContent = yardData.blocks.length;
  preview.innerHTML = yardData.zones.length ? yardData.zones.map((zone, index) => {
    const geometry = zone.geometry || {};
    const left = Math.min(90, Math.max(0, geometryValue(geometry.x, 4 + (index % 3) * 28)));
    const top = Math.min(86, Math.max(0, geometryValue(geometry.y, 5 + Math.floor(index / 3) * 26)));
    const width = Math.min(100 - left, Math.max(8, geometryValue(geometry.width, 22)));
    const height = Math.min(100 - top, Math.max(8, geometryValue(geometry.height, 20)));
    const blocks = yardData.blocks.filter((block) => block.terminal_zone_id === zone.terminal_zone_id).length;
    return `<div class="preview-zone" data-type="${esc(zone.zone_type)}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%"><strong>${esc(zone.zone_code)}</strong><small>${blocks} BLOCK${blocks === 1 ? "" : "S"}</small></div>`;
  }).join("") : '<div class="preview-empty">Add your first zone to begin</div>';

  $("zones").innerHTML = yardData.zones.map((zone) => {
    const blocks = yardData.blocks.filter((block) => block.terminal_zone_id === zone.terminal_zone_id);
    const positions = blocks.reduce((sum, block) => sum + block.row_count * block.bay_count * block.tier_count, 0);
    return `<div class="record"><div class="record-head"><strong>${esc(zone.zone_code)} · ${esc(zone.zone_name)}</strong><span class="status-chip">${esc(zone.zone_type)}</span></div><p>${blocks.length} blocks · ${positions.toLocaleString()} positions · ${zone.capacity_units ?? "No"} unit capacity</p></div>`;
  }).join("") || '<p class="field-help">No zones configured yet.</p>';
}

async function load() {
  const data = await api("/api/admin/terminals");
  $("terminal").innerHTML = data.terminals.map((terminal) => `<option value="${terminal.terminal_id}">${esc(terminal.terminal_name)}</option>`).join("");
  terminalId = Number($("terminal").value);
  await Promise.all([loadConfig(), loadUsers()]);
}

async function loadConfig() {
  const data = await api(`/api/admin/terminals/${terminalId}/configuration`);
  const config = data.configuration || {};
  $("country").value = config.country_code || "US";
  $("jurisdiction").value = config.jurisdiction_code || "";
  $("configuration").value = JSON.stringify(config.configuration || {}, null, 2);
  $("security-policy").value = JSON.stringify(config.security_policy || {}, null, 2);
  $("inspection-policy").value = JSON.stringify(config.inspection_policy || {}, null, 2);
  yardData = { zones: data.zones || [], blocks: data.blocks || [] };
  $("block-zone").innerHTML = yardData.zones.map((zone) => `<option value="${zone.terminal_zone_id}">${esc(zone.zone_code)} · ${esc(zone.zone_name)}</option>`).join("");
  renderYard();
}

async function loadUsers() {
  const data = await api("/api/admin/users");
  $("users").innerHTML = data.users.map((user) => `<div class="record"><div class="record-head"><strong>${esc(user.display_name)}</strong><span class="status-chip">${esc(user.role_code)}</span></div><p>${esc(user.username)} · ${user.active ? "Active" : "Disabled"}</p></div>`).join("");
}

function updateSlotTotal() {
  $("slot-total").textContent = (["rows", "bays", "tiers"].reduce((total, id) => total * Math.max(0, Number($(id).value) || 0), 1)).toLocaleString();
}

function updatePositionLabels() {
  $("zone-x-value").textContent = `${$("zone-x").value}%`;
  $("zone-y-value").textContent = `${$("zone-y").value}%`;
}

$("terminal").addEventListener("change", async () => { terminalId = Number($("terminal").value); await loadConfig(); });
["rows", "bays", "tiers"].forEach((id) => $(id).addEventListener("input", updateSlotTotal));
["zone-x", "zone-y"].forEach((id) => $(id).addEventListener("input", updatePositionLabels));

$("config-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api(`/api/admin/terminals/${terminalId}/configuration`, { method: "PUT", body: JSON.stringify({ country_code: $("country").value, jurisdiction_code: $("jurisdiction").value, configuration: parseJson("configuration"), security_policy: parseJson("security-policy"), inspection_policy: parseJson("inspection-policy") }) });
    message("config-message", "Terminal settings saved.");
  } catch (error) { message("config-message", error.message, false); }
});

$("zone-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api(`/api/admin/terminals/${terminalId}/zones`, { method: "POST", body: JSON.stringify({ zone_code: $("zone-code").value, zone_name: $("zone-name").value, zone_type: $("zone-type").value, capacity_units: Number($("zone-capacity").value) || null, geometry: { x: Number($("zone-x").value), y: Number($("zone-y").value), width: Number($("zone-width").value), height: Number($("zone-height").value) } }) });
    message("zone-message", "Zone added to the yard.");
    event.target.reset(); updatePositionLabels(); await loadConfig();
  } catch (error) { message("zone-message", error.message, false); }
});

$("block-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!$("block-zone").value) return message("block-message", "Add a zone before creating a block.", false);
  try {
    await api(`/api/admin/zones/${$("block-zone").value}/blocks`, { method: "POST", body: JSON.stringify({ block_code: $("block-code").value, block_name: $("block-name").value, row_count: Number($("rows").value), bay_count: Number($("bays").value), tier_count: Number($("tiers").value), slot_length_feet: Number($("slot-length").value), rules: { reefer: $("allow-reefer").checked, hazardous: $("allow-hazardous").checked, max_stack_weight_kg: Number($("max-stack-weight").value) } }) });
    message("block-message", "Storage block added."); await loadConfig();
  } catch (error) { message("block-message", error.message, false); }
});

$("user-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/admin/users", { method: "POST", body: JSON.stringify({ username: $("username").value, display_name: $("display-name").value, role: $("role").value, password: $("password").value, terminal_ids: [terminalId] }) });
    message("user-message", "User created; password change required."); event.target.reset(); await loadUsers();
  } catch (error) { message("user-message", error.message, false); }
});

$("logout").addEventListener("click", async () => { await api("/api/auth/logout", { method: "POST" }); location.href = "/login"; });
updateSlotTotal(); updatePositionLabels(); load().catch((error) => message("config-message", error.message, false));
