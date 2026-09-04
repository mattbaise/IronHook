const startButton = document.getElementById("startSimulation");

const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));


async function getState() {
    const response = await fetch("/api/demo/state");

    if (!response.ok) {
        throw new Error("Unable to load demo state.");
    }

    return response.json();
}


async function stepSimulation() {
    const response = await fetch(
        "/api/demo/step",
        {
            method: "POST",
        }
    );

    if (!response.ok) {
        throw new Error("Unable to advance simulation.");
    }

    return response.json();
}


async function resetSimulation() {
    const response = await fetch(
        "/api/demo/reset",
        {
            method: "POST",
        }
    );

    if (!response.ok) {
        throw new Error("Unable to reset simulation.");
    }

    return response.json();
}


function formatStatus(status) {
    return status
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}


function updateDashboard(state) {
    const vessel = state.vessel;

    const discharged =
        document.getElementById("dischargedContainers");

    const remaining =
        document.getElementById("remainingContainers");

    const progressPercent =
        document.getElementById("progressPercent");

    const progressBar =
        document.getElementById("progressBar");

    const progressDischarged =
        document.getElementById("progressDischarged");

    const progressRemaining =
        document.getElementById("progressRemaining");

    if (discharged) {
        discharged.textContent =
            vessel.discharged.toLocaleString();
    }

    if (remaining) {
        remaining.textContent =
            vessel.remaining.toLocaleString();
    }

    if (progressPercent) {
        progressPercent.textContent =
            `${vessel.progress_percent}%`;
    }

    if (progressBar) {
        progressBar.style.width =
            `${vessel.progress_percent}%`;
    }

    if (progressDischarged) {
        progressDischarged.textContent =
            `${vessel.discharged.toLocaleString()} discharged`;
    }

    if (progressRemaining) {
        progressRemaining.textContent =
            `${vessel.remaining.toLocaleString()} remaining`;
    }

    updateContainerTable(state.containers);
    updateCranePerformance(state.cranes);
    updateVesselBayPlan(state.containers);
    updateTruckOperations(state.trucks);
    updateYardOperations(state.containers);
    updateEventFeed(state.events);
}


function getStatusClass(status) {
    if (status === "IN_YARD") {
        return "success-pill";
    }

    if (status === "IN_TRANSIT") {
        return "warning-pill";
    }

    if (status === "ON_TRUCK") {
        return "transit-pill";
    }

    return "working-pill";
}


function updateContainerTable(containers) {
    const tableBody =
        document.getElementById("containerTableBody");

    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = "";

    Object.entries(containers).forEach(
        ([containerId, container]) => {
            const row =
                document.createElement("tr");

            const bayPosition =
                `${container.bay} / ${container.row} / ${container.tier}`;

            const truck =
                container.truck || "—";

            row.innerHTML = `
                <td>${containerId}</td>
                <td>${bayPosition}</td>
                <td>${container.crane}</td>
                <td>${truck}</td>
                <td>${container.destination}</td>
                <td>
                    <span class="status-pill ${getStatusClass(container.status)}">
                        ${formatStatus(container.status)}
                    </span>
                </td>
            `;

            tableBody.appendChild(row);
        }
    );
}


function updateCranePerformance(cranes) {
    const craneElements = {
        "QC-01": document.getElementById("craneMovesQC01"),
        "QC-02": document.getElementById("craneMovesQC02"),
        "QC-03": document.getElementById("craneMovesQC03"),
        "QC-04": document.getElementById("craneMovesQC04"),
    };

    Object.entries(cranes).forEach(
        ([craneId, crane]) => {
            const element =
                craneElements[craneId];

            if (!element) {
                return;
            }

            const moveLabel =
                crane.moves === 1
                    ? "move"
                    : "moves";

            element.textContent =
                `${crane.moves} ${moveLabel}`;
        }
    );
}


function updateVesselBayPlan(containers) {
    const activeBays = ["04", "08", "12", "16"];

    activeBays.forEach((bay) => {
        const stack =
            document.getElementById(`bayStack${bay}`);

        if (!stack) {
            return;
        }

        const bayContainers =
            Object.values(containers).filter(
                (container) => container.bay === bay
            );

        const stillOnVessel =
            bayContainers.filter(
                (container) =>
                    container.status === "ON_VESSEL"
            ).length;

        const blocks =
            Array.from(stack.querySelectorAll("span"));

        const totalContainers =
            bayContainers.length;

        let visibleBlocks = 0;

        if (totalContainers > 0) {
            visibleBlocks = Math.round(
                (stillOnVessel / totalContainers)
                * blocks.length
            );
        }

        blocks.forEach((block, index) => {
            if (index < visibleBlocks) {
                block.style.opacity = "1";
                block.style.transform = "scale(1)";
            } else {
                block.style.opacity = "0.08";
                block.style.transform = "scale(0.82)";
            }

            block.style.transition =
                "opacity 0.45s ease, transform 0.45s ease";
        });

        stack.classList.remove(
            "working-stack",
            "discharged-stack"
        );

        if (stillOnVessel === 0) {
            stack.classList.add(
                "discharged-stack"
            );
        } else {
            stack.classList.add(
                "working-stack"
            );
        }
    });
}


function updateTruckOperations(trucks) {
    const fleet =
        document.getElementById("truckFleet");

    if (!fleet) {
        return;
    }

    fleet.innerHTML = "";

    let availableCount = 0;
    let activeCount = 0;

    Object.entries(trucks).forEach(
        ([truckId, truck]) => {
            const unit =
                document.createElement("div");

            const status =
                truck.status || "AVAILABLE";

            if (status === "AVAILABLE") {
                availableCount += 1;
            } else {
                activeCount += 1;
            }

            const statusClass =
                status.toLowerCase().replace("_", "-");

            unit.className =
                `truck-unit ${statusClass}`;

            const assignment =
                truck.container
                    ? truck.container
                    : truck.driver;

            unit.innerHTML = `
                <div class="truck-icon"></div>
                <strong>${truckId}</strong>
                <small>${assignment}</small>
                <span class="truck-status">
                    ${formatStatus(status)}
                </span>
            `;

            fleet.appendChild(unit);
        }
    );

    const availableElement =
        document.getElementById(
            "availableTruckCount"
        );

    const activeElement =
        document.getElementById(
            "activeTruckCount"
        );

    if (availableElement) {
        availableElement.textContent =
            availableCount;
    }

    if (activeElement) {
        activeElement.textContent =
            activeCount;
    }
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


function updateYardOperations(containers) {
    const blocks = {
        A: [],
        B: [],
        C: [],
        D: [],
    };

    let inYardCount = 0;
    let incomingCount = 0;

    Object.entries(containers).forEach(
        ([containerId, container]) => {
            const location =
                parseYardDestination(
                    container.destination
                );

            if (!location) {
                return;
            }

            let yardStatus = "empty";

            if (
                container.status === "IN_TRANSIT"
            ) {
                yardStatus = "incoming";
                incomingCount += 1;
            }

            if (
                container.status === "IN_YARD"
            ) {
                yardStatus = "occupied";
                inYardCount += 1;
            }

            blocks[location.block].push({
                containerId,
                location,
                yardStatus,
            });
        }
    );

    Object.entries(blocks).forEach(
        ([blockName, slots]) => {
            const blockElement =
                document.getElementById(
                    `yardBlock${blockName}`
                );

            const countElement =
                document.getElementById(
                    `block${blockName}Count`
                );

            if (!blockElement) {
                return;
            }

            blockElement.innerHTML = "";

            slots.sort(
                (a, b) =>
                    Number(a.location.row)
                    - Number(b.location.row)
            );

            let occupied = 0;

            slots.forEach((slot) => {
                if (
                    slot.yardStatus ===
                    "occupied"
                ) {
                    occupied += 1;
                }

                const element =
                    document.createElement(
                        "div"
                    );

                element.className =
                    `yard-slot ${slot.yardStatus}`;

                let containerLabel =
                    "EMPTY";

                if (
                    slot.yardStatus ===
                    "incoming"
                ) {
                    containerLabel =
                        `${slot.containerId} →`;
                }

                if (
                    slot.yardStatus ===
                    "occupied"
                ) {
                    containerLabel =
                        slot.containerId;
                }

                element.innerHTML = `
                    <div class="yard-slot-location">
                        <strong>
                            Row ${slot.location.row}
                        </strong>
                        <span>
                            Slot ${slot.location.slot}
                        </span>
                    </div>

                    <div class="yard-container">
                        ${containerLabel}
                    </div>
                `;

                blockElement.appendChild(
                    element
                );
            });

            if (countElement) {
                countElement.textContent =
                    `${occupied} / ${slots.length}`;
            }
        }
    );

    const yardCountElement =
        document.getElementById(
            "yardContainerCount"
        );

    const incomingElement =
        document.getElementById(
            "yardIncomingCount"
        );

    if (yardCountElement) {
        yardCountElement.textContent =
            inYardCount;
    }

    if (incomingElement) {
        incomingElement.textContent =
            incomingCount;
    }
}


function updateEventFeed(events) {
    const feed =
        document.getElementById("simulationEvents");

    if (!feed) {
        return;
    }

    feed.innerHTML = "";

    if (events.length === 0) {
        feed.innerHTML = `
            <div class="event-item">
                <span class="event-icon">•</span>
                <div>
                    <strong>Simulation ready</strong>
                    <span>Awaiting terminal activity</span>
                </div>
            </div>
        `;

        return;
    }

    [...events]
        .reverse()
        .slice(0, 8)
        .forEach((event) => {
            const item =
                document.createElement("div");

            item.className = "event-item";

            const icon =
                document.createElement("span");

            icon.className = "event-icon";
            icon.textContent = "✓";

            const content =
                document.createElement("div");

            const title =
                document.createElement("strong");

            title.textContent =
                event.type.replaceAll("_", " ");

            const detail =
                document.createElement("span");

            let detailText =
                event.container_id || "";

            if (event.crane_id) {
                detailText +=
                    ` • ${event.crane_id}`;
            }

            if (event.truck_id) {
                detailText +=
                    ` → ${event.truck_id}`;
            }

            detail.textContent =
                detailText;

            content.appendChild(title);
            content.appendChild(detail);

            item.appendChild(icon);
            item.appendChild(content);

            feed.appendChild(item);
        });
}


function simulationComplete(state) {
    return Object.values(
        state.containers
    ).every(
        (container) =>
            container.status === "IN_YARD"
    );
}


async function runSimulation() {
    if (!startButton) {
        return;
    }

    startButton.disabled = true;
    startButton.textContent =
        "● Simulation Running";

    try {
        let state =
            await resetSimulation();

        updateDashboard(state);

        await sleep(800);

        while (!simulationComplete(state)) {
            const response =
                await stepSimulation();

            state = response.state;

            updateDashboard(state);

            await sleep(1200);
        }

        startButton.textContent =
            "✓ Simulation Complete";

        await sleep(1000);

        startButton.textContent =
            "Run Simulation Again";

        startButton.disabled = false;

    } catch (error) {
        console.error(error);

        startButton.textContent =
            "Simulation Error";

        startButton.disabled = false;
    }
}


if (startButton) {
    startButton.addEventListener(
        "click",
        runSimulation
    );
}


getState()
    .then(updateDashboard)
    .catch(console.error);
