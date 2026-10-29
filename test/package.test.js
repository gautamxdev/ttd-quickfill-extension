import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync, existsSync} from "node:fs";

test("manifest references valid files and square PNG icons at every declared size", () => {
  const root = new URL("../", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", root)));
  for (const [size, path] of Object.entries(manifest.icons)) {
    const bytes = readFileSync(new URL(path, root));
    assert.equal(bytes.subarray(1, 4).toString(), "PNG");
    assert.equal(bytes.readUInt32BE(16), Number(size));
    assert.equal(bytes.readUInt32BE(20), Number(size));
  }
  for (const path of [manifest.background.service_worker, manifest.side_panel.default_path, ...manifest.content_scripts.flatMap(item => item.js)]) assert.equal(existsSync(new URL(path, root)), true);
});
