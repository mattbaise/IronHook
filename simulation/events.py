from datetime import datetime


def _timestamp():
    return datetime.now().isoformat(timespec="seconds")


def get_next_container(state):
    for container_id, container in state["containers"].items():
        if container["status"] == "ON_VESSEL":
            return container_id

    return None


def get_available_truck(state):
    for truck_id, truck in state["trucks"].items():
        if truck["status"] == "AVAILABLE":
            return truck_id

    return None


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
            "timestamp": _timestamp(),
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
            "timestamp": _timestamp(),
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
            "timestamp": _timestamp(),
            "container_id": container_id,
            "truck_id": truck_id,
            "destination": container["destination"],
        }
    )

    return state


def advance_simulation(state):
    actions = []

    # 1. Containers already traveling reach the yard.
    in_transit = [
        container_id
        for container_id, container in state["containers"].items()
        if container["status"] == "IN_TRANSIT"
    ]

    for container_id in in_transit:
        place_container_in_yard(
            state,
            container_id,
        )

        actions.append(
            {
                "action": "PLACED_IN_YARD",
                "container_id": container_id,
            }
        )

    # 2. Containers already on trucks leave the vessel apron.
    on_truck = [
        container_id
        for container_id, container in state["containers"].items()
        if container["status"] == "ON_TRUCK"
    ]

    for container_id in on_truck:
        start_truck_transit(
            state,
            container_id,
        )

        actions.append(
            {
                "action": "STARTED_TRANSIT",
                "container_id": container_id,
            }
        )

    # 3. Each crane may discharge one new container this tick.
    for crane_id in state["cranes"]:
        container_id = None

        for candidate_id, container in state["containers"].items():
            if (
                container["status"] == "ON_VESSEL"
                and container["crane"] == crane_id
            ):
                container_id = candidate_id
                break

        if container_id is None:
            continue

        truck_id = get_available_truck(state)

        if truck_id is None:
            break

        discharge_container(
            state,
            container_id,
            truck_id,
        )

        actions.append(
            {
                "action": "DISCHARGED",
                "container_id": container_id,
                "truck_id": truck_id,
                "crane_id": crane_id,
            }
        )

    if not actions:
        return {
            "action": "IDLE",
            "actions": [],
        }

    return {
        "action": "TICK",
        "actions": actions,
    }
