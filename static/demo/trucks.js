let truckPageState = null;
let selectedTruckId = null;
let truckSimulationRunning = false;

async function fetchTruckDemoState() {
    const response = await fetch("/api/demo/state");

    if (!response.ok) {
        throw new Error("Failed to load live truck state");
    }

    return response.json();
}

async function fetchEquipmentFleet() {
    const response = await fetch("/api/equipment");

    if (!response.ok) {
        throw new Error("Failed to load equipment fleet");
    }

    return response.json();
}

function formatTruckStatus(status) {
    return status
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(
            /\b\w/g,
            (letter) => letter.toUpperCase()
        );
}

function parseTruckDestination(destination) {
    if (!destination) {
        return "—";
    }

    return destination;
}

function getTruckContainer(truck, containers) {
    if (!truck.container) {
        return null;
    }

    return containers[truck.container] || null;
}

function updateTruckKpis(
    trucks,
    equipment
) {
    const demoTrucks = Object.values(trucks);

    const available = demoTrucks.filter(
        (truck) =>
            truck.status === "AVAILABLE"
    ).length;

    const active = demoTrucks.filter(
        (truck) =>
            truck.status === "ASSIGNED" ||
            truck.status === "IN_TRANSIT"
    ).length;

    const exceptions = equipment.filter(
        (item) =>
            item.equipment_type === "YARD_TRUCK" &&
            [
                "DOWN",
                "MAINTENANCE",
                "RESTRICTED",
            ].includes(item.operating_status)
    ).length;

    document.getElementById(
        "truckDemoTotal"
    ).textContent = demoTrucks.length;

    document.getElementById(
        "truckAvailableCount"
    ).textContent = available;

    document.getElementById(
        "truckActiveCount"
    ).textContent = active;

    document.getElementById(
        "truckExceptionCount"
    ).textContent = exceptions;
}

function getFilteredTrucks(trucks) {
    const search = document.getElementById(
        "truckSearch"
    ).value.trim().toUpperCase();

    const status = document.getElementById(
        "truckStatusFilter"
    ).value;

    return Object.entries(trucks).filter(
        ([truckId, truck]) => {
            const searchValues = [
                truckId,
                truck.driver || "",
                truck.container || "",
            ]
                .join(" ")
                .toUpperCase();

            const matchesSearch =
                !search ||
                searchValues.includes(search);

            const matchesStatus =
                status === "ALL" ||
                truck.status === status;

            return matchesSearch && matchesStatus;
        }
    );
}

function renderTruckDispatch(
    trucks,
    containers
) {
    const grid = document.getElementById(
        "truckDispatchGrid"
    );

    const filtered =
        getFilteredTrucks(trucks);

    grid.innerHTML = "";

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="truck-empty-state">
                No trucks match the current filters.
            </div>
        `;

        return;
    }

    filtered.forEach(([truckId, truck]) => {
        const assignedContainer =
            getTruckContainer(
                truck,
                containers
            );

        const card =
            document.createElement("button");

        card.className =
            `truck-dispatch-card truck-${truck.status.toLowerCase()}`;

        if (truckId === selectedTruckId) {
            card.classList.add("selected");
        }

        card.innerHTML = `
            <div class="truck-dispatch-card-header">

                <div>
                    <span>TERMINAL TRUCK</span>
                    <strong>${truckId}</strong>
                </div>

                <span
                    class="
                        truck-status-pill
                        status-${truck.status.toLowerCase()}
                    "
                >
                    ${formatTruckStatus(truck.status)}
                </span>

            </div>

            <div class="truck-card-grid">

                <div>
                    <span>DRIVER</span>
                    <strong>
                        ${truck.driver || "Unassigned"}
                    </strong>
                </div>

                <div>
                    <span>CONTAINER</span>
                    <strong>
                        ${truck.container || "None"}
                    </strong>
                </div>

                <div class="truck-card-destination">
                    <span>DESTINATION</span>

                    <strong>
                        ${
                            assignedContainer
                                ? parseTruckDestination(
                                    assignedContainer.destination
                                )
                                : "Awaiting dispatch"
                        }
                    </strong>
                </div>

            </div>
        `;

        card.addEventListener(
            "click",
            () => selectTruck(
                truckId,
                trucks,
                containers
            )
        );

        grid.appendChild(card);
    });
}

function selectTruck(
    truckId,
    trucks,
    containers
) {
    selectedTruckId = truckId;

    renderTruckDispatch(
        trucks,
        containers
    );

    const truck = trucks[truckId];

    const container =
        getTruckContainer(
            truck,
            containers
        );

    const detail = document.getElementById(
        "truckDetail"
    );

    detail.className = "";

    detail.innerHTML = `
        <div class="truck-detail-header">

            <div>
                <span>TRUCK</span>
                <strong>${truckId}</strong>
                <small>${truck.driver}</small>
            </div>

            <span
                class="
                    truck-status-pill
                    status-${truck.status.toLowerCase()}
                "
            >
                ${formatTruckStatus(truck.status)}
            </span>

        </div>

        <div class="truck-movement-state
            ${
                truck.status === "AVAILABLE"
                    ? "ready"
                    : "active"
            }
        ">
            <span>
                ${
                    truck.status === "AVAILABLE"
                        ? "✓"
                        : "→"
                }
            </span>

            <div>
                <strong>
                    ${
                        truck.status === "AVAILABLE"
                            ? "READY FOR DISPATCH"
                            : "ACTIVE CONTAINER MOVE"
                    }
                </strong>

                <small>
                    ${
                        truck.status === "AVAILABLE"
                            ? "Truck is available for the next terminal move."
                            : `${truck.container} is currently assigned to this truck.`
                    }
                </small>
            </div>
        </div>

        <div class="truck-detail-grid">

            <div>
                <span>DRIVER</span>
                <strong>${truck.driver}</strong>
            </div>

            <div>
                <span>CURRENT STATUS</span>
                <strong>
                    ${formatTruckStatus(truck.status)}
                </strong>
            </div>

            <div>
                <span>CONTAINER</span>
                <strong>
                    ${truck.container || "No container"}
                </strong>
            </div>

            <div>
                <span>DESTINATION</span>

                <strong>
                    ${
                        container
                            ? container.destination
                            : "No active move"
                    }
                </strong>
            </div>

        </div>

        ${
            container
                ? `
                    <div class="truck-container-link">

                        <span>
                            ACTIVE CONTAINER
                        </span>

                        <strong>
                            ${truck.container}
                        </strong>

                        <small>
                            ${
                                formatTruckStatus(
                                    container.status
                                )
                            }
                            · Bay ${container.bay}
                            · ${container.crane}
                        </small>

                    </div>
                `
                : ""
        }
    `;
}

function renderDatabaseFleet(equipment) {
    const grid = document.getElementById(
        "truckFleetGrid"
    );

    const trucks = equipment.filter(
        (item) =>
            item.equipment_type === "YARD_TRUCK"
    );

    grid.innerHTML = "";

    trucks.forEach((truck) => {
        const unavailable = [
            "DOWN",
            "MAINTENANCE",
            "RESTRICTED",
        ].includes(truck.operating_status);

        const card =
            document.createElement("div");

        card.className =
            `truck-fleet-card ${
                unavailable
                    ? "fleet-exception"
                    : ""
            }`;

        card.innerHTML = `
            <div class="truck-fleet-header">

                <div>
                    <span>YARD TRUCK</span>
                    <strong>
                        ${truck.equipment_code}
                    </strong>
                </div>

                <span
                    class="
                        equipment-status-pill
                        status-${truck.operating_status.toLowerCase()}
                    "
                >
                    ${formatTruckStatus(
                        truck.operating_status
                    )}
                </span>

            </div>

            <div class="truck-fleet-metrics">

                <div>
                    <span>OPERATING HOURS</span>

                    <strong>
                        ${Number(
                            truck.total_operating_hours
                        ).toLocaleString(
                            undefined,
                            {
                                maximumFractionDigits: 1,
                            }
                        )}
                    </strong>
                </div>

                <div>
                    <span>MILEAGE</span>

                    <strong>
                        ${Number(
                            truck.total_mileage
                        ).toLocaleString(
                            undefined,
                            {
                                maximumFractionDigits: 1,
                            }
                        )}
                    </strong>
                </div>

                <div>
                    <span>SERVICE CLEARANCE</span>

                    <strong>
                        ${
                            unavailable
                                ? "NOT CLEARED"
                                : "CLEARED"
                        }
                    </strong>
                </div>

            </div>
        `;

        grid.appendChild(card);
    });
}

function updateTrucksPage(
    state,
    equipment
) {
    truckPageState = {
        state,
        equipment,
    };

    updateTruckKpis(
        state.trucks,
        equipment
    );

    renderTruckDispatch(
        state.trucks,
        state.containers
    );

    renderDatabaseFleet(equipment);

    if (selectedTruckId) {
        selectTruck(
            selectedTruckId,
            state.trucks,
            state.containers
        );
    }
}

function configureTruckFilters() {
    const search = document.getElementById(
        "truckSearch"
    );

    const status = document.getElementById(
        "truckStatusFilter"
    );

    search.addEventListener(
        "input",
        () => {
            if (!truckPageState) {
                return;
            }

            renderTruckDispatch(
                truckPageState.state.trucks,
                truckPageState.state.containers
            );
        }
    );

    status.addEventListener(
        "change",
        () => {
            if (!truckPageState) {
                return;
            }

            renderTruckDispatch(
                truckPageState.state.trucks,
                truckPageState.state.containers
            );
        }
    );
}

function truckSimulationComplete(state) {
    return Object.values(state.containers)
        .every(
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

async function runTruckSimulation() {
    if (truckSimulationRunning) {
        return;
    }

    const button = document.getElementById(
        "startTruckSimulation"
    );

    truckSimulationRunning = true;

    button.disabled = true;
    button.textContent = "● Simulation Running";

    try {
        const resetResponse = await fetch(
            "/api/demo/reset",
            {
                method: "POST",
            }
        );

        let state =
            await resetResponse.json();

        updateTrucksPage(
            state,
            truckPageState.equipment
        );

        await wait(700);

        while (!truckSimulationComplete(state)) {
            const response = await fetch(
                "/api/demo/step",
                {
                    method: "POST",
                }
            );

            const data =
                await response.json();

            state = data.state;

            updateTrucksPage(
                state,
                truckPageState.equipment
            );

            await wait(1200);
        }

        button.textContent =
            "✓ Truck Operation Complete";
    } catch (error) {
        console.error(error);

        button.textContent =
            "⚠ Simulation Error";
    } finally {
        truckSimulationRunning = false;
        button.disabled = false;
    }
}

async function loadTrucksPage() {
    try {
        const [
            state,
            equipmentResponse,
        ] = await Promise.all([
            fetchTruckDemoState(),
            fetchEquipmentFleet(),
        ]);

        updateTrucksPage(
            state,
            equipmentResponse.equipment
        );

        configureTruckFilters();
    } catch (error) {
        console.error(error);
    }
}

document.addEventListener(
    "DOMContentLoaded",
    () => {
        loadTrucksPage();

        const button = document.getElementById(
            "startTruckSimulation"
        );

        button.addEventListener(
            "click",
            runTruckSimulation
        );
    }
);
