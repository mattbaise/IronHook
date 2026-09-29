const assignmentState = {
    assignments: [],
    selectedAssignmentId: null,
};


async function fetchAssignments() {
    const response = await fetch("/api/assignments");

    if (!response.ok) {
        throw new Error(
            "Failed to load assignments"
        );
    }

    return response.json();
}


function formatDateTime(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString(
        [],
        {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }
    );
}


function formatStatus(value) {
    if (!value) {
        return "—";
    }

    return value
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(
            /\b\w/g,
            (character) =>
                character.toUpperCase()
        );
}


function formatLocation(
    zone,
    block,
    row,
    bay,
    tier
) {
    const parts = [];

    if (zone) {
        parts.push(zone);
    }

    if (block) {
        parts.push(`Block ${block}`);
    }

    if (row) {
        parts.push(`Row ${row}`);
    }

    if (bay !== null && bay !== undefined) {
        parts.push(`Bay ${bay}`);
    }

    if (tier !== null && tier !== undefined) {
        parts.push(`Tier ${tier}`);
    }

    if (parts.length === 0) {
        return "Not assigned";
    }

    return parts.join(" • ");
}


function createTextElement(
    tag,
    text,
    className = ""
) {
    const element =
        document.createElement(tag);

    element.textContent = text;

    if (className) {
        element.className = className;
    }

    return element;
}


function assignmentNeedsAttention(
    assignment
) {
    return Boolean(
        assignment.safety_stop ||
        assignment.customs_hold ||
        assignment.security_hold ||
        assignment.assignment_status ===
            "PAUSED"
    );
}


function getStatusClass(
    assignment
) {
    if (
        assignmentNeedsAttention(
            assignment
        )
    ) {
        return "inactive";
    }

    return "active";
}


function updateAssignmentKpis() {
    const assignments =
        assignmentState.assignments;

    const inProgress =
        assignments.filter(
            (assignment) =>
                assignment.assignment_status ===
                "IN_PROGRESS"
        ).length;

    const queued =
        assignments.filter(
            (assignment) =>
                assignment.assignment_status ===
                "QUEUED"
        ).length;

    const attention =
        assignments.filter(
            assignmentNeedsAttention
        ).length;

    document.getElementById(
        "assignmentActiveCount"
    ).textContent =
        assignments.length;

    document.getElementById(
        "assignmentProgressCount"
    ).textContent =
        inProgress;

    document.getElementById(
        "assignmentQueuedCount"
    ).textContent =
        queued;

    document.getElementById(
        "assignmentSafetyCount"
    ).textContent =
        attention;
}


function getFilteredAssignments() {
    const search =
        document.getElementById(
            "assignmentSearch"
        ).value
            .trim()
            .toUpperCase();

    const status =
        document.getElementById(
            "assignmentStatusFilter"
        ).value;

    return assignmentState.assignments.filter(
        (assignment) => {
            const searchable = [
                assignment.assignment_id,
                assignment.container_number,
                assignment.container_status,
                assignment.worker_name,
                assignment.equipment_code,
                assignment.equipment_status,
                assignment.pickup_zone,
                assignment.pickup_block,
                assignment.delivery_zone,
                assignment.delivery_block,
            ]
                .filter(
                    (value) =>
                        value !== null &&
                        value !== undefined
                )
                .join(" ")
                .toUpperCase();

            const matchesSearch =
                !search ||
                searchable.includes(search);

            const matchesStatus =
                status === "ALL" ||
                assignment.assignment_status ===
                    status;

            return (
                matchesSearch &&
                matchesStatus
            );
        }
    );
}


function renderAssignments() {
    const grid =
        document.getElementById(
            "assignmentGrid"
        );

    const assignments =
        getFilteredAssignments();

    grid.replaceChildren();

    if (assignments.length === 0) {
        const empty =
            createTextElement(
                "div",
                "No assignments match the current filters.",
                "workforce-empty-state"
            );

        grid.appendChild(empty);
        return;
    }

    assignments.forEach(
        (assignment) => {
            const card =
                document.createElement(
                    "button"
                );

            card.type = "button";
            card.className =
                "workforce-card";

            if (
                assignment.assignment_id ===
                assignmentState
                    .selectedAssignmentId
            ) {
                card.classList.add(
                    "selected"
                );
            }

            const header =
                document.createElement(
                    "div"
                );

            header.className =
                "workforce-card-header";

            const identity =
                document.createElement(
                    "div"
                );

            identity.appendChild(
                createTextElement(
                    "span",
                    `ASSIGNMENT #${assignment.assignment_id}`
                )
            );

            identity.appendChild(
                createTextElement(
                    "strong",
                    assignment.container_number ||
                        "Unknown Container"
                )
            );

            const status =
                createTextElement(
                    "span",
                    formatStatus(
                        assignment.assignment_status
                    ),
                    (
                        "workforce-status-pill " +
                        getStatusClass(
                            assignment
                        )
                    )
                );

            header.appendChild(
                identity
            );

            header.appendChild(
                status
            );

            const info =
                document.createElement(
                    "div"
                );

            info.className =
                "workforce-card-info";

            const worker =
                document.createElement(
                    "div"
                );

            worker.appendChild(
                createTextElement(
                    "span",
                    "WORKER"
                )
            );

            worker.appendChild(
                createTextElement(
                    "strong",
                    assignment.worker_name ||
                        "Unassigned"
                )
            );

            const equipment =
                document.createElement(
                    "div"
                );

            equipment.appendChild(
                createTextElement(
                    "span",
                    "EQUIPMENT"
                )
            );

            equipment.appendChild(
                createTextElement(
                    "strong",
                    assignment.equipment_code ||
                        "Unassigned"
                )
            );

            const priority =
                document.createElement(
                    "div"
                );

            priority.appendChild(
                createTextElement(
                    "span",
                    "PRIORITY"
                )
            );

            priority.appendChild(
                createTextElement(
                    "strong",
                    String(
                        assignment.priority_number
                    )
                )
            );

            info.appendChild(worker);
            info.appendChild(equipment);
            info.appendChild(priority);

            card.appendChild(header);
            card.appendChild(info);

            card.addEventListener(
                "click",
                () =>
                    selectAssignment(
                        assignment
                    )
            );

            grid.appendChild(card);
        }
    );
}


function addDetailField(
    container,
    label,
    value
) {
    const item =
        document.createElement("div");

    item.appendChild(
        createTextElement(
            "span",
            label
        )
    );

    item.appendChild(
        createTextElement(
            "strong",
            value || "—"
        )
    );

    container.appendChild(item);
}


function selectAssignment(
    assignment
) {
    assignmentState.selectedAssignmentId =
        assignment.assignment_id;

    renderAssignments();

    const detail =
        document.getElementById(
            "assignmentDetail"
        );

    detail.className = "";
    detail.replaceChildren();

    const header =
        document.createElement(
            "div"
        );

    header.className =
        "workforce-detail-header";

    const identity =
        document.createElement(
            "div"
        );

    identity.appendChild(
        createTextElement(
            "span",
            `ASSIGNMENT #${assignment.assignment_id}`
        )
    );

    identity.appendChild(
        createTextElement(
            "strong",
            assignment.container_number ||
                "Unknown Container"
        )
    );

    identity.appendChild(
        createTextElement(
            "small",
            assignment.worker_name ||
                "Worker unassigned"
        )
    );

    const status =
        createTextElement(
            "span",
            formatStatus(
                assignment.assignment_status
            ),
            (
                "workforce-status-pill " +
                getStatusClass(
                    assignment
                )
            )
        );

    header.appendChild(identity);
    header.appendChild(status);

    detail.appendChild(header);

    const clearance =
        document.createElement(
            "div"
        );

    clearance.className =
        assignmentNeedsAttention(
            assignment
        )
            ? "workforce-clearance blocked"
            : "workforce-clearance cleared";

    clearance.appendChild(
        createTextElement(
            "span",
            assignmentNeedsAttention(
                assignment
            )
                ? "!"
                : "✓"
        )
    );

    const clearanceText =
        document.createElement(
            "div"
        );

    clearanceText.appendChild(
        createTextElement(
            "strong",
            assignmentNeedsAttention(
                assignment
            )
                ? "OPERATIONAL ATTENTION REQUIRED"
                : "MOVE CLEARED"
        )
    );

    let clearanceMessage =
        "Assignment has no active hold or safety stop.";

    if (
        assignment.safety_stop
    ) {
        clearanceMessage =
            "Assignment is under a safety stop.";
    } else if (
        assignment.customs_hold
    ) {
        clearanceMessage =
            "Container is under customs hold.";
    } else if (
        assignment.security_hold
    ) {
        clearanceMessage =
            "Container is under security hold.";
    } else if (
        assignment.assignment_status ===
        "PAUSED"
    ) {
        clearanceMessage =
            "Assignment is currently paused.";
    }

    clearanceText.appendChild(
        createTextElement(
            "small",
            clearanceMessage
        )
    );

    clearance.appendChild(
        clearanceText
    );

    detail.appendChild(
        clearance
    );

    const detailGrid =
        document.createElement(
            "div"
        );

    detailGrid.className =
        "workforce-detail-grid";

    addDetailField(
        detailGrid,
        "CONTAINER STATUS",
        formatStatus(
            assignment.container_status
        )
    );

    addDetailField(
        detailGrid,
        "WORKER",
        assignment.worker_name ||
            "Unassigned"
    );

    addDetailField(
        detailGrid,
        "EQUIPMENT",
        assignment.equipment_code ||
            "Unassigned"
    );

    addDetailField(
        detailGrid,
        "EQUIPMENT STATUS",
        formatStatus(
            assignment.equipment_status
        )
    );

    addDetailField(
        detailGrid,
        "PRIORITY",
        String(
            assignment.priority_number
        )
    );

    addDetailField(
        detailGrid,
        "ASSIGNED",
        formatDateTime(
            assignment.assigned_at
        )
    );

    addDetailField(
        detailGrid,
        "ACCEPTED",
        formatDateTime(
            assignment.accepted_at
        )
    );

    addDetailField(
        detailGrid,
        "SAFETY STOP",
        assignment.safety_stop
            ? "YES"
            : "NO"
    );

    detail.appendChild(
        detailGrid
    );

    const routeTitle =
        createTextElement(
            "div",
            "MOVE ROUTE",
            "workforce-assignment-title"
        );

    detail.appendChild(
        routeTitle
    );

    const routeGrid =
        document.createElement(
            "div"
        );

    routeGrid.className =
        "workforce-detail-grid";

    addDetailField(
        routeGrid,
        "PICKUP",
        formatLocation(
            assignment.pickup_zone,
            assignment.pickup_block,
            assignment.pickup_row,
            assignment.pickup_bay,
            assignment.pickup_tier
        )
    );

    addDetailField(
        routeGrid,
        "DELIVERY",
        formatLocation(
            assignment.delivery_zone,
            assignment.delivery_block,
            assignment.delivery_row,
            assignment.delivery_bay,
            assignment.delivery_tier
        )
    );

    detail.appendChild(
        routeGrid
    );

    const holdTitle =
        createTextElement(
            "div",
            "CONTROL FLAGS",
            "workforce-assignment-title"
        );

    detail.appendChild(
        holdTitle
    );

    const holdGrid =
        document.createElement(
            "div"
        );

    holdGrid.className =
        "workforce-detail-grid";

    addDetailField(
        holdGrid,
        "CUSTOMS HOLD",
        assignment.customs_hold
            ? "ACTIVE"
            : "CLEAR"
    );

    addDetailField(
        holdGrid,
        "SECURITY HOLD",
        assignment.security_hold
            ? "ACTIVE"
            : "CLEAR"
    );

    detail.appendChild(
        holdGrid
    );
}


function renderOperationsSummary() {
    const container =
        document.getElementById(
            "assignmentOperations"
        );

    container.replaceChildren();

    const assignments =
        assignmentState.assignments;

    const highestPriority =
        [...assignments]
            .sort(
                (first, second) =>
                    first.priority_number -
                    second.priority_number
            )[0];

    const safetyCount =
        assignments.filter(
            (assignment) =>
                assignment.safety_stop
        ).length;

    const holdCount =
        assignments.filter(
            (assignment) =>
                assignment.customs_hold ||
                assignment.security_hold
        ).length;

    addDetailField(
        container,
        "QUEUE SIZE",
        String(
            assignments.length
        )
    );

    addDetailField(
        container,
        "NEXT PRIORITY",
        highestPriority
            ? `#${highestPriority.assignment_id} • ${highestPriority.container_number}`
            : "—"
    );

    addDetailField(
        container,
        "SAFETY STOPS",
        String(safetyCount)
    );

    addDetailField(
        container,
        "CONTAINER HOLDS",
        String(holdCount)
    );
}


async function loadAssignments() {
    const grid =
        document.getElementById(
            "assignmentGrid"
        );

    try {
        const response =
            await fetchAssignments();

        assignmentState.assignments =
            response.assignments || [];

        const selectedStillExists =
            assignmentState.assignments.some(
                (assignment) =>
                    assignment.assignment_id ===
                    assignmentState
                        .selectedAssignmentId
            );

        if (!selectedStillExists) {
            assignmentState.selectedAssignmentId =
                null;
        }

        updateAssignmentKpis();
        renderAssignments();
        renderOperationsSummary();

        if (
            assignmentState.selectedAssignmentId !==
            null
        ) {
            const selected =
                assignmentState.assignments.find(
                    (assignment) =>
                        assignment.assignment_id ===
                        assignmentState
                            .selectedAssignmentId
                );

            if (selected) {
                selectAssignment(
                    selected
                );
            }
        }
    } catch (error) {
        console.error(
            "Assignment load failed:",
            error
        );

        grid.replaceChildren();

        grid.appendChild(
            createTextElement(
                "div",
                "Unable to load assignment data.",
                "workforce-empty-state"
            )
        );
    }
}


function configureAssignmentControls() {
    document.getElementById(
        "assignmentSearch"
    ).addEventListener(
        "input",
        renderAssignments
    );

    document.getElementById(
        "assignmentStatusFilter"
    ).addEventListener(
        "change",
        renderAssignments
    );

    document.getElementById(
        "assignmentRefreshButton"
    ).addEventListener(
        "click",
        loadAssignments
    );
}


document.addEventListener(
    "DOMContentLoaded",
    () => {
        configureAssignmentControls();
        loadAssignments();
    }
);
