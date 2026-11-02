// DevTools custom formatter that lists inherited JavaScript getters (for example
// ArcGIS Accessor properties such as WebMap.allLayers) at the top level of an
// expanded object, greyed out, the way Chrome DevTools does.
//
// Requires DevTools Settings > Advanced settings > "Enable custom formatters".
// Runs in the page's own world (content script with "world": "MAIN").
(() => {
  "use strict";

  // Keys whose string value is shown next to the class name in the collapsed header.
  const PREVIEW_KEYS = ["title", "id"];
  const MAX_STRING_LENGTH = 300;

  const STYLE = {
    body: "padding-left: 14px",
    header: "font-style: italic",
    preview: "color: #8a8a8a",
    ownKey: "color: #b000b0",
    inheritedKey: "color: #9a9a9a",
    string: "color: #c41a16",
    number: "color: #1c00cf",
    muted: "color: #8a8a8a",
    error: "color: #d70022",
  };

  // Marks object references that should get Firefox's default rendering.
  const RAW_CONFIG = { __inheritedGettersRaw: true };

  const fnToString = Function.prototype.toString;

  // Built-in getters (DOM, Map.size, ...) are already handled by Firefox.
  function isNative(fn) {
    try {
      return /\{\s*\[native code\]\s*\}\s*$/.test(fnToString.call(fn));
    } catch {
      return true;
    }
  }

  function compareKeys(a, b) {
    const aSym = typeof a === "symbol";
    const bSym = typeof b === "symbol";
    if (aSym !== bSym) return aSym ? 1 : -1;
    if (aSym) return 0;
    return a < b ? -1 : a > b ? 1 : 0;
  }

  // prototype -> names of the script getters visible through it, sorted.
  const getterCache = new WeakMap();

  function protoGetters(proto) {
    let keys = getterCache.get(proto);
    if (keys) return keys;
    keys = [];
    const seen = new Set();
    for (let p = proto; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
      for (const key of Reflect.ownKeys(p)) {
        // The nearest definition wins, so a subclass method hides a base getter.
        if (seen.has(key)) continue;
        seen.add(key);
        const desc = Object.getOwnPropertyDescriptor(p, key);
        if (desc && desc.get && !isNative(desc.get)) keys.push(key);
      }
    }
    keys.sort(compareKeys);
    getterCache.set(proto, keys);
    return keys;
  }

  function inheritedGetters(obj) {
    const proto = Object.getPrototypeOf(obj);
    if (!proto || proto === Object.prototype) return [];
    return protoGetters(proto).filter((key) => !Object.hasOwn(obj, key));
  }

  function isPrototypeObject(obj) {
    const desc = Object.getOwnPropertyDescriptor(obj, "constructor");
    return !!desc && typeof desc.value === "function" && desc.value.prototype === obj;
  }

  function applies(obj, config) {
    if (config && config.__inheritedGettersRaw) return false;
    if (obj === null || typeof obj !== "object") return false;
    if (typeof Node === "function" && obj instanceof Node) return false;
    if (isPrototypeObject(obj)) return false;
    return inheritedGetters(obj).length > 0;
  }

  function read(obj, key) {
    try {
      return { value: obj[key] };
    } catch (error) {
      return { error };
    }
  }

  function typeName(obj) {
    const declared = read(obj, "declaredClass").value;
    if (typeof declared === "string" && declared) return declared;
    const ctor = read(obj, "constructor").value;
    if (typeof ctor === "function" && ctor.name) return ctor.name;
    return "Object";
  }

  function truncate(str) {
    return str.length > MAX_STRING_LENGTH ? str.slice(0, MAX_STRING_LENGTH) + "…" : str;
  }

  function valueTemplate(value) {
    if (value !== null && (typeof value === "object" || typeof value === "function")) {
      return ["object", { object: value }];
    }
    switch (typeof value) {
      case "string":
        return ["span", { style: STYLE.string }, truncate(JSON.stringify(value))];
      case "number":
      case "boolean":
        return ["span", { style: STYLE.number }, String(value)];
      case "bigint":
        return ["span", { style: STYLE.number }, `${value}n`];
      default:
        return ["span", { style: STYLE.muted }, String(value)];
    }
  }

  function row(key, result, inherited) {
    const label = ["span", { style: inherited ? STYLE.inheritedKey : STYLE.ownKey }, String(key)];
    if ("error" in result) {
      const message = result.error instanceof Error ? result.error.message : String(result.error);
      return ["div", {}, label, ": ", ["span", { style: STYLE.error }, `<getter threw: ${message}>`]];
    }
    return ["div", {}, label, ": ", valueTemplate(result.value)];
  }

  const formatter = {
    header(obj, config) {
      try {
        if (!applies(obj, config)) return null;
        const header = ["span", { style: STYLE.header }, typeName(obj) + " {…}"];
        for (const key of PREVIEW_KEYS) {
          const value = read(obj, key).value;
          if (typeof value === "string" && value) {
            header.push(["span", { style: STYLE.preview }, " " + truncate(JSON.stringify(value))]);
            break;
          }
        }
        return header;
      } catch {
        return null;
      }
    },

    hasBody() {
      return true;
    },

    body(obj) {
      const rows = [];
      let ownKeys = [];
      try {
        ownKeys = Reflect.ownKeys(obj).sort(compareKeys);
      } catch {}
      for (const key of ownKeys) rows.push(row(key, read(obj, key), false));
      for (const key of inheritedGetters(obj)) rows.push(row(key, read(obj, key), true));

      const proto = Object.getPrototypeOf(obj);
      if (proto) {
        rows.push([
          "div",
          {},
          ["span", { style: STYLE.inheritedKey }, "[[Prototype]]"],
          ": ",
          ["object", { object: proto, config: RAW_CONFIG }],
        ]);
      }
      return ["div", { style: STYLE.body }, ...rows];
    },
  };

  if (!Array.isArray(window.devtoolsFormatters)) window.devtoolsFormatters = [];
  window.devtoolsFormatters.push(formatter);
})();
