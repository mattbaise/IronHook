const demoDestinations = {
  "overview": "/",
  "vessel operations": "/demo",
  "yard map": "/demo/yard",
  "containers": "/demo/containers",
  "equipment": "/demo/equipment",
  "trucks": "/demo/trucks",
  "workforce": "/demo/workforce",
  "assignments": "/demo/assignments",
  "gate activity": "/demo/credential-scan",
  "alerts": "/security",
  "analytics": "/command-center",
};

document.querySelectorAll(".sidebar-nav .nav-item").forEach((link) => {
  const label = link.textContent.trim().replace(/^[^A-Za-z]+/, "").trim().toLowerCase();
  const destination = demoDestinations[label];
  if (destination) link.href = destination;
  link.classList.toggle("active", destination === window.location.pathname);
});

const brand = document.querySelector(".sidebar .brand");
if (brand) {
  brand.tabIndex = 0;
  brand.setAttribute("role", "link");
  brand.setAttribute("aria-label", "Go to IronHook home");
  brand.addEventListener("click", () => window.location.assign("/"));
  brand.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") window.location.assign("/");
  });
}
