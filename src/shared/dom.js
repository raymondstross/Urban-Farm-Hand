export function el(tagName, options = {}, children = []) {
  const node = document.createElement(tagName);
  const entries = Object.entries(options);

  entries.forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) {
      return;
    }

    if (key === "className") {
      node.className = value;
      return;
    }

    if (key === "text") {
      node.textContent = value;
      return;
    }

    if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
      return;
    }

    node.setAttribute(key, value);
  });

  children.flat().forEach((child) => {
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });

  return node;
}

export function pageHeader({ title, summary, actions = [] }) {
  return el("section", { className: "page-heading" }, [
    el("div", {}, [
      el("p", { className: "eyebrow", text: "Urban Farm Hand" }),
      el("h1", { text: title }),
      el("p", { className: "lede", text: summary })
    ]),
    actions.length ? el("div", { className: "heading-actions" }, actions) : ""
  ]);
}

export function emptyState(title, message) {
  const template = document.querySelector("#empty-state-template");
  const clone = template.content.cloneNode(true);
  clone.querySelector("h2").textContent = title;
  clone.querySelector("p").textContent = message;
  return clone;
}

export function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

let activeConfirmation = null;

export function confirmNearTarget(target, { message, onConfirm }) {
  if (activeConfirmation) {
    activeConfirmation();
  }

  const popover = el("section", {
    className: "delete-confirm-popover",
    role: "dialog",
    "aria-modal": "false"
  }, [
    el("p", { text: message }),
    el("div", { className: "button-row" }, [
      el("button", {
        className: "danger-button",
        type: "button",
        onClick: () => {
          cleanup();
          onConfirm();
        }
      }, ["Delete"]),
      el("button", {
        className: "secondary-button compact-button",
        type: "button",
        onClick: () => {
          cleanup();
          target.focus();
        }
      }, ["Cancel"])
    ])
  ]);

  function positionPopover() {
    const targetRect = target.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const gap = 8;
    const margin = 12;
    const left = Math.min(
      Math.max(targetRect.left + (targetRect.width / 2) - (popoverRect.width / 2), margin),
      window.innerWidth - popoverRect.width - margin
    );
    const bottomTop = targetRect.bottom + gap;
    const top = bottomTop + popoverRect.height > window.innerHeight - margin
      ? Math.max(targetRect.top - popoverRect.height - gap, margin)
      : bottomTop;

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  function handleOutsideClick(event) {
    if (!popover.contains(event.target) && event.target !== target) {
      cleanup();
    }
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      cleanup();
      target.focus();
    }
  }

  function cleanup() {
    popover.remove();
    window.removeEventListener("resize", positionPopover);
    window.removeEventListener("scroll", positionPopover, true);
    document.removeEventListener("pointerdown", handleOutsideClick);
    document.removeEventListener("keydown", handleKeydown);
    activeConfirmation = null;
  }

  document.body.append(popover);
  positionPopover();
  popover.querySelector(".danger-button").focus();
  window.addEventListener("resize", positionPopover);
  window.addEventListener("scroll", positionPopover, true);
  window.setTimeout(() => {
    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleKeydown);
  });
  activeConfirmation = cleanup;
}
