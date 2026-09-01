from copy import deepcopy


INITIAL_VESSEL_STATE = {
    "vessel": {
        "name": "IRONHOOK HORIZON",
        "berth": "02",
        "operation": "DISCHARGE",
        "total_containers": 2450,
        "discharged": 1257,
        "remaining": 1193,
        "progress_percent": 51,
    },
    "cranes": {
        "QC-01": {
            "bay": "04",
            "moves": 0,
            "status": "WORKING",
        },
        "QC-02": {
            "bay": "08",
            "moves": 0,
            "status": "WORKING",
        },
        "QC-03": {
            "bay": "12",
            "moves": 0,
            "status": "WORKING",
        },
        "QC-04": {
            "bay": "16",
            "moves": 0,
            "status": "WORKING",
        },
    },
    "containers": {
        "IH-C-1847": {
            "status": "ON_VESSEL",
            "bay": "08",
            "row": "12",
            "tier": "05",
            "crane": "QC-02",
            "truck": None,
            "destination": "Block C / Row 08 / Slot 14",
        }
    },
    "trucks": {
        "TT-17": {
            "driver": "DEMO-W042",
            "status": "AVAILABLE",
            "container": None,
        }
    },
    "events": [],
}


def create_initial_state():
    return deepcopy(INITIAL_VESSEL_STATE)
