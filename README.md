# Inherited Getters in DevTools (Firefox)

When you expand an object in the Firefox console, this lists the getters it inherits from its prototype chain alongside its own properties, greyed out, as Chrome DevTools does. Examples are ArcGIS `Accessor` properties such as `WebMap.allLayers`, `basemap` and `layers`. You no longer have to expand `<prototype>` twice to find them.

It works through Firefox's [custom formatters](https://firefox-source-docs.mozilla.org/devtools-user/custom_formatters/index.html) feature. The extension only injects a formatter into each page; Firefox does the rendering.

## Setup

1. **Turn on custom formatters.** Open DevTools, go to Settings (F1) → Advanced settings, and check **Enable custom formatters**. Close and reopen DevTools.
2. **Load the extension.** Go to `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…**, and pick `manifest.json` in this folder.
3. **Reload the page you're debugging.** The formatter is injected when the page starts loading.

A temporary add-on is removed when Firefox restarts, so repeat step 2 after each restart. See "Installing permanently" below to avoid that.

## Using it

Log or evaluate an object as usual, for example `console.log(view.map)`. Matching objects show a collapsed header such as `esri.WebMap {…}` or `esri.layers.FeatureLayer {…} "Parcels"`. When you expand one you get:

- **Own properties** (purple), sorted.
- **Inherited getters** (grey), sorted, with their current values.
- **`[[Prototype]]`**, which opens Firefox's normal view of the prototype, methods included.

Nested objects use the same view, so you can keep drilling down (`map` → `layers` → a layer).

## What it applies to

The formatter only takes over objects that inherit getters written in JavaScript. Firefox's default view is kept for:

- plain objects and arrays
- built-ins like `Map` and `Date`
- DOM nodes
- prototype objects themselves

## Differences from Chrome

- **Getters run when you expand:** Chrome shows `(...)` and waits for a click. This formatter runs every inherited getter as soon as you expand the object. For ArcGIS accessors that's normally harmless. A getter that throws shows `<getter threw: …>` instead of breaking the view.
- **Header preview:** the collapsed header reads `title`, or `id` if there's no title, to show a short preview. You can change this with `PREVIEW_KEYS` at the top of `formatter.js`.
- **Methods:** methods on the prototype aren't listed at the top level, same as Chrome. Use `[[Prototype]]` to see them.

## Installing permanently

Regular Firefox only installs signed extensions permanently. Your options are:

- **Sign it as unlisted on addons.mozilla.org.** Signing is automatic and nothing gets published. With [web-ext](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/) and AMO API keys, run this from this folder:

  ```bash
  npx web-ext sign --channel unlisted --api-key <JWT issuer> --api-secret <JWT secret>
  ```

  Then install the `.xpi` it produces.
- **Use Firefox Developer Edition, Nightly or ESR** with `xpinstall.signatures.required` set to `false` in `about:config`, and install an unsigned zip of this folder.

## Limiting which sites it runs on

`manifest.json` matches `<all_urls>`. To run it only on your dev or test hosts, edit `matches`, for example:

```json
"matches": ["http://localhost/*", "https://*.example.com/*"]
```

If the formatter isn't taking effect, open `about:addons` → this extension → **Permissions** and make sure site access is allowed.

## Files

- `manifest.json`: an MV3 manifest with one content script that runs in the page's own world at `document_start`. Requires Firefox 128 or later.
- `formatter.js`: the formatter itself. It adds an entry to `window.devtoolsFormatters`.
