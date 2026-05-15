const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const scriptDir = path.basename(__dirname) === "scripts" ? __dirname : path.join(process.cwd(), "scripts");
const root = path.resolve(scriptDir, "..");
const port = Number(process.env.PORT || 4173);
const certDir = path.join(root, ".cert");
const certPath = path.join(certDir, "localhost-cert.pem");
const keyPath = path.join(certDir, "localhost-key.pem");
const perenualBaseUrl = "https://perenual.com/api/v2";
const plantCache = new Map();
const plantCacheTtl = 15 * 60 * 1000;
const fallbackPlants = sortPlantsAlphabetically([
  {
    id: "fallback-arugula",
    common_name: "Arugula",
    scientific_name: ["Eruca vesicaria"],
    other_name: ["Rocket"],
    cycle: "Annual",
    watering: "Average",
    sunlight: ["Full sun", "Part shade"],
    genus: "Eruca"
  },
  {
    id: "fallback-basil",
    common_name: "Basil",
    scientific_name: ["Ocimum basilicum"],
    other_name: ["Sweet basil"],
    cycle: "Annual",
    watering: "Average",
    sunlight: ["Full sun"],
    genus: "Ocimum"
  },
  {
    id: "fallback-carrot",
    common_name: "Carrot",
    scientific_name: ["Daucus carota"],
    other_name: [],
    cycle: "Biennial",
    watering: "Average",
    sunlight: ["Full sun"],
    genus: "Daucus"
  },
  {
    id: "fallback-kale",
    common_name: "Kale",
    scientific_name: ["Brassica oleracea"],
    other_name: [],
    cycle: "Biennial",
    watering: "Average",
    sunlight: ["Full sun", "Part shade"],
    genus: "Brassica"
  },
  {
    id: "fallback-lettuce",
    common_name: "Lettuce",
    scientific_name: ["Lactuca sativa"],
    other_name: [],
    cycle: "Annual",
    watering: "Frequent",
    sunlight: ["Full sun", "Part shade"],
    genus: "Lactuca"
  },
  {
    id: "fallback-radish",
    common_name: "Radish",
    scientific_name: ["Raphanus sativus"],
    other_name: [],
    cycle: "Annual",
    watering: "Average",
    sunlight: ["Full sun"],
    genus: "Raphanus"
  },
  {
    id: "fallback-tomato",
    common_name: "Tomato",
    scientific_name: ["Solanum lycopersicum"],
    other_name: [],
    cycle: "Annual",
    watering: "Average",
    sunlight: ["Full sun"],
    genus: "Solanum"
  }
]);

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function loadEnv() {
  const envPath = path.join(root, ".env.local");

  if (!fs.existsSync(envPath)) {
    return;
  }

  fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        return;
      }

      const [key, ...valueParts] = trimmed.split("=");
      process.env[key.trim()] ||= valueParts.join("=").trim();
    });
}

function ensureCertificate() {
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return;
  }

  const result = spawnSync("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(scriptDir, "generate-dev-cert.ps1")
  ], {
    cwd: root,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error("Unable to create a local HTTPS certificate.");
  }
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const requested = decoded === "/" ? "/index.html" : decoded;
  const resolved = path.normalize(path.join(root, requested));

  if (!resolved.startsWith(root)) {
    return null;
  }

  return resolved;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function plantName(plant) {
  return (plant.common_name || plant.scientific_name?.[0] || "").trim();
}

function sortPlantsAlphabetically(plants) {
  return plants.sort((a, b) => {
    return plantName(a).localeCompare(plantName(b), undefined, {
      sensitivity: "base"
    });
  });
}

function fallbackPlantPage({ page, query, detail }) {
  const normalized = query.toLowerCase();
  const filteredPlants = normalized
    ? fallbackPlants.filter((plant) => {
        return [
          plant.common_name,
          plant.scientific_name?.join(" "),
          plant.other_name?.join(" "),
          plant.genus
        ].filter(Boolean).join(" ").toLowerCase().includes(normalized);
      })
    : fallbackPlants;
  const perPage = 30;
  const lastPage = Math.max(1, Math.ceil(filteredPlants.length / perPage));
  const currentPage = Math.min(page, lastPage);
  const start = (currentPage - 1) * perPage;
  const data = filteredPlants.slice(start, start + perPage).map((plant) => {
    return { ...plant, source: "fallback" };
  });

  return {
    data,
    current_page: currentPage,
    from: filteredPlants.length ? start + 1 : null,
    last_page: lastPage,
    per_page: perPage,
    to: filteredPlants.length ? start + data.length : null,
    total: filteredPlants.length,
    sort: "fallback",
    source: "fallback",
    warning: "Perenual plant data is temporarily unavailable, so starter examples are shown.",
    detail
  };
}

async function fetchPerenualPage({ apiKey, page, query }) {
  const upstreamUrl = new URL(`${perenualBaseUrl}/species-list`);
  upstreamUrl.searchParams.set("key", apiKey);
  upstreamUrl.searchParams.set("edible", "1");
  upstreamUrl.searchParams.set("page", String(page));

  if (query) {
    upstreamUrl.searchParams.set("q", query);
  }

  const upstreamResponse = await fetch(upstreamUrl);
  const body = await upstreamResponse.text();
  const contentType = upstreamResponse.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(`Perenual returned ${upstreamResponse.status} with a non-JSON response.`);
  }

  if (!upstreamResponse.ok) {
    throw new Error(`Perenual returned ${upstreamResponse.status}.`);
  }

  return JSON.parse(body);
}

async function fetchSortedPlantCatalog(apiKey, query) {
  const cacheKey = query || "__all_edible_plants__";
  const cached = plantCache.get(cacheKey);

  if (cached && Date.now() - cached.createdAt < plantCacheTtl && cached.catalog) {
    return cached.catalog;
  }

  const promise = (async () => {
    const firstPage = await fetchPerenualPage({ apiKey, page: 1, query });
    const lastPage = Number(firstPage.last_page || 1);
    const pages = [firstPage];

    for (let page = 2; page <= lastPage; page += 1) {
      pages.push(await fetchPerenualPage({ apiKey, page, query }));
    }

    const plants = sortPlantsAlphabetically(pages.flatMap((page) => {
      return Array.isArray(page.data) ? page.data : [];
    }));

    return {
      plants,
      perPage: Number(firstPage.per_page || firstPage.data?.length || 30)
    };
  })().catch((error) => {
    plantCache.delete(cacheKey);
    throw error;
  });

  const entry = {
    catalog: null,
    createdAt: Date.now(),
    promise
  };

  plantCache.set(cacheKey, entry);
  promise.then((catalog) => {
    entry.catalog = catalog;
    entry.createdAt = Date.now();
  }).catch(() => {});

  return promise;
}

function startPlantCatalogBuild(apiKey, query) {
  const cacheKey = query || "__all_edible_plants__";
  const cached = plantCache.get(cacheKey);

  if (cached && Date.now() - cached.createdAt < plantCacheTtl) {
    return cached;
  }

  fetchSortedPlantCatalog(apiKey, query).catch(() => {});
  return plantCache.get(cacheKey);
}

async function fetchFastPlantPage({ apiKey, page, query }) {
  const payload = await fetchPerenualPage({ apiKey, page, query });
  const data = sortPlantsAlphabetically(Array.isArray(payload.data) ? payload.data : []);

  return {
    data,
    current_page: Number(payload.current_page || page),
    from: payload.from || null,
    last_page: Number(payload.last_page || 1),
    per_page: Number(payload.per_page || data.length || 30),
    to: payload.to || null,
    total: Number(payload.total || data.length),
    sort: "catalog-building"
  };
}

async function handlePlantApi(request, response) {
  const apiKey = process.env.PERENUAL_API_KEY;

  if (!apiKey) {
    sendJson(response, 500, {
      error: "Missing PERENUAL_API_KEY. Add it to .env.local."
    });
    return;
  }

  const requestUrl = new URL(request.url || "/", `https://localhost:${port}`);
  const requestedPage = Math.max(1, Number(requestUrl.searchParams.get("page") || "1"));
  const query = requestUrl.searchParams.get("q")?.trim() || "";

  try {
    const build = startPlantCatalogBuild(apiKey, query);

    if (build?.catalog) {
      const catalog = build.catalog;
      const total = catalog.plants.length;
      const lastPage = Math.max(1, Math.ceil(total / catalog.perPage));
      const currentPage = Math.min(requestedPage, lastPage);
      const start = (currentPage - 1) * catalog.perPage;
      const data = catalog.plants.slice(start, start + catalog.perPage);

      sendJson(response, 200, {
        data,
        current_page: currentPage,
        from: total ? start + 1 : null,
        last_page: lastPage,
        per_page: catalog.perPage,
        to: total ? start + data.length : null,
        total,
        sort: "alphabetical"
      });
      return;
    }

    sendJson(response, 200, await fetchFastPlantPage({
      apiKey,
      page: requestedPage,
      query
    }));
  } catch (error) {
    sendJson(response, 200, fallbackPlantPage({
      page: requestedPage,
      query,
      detail: error.message
    }));
  }
}

loadEnv();
ensureCertificate();

const server = https.createServer({
  cert: fs.readFileSync(certPath),
  key: fs.readFileSync(keyPath)
}, async (request, response) => {
  if (request.url?.startsWith("/api/plants")) {
    await handlePlantApi(request, response);
    return;
  }

  const filePath = safePath(request.url || "/");

  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "content-type": types[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(content);
  });
});

server.listen(port, () => {
  console.log(`Urban Farm Hand is running at https://localhost:${port}`);
});
