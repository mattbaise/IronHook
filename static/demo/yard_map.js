async function fetchYardState() {
    const response = await fetch("/api/demo/state");

    if (!response.ok) {
        throw new Error("Failed to load terminal state");
    }

    return response.json();
}

function parseYardDestination(destination) {
    const match = destination.match(
        /Block ([A-D]) \/ Row (\d+) \/ Slot (\d+)/
    );

    if (!match) {
        return null;
    }

    return {
        block: match[1],
        row: match[2],
        slot: match[3],
    };
}

function formatStatus(status) {
    return status
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildYardState(containers) {
    const blocks = {
        A: [],
        B: [],
        C: [],
        D: [],
    };

    let occupied = 0;
    let incoming = 0;

    Object.entries(containers).forEach(
        ([containerId, container]) => {
            const destination = parseYardDestination(
                container.destination
            );

            if (!destination) {
                return;
            }

            let yardStatus = "open";

            if (container.status === "IN_TRANSIT") {
                yardStatus = "incoming";
                incoming += 1;
            }

            if (container.status === "IN_YARD") {
                yardStatus = "occupied";
                occupied += 1;
            }

            blocks[destination.block].push({
                containerId,
                row: destination.row,
                slot: destination.slot,
                status: container.status,
                truck: container.truck,
                yardStatus,
            });
        }
    );

    return {
        blocks,
        occupied,
        incoming,
    };
}

function renderYardBlocks(containers) {
    const {
        blocks,
        occupied,
        incoming,
    } = buildYardState(containers);

    const totalSlots = Object.values(blocks)
        .reduce((total, block) => total + block.length, 0);

    const available = totalSlots - occupied - incoming;

    document.getElementById("yardTotalSlots").textContent =
        totalSlots;

    document.getElementById("yardOccupiedCount").textContent =
        occupied;

    document.getElementById("yardIncomingCount").textContent =
        incoming;

    document.getElementById("yardAvailableCount").textContent =
        available;

    Object.entries(blocks).forEach(([blockName, slots]) => {
        const container = document.getElementById(
            `yardMapBlock${blockName}`
        );

        const utilization = document.getElementById(
            `yardBlock${blockName}Utilization`
        );

        if (!container || !utilization) {
            return;
        }

        const occupiedCount = slots.filter(
            (slot) => slot.yardStatus === "occupied"
        ).length;

        utilization.textContent =
            `${occupiedCount} / ${slots.length}`;

        container.innerHTML = "";

        slots
            .sort(
                (a, b) =>
                    Number(a.row) - Number(b.row)
            )
            .forEach((slot) => {
                const slotElement =
                    document.createElement("button");

                slotElement.className =
                    `yard-map-slot ${slot.yardStatus}`;

                slotElement.dataset.containerId =
                    slot.containerId;

                let label = "OPEN";

                if (slot.yardStatus === "incoming") {
                    label = `${slot.containerId} →`;
                }

                if (slot.yardStatus === "occupied") {
                    label = slot.containerId;
                }

                slotElement.innerHTML = `
                    <span>ROW ${slot.row}</span>
                    <strong>${label}</strong>
                    <small>SLOT ${slot.slot}</small>
                `;

                slotElement.addEventListener(
                    "click",
                    () => showContainerDetails(
                        slot.containerId,
                        containers
                    )
                );

                container.appendChild(slotElement);
            });
    });
}

function renderIncomingContainers(containers) {
    const list = document.getElementById(
        "yardIncomingList"
    );

    if (!list) {
        return;
    }

    const incoming = Object.entries(containers).filter(
        ([, container]) =>
            container.status === "IN_TRANSIT" ||
            container.status === "ON_TRUCK"
    );

    if (incoming.length === 0) {
        list.innerHTML = `
            <div class="yard-list-empty">
                No containers currently inbound to the yard
            </div>
        `;
        return;
    }

    list.innerHTML = "";

    incoming.forEach(([containerId, container]) => {
        const destination =
            parseYardDestination(container.destination);

        const item = document.createElement("button");
        item.className = "yard-list-item";

        item.innerHTML = `
            <div>
                <strong>${containerId}</strong>
                <span>
                    ${container.truck || "Awaiting truck"}
                </span>
            </div>
            <div>
                <strong>
                    Block ${destination?.block || "—"}
                </strong>
                <span>${formatStatus(container.status)}</span>
            </div>
        `;

        item.addEventListener(
            "click",
            () => showContainerDetails(
                containerId,
                containers
            )
        );

        list.appendChild(item);
    });
}

function renderTruckActivity(trucks) {
    const list = document.getElementById(
        "yardTruckList"
    );

    const strip = document.getElementById(
        "yardTruckStrip"
    );

    if (!list || !strip) {
        return;
    }

    list.innerHTML = "";
    strip.innerHTML = "";

    Object.entries(trucks).forEach(
        ([truckId, truck]) => {
            const item =
                document.createElement("div");

            item.className =
                `yard-list-item truck-${truck.status.toLowerCase()}`;

            item.innerHTML = `
                <div>
                    <strong>${truckId}</strong>
                    <span>${truck.driver}</span>
                </div>
                <div>
                    <strong>${formatStatus(truck.status)}</strong>
                    <span>${truck.container || "No container"}</span>
                </div>
            `;

            list.appendChild(item);

            const roadTruck =
                document.createElement("div");

            roadTruck.className =
                `yard-road-truck ${truck.status.toLowerCase()}`;

            roadTruck.innerHTML = `
                <strong>${truckId}</strong>
                <span>${truck.container || "AVAILABLE"}</span>
            `;

            strip.appendChild(roadTruck);
        }
    );
}

let selectedContainerId = null;

async function fetchContainerHistory(containerId) {
    const response = await fetch(
        `/api/demo/containers/${containerId}/history`
    );

    if (!response.ok) {
        throw new Error("Failed to load container history");
    }

    return response.json();
}

function formatEventType(type) {
    const labels = {
        CONTAINER_DISCHARGED: "Discharged from vessel",
        CONTAINER_IN_TRANSIT: "Entered terminal transit",
        CONTAINER_PLACED_IN_YARD: "Placed in yard",
    };

    return labels[type] || formatStatus(type);
}

function formatEventTime(timestamp) {
    const value = new Date(timestamp);

    return value.toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        }
    );
}


async function showContainerDetails(containerId, containers) {
    const result = document.getElementById(
        "yardSearchResult"
    );

    const container = containers[containerId];

    if (!result) {
        return;
    }

    if (!container) {
        selectedContainerId = null;

        result.innerHTML = `
            <strong>Container not found</strong>
            <span>
                Check the container ID and try again.
            </span>
        `;
        return;
    }

    selectedContainerId = containerId;

    const destination =
        parseYardDestination(container.destination);

    let history = [];

    try {
        const historyResponse =
            await fetchContainerHistory(containerId);

        history = historyResponse.history;
    } catch (error) {
        console.error(error);
    }

    const status = container.status;

    const stageStates = {
        vessel:
            status === "ON_VESSEL"
                ? "active"
                : "complete",

        crane:
            status === "ON_VESSEL"
                ? "upcoming"
                : "complete",

        truck:
            status === "ON_TRUCK"
                ? "active"
                : (
                    status === "IN_TRANSIT" ||
                    status === "IN_YARD"
                        ? "complete"
                        : "upcoming"
                ),

        transit:
            status === "IN_TRANSIT"
                ? "active"
                : (
                    status === "IN_YARD"
                        ? "complete"
                        : "upcoming"
                ),

        yard:
            status === "IN_YARD"
                ? "active"
                : "upcoming",
    };

    result.innerHTML = `
        <div class="yard-trace-header">
            <div>
                <strong>${containerId}</strong>
                <span class="yard-trace-current-status">
                    ${formatStatus(status)}
                </span>
            </div>

            <span class="yard-trace-location">
                ${
                    status === "IN_YARD"
                        ? `Block ${destination?.block || "—"}`
                        : status === "IN_TRANSIT"
                            ? "In Transit"
                            : status === "ON_TRUCK"
                                ? container.truck || "Truck Assigned"
                                : `Bay ${container.bay}`
                }
            </span>
        </div>

        <div class="container-journey">

            <div class="journey-stage ${stageStates.vessel}">
                <div class="journey-marker">1</div>

                <div class="journey-content">
                    <span>VESSEL</span>
                    <strong>IRONHOOK HORIZON</strong>
                    <small>
                        Bay ${container.bay} /
                        Row ${container.row} /
                        Tier ${container.tier}
                    </small>
                </div>
            </div>

            <div class="journey-connector"></div>

            <div class="journey-stage ${stageStates.crane}">
                <div class="journey-marker">2</div>

                <div class="journey-content">
                    <span>CRANE</span>
                    <strong>${container.crane}</strong>
                    <small>
                        Vessel discharge operation
                    </small>
                </div>
            </div>

            <div class="journey-connector"></div>

            <div class="journey-stage ${stageStates.truck}">
                <div class="journey-marker">3</div>

                <div class="journey-content">
                    <span>TERMINAL TRUCK</span>
                    <strong>
                        ${container.truck || "Awaiting Assignment"}
                    </strong>
                    <small>
                        ${
                            container.truck
                                ? "Container transferred to ground movement"
                                : "Truck not yet assigned"
                        }
                    </small>
                </div>
            </div>

            <div class="journey-connector"></div>

            <div class="journey-stage ${stageStates.transit}">
                <div class="journey-marker">4</div>

                <div class="journey-content">
                    <span>TRANSFER ROAD</span>
                    <strong>Terminal Transit</strong>
                    <small>
                        Moving toward Block ${destination?.block || "—"}
                    </small>
                </div>
            </div>

            <div class="journey-connector"></div>

            <div class="journey-stage ${stageStates.yard}">
                <div class="journey-marker">5</div>

                <div class="journey-content">
                    <span>YARD DESTINATION</span>
                    <strong>
                        Block ${destination?.block || "—"}
                    </strong>
                    <small>
                        Row ${destination?.row || "—"} /
                        Slot ${destination?.slot || "—"}
                    </small>
                </div>
            </div>

        </div>

        <div class="movement-history">
            <div class="movement-history-header">
                <span>CONTAINER MOVEMENT HISTORY</span>
                <strong>${history.length} Events</strong>
            </div>

            <div class="movement-history-list">
                ${
                    history.length === 0
                        ? `
                            <div class="movement-history-empty">
                                No movement events recorded yet.
                            </div>
                        `
                        : history.map((event) => `
                            <div class="movement-history-event">
                                <div class="movement-history-time">
                                    ${formatEventTime(event.timestamp)}
                                </div>

                                <div class="movement-history-marker"></div>

                                <div class="movement-history-content">
                                    <strong>
                                        ${formatEventType(event.type)}
                                    </strong>

                                    <span>
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
                                    </span>
                                </div>
                            </div>
                        `).join("")
                }
            </div>
        </div>
    `;
}

function configureSearch(containers) {
    const input = document.getElementById(
        "yardContainerSearch"
    );

    const button = document.getElementById(
        "yardSearchButton"
    );

    if (!input || !button) {
        return;
    }

    const runSearch = () => {
        const containerId =
            input.value.trim().toUpperCase();

        if (!containerId) {
            return;
        }

        showContainerDetails(
            containerId,
            containers
        );
    };

    button.onclick = runSearch;

    input.onkeydown = (event) => {
        if (event.key === "Enter") {
            runSearch();
        }
    };
}

function updateYardPage(state) {
    renderYardBlocks(state.containers);
    renderIncomingContainers(state.containers);
    renderTruckActivity(state.trucks);
    configureSearch(state.containers);

    if (selectedContainerId) {
        showContainerDetails(
            selectedContainerId,
            state.containers,
        );
    }
}

async function loadYardPage() {
    try {
        const state = await fetchYardState();
        updateYardPage(state);
    } catch (error) {
        console.error(error);
    }
}

document.addEventListener(
    "DOMContentLoaded",
    loadYardPage
);

let yardSimulationRunning = false;

function yardSimulationComplete(state) {
    return Object.values(state.containers).every(
        (container) => container.status === "IN_YARD"
    );
}

async function resetYardSimulation() {
    const response = await fetch(
        "/api/demo/reset",
        {
            method: "POST",
        }
    );

    if (!response.ok) {
        throw new Error("Failed to reset simulation");
    }

    return response.json();
}

async function stepYardSimulation() {
    const response = await fetch(
        "/api/demo/step",
        {
            method: "POST",
        }
    );

    if (!response.ok) {
        throw new Error("Failed to advance simulation");
    }

    return response.json();
}

function wait(milliseconds) {
    return new Promise(
        (resolve) => setTimeout(resolve, milliseconds)
    );
}

async function runYardSimulation() {
    if (yardSimulationRunning) {
        return;
    }

    const button = document.getElementById(
        "startSimulation"
    );

    yardSimulationRunning = true;

    if (button) {
        button.disabled = true;
        button.textContent = "● Simulation Running";
    }

    try {
        let state = await resetYardSimulation();

        updateYardPage(state);

        await wait(700);

        while (!yardSimulationComplete(state)) {
            const response =
                await stepYardSimulation();

            state = response.state;

            updateYardPage(state);

            await wait(1200);
        }

        if (button) {
            button.textContent = "✓ Yard Operation Complete";
        }
    } catch (error) {
        console.error(error);

        if (button) {
            button.textContent = "⚠ Simulation Error";
        }
    } finally {
        yardSimulationRunning = false;

        if (button) {
            button.disabled = false;
        }
    }
}

document.addEventListener(
    "DOMContentLoaded",
    () => {
        const button = document.getElementById(
            "startSimulation"
        );

        if (button) {
            button.addEventListener(
                "click",
                runYardSimulation
            );
        }
    }
);
