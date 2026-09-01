const startButton = document.getElementById("startSimulation");

if (startButton) {
    startButton.addEventListener("click", () => {
        startButton.textContent = "● Simulation Running";
        startButton.disabled = true;
    });
}
