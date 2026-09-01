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


function updateDashboard(state) {
    const vessel = state.vessel;
    const container = state.containers["IH-C-1847"];

    const discharged = document.getElementById(
        "dischargedContainers"
    );

    const remaining = document.getElementById(
        "remainingContainers"
    );

    const progressPercent = document.getElementById(
        "progressPercent"
    );

    const progressBar = document.getElementById(
        "progressBar"
    );

    const progressDischarged = document.getElementById(
        "progressDischarged"
    );

    const progressRemaining = document.getElementById(
        "progressRemaining"
    );

    const containerStatus = document.getElementById(
        "containerStatus"
    );

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

    if (containerStatus) {
        containerStatus.textContent =
            container.status.replaceAll("_", " ");
    }

    updateEventFeed(state.events);
}


function updateEventFeed(events) {
    const feed = document.getElementById(
        "simulationEvents"
    );

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
        .slice(0, 5)
        .forEach((event) => {
            const item =
                document.createElement("div");

            item.className = "event-item";

            const title =
                document.createElement("strong");

            title.textContent =
                event.type.replaceAll("_", " ");

            const detail =
                document.createElement("span");

            detail.textContent =
                `${event.container_id} • ${event.truck_id}`;

            const content =
                document.createElement("div");

            content.appendChild(title);
            content.appendChild(detail);

            const icon =
                document.createElement("span");

            icon.className = "event-icon";
            icon.textContent = "✓";

            item.appendChild(icon);
            item.appendChild(content);

            feed.appendChild(item);
        });
}


async function runSimulation() {
    if (!startButton) {
        return;
    }

    startButton.disabled = true;
    startButton.textContent =
        "● Simulation Running";

    try {
        let state = await resetSimulation();
        updateDashboard(state);

        await sleep(1000);

        state = await stepSimulation();
        updateDashboard(state);

        await sleep(1500);

        state = await stepSimulation();
        updateDashboard(state);

        await sleep(1500);

        state = await stepSimulation();
        updateDashboard(state);

        startButton.textContent =
            "✓ Simulation Complete";

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
