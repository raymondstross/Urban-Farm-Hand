import { confirmNearTarget, el, emptyState, pageHeader, uid } from "../../shared/dom.js";

const storageKey = "notes.items";

function formatDate(value) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export const notesService = {
  id: "notes",
  label: "Garden Notes",
  navLabel: "Notes",
  summary: "Record your observations and ideas, revise and delete as needed.",

  render({ storage }) {
    let notes = storage.get(storageKey, [
      {
        id: "seed-note",
        title: "Balcony herb rail",
        body: "Measure the sunny railing and look for narrow planters with drainage trays.",
        updatedAt: new Date().toISOString()
      }
    ]);

    const titleInput = el("input", {
      type: "text",
      required: "",
      placeholder: "Note title",
      "aria-label": "Note title"
    });
    const bodyInput = el("textarea", {
      rows: "4",
      required: "",
      placeholder: "Record your notes",
      "aria-label": "Note description"
    });
    const saveButton = el("button", { className: "primary-button", type: "submit" }, ["+ Save note"]);
    const cancelButton = el("button", { className: "secondary-button hidden", type: "button" }, ["Cancel edit"]);
    const list = el("section", { className: "notes-grid", "aria-live": "polite" });
    let editingId = null;

    function persist() {
      storage.set(storageKey, notes);
    }

    function resetForm() {
      editingId = null;
      titleInput.value = "";
      bodyInput.value = "";
      saveButton.textContent = "+ Save note";
      cancelButton.classList.add("hidden");
    }

    function editNote(note) {
      editingId = note.id;
      titleInput.value = note.title;
      bodyInput.value = note.body;
      saveButton.textContent = "Save changes";
      cancelButton.classList.remove("hidden");
      titleInput.focus();
    }

    function deleteNote(id, target) {
      if (!target) {
        return;
      }

      confirmNearTarget(target, {
        message: "This note will be deleted permanently, do you want to proceed?",
        onConfirm: () => {
          notes = notes.filter((note) => note.id !== id);
          persist();

          if (editingId === id) {
            resetForm();
          }

          draw();
        }
      });
    }

    function noteCard(note) {
      return el("article", { className: "note-card" }, [
        el("div", {}, [
          el("p", { className: "task-date", text: `Updated ${formatDate(note.updatedAt)}` }),
          el("h2", { text: note.title }),
          el("p", { text: note.body })
        ]),
        el("div", { className: "card-actions" }, [
          el("button", {
            className: "secondary-button",
            type: "button",
            onClick: () => editNote(note)
          }, ["Edit"]),
          el("button", {
            className: "icon-button danger",
            type: "button",
            title: "Delete note",
            "aria-label": `Delete ${note.title}`,
            onClick: (event) => deleteNote(note.id, event.currentTarget)
          }, ["x"])
        ])
      ]);
    }

    function draw() {
      list.innerHTML = "";

      if (!notes.length) {
        list.append(emptyState("No notes yet", "Save a garden idea, layout thought, or experiment to revisit."));
        return;
      }

      notes
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .forEach((note) => list.append(noteCard(note)));
    }

    cancelButton.addEventListener("click", resetForm);

    const form = el("form", {
      className: "service-form",
      onSubmit: (event) => {
        event.preventDefault();

        const title = titleInput.value.trim();
        const body = bodyInput.value.trim();

        if (!title || !body) {
          return;
        }

        if (editingId) {
          notes = notes.map((note) => note.id === editingId
            ? { ...note, title, body, updatedAt: new Date().toISOString() }
            : note);
        } else {
          notes = [
            {
              id: uid("note"),
              title,
              body,
              updatedAt: new Date().toISOString()
            },
            ...notes
          ];
        }

        persist();
        resetForm();
        draw();
      }
    }, [
      el("h2", { className: "section-title", text: "Create a New Note" }),
      el("div", { className: "form-grid" }, [
        el("label", { className: "wide" }, ["Title", titleInput]),
        el("label", { className: "wide" }, ["Description", bodyInput])
      ]),
      el("div", { className: "button-row" }, [saveButton, cancelButton])
    ]);

    draw();

    return el("div", { className: "service-view" }, [
      pageHeader({
        title: this.label,
        summary: this.summary
      }),
      form,
      el("section", { className: "notes-section" }, [
        el("h2", { className: "section-title", text: "My Notes" }),
        list
      ])
    ]);
  }
};
