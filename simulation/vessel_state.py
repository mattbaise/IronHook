from copy import deepcopy


INITIAL_VESSEL_STATE = {
    "vessel": {
        "name": "IRONHOOK HORIZON",
        "berth": "02",
        "operation": "DISCHARGE",
        "total_containers": 2450,
        "discharged": 1257,
        "remaining": 1193,
        "progress_percent": 51.3,
    },

    "cranes": {
        "QC-01": {"bay": "04", "moves": 0, "status": "WORKING"},
        "QC-02": {"bay": "08", "moves": 0, "status": "WORKING"},
        "QC-03": {"bay": "12", "moves": 0, "status": "WORKING"},
        "QC-04": {"bay": "16", "moves": 0, "status": "WORKING"},
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
        },
        "IH-C-1848": {
            "status": "ON_VESSEL",
            "bay": "04",
            "row": "07",
            "tier": "03",
            "crane": "QC-01",
            "truck": None,
            "destination": "Block A / Row 03 / Slot 09",
        },
        "IH-C-1849": {
            "status": "ON_VESSEL",
            "bay": "12",
            "row": "02",
            "tier": "04",
            "crane": "QC-03",
            "truck": None,
            "destination": "Block D / Row 11 / Slot 06",
        },
        "IH-C-1850": {
            "status": "ON_VESSEL",
            "bay": "16",
            "row": "05",
            "tier": "02",
            "crane": "QC-04",
            "truck": None,
            "destination": "Block B / Row 06 / Slot 12",
        },
        "IH-C-1851": {
            "status": "ON_VESSEL",
            "bay": "04",
            "row": "09",
            "tier": "04",
            "crane": "QC-01",
            "truck": None,
            "destination": "Block A / Row 05 / Slot 18",
        },
        "IH-C-1852": {
            "status": "ON_VESSEL",
            "bay": "08",
            "row": "04",
            "tier": "06",
            "crane": "QC-02",
            "truck": None,
            "destination": "Block C / Row 10 / Slot 03",
        },
        "IH-C-1853": {
            "status": "ON_VESSEL",
            "bay": "12",
            "row": "08",
            "tier": "03",
            "crane": "QC-03",
            "truck": None,
            "destination": "Block D / Row 04 / Slot 11",
        },
        "IH-C-1854": {
            "status": "ON_VESSEL",
            "bay": "16",
            "row": "11",
            "tier": "05",
            "crane": "QC-04",
            "truck": None,
            "destination": "Block B / Row 09 / Slot 07",
        },
        "IH-C-1855": {
            "status": "ON_VESSEL",
            "bay": "04",
            "row": "03",
            "tier": "02",
            "crane": "QC-01",
            "truck": None,
            "destination": "Block A / Row 08 / Slot 04",
        },
        "IH-C-1856": {
            "status": "ON_VESSEL",
            "bay": "08",
            "row": "10",
            "tier": "03",
            "crane": "QC-02",
            "truck": None,
            "destination": "Block C / Row 02 / Slot 16",
        },
        "IH-C-1857": {
            "status": "ON_VESSEL",
            "bay": "12",
            "row": "06",
            "tier": "05",
            "crane": "QC-03",
            "truck": None,
            "destination": "Block D / Row 07 / Slot 02",
        },
        "IH-C-1858": {
            "status": "ON_VESSEL",
            "bay": "16",
            "row": "01",
            "tier": "04",
            "crane": "QC-04",
            "truck": None,
            "destination": "Block B / Row 12 / Slot 10",
        },
    },

    "trucks": {
        "TT-17": {
            "driver": "DEMO-W042",
            "status": "AVAILABLE",
            "container": None,
        },
        "TT-09": {
            "driver": "DEMO-W018",
            "status": "AVAILABLE",
            "container": None,
        },
        "TT-22": {
            "driver": "DEMO-W067",
            "status": "AVAILABLE",
            "container": None,
        },
        "TT-31": {
            "driver": "DEMO-W103",
            "status": "AVAILABLE",
            "container": None,
        },
        "TT-12": {
            "driver": "DEMO-W055",
            "status": "AVAILABLE",
            "container": None,
        },
        "TT-26": {
            "driver": "DEMO-W081",
            "status": "AVAILABLE",
            "container": None,
        },
    },

    "events": [],
}


def create_initial_state():
    return deepcopy(INITIAL_VESSEL_STATE)
