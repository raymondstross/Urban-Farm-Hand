import { confirmNearTarget, el, pageHeader, uid } from "../../shared/dom.js";

const storageKey = "calendar.tasks";
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = Array.from({ length: 12 }, (_, index) => new Date(2026, index, 1).toLocaleDateString([], {
  month: "long"
}));

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthLabel(date) {
  return date.toLocaleDateString([], {
    month: "long",
    year: "numeric"
  });
}

function sameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function tasksForDate(tasks, key) {
  return tasks
    .filter((task) => task.date === key)
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

function buildCalendarDays(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const weekCount = Math.max(5, Math.ceil((first.getDay() + daysInMonth) / 7));
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: weekCount * 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function taskPill(task, onEdit, onDelete) {
  return el("li", { className: "calendar-task" }, [
    el("button", {
      className: "task-pill-button",
      type: "button",
      title: "Edit task",
      "aria-label": `Edit ${task.title}`,
      onClick: () => onEdit(task)
    }, [task.time ? `${task.time} ${task.title}` : task.title]),
    el("div", { className: "mini-action-row" }, [
      el("button", {
        className: "mini-edit",
        type: "button",
        title: "Edit task",
        "aria-label": `Edit ${task.title}`,
        onClick: () => onEdit(task)
      }, ["Edit"]),
      el("button", {
        className: "mini-delete",
        type: "button",
        title: "Delete task",
        "aria-label": `Delete ${task.title}`,
        onClick: (event) => onDelete(task.id, event.currentTarget)
      }, ["x"])
    ])
  ]);
}

export const calendarService = {
  id: "calendar",
  label: "Garden Calendar",
  navLabel: "Calendar",
  summary: "Organize your garden tasks with a daily calendar.",

  render({ storage }) {
    let tasks = storage.get(storageKey, [
      {
        id: "seed-demo",
        title: "Check soil moisture",
        date: dateKey(new Date()),
        time: "08:00",
        notes: "Water containers deeply if the top inch is dry."
      }
    ]);
    let visibleMonth = new Date();
    visibleMonth.setDate(1);
    let selectedDate = dateKey(new Date());
    let editingTaskId = null;

    const calendarGrid = el("section", { className: "calendar-grid", "aria-live": "polite" });
    const selectedLabel = el("strong", { text: selectedDate });
    const monthSelect = el("select", { "aria-label": "Jump to month" }, monthNames.map((month, index) => {
      return el("option", { value: String(index), text: month });
    }));
    const currentYear = new Date().getFullYear();
    const yearInput = el("input", {
      type: "number",
      min: "1900",
      max: "2200",
      step: "1",
      value: String(currentYear),
      "aria-label": "Jump to year"
    });
    const titleInput = el("input", {
      type: "text",
      required: "",
      placeholder: "Task name",
      "aria-label": "Task name"
    });
    const timeInput = el("input", {
      type: "time",
      "aria-label": "Task time"
    });
    const notesInput = el("textarea", {
      rows: "3",
      placeholder: "Optional notes",
      "aria-label": "Task notes"
    });
    const saveButton = el("button", { className: "primary-button", type: "submit" }, ["+ Add task"]);
    const cancelEditButton = el("button", {
      className: "secondary-button hidden",
      type: "button",
      onClick: () => resetForm()
    }, ["Cancel edit"]);
    const selectedTasks = el("section", { className: "selected-tasks", "aria-live": "polite" });

    function persist() {
      storage.set(storageKey, tasks);
    }

    function formatSelectedDate(key) {
      return new Date(`${key}T12:00`).toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
      });
    }

    function resetForm() {
      editingTaskId = null;
      titleInput.value = "";
      timeInput.value = "";
      notesInput.value = "";
      saveButton.textContent = "+ Add task";
      cancelEditButton.classList.add("hidden");
    }

    function updateJumpControls() {
      monthSelect.value = String(visibleMonth.getMonth());
      yearInput.value = String(visibleMonth.getFullYear());
    }

    function setVisibleMonth(year, month) {
      visibleMonth = new Date(year, month, 1);
      updateJumpControls();
      draw();
    }

    function selectDate(key) {
      selectedDate = key;
      selectedLabel.textContent = formatSelectedDate(key);
      draw();
      titleInput.focus();
    }

    function editTask(task) {
      editingTaskId = task.id;
      selectDate(task.date);
      titleInput.value = task.title;
      timeInput.value = task.time || "";
      notesInput.value = task.notes || "";
      saveButton.textContent = "Save changes";
      cancelEditButton.classList.remove("hidden");
      notesInput.focus();
    }

    function deleteTask(id, target) {
      if (!target) {
        return;
      }

      confirmNearTarget(target, {
        message: "This task will be deleted permanently, do you want to proceed?",
        onConfirm: () => {
          tasks = tasks.filter((task) => task.id !== id);
          persist();

          if (editingTaskId === id) {
            resetForm();
          }

          draw();
        }
      });
    }

    function drawSelectedTasks() {
      selectedTasks.innerHTML = "";
      const dayTasks = tasksForDate(tasks, selectedDate);

      if (!dayTasks.length) {
        selectedTasks.append(el("p", { className: "muted-copy", text: "No tasks on this date yet." }));
        return;
      }

      selectedTasks.append(el("ul", { className: "selected-task-list" }, dayTasks.map((task) => {
        const meta = [task.time, task.notes].filter(Boolean).join(" - ");

        return el("li", { className: editingTaskId === task.id ? "editing" : "" }, [
          el("div", {}, [
            el("strong", { text: task.title }),
            meta ? el("span", { text: meta }) : ""
          ]),
          el("div", { className: "button-row" }, [
            el("button", {
              className: "secondary-button compact-button",
              type: "button",
              onClick: () => editTask(task)
            }, ["Edit"]),
            el("button", {
              className: "icon-button danger",
              type: "button",
              title: "Delete task",
              "aria-label": `Delete ${task.title}`,
              onClick: (event) => deleteTask(task.id, event.currentTarget)
            }, ["x"])
          ])
        ]);
      })));
    }

    function draw() {
      updateJumpControls();
      calendarGrid.innerHTML = "";
      dayNames.forEach((day) => calendarGrid.append(el("div", { className: "calendar-weekday", text: day })));

      buildCalendarDays(visibleMonth).forEach((day) => {
        const key = dateKey(day);
        const dayTasks = tasksForDate(tasks, key);
        const isSelected = key === selectedDate;
        const isToday = key === dateKey(new Date());
        const classes = [
          "calendar-day",
          sameMonth(day, visibleMonth) ? "" : "outside-month",
          isSelected ? "selected" : "",
          isToday ? "today" : ""
        ].filter(Boolean).join(" ");

        calendarGrid.append(el("article", { className: classes }, [
          el("div", { className: "calendar-day-header" }, [
            el("button", {
              className: "date-button",
              type: "button",
              onClick: () => selectDate(key)
            }, [String(day.getDate())]),
            el("button", {
              className: "plus-button",
              type: "button",
              title: "Add task",
              "aria-label": `Add task on ${key}`,
              onClick: () => selectDate(key)
            }, ["+"])
          ]),
          dayTasks.length
            ? el("ul", { className: "calendar-task-list" }, dayTasks.map((task) => taskPill(task, editTask, deleteTask)))
            : el("p", { className: "calendar-empty", text: " " })
        ]));
      });

      drawSelectedTasks();
    }

    const previousMonth = el("button", {
      className: "secondary-button",
      type: "button",
      onClick: () => {
        setVisibleMonth(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1);
      }
    }, ["Previous"]);
    const nextMonth = el("button", {
      className: "secondary-button",
      type: "button",
      onClick: () => {
        setVisibleMonth(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1);
      }
    }, ["Next"]);
    const todayButton = el("button", {
      className: "secondary-button",
      type: "button",
      onClick: () => {
        visibleMonth = new Date();
        visibleMonth.setDate(1);
        updateJumpControls();
        selectDate(dateKey(new Date()));
      }
    }, ["Today"]);

    monthSelect.addEventListener("change", () => {
      setVisibleMonth(Number(yearInput.value), Number(monthSelect.value));
    });

    yearInput.addEventListener("change", () => {
      const year = Number(yearInput.value);

      if (Number.isFinite(year) && year >= 1900 && year <= 2200) {
        setVisibleMonth(year, Number(monthSelect.value));
      }
    });

    const form = el("form", {
      className: "calendar-task-form",
      onSubmit: (event) => {
        event.preventDefault();
        const title = titleInput.value.trim();

        if (!title) {
          return;
        }

        if (editingTaskId) {
          tasks = tasks.map((task) => task.id === editingTaskId
            ? {
                ...task,
                title,
                date: selectedDate,
                time: timeInput.value,
                notes: notesInput.value.trim()
              }
            : task);
        } else {
          tasks = [
            ...tasks,
            {
              id: uid("task"),
              title,
              date: selectedDate,
              time: timeInput.value,
              notes: notesInput.value.trim()
            }
          ];
        }

        persist();
        resetForm();
        draw();
      }
    }, [
      el("p", { className: "selected-date-label" }, ["Adding task for ", selectedLabel]),
      el("label", {}, ["Task", titleInput]),
      el("label", {}, ["Time", timeInput]),
      el("label", {}, ["Notes", notesInput]),
      el("div", { className: "button-row" }, [saveButton, cancelEditButton]),
      selectedTasks
    ]);

    selectedLabel.textContent = formatSelectedDate(selectedDate);
    updateJumpControls();
    draw();

    return el("div", { className: "service-view calendar-view" }, [
      pageHeader({
        title: this.label,
        summary: this.summary
      }),
      el("section", { className: "calendar-shell" }, [
        el("div", { className: "calendar-board" }, [
          el("div", { className: "calendar-controls" }, [
            el("div", { className: "button-row" }, [previousMonth, todayButton, nextMonth]),
            el("div", { className: "calendar-jump" }, [
              monthSelect,
              yearInput
            ])
          ]),
          calendarGrid
        ]),
        form
      ])
    ]);
  }
};
