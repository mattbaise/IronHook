const form = document.getElementById(
    "credentialScanForm"
);

const resultPanel = document.getElementById(
    "resultPanel"
);

const resultIndicator = document.getElementById(
    "resultIndicator"
);

const resultLabel = document.getElementById(
    "resultLabel"
);

const resultReason = document.getElementById(
    "resultReason"
);

const workerDetails = document.getElementById(
    "workerDetails"
);

const auditDetails = document.getElementById(
    "auditDetails"
);

const credentialPayload = document.getElementById(
    "credentialPayload"
);

const cameraVideo = document.getElementById(
    "credentialCamera"
);

const startCameraButton = document.getElementById(
    "startCameraButton"
);

const stopCameraButton = document.getElementById(
    "stopCameraButton"
);

const cameraStatus = document.getElementById(
    "cameraStatus"
);

const cameraPlaceholder = document.getElementById(
    "cameraPlaceholder"
);

let cameraStream = null;
let barcodeDetector = null;
let scanLoopActive = false;
let scanInProgress = false;


function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent =
            value ?? "—";
    }
}


function resetResult() {
    resultPanel.className =
        "panel result-panel idle";

    resultIndicator.textContent = "…";
    resultLabel.textContent =
        "VERIFYING";

    resultReason.textContent =
        "Checking credential status...";

    workerDetails.classList.add(
        "hidden"
    );

    auditDetails.classList.add(
        "hidden"
    );
}


function displayResult(data) {
    const granted =
        data.scan_result === "GRANTED";

    resultPanel.className =
        `panel result-panel ${
            granted
                ? "granted"
                : "denied"
        }`;

    resultIndicator.textContent =
        granted ? "✓" : "×";

    resultLabel.textContent =
        granted
            ? "ACCESS GRANTED"
            : "ACCESS DENIED";

    resultReason.textContent =
        granted
            ? "Credential verified successfully."
            : (
                data.denial_reason
                || "Credential was not authorized."
            );

    if (data.credential) {
        setText(
            "workerName",
            data.credential.worker_name
        );

        setText(
            "employeeNumber",
            data.credential.employee_number
        );

        setText(
            "credentialCode",
            data.credential.credential_code
        );

        setText(
            "jobClassification",
            data.credential.job_classification
        );

        workerDetails.classList.remove(
            "hidden"
        );
    }

    if (data.scan_event_id) {
        setText(
            "scanEventId",
            data.scan_event_id
        );

        const timestamp =
            data.scanned_at
                ? new Date(
                    data.scanned_at
                ).toLocaleString()
                : "—";

        setText(
            "scanTimestamp",
            timestamp
        );

        auditDetails.classList.remove(
            "hidden"
        );
    }
}


function displayError(message) {
    resultPanel.className =
        "panel result-panel denied";

    resultIndicator.textContent = "!";

    resultLabel.textContent =
        "SCAN ERROR";

    resultReason.textContent =
        message;

    workerDetails.classList.add(
        "hidden"
    );

    auditDetails.classList.add(
        "hidden"
    );
}


async function verifyCredential(payload) {
    if (!payload) {
        displayError(
            "Credential payload is required."
        );

        return;
    }

    resetResult();

    const scanType =
        document
            .getElementById(
                "scanType"
            )
            .value;

    const terminalValue =
        document
            .getElementById(
                "terminalId"
            )
            .value;

    const deviceCode =
        document
            .getElementById(
                "deviceCode"
            )
            .value
            .trim();

    const locationLabel =
        document
            .getElementById(
                "locationLabel"
            )
            .value
            .trim();

    const requestBody = {
        payload,
        scan_type: scanType,
        device_code:
            deviceCode || null,
        location_label:
            locationLabel || null,
    };

    if (terminalValue) {
        requestBody.terminal_id =
            Number(terminalValue);
    }

    if (scanType === "EQUIPMENT_ASSIGNMENT") {
        const equipmentValue =
            document
                .getElementById(
                    "equipmentId"
                )
                ?.value;

        if (!equipmentValue) {
            displayError(
                "Select equipment before scanning."
            );

            return;
        }

        requestBody.equipment_id =
            Number(equipmentValue);
    }

    try {
        const response = await fetch(
            "/api/credentials/scan",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json",
                },
                body: JSON.stringify(
                    requestBody
                ),
            }
        );

        const data =
            await response.json();

        if (
            response.ok
            || data.scan_result
        ) {
            displayResult(data);
            return;
        }

        displayError(
            data.error
            || "Credential scan failed."
        );
    } catch (error) {
        console.error(
            "Credential scan failed:",
            error
        );

        displayError(
            "Unable to reach the credential service."
        );
    }
}


async function stopCamera() {
    scanLoopActive = false;

    if (cameraStream) {
        for (
            const track
            of cameraStream.getTracks()
        ) {
            track.stop();
        }
    }

    cameraStream = null;

    cameraVideo.srcObject = null;

    cameraPlaceholder.classList.remove(
        "hidden"
    );

    startCameraButton.classList.remove(
        "hidden"
    );

    stopCameraButton.classList.add(
        "hidden"
    );

    cameraStatus.textContent =
        "Camera inactive";
}


async function scanCameraFrame() {
    if (
        !scanLoopActive
        || !barcodeDetector
        || !cameraStream
    ) {
        return;
    }

    if (
        cameraVideo.readyState >= 2
        && !scanInProgress
    ) {
        try {
            const codes =
                await barcodeDetector.detect(
                    cameraVideo
                );

            if (codes.length > 0) {
                const payload =
                    codes[0].rawValue;

                if (
                    payload
                    && payload.startsWith(
                        "IRONHOOK:CREDENTIAL:"
                    )
                ) {
                    scanInProgress = true;

                    credentialPayload.value =
                        payload;

                    cameraStatus.textContent =
                        "Credential detected";

                    await stopCamera();

                    await verifyCredential(
                        payload
                    );

                    scanInProgress = false;

                    return;
                }
            }
        } catch (error) {
            console.error(
                "QR detection failed:",
                error
            );
        }
    }

    if (scanLoopActive) {
        requestAnimationFrame(
            scanCameraFrame
        );
    }
}


async function startCamera() {
    if (
        !("BarcodeDetector" in window)
    ) {
        displayError(
            "This browser does not support built-in QR scanning. Use manual credential entry for now."
        );

        cameraStatus.textContent =
            "QR scanner unsupported";

        return;
    }

    try {
        barcodeDetector =
            new BarcodeDetector(
                {
                    formats: [
                        "qr_code",
                    ],
                }
            );

        cameraStream =
            await navigator.mediaDevices
                .getUserMedia(
                    {
                        video: {
                            facingMode:
                                {
                                    ideal:
                                        "environment",
                                },
                        },
                        audio: false,
                    }
                );

        cameraVideo.srcObject =
            cameraStream;

        await cameraVideo.play();

        cameraPlaceholder.classList.add(
            "hidden"
        );

        startCameraButton.classList.add(
            "hidden"
        );

        stopCameraButton.classList.remove(
            "hidden"
        );

        cameraStatus.textContent =
            "Scanning for IronHook credential...";

        scanLoopActive = true;

        requestAnimationFrame(
            scanCameraFrame
        );
    } catch (error) {
        console.error(
            "Camera start failed:",
            error
        );

        cameraStatus.textContent =
            "Camera unavailable";

        displayError(
            "Unable to access the camera. Check browser camera permissions."
        );

        await stopCamera();
    }
}


form.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        const payload =
            credentialPayload
                .value
                .trim();

        await verifyCredential(
            payload
        );
    }
);


startCameraButton.addEventListener(
    "click",
    startCamera
);


stopCameraButton.addEventListener(
    "click",
    stopCamera
);


window.addEventListener(
    "beforeunload",
    stopCamera
);


async function loadEquipmentOptions() {
    const equipmentSelect =
        document.getElementById("equipmentId");

    if (!equipmentSelect) {
        return;
    }

    try {
        const response =
            await fetch("/api/equipment");

        if (!response.ok) {
            throw new Error(
                "Failed to load equipment"
            );
        }

        const data = await response.json();

        equipmentSelect.innerHTML = `
            <option value="">
                Select equipment
            </option>
            ${data.equipment.map(
                (equipment) => `
                    <option
                        value="${equipment.equipment_id}"
                    >
                        ${equipment.equipment_code}
                        — ${equipment.equipment_type}
                        (${equipment.operating_status})
                    </option>
                `
            ).join("")}
        `;
    } catch (error) {
        console.error(
            "Equipment load failed:",
            error
        );

        equipmentSelect.innerHTML = `
            <option value="">
                Equipment unavailable
            </option>
        `;
    }
}


function updateEquipmentField() {
    const scanType =
        document.getElementById("scanType");

    const equipmentField =
        document.getElementById("equipmentField");

    if (!scanType || !equipmentField) {
        return;
    }

    equipmentField.classList.toggle(
        "hidden",
        scanType.value !==
            "EQUIPMENT_ASSIGNMENT"
    );
}


document
    .getElementById("scanType")
    ?.addEventListener(
        "change",
        updateEquipmentField
    );

loadEquipmentOptions();
updateEquipmentField();
