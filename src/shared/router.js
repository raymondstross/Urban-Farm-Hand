export function createRouter({ services, fallbackServiceId, onRouteChange }) {
  const serviceMap = new Map(services.map((service) => [service.id, service]));

  function resolveService() {
    const hash = window.location.hash.replace("#", "");
    return serviceMap.get(hash) || serviceMap.get(fallbackServiceId) || services[0];
  }

  function route() {
    const service = resolveService();

    if (window.location.hash.replace("#", "") !== service.id) {
      window.history.replaceState(null, "", `#${service.id}`);
    }

    onRouteChange(service);
  }

  return {
    start() {
      window.addEventListener("hashchange", route);
      route();
    }
  };
}
