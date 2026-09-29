let equipmentState = [];
let selectedEquipmentId = null;

async function fetchEquipment() {
    const response = await fetch("/api/equipment");

    if (!response.ok) {
        throw new Error("Failed to load equipment");
    }

    return response.json();
}

function formatEquipmentType(type) {
    const labels = {
        STS_CRANE: "STS Crane",
        RTG: "RTG",
        TOP_PICK: "Top Pick",
        CHASSIS: "Chassis",
        YARD_TRUCK: "Yard Truck",
    };

    return labels[type] || type;
}

function formatEquipmentStatus(status) {
    return status
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(
            /\b\w/g,
            (letter) => letter.toUpperCase()
        );
}

function isUnavailable(status) {
    return [
        "DOWN",
        "MAINTENANCE",
        "RESTRICTED",
    ].includes(status);
}

function updateEquipmentKpis(equipment) {
    const ready = equipment.filter(
        (item) => item.operating_status === "READY"
    ).length;

    const assigned = equipment.filter(
        (item) => item.operating_status === "ASSIGNED"
    ).length;

    const unavailable = equipment.filter(
        (item) => isUnavailable(item.operating_status)
    ).length;

    document.getElementById(
        "equipmentTotalCount"
    ).textContent = equipment.length;

    document.getElementById(
        "equipmentReadyCount"
    ).textContent = ready;

    document.getElementById(
        "equipmentAssignedCount"
    ).textContent = assigned;

    document.getElementById(
        "equipmentUnavailableCount"
    ).textContent = unavailable;
}

function getFilteredEquipment(equipment) {
    const search = document.getElementById(
        "equipmentSearch"
    ).value.trim().toUpperCase();

    const type = document.getElementById(
        "equipmentTypeFilter"
    ).value;

    const status = document.getElementById(
        "equipmentStatusFilter"
    ).value;

    return equipment.filter((item) => {
        const matchesSearch =
            !search ||
            item.equipment_code.includes(search);

        const matchesType =
            type === "ALL" ||
            item.equipment_type === type;

        const matchesStatus =
            status === "ALL" ||
            item.operating_status === status;

        return (
            matchesSearch &&
            matchesType &&
            matchesStatus
        );
    });
}

function renderEquipmentCards(equipment) {
    const grid = document.getElementById(
        "equipmentGrid"
    );

    const filtered =
        getFilteredEquipment(equipment);

    grid.innerHTML = "";

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="equipment-empty-state">
                No equipment matches the current filters.
            </div>
        `;

        return;
    }

    filtered.forEach((item) => {
        const card =
            document.createElement("button");

        card.className =
            `equipment-card status-${item.operating_status.toLowerCase()}`;

        if (
            item.equipment_id ===
            selectedEquipmentId
        ) {
            card.classList.add("selected");
        }

        card.innerHTML = `
            <div class="equipment-card-header">
                <div>
                    <span>
                        ${formatEquipmentType(
                            item.equipment_type
                        )}
                    </span>

                    <strong>
                        ${item.equipment_code}
                    </strong>
                </div>

                <span
                    class="
                        equipment-status-pill
                        status-${item.operating_status.toLowerCase()}
                    "
                >
                    ${formatEquipmentStatus(
                        item.operating_status
                    )}
                </span>
            </div>

            <div class="equipment-card-metrics">

                <div>
                    <span>OPERATING HOURS</span>

                    <strong>
                        ${Number(
                            item.total_operating_hours
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
                            item.total_mileage
                        ).toLocaleString(
                            undefined,
                            {
                                maximumFractionDigits: 1,
                            }
                        )}
                    </strong>
                </div>

            </div>
        `;

        card.addEventListener(
            "click",
            () => selectEquipment(
                item,
                equipment
            )
        );

        grid.appendChild(card);
    });
}

function selectEquipment(
    item,
    equipment
) {
    selectedEquipmentId =
        item.equipment_id;

    renderEquipmentCards(equipment);

    const detail = document.getElementById(
        "equipmentDetail"
    );

    const unavailable =
        isUnavailable(item.operating_status);

    const clearanceText =
        unavailable
            ? "NOT CLEARED FOR NORMAL SERVICE"
            : "CLEARED FOR NORMAL SERVICE";

    detail.className = "";

    detail.innerHTML = `
        <div class="equipment-detail-header">

            <div>
                <span>ASSET</span>

                <strong>
                    ${item.equipment_code}
                </strong>

                <small>
                    ${formatEquipmentType(
                        item.equipment_type
                    )}
                </small>
            </div>

            <span
                class="
                    equipment-status-pill
                    status-${item.operating_status.toLowerCase()}
                "
            >
                ${formatEquipmentStatus(
                    item.operating_status
                )}
            </span>

        </div>

        <div class="equipment-clearance
            ${unavailable ? "blocked" : "cleared"}"
        >
            <span>
                ${unavailable ? "!" : "✓"}
            </span>

            <div>
                <strong>
                    ${clearanceText}
                </strong>

                <small>
                    ${
                        unavailable
                            ? "This asset cannot begin a normal assignment in its current state."
                            : "This asset is available for normal terminal operations."
                    }
                </small>
            </div>
        </div>

        <div class="equipment-detail-grid">

            <div>
                <span>EQUIPMENT TYPE</span>

                <strong>
                    ${formatEquipmentType(
                        item.equipment_type
                    )}
                </strong>
            </div>

            <div>
                <span>OPERATING STATUS</span>

                <strong>
                    ${formatEquipmentStatus(
                        item.operating_status
                    )}
                </strong>
            </div>

            <div>
                <span>TOTAL HOURS</span>

                <strong>
                    ${Number(
                        item.total_operating_hours
                    ).toLocaleString(
                        undefined,
                        {
                            maximumFractionDigits: 1,
                        }
                    )}
                </strong>
            </div>

            <div>
                <span>TOTAL MILEAGE</span>

                <strong>
                    ${Number(
                        item.total_mileage
                    ).toLocaleString(
                        undefined,
                        {
                            maximumFractionDigits: 1,
                        }
                    )}
                </strong>
            </div>

        </div>
    `;
}

function configureEquipmentFilters() {
    const search = document.getElementById(
        "equipmentSearch"
    );

    const type = document.getElementById(
        "equipmentTypeFilter"
    );

    const status = document.getElementById(
        "equipmentStatusFilter"
    );

    [
        search,
        type,
        status,
    ].forEach((control) => {
        control.addEventListener(
            control.tagName === "INPUT"
                ? "input"
                : "change",
            () => renderEquipmentCards(
                equipmentState
            )
        );
    });
}

async function loadEquipmentPage() {
    try {
        const response = await fetchEquipment();

        equipmentState =
            response.equipment;

        updateEquipmentKpis(
            equipmentState
        );

        renderEquipmentCards(
            equipmentState
        );

        configureEquipmentFilters();
    } catch (error) {
        console.error(error);
    }
}

document.addEventListener(
    "DOMContentLoaded",
    loadEquipmentPage
);
