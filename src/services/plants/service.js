import { el, emptyState, pageHeader } from "../../shared/dom.js";

function plantCard(plant) {
  const image = plant.default_image?.medium_url || plant.default_image?.small_url || plant.default_image?.thumbnail;
  const details = [
    ["Scientific", formatList(plant.scientific_name)],
    ["Cycle", plant.cycle || "Not listed"],
    ["Watering", plant.watering || "Not listed"],
    ["Sun", formatList(plant.sunlight)],
    ["Other names", formatList(plant.other_name)]
  ];

  return el("article", { className: "plant-card" }, [
    image ? el("img", {
      className: "plant-image",
      src: image,
      alt: plant.common_name ? `${plant.common_name} plant` : "Plant image",
      loading: "lazy"
    }) : "",
    el("div", { className: "card-title-row" }, [
      el("h2", { text: plant.common_name || "Unnamed plant" }),
      el("span", { className: "tag", text: plant.genus || "Edible" })
    ]),
    el("dl", { className: "detail-grid" }, details.map(([label, value]) => [
      el("div", {}, [
        el("dt", { text: label }),
        el("dd", { text: value })
      ])
    ])),
    el("p", {
      text: plant.source === "fallback"
        ? "Starter plant example shown while Perenual plant data is unavailable."
        : "Plant data supplied by the Perenual Plant Data API."
    })
  ]);
}

function formatList(value) {
  if (Array.isArray(value) && value.length) {
    return value.join(", ");
  }

  return value || "Not listed";
}

export const plantService = {
  id: "plants",
  label: "Plant Library",
  navLabel: "Plants",
  summary: "Search edible plants from the Perenual Plant Data API.",

  render() {
    const list = el("section", { className: "plant-grid", "aria-live": "polite" });
    const count = el("p", { className: "result-count" });
    const status = el("p", { className: "service-status", "aria-live": "polite" });
    const pageLabel = el("span", { className: "page-label", text: "Page 1" });
    const previousButton = el("button", { className: "secondary-button", type: "button" }, ["Previous"]);
    const nextButton = el("button", { className: "secondary-button", type: "button" }, ["Next"]);
    const search = el("input", {
      type: "search",
      placeholder: "Search edible plants...",
      "aria-label": "Search edible plants"
    });
    let currentPage = 1;
    let lastPage = 1;
    let activeController = null;
    let debounceTimer = null;

    function setLoading() {
      status.textContent = "Loading plant data...";
      count.textContent = "";
      list.innerHTML = "";
      list.append(emptyState("Loading plants", "Fetching edible plant information from Perenual."));
    }

    function updatePager() {
      pageLabel.textContent = `Page ${currentPage} of ${lastPage}`;
      previousButton.disabled = currentPage <= 1;
      nextButton.disabled = currentPage >= lastPage;
    }

    async function loadPlants() {
      if (activeController) {
        activeController.abort();
      }

      activeController = new AbortController();
      setLoading();
      updatePager();

      const params = new URLSearchParams({
        page: String(currentPage)
      });
      const query = search.value.trim();

      if (query) {
        params.set("q", query);
      }

      try {
        const response = await fetch(`/api/plants?${params.toString()}`, {
          signal: activeController.signal
        });

        if (!response.ok) {
          throw new Error(`Plant API returned ${response.status}`);
        }

        const payload = await response.json();
        const plants = Array.isArray(payload.data) ? payload.data : [];
        lastPage = Number(payload.last_page || 1);
        currentPage = Number(payload.current_page || currentPage);
        count.textContent = `${payload.total || plants.length} edible plant${Number(payload.total) === 1 ? "" : "s"} available`;
        if (payload.source === "fallback") {
          status.textContent = payload.warning || "Showing starter plant examples while Perenual is unavailable.";
        } else if (payload.sort === "catalog-building") {
          status.textContent = query
            ? `Search results for "${query}" while the full A-to-Z catalog loads`
            : "Loading the full A-to-Z catalog; showing live page results now";
        } else {
          status.textContent = query ? `Search results for "${query}"` : "Alphabetical edible plant collection";
        }
        list.innerHTML = "";

        if (!plants.length) {
          list.append(emptyState("No plants found", "Try a different plant name or keyword."));
          updatePager();
          return;
        }

        plants.forEach((plant) => list.append(plantCard(plant)));
        updatePager();
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        status.textContent = "Plant data could not be loaded.";
        count.textContent = "";
        list.innerHTML = "";
        list.append(emptyState("No plants found", "Try a different plant, season, or care term."));
        updatePager();
      }
    }

    search.addEventListener("input", () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        currentPage = 1;
        loadPlants();
      }, 350);
    });

    previousButton.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage -= 1;
        loadPlants();
      }
    });

    nextButton.addEventListener("click", () => {
      if (currentPage < lastPage) {
        currentPage += 1;
        loadPlants();
      }
    });

    loadPlants();

    return el("div", { className: "service-view" }, [
      pageHeader({
        title: "Edible Plant Library",
        summary: this.summary,
        actions: [
          el("section", { className: "account-prompt" }, [
            el("p", { text: "Login to your account or create one in less than 1 minute." }),
            el("div", { className: "button-row" }, [
              el("button", { className: "secondary-button", type: "button" }, ["Login"]),
              el("button", { className: "primary-button", type: "button" }, ["Create Account"])
            ])
          ])
        ]
      }),
      el("p", {
        className: "service-instruction",
        text: "Type the name of an edible plant or browse the catalog below page by page."
      }),
      el("section", { className: "toolbar" }, [
        search,
        el("div", { className: "plant-toolbar-meta" }, [
          status,
          count
        ])
      ]),
      el("section", { className: "pager", "aria-label": "Plant results pages" }, [
        previousButton,
        pageLabel,
        nextButton
      ]),
      list
    ]);
  }
};
