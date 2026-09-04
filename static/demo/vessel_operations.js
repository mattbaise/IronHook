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
    updateEventFeed(state.events);
}


function updateContainerTable(containers) {
    const rows = document.querySelectorAll("tbody tr");

    rows.forEach((row) => {
        const cells = row.querySelectorAll("td");

        if (cells.length < 6) {
            return;
        }

        const containerId =
            cells[0].textContent.trim();

        const container =
            containers[containerId];

        if (!container) {
            return;
        }

        cells[2].textContent =
            container.crane || "—";

        cells[3].textContent =
            container.truck || "—";

        const statusPill =
            cells[5].querySelector(".status-pill");

        if (!statusPill) {
            return;
        }

        statusPill.textContent =
            formatStatus(container.status);

        statusPill.classList.remove(
            "working-pill",
            "success-pill",
            "warning-pill",
            "danger-pill"
        );

        if (container.status === "IN_YARD") {
            statusPill.classList.add(
                "success-pill"
            );

        } else if (
            container.status === "IN_TRANSIT"
        ) {
            statusPill.classList.add(
                "warning-pill"
            );

        } else {
            statusPill.classList.add(
                "working-pill"
            );
        }
    });
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
