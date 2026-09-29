const state = {
    events: [],
    search: "",
    result: "ALL",
    type: "ALL",
};

const scanCount = document.getElementById("scanCount");
const grantedCount = document.getElementById("grantedCount");
const deniedCount = document.getElementById("deniedCount");
const equipmentScanCount = document.getElementById(
    "equipmentScanCount"
);

const accessHistoryBody = document.getElementById(
    "accessHistoryBody"
);

const accessSearch = document.getElementById(
    "accessSearch"
);

const accessResultFilter = document.getElementById(
    "accessResultFilter"
);

const accessTypeFilter = document.getElementById(
    "accessTypeFilter"
);

const refreshButton = document.getElementById(
    "refreshAccessHistory"
);

function formatScanType(value) {
    if (!value) {
        return "—";
    }

    return value
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTime(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString();
}

function getFilteredEvents() {
    return state.events.filter((event) => {
        if (
            state.result !== "ALL"
            && event.scan_result !== state.result
        ) {
            return false;
        }

        if (
            state.type !== "ALL"
            && event.scan_type !== state.type
        ) {
            return false;
        }

        const details = event.details || {};

        const searchable = [
            event.worker_name,
            event.employee_number,
            event.credential_code,
            event.job_classification,
            event.location_label,
            event.device_code,
            event.scan_type,
            event.scan_result,
            details.equipment_code,
            details.equipment_type,
            details.required_certification,
            details.denial_reason,
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return searchable.includes(
            state.search.toLowerCase()
        );
    });
}

function renderMetrics() {
    const granted = state.events.filter(
        (event) => event.scan_result === "GRANTED"
    ).length;

    const denied = state.events.filter(
        (event) => event.scan_result === "DENIED"
    ).length;

    const equipmentScans = state.events.filter(
        (event) =>
            event.scan_type === "EQUIPMENT_ASSIGNMENT"
    ).length;

    scanCount.textContent = state.events.length;
    grantedCount.textContent = granted;
    deniedCount.textContent = denied;
    equipmentScanCount.textContent = equipmentScans;
}

function renderTable() {
    const events = getFilteredEvents();

    if (!events.length) {
        accessHistoryBody.innerHTML = `
            <tr>
                <td colspan="7" class="access-empty">
                    No credential events match the current filters.
                </td>
            </tr>
        `;

        return;
    }

    accessHistoryBody.innerHTML = events
        .map((event) => {
            const details = event.details || {};

            const equipment =
                details.equipment_code || "—";

            const denialReason =
                details.denial_reason || "—";

            const resultClass =
                event.scan_result === "GRANTED"
                    ? "result-granted"
                    : "result-denied";

            return `
                <tr>
                    <td>
                        ${formatTime(event.scanned_at)}
                    </td>

                    <td>
                        <div class="worker-cell">
                            <strong>
                                ${event.worker_name || "Unknown"}
                            </strong>

                            <span>
                                ${event.employee_number || "—"}
                            </span>
                        </div>
                    </td>

                    <td>
                        ${formatScanType(event.scan_type)}
                    </td>

                    <td>
                        <div class="equipment-cell">
                            <strong>
                                ${equipment}
                            </strong>

                            <span>
                                ${
                                    details.required_certification
                                    || "—"
                                }
                            </span>
                        </div>
                    </td>

                    <td>
                        <span class="result-badge ${resultClass}">
                            ${event.scan_result}
                        </span>
                    </td>

                    <td class="reason-cell">
                        ${denialReason}
                    </td>

                    <td>
                        <div class="station-cell">
                            <strong>
                                ${event.location_label || "—"}
                            </strong>

                            <span>
                                ${event.device_code || "—"}
                            </span>
                        </div>
                    </td>
                </tr>
            `;
        })
        .join("");
}

async function loadAccessHistory() {
    accessHistoryBody.innerHTML = `
        <tr>
            <td colspan="7" class="access-empty">
                Loading credential history...
            </td>
        </tr>
    `;

    try {
        const response = await fetch(
            "/api/credential-scan-events?limit=100"
        );

        if (!response.ok) {
            throw new Error(
                `Request failed with ${response.status}`
            );
        }

        const data = await response.json();

        state.events = data.events || [];

        renderMetrics();
        renderTable();
    } catch (error) {
        console.error(error);

        accessHistoryBody.innerHTML = `
            <tr>
                <td colspan="7" class="access-empty access-error">
                    Unable to load credential audit history.
                </td>
            </tr>
        `;
    }
}

accessSearch.addEventListener(
    "input",
    (event) => {
        state.search = event.target.value;
        renderTable();
    }
);

accessResultFilter.addEventListener(
    "change",
    (event) => {
        state.result = event.target.value;
        renderTable();
    }
);

accessTypeFilter.addEventListener(
    "change",
    (event) => {
        state.type = event.target.value;
        renderTable();
    }
);

refreshButton.addEventListener(
    "click",
    loadAccessHistory
);

loadAccessHistory();
