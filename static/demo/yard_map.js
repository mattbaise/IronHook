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

function showContainerDetails(containerId, containers) {
    const result = document.getElementById(
        "yardSearchResult"
    );

    const container = containers[containerId];

    if (!result) {
        return;
    }

    if (!container) {
        result.innerHTML = `
            <strong>Container not found</strong>
            <span>
                Check the container ID and try again.
            </span>
        `;
        return;
    }

    const destination =
        parseYardDestination(container.destination);

    result.innerHTML = `
        <div class="yard-trace-header">
            <strong>${containerId}</strong>
            <span>${formatStatus(container.status)}</span>
        </div>

        <div class="yard-trace-grid">
            <div>
                <span>Vessel Bay</span>
                <strong>
                    ${container.bay} / ${container.row} / ${container.tier}
                </strong>
            </div>

            <div>
                <span>Crane</span>
                <strong>${container.crane}</strong>
            </div>

            <div>
                <span>Truck</span>
                <strong>${container.truck || "Not Assigned"}</strong>
            </div>

            <div>
                <span>Yard Destination</span>
                <strong>
                    Block ${destination?.block || "—"} /
                    Row ${destination?.row || "—"} /
                    Slot ${destination?.slot || "—"}
                </strong>
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
