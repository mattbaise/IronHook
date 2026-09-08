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


form.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        resetResult();

        const payload =
            document
                .getElementById(
                    "credentialPayload"
                )
                .value
                .trim();

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
);
