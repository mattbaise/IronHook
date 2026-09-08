let containerState = null;
let selectedContainerId = null;
let containerSimulationRunning = false;

async function fetchContainerState() {
    const response = await fetch("/api/demo/state");

    if (!response.ok) {
        throw new Error("Failed to load container state");
    }

    return response.json();
}

async function fetchContainerHistory(containerId) {
    const response = await fetch(
        `/api/demo/containers/${containerId}/history`
    );

    if (!response.ok) {
        throw new Error("Failed to load container history");
    }

    return response.json();
}

function formatContainerStatus(status) {
    return status
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(
            /\b\w/g,
            (letter) => letter.toUpperCase()
        );
}

function updateContainerKpis(containers) {
    const values = Object.values(containers);

    const onVessel = values.filter(
        (container) =>
            container.status === "ON_VESSEL"
    ).length;

    const inMotion = values.filter(
        (container) =>
            container.status === "ON_TRUCK" ||
            container.status === "IN_TRANSIT"
    ).length;

    const inYard = values.filter(
        (container) =>
            container.status === "IN_YARD"
    ).length;

    document.getElementById(
        "containerTotalCount"
    ).textContent = values.length;

    document.getElementById(
        "containerOnVesselCount"
    ).textContent = onVessel;

    document.getElementById(
        "containerInMotionCount"
    ).textContent = inMotion;

    document.getElementById(
        "containerInYardCount"
    ).textContent = inYard;
}

function getFilteredContainers(containers) {
    const search = document.getElementById(
        "containerSearch"
    ).value.trim().toUpperCase();

    const status = document.getElementById(
        "containerStatusFilter"
    ).value;

    return Object.entries(containers).filter(
        ([containerId, container]) => {
            const matchesSearch =
                !search ||
                containerId.includes(search);

            const matchesStatus =
                status === "ALL" ||
                container.status === status;

            return matchesSearch && matchesStatus;
        }
    );
}

function renderContainerTable(containers) {
    const body = document.getElementById(
        "containerInventoryBody"
    );

    const rows = getFilteredContainers(containers);

    body.innerHTML = "";

    rows.forEach(([containerId, container]) => {
        const row = document.createElement("tr");

        row.className = "container-inventory-row";

        if (containerId === selectedContainerId) {
            row.classList.add("selected");
        }

        row.innerHTML = `
            <td>
                <strong>${containerId}</strong>
            </td>

            <td>
                <span class="
                    container-status-pill
                    status-${container.status.toLowerCase()}
                ">
                    ${formatContainerStatus(container.status)}
                </span>
            </td>

            <td>
                Bay ${container.bay}
            </td>

            <td>
                ${container.crane}
            </td>

            <td>
                ${container.truck || "—"}
            </td>

            <td>
                ${container.destination}
            </td>
        `;

        row.addEventListener(
            "click",
            () => selectContainer(
                containerId,
                containers
            )
        );

        body.appendChild(row);
    });

    if (rows.length === 0) {
        body.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    class="container-empty-row"
                >
                    No containers match the current filters.
                </td>
            </tr>
        `;
    }
}

async function selectContainer(
    containerId,
    containers
) {
    selectedContainerId = containerId;

    renderContainerTable(containers);

    const container = containers[containerId];
    const detail = document.getElementById(
        "containerDetail"
    );

    let history = [];

    try {
        const response =
            await fetchContainerHistory(containerId);

        history = response.history;
    } catch (error) {
        console.error(error);
    }

    detail.innerHTML = `
        <div class="container-detail-header">
            <div>
                <span>CONTAINER</span>
                <strong>${containerId}</strong>
            </div>

            <span class="
                container-status-pill
                status-${container.status.toLowerCase()}
            ">
                ${formatContainerStatus(container.status)}
            </span>
        </div>

        <div class="container-detail-grid">

            <div>
                <span>VESSEL</span>
                <strong>IRONHOOK HORIZON</strong>
            </div>

            <div>
                <span>VESSEL POSITION</span>
                <strong>
                    Bay ${container.bay} /
                    Row ${container.row} /
                    Tier ${container.tier}
                </strong>
            </div>

            <div>
                <span>CRANE</span>
                <strong>${container.crane}</strong>
            </div>

            <div>
                <span>TRUCK</span>
                <strong>${container.truck || "Not assigned"}</strong>
            </div>

            <div class="container-detail-destination">
                <span>YARD DESTINATION</span>
                <strong>${container.destination}</strong>
            </div>

        </div>

        <div class="container-history-summary">
            <div class="container-history-title">
                <span>MOVEMENT HISTORY</span>
                <strong>${history.length} Events</strong>
            </div>

            ${
                history.length === 0
                    ? `
                        <div class="container-history-empty">
                            No movement events recorded yet.
                        </div>
                    `
                    : history.map((event) => `
                        <div class="container-history-row">
                            <span>
                                ${new Date(
                                    event.timestamp
                                ).toLocaleTimeString()}
                            </span>

                            <strong>
                                ${formatContainerStatus(event.type)}
                            </strong>

                            <small>
                                ${
                                    event.crane_id
                                        ? `${event.crane_id} · `
                                        : ""
                                }
                                ${
                                    event.truck_id
                                        ? `${event.truck_id} · `
                                        : ""
                                }
                                ${event.destination || ""}
                            </small>
                        </div>
                    `).join("")
            }
        </div>
    `;
}

function updateContainersPage(state) {
    containerState = state;

    updateContainerKpis(state.containers);
    renderContainerTable(state.containers);

    if (selectedContainerId) {
        selectContainer(
            selectedContainerId,
            state.containers
        );
    }
}

function configureContainerFilters() {
    const search = document.getElementById(
        "containerSearch"
    );

    const status = document.getElementById(
        "containerStatusFilter"
    );

    search.addEventListener(
        "input",
        () => {
            if (containerState) {
                renderContainerTable(
                    containerState.containers
                );
            }
        }
    );

    status.addEventListener(
        "change",
        () => {
            if (containerState) {
                renderContainerTable(
                    containerState.containers
                );
            }
        }
    );
}

function containerSimulationComplete(state) {
    return Object.values(state.containers).every(
        (container) =>
            container.status === "IN_YARD"
    );
}

function wait(milliseconds) {
    return new Promise(
        (resolve) =>
            setTimeout(resolve, milliseconds)
    );
}

async function runContainerSimulation() {
    if (containerSimulationRunning) {
        return;
    }

    const button = document.getElementById(
        "startSimulation"
    );

    containerSimulationRunning = true;
    button.disabled = true;
    button.textContent = "● Simulation Running";

    try {
        const resetResponse = await fetch(
            "/api/demo/reset",
            {
                method: "POST",
            }
        );

        let state = await resetResponse.json();

        updateContainersPage(state);

        await wait(700);

        while (!containerSimulationComplete(state)) {
            const response = await fetch(
                "/api/demo/step",
                {
                    method: "POST",
                }
            );

            const data = await response.json();

            state = data.state;

            updateContainersPage(state);

            await wait(1200);
        }

        button.textContent =
            "✓ Container Operation Complete";
    } catch (error) {
        console.error(error);

        button.textContent =
            "⚠ Simulation Error";
    } finally {
        containerSimulationRunning = false;
        button.disabled = false;
    }
}

async function loadContainersPage() {
    try {
        const state = await fetchContainerState();

        updateContainersPage(state);
        configureContainerFilters();
    } catch (error) {
        console.error(error);
    }
}

document.addEventListener(
    "DOMContentLoaded",
    () => {
        loadContainersPage();

        const button = document.getElementById(
            "startSimulation"
        );

        button.addEventListener(
            "click",
            runContainerSimulation
        );
    }
);
