const YARD_ZONE_STYLES = {
    CONTAINER: "container",
    REEFER: "reefer",
    HAZARDOUS: "hazardous",
    EMPTY: "empty",
    GENERAL_CARGO: "general-cargo",
    WAREHOUSE: "warehouse",
    GATE: "gate",
    ROAD: "road",
    BERTH: "berth",
    RAIL: "rail",
    INSPECTION: "inspection",
    SECURE_HOLD: "secure-hold",
    MAINTENANCE: "maintenance",
    STAGING: "staging",
    OTHER: "other",
};

function yardNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizedGeometry(zone, index) {
    const geometry = zone.geometry || {};
    const column = index % 4;
    const row = Math.floor(index / 4);

    return {
        x: yardNumber(geometry.x, 4 + column * 24),
        y: yardNumber(geometry.y, 8 + row * 27),
        width: yardNumber(geometry.width, 20),
        height: yardNumber(geometry.height, 20),
        rotation: yardNumber(geometry.rotation, 0),
    };
}

function createZone(zone, index, blocks) {
    const geometry = normalizedGeometry(zone, index);
    const element = document.createElement("button");
    const styleName = YARD_ZONE_STYLES[zone.zone_type] || "other";

    element.type = "button";
    element.className = `config-yard-zone zone-${styleName}`;
    if (zone.restricted) {
        element.classList.add("restricted");
    }
    element.style.left = `${geometry.x}%`;
    element.style.top = `${geometry.y}%`;
    element.style.width = `${geometry.width}%`;
    element.style.height = `${geometry.height}%`;
    element.style.transform = `rotate(${geometry.rotation}deg)`;
    element.dataset.zoneId = zone.terminal_zone_id;
    const zoneBlocks = blocks.filter((block) => block.terminal_zone_id === zone.terminal_zone_id);
    element.innerHTML = `
        <span>${zone.zone_type.replaceAll("_", " ")}</span>
        <strong>${zone.zone_code}</strong>
        <small>${zone.zone_name}</small>
        ${zone.capacity_units == null ? "" : `<em>${zone.capacity_units} capacity</em>`}
        <div class="config-yard-blocks">${zoneBlocks.map((block) => `<b>${block.block_code} · ${block.row_count}R/${block.bay_count}B/${block.tier_count}T</b>`).join("")}</div>
    `;

    element.addEventListener("click", () => {
        document.querySelectorAll(".config-yard-zone.selected")
            .forEach((item) => item.classList.remove("selected"));
        element.classList.add("selected");
        const detail = document.getElementById("configYardDetail");
        if (detail) {
            detail.innerHTML = `
                <strong>${zone.zone_name}</strong>
                <span>${zone.zone_type.replaceAll("_", " ")}</span>
                <span>${zone.restricted ? "Restricted access" : "Standard access"}</span>
                <span>${zone.capacity_units == null ? "Capacity not configured" : `${zone.capacity_units} configured units`}</span>
                <span>${zoneBlocks.length ? `${zoneBlocks.length} blocks · ${zoneBlocks.reduce((total, block) => total + block.row_count * block.bay_count * block.tier_count, 0)} modeled slots` : "No blocks configured"}</span>
            `;
        }
    });

    return element;
}

function renderConfigurableYard(payload) {
    const canvas = document.getElementById("configYardCanvas");
    const title = document.getElementById("configYardTerminalName");
    const version = document.getElementById("configYardVersion");
    const zones = payload.zones || [];
    const blocks = payload.blocks || [];

    if (!canvas) {
        return;
    }

    canvas.replaceChildren();
    zones.filter((zone) => zone.active !== false)
        .forEach((zone, index) => canvas.appendChild(createZone(zone, index, blocks)));

    if (title && payload.terminal) {
        title.textContent = payload.terminal.terminal_name;
    }
    if (version) {
        version.textContent = `MAP v${payload.configuration?.map_version || 1}`;
    }

    const count = document.getElementById("configYardZoneCount");
    if (count) {
        count.textContent = String(zones.length);
    }
}

async function loadConfigurableYard() {
    const canvas = document.getElementById("configYardCanvas");
    if (!canvas) {
        return;
    }

    try {
        const terminalResponse = await fetch("/api/admin/terminals");
        if (!terminalResponse.ok) {
            throw new Error("Unable to load terminal list");
        }
        const terminalData = await terminalResponse.json();
        const terminal = terminalData.terminals?.[0];
        if (!terminal) {
            throw new Error("No terminal configured");
        }

        const configResponse = await fetch(
            `/api/admin/terminals/${terminal.terminal_id}/configuration`
        );
        if (!configResponse.ok) {
            throw new Error("Unable to load terminal map configuration");
        }
        const configData = await configResponse.json();
        renderConfigurableYard({
            terminal,
            configuration: configData.configuration,
            zones: configData.zones,
            blocks: configData.blocks,
        });
    } catch (error) {
        console.error(error);
        canvas.innerHTML = `
            <div class="config-yard-empty">
                <strong>Terminal map configuration unavailable</strong>
                <span>${error.message}</span>
            </div>
        `;
    }
}

document.addEventListener("DOMContentLoaded", loadConfigurableYard);
