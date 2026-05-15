const namespace = "urban-farm-hand";

function keyFor(key) {
  return `${namespace}:${key}`;
}

export const storage = {
  get(key, fallbackValue) {
    const raw = localStorage.getItem(keyFor(key));

    if (!raw) {
      return fallbackValue;
    }

    try {
      return JSON.parse(raw);
    } catch {
      return fallbackValue;
    }
  },

  set(key, value) {
    localStorage.setItem(keyFor(key), JSON.stringify(value));
  }
};
