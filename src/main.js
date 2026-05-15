import { services } from "./services/index.js";
import { createRouter } from "./shared/router.js";
import { storage } from "./shared/storage.js";

const app = document.querySelector("#app");
const nav = document.querySelector("#service-nav");

const context = {
  storage,
  navigate: (serviceId) => {
    window.location.hash = serviceId;
  }
};

function renderNav(activeServiceId) {
  nav.innerHTML = "";

  services.forEach((service) => {
    const link = document.createElement("a");
    link.href = `#${service.id}`;
    link.textContent = service.navLabel || service.label;
    link.className = service.id === activeServiceId ? "active" : "";
    link.setAttribute("aria-current", service.id === activeServiceId ? "page" : "false");
    nav.append(link);
  });
}

function renderService(service) {
  document.title = `${service.label} | Urban Farm Hand`;
  app.innerHTML = "";
  app.append(service.render(context));
  app.focus({ preventScroll: true });
  renderNav(service.id);
}

createRouter({
  services,
  fallbackServiceId: "plants",
  onRouteChange: renderService
}).start();
