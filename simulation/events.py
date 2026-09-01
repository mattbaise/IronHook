from datetime import datetime


def discharge_container(state, container_id, truck_id):
    container = state["containers"][container_id]
    crane_id = container["crane"]
    truck = state["trucks"][truck_id]

    if container["status"] != "ON_VESSEL":
        raise ValueError(
            f"{container_id} cannot be discharged from status "
            f"{container['status']}"
        )

    if truck["status"] != "AVAILABLE":
        raise ValueError(
            f"{truck_id} is not available"
        )

    container["status"] = "ON_TRUCK"
    container["truck"] = truck_id

    truck["status"] = "ASSIGNED"
    truck["container"] = container_id

    state["vessel"]["discharged"] += 1
    state["vessel"]["remaining"] -= 1

    total = state["vessel"]["total_containers"]
    discharged = state["vessel"]["discharged"]

    state["vessel"]["progress_percent"] = round(
        discharged / total * 100,
        1,
    )

    state["cranes"][crane_id]["moves"] += 1

    state["events"].append(
        {
            "type": "CONTAINER_DISCHARGED",
            "timestamp": datetime.now().isoformat(
                timespec="seconds"
            ),
            "container_id": container_id,
            "crane_id": crane_id,
            "truck_id": truck_id,
            "destination": container["destination"],
        }
    )

    return state


def start_truck_transit(state, container_id):
    container = state["containers"][container_id]

    if container["status"] != "ON_TRUCK":
        raise ValueError(
            f"{container_id} cannot enter transit from status "
            f"{container['status']}"
        )

    truck_id = container["truck"]
    truck = state["trucks"][truck_id]

    container["status"] = "IN_TRANSIT"
    truck["status"] = "IN_TRANSIT"

    state["events"].append(
        {
            "type": "CONTAINER_IN_TRANSIT",
            "timestamp": datetime.now().isoformat(
                timespec="seconds"
            ),
            "container_id": container_id,
            "truck_id": truck_id,
            "destination": container["destination"],
        }
    )

    return state


def place_container_in_yard(state, container_id):
    container = state["containers"][container_id]

    if container["status"] != "IN_TRANSIT":
        raise ValueError(
            f"{container_id} cannot enter yard from status "
            f"{container['status']}"
        )

    truck_id = container["truck"]
    truck = state["trucks"][truck_id]

    container["status"] = "IN_YARD"

    truck["status"] = "AVAILABLE"
    truck["container"] = None

    state["events"].append(
        {
            "type": "CONTAINER_PLACED_IN_YARD",
            "timestamp": datetime.now().isoformat(
                timespec="seconds"
            ),
            "container_id": container_id,
            "truck_id": truck_id,
            "destination": container["destination"],
        }
    )

    return state
