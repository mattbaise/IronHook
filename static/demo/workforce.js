let workforceState = {
    workers: [],
    shifts: [],
    assignments: [],
};

let selectedWorkerId = null;

async function fetchWorkers() {
    const response = await fetch("/api/workers");

    if (!response.ok) {
        throw new Error("Failed to load workers");
    }

    return response.json();
}

async function fetchShifts() {
    const response = await fetch("/api/shifts");

    if (!response.ok) {
        throw new Error("Failed to load shifts");
    }

    return response.json();
}

async function fetchAssignments() {
    const response = await fetch("/api/assignments");

    if (!response.ok) {
        throw new Error("Failed to load assignments");
    }

    return response.json();
}

function formatDateTime(value) {
    if (!value) {
        return "—";
    }

    return new Date(value).toLocaleString(
        [],
        {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }
    );
}

function updateWorkforceKpis() {
    const workers = workforceState.workers;

    const activeWorkers = workers.filter(
        (worker) => worker.active
    ).length;

    const activeShift =
        workforceState.shifts.find(
            (shift) =>
                shift.shift_status === "ACTIVE"
        );

    document.getElementById(
        "workforceTotalCount"
    ).textContent = workers.length;

    document.getElementById(
        "workforceActiveCount"
    ).textContent = activeWorkers;

    document.getElementById(
        "workforceAssignmentCount"
    ).textContent =
        workforceState.assignments.length;

    const shiftName = document.getElementById(
        "workforceShiftName"
    );

    const shiftTime = document.getElementById(
        "workforceShiftTime"
    );

    if (activeShift) {
        shiftName.textContent =
            activeShift.shift_name;

        shiftTime.textContent =
            `${formatDateTime(
                activeShift.starts_at
            )} – ${formatDateTime(
                activeShift.ends_at
            )}`;
    } else {
        shiftName.textContent = "—";
        shiftTime.textContent =
            "No active shift";
    }
}

function getWorkerAssignments(worker) {
    const name =
        `${worker.first_name} ${worker.last_name}`;

    return workforceState.assignments.filter(
        (assignment) =>
            assignment.worker_name === name
    );
}

function getFilteredWorkers() {
    const search = document.getElementById(
        "workforceSearch"
    ).value.trim().toUpperCase();

    const status = document.getElementById(
        "workforceStatusFilter"
    ).value;

    return workforceState.workers.filter(
        (worker) => {
            const searchable = [
                worker.employee_number,
                worker.first_name,
                worker.last_name,
                worker.job_classification,
                worker.union_local_code || "",
            ]
                .join(" ")
                .toUpperCase();

            const matchesSearch =
                !search ||
                searchable.includes(search);

            const matchesStatus =
                status === "ALL" ||
                (
                    status === "ACTIVE" &&
                    worker.active
                ) ||
                (
                    status === "INACTIVE" &&
                    !worker.active
                );

            return (
                matchesSearch &&
                matchesStatus
            );
        }
    );
}

function renderWorkers() {
    const grid = document.getElementById(
        "workforceGrid"
    );

    const workers = getFilteredWorkers();

    grid.innerHTML = "";

    if (workers.length === 0) {
        grid.innerHTML = `
            <div class="workforce-empty-state">
                No workers match the current filters.
            </div>
        `;

        return;
    }

    workers.forEach((worker) => {
        const assignments =
            getWorkerAssignments(worker);

        const card =
            document.createElement("button");

        card.className = "workforce-card";

        if (
            worker.worker_id ===
            selectedWorkerId
        ) {
            card.classList.add("selected");
        }

        card.innerHTML = `
            <div class="workforce-card-header">

                <div>
                    <span>
                        ${worker.employee_number}
                    </span>

                    <strong>
                        ${worker.first_name}
                        ${worker.last_name}
                    </strong>
                </div>

                <span
                    class="
                        workforce-status-pill
                        ${worker.active
                            ? "active"
                            : "inactive"}
                    "
                >
                    ${worker.active
                        ? "Active"
                        : "Inactive"}
                </span>

            </div>

            <div class="workforce-card-info">

                <div>
                    <span>CLASSIFICATION</span>

                    <strong>
                        ${worker.job_classification}
                    </strong>
                </div>

                <div>
                    <span>UNION LOCAL</span>

                    <strong>
                        ${worker.union_local_code || "—"}
                    </strong>
                </div>

                <div>
                    <span>ACTIVE ASSIGNMENTS</span>

                    <strong>
                        ${assignments.length}
                    </strong>
                </div>

            </div>
        `;

        card.addEventListener(
            "click",
            () => selectWorker(worker)
        );

        grid.appendChild(card);
    });
}

function selectWorker(worker) {
    selectedWorkerId =
        worker.worker_id;

    renderWorkers();

    const detail = document.getElementById(
        "workforceDetail"
    );

    const assignments =
        getWorkerAssignments(worker);

    detail.className = "";

    detail.innerHTML = `
        <div class="workforce-detail-header">

            <div>
                <span>WORKER</span>

                <strong>
                    ${worker.first_name}
                    ${worker.last_name}
                </strong>

                <small>
                    ${worker.employee_number}
                </small>
            </div>

            <span
                class="
                    workforce-status-pill
                    ${worker.active
                        ? "active"
                        : "inactive"}
                "
            >
                ${worker.active
                    ? "Active"
                    : "Inactive"}
            </span>

        </div>

        <div class="
            workforce-clearance
            ${worker.active
                ? "cleared"
                : "blocked"}
        ">

            <span>
                ${worker.active ? "✓" : "!"}
            </span>

            <div>
                <strong>
                    ${worker.active
                        ? "ACTIVE WORKFORCE RECORD"
                        : "INACTIVE WORKFORCE RECORD"}
                </strong>

                <small>
                    ${
                        worker.active
                            ? "Worker is active in the IronHook workforce roster."
                            : "Worker is not currently active in the workforce roster."
                    }
                </small>
            </div>

        </div>

        <div class="workforce-detail-grid">

            <div>
                <span>EMPLOYEE NUMBER</span>
                <strong>
                    ${worker.employee_number}
                </strong>
            </div>

            <div>
                <span>CLASSIFICATION</span>
                <strong>
                    ${worker.job_classification}
                </strong>
            </div>

            <div>
                <span>UNION LOCAL</span>
                <strong>
                    ${worker.union_local_code || "—"}
                </strong>
            </div>

            <div>
                <span>ACTIVE ASSIGNMENTS</span>
                <strong>
                    ${assignments.length}
                </strong>
            </div>

        </div>

        <div class="workforce-assignment-list">

            <div class="workforce-assignment-title">
                CURRENT ASSIGNMENTS
            </div>

            ${
                assignments.length === 0
                    ? `
                        <div class="workforce-assignment-empty">
                            No active assignments.
                        </div>
                    `
                    : assignments.map(
                        (assignment) => `
                            <div class="workforce-assignment-row">

                                <div>
                                    <strong>
                                        ${assignment.container_number}
                                    </strong>

                                    <span>
                                        ${assignment.assignment_status}
                                    </span>
                                </div>

                                <div>
                                    <strong>
                                        ${assignment.equipment_code || "No equipment"}
                                    </strong>

                                    <span>
                                        Priority ${assignment.priority_number}
                                    </span>
                                </div>

                            </div>
                        `
                    ).join("")
            }

        </div>
    `;
}

function renderShift() {
    const container = document.getElementById(
        "workforceShiftDetail"
    );

    const activeShift =
        workforceState.shifts.find(
            (shift) =>
                shift.shift_status === "ACTIVE"
        );

    if (!activeShift) {
        container.innerHTML = `
            <div class="workforce-shift-empty">
                No active shift.
            </div>
        `;

        return;
    }

    container.innerHTML = `
        <div>
            <span>SHIFT</span>
            <strong>
                ${activeShift.shift_name}
            </strong>
        </div>

        <div>
            <span>STATUS</span>
            <strong>
                ${activeShift.shift_status}
            </strong>
        </div>

        <div>
            <span>START</span>
            <strong>
                ${formatDateTime(
                    activeShift.starts_at
                )}
            </strong>
        </div>

        <div>
            <span>END</span>
            <strong>
                ${formatDateTime(
                    activeShift.ends_at
                )}
            </strong>
        </div>

        <div>
            <span>TERMINAL</span>
            <strong>
                Terminal ${activeShift.terminal_id}
            </strong>
        </div>
    `;
}

function configureWorkforceFilters() {
    const search = document.getElementById(
        "workforceSearch"
    );

    const status = document.getElementById(
        "workforceStatusFilter"
    );

    search.addEventListener(
        "input",
        renderWorkers
    );

    status.addEventListener(
        "change",
        renderWorkers
    );
}

async function loadWorkforcePage() {
    try {
        const [
            workersResponse,
            shiftsResponse,
            assignmentsResponse,
        ] = await Promise.all([
            fetchWorkers(),
            fetchShifts(),
            fetchAssignments(),
        ]);

        workforceState = {
            workers: workersResponse.workers,
            shifts: shiftsResponse.shifts,
            assignments:
                assignmentsResponse.assignments,
        };

        updateWorkforceKpis();
        renderWorkers();
        renderShift();
        configureWorkforceFilters();
    } catch (error) {
        console.error(error);
    }
}

document.addEventListener(
    "DOMContentLoaded",
    loadWorkforcePage
);
