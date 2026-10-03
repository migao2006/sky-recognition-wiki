// Synthetic fixture only: no player IDs, purchased-item history or remote calls.
export function webarchiveFixture(html, url = "https://skyinfoweb.pages.dev/") {
  const objects = [];
  function add(value) {
    const id = objects.length;
    objects.push(null);
    if (typeof value === "string" || Buffer.isBuffer(value)) {
      const data = Buffer.isBuffer(value) ? value : Buffer.from(value);
      const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
      objects[id] = Buffer.concat([Buffer.from([Buffer.isBuffer(value) ? 0x4f : 0x5f, 0x12]), length, data]);
    } else {
      const keys = Object.keys(value).map(add), values = Object.values(value).map(add);
      objects[id] = Buffer.from([0xd0 + keys.length, ...keys, ...values]);
    }
    return id;
  }
  add({ WebMainResource: { WebResourceURL: url, WebResourceMIMEType: "text/html", WebResourceData: Buffer.from(html) } });
  let offset = 8;
  const table = Buffer.alloc(objects.length * 4);
  objects.forEach((object, i) => { table.writeUInt32BE(offset, i * 4); offset += object.length; });
  const trailer = Buffer.alloc(32);
  trailer[6] = 4; trailer[7] = 1;
  trailer.writeBigUInt64BE(BigInt(objects.length), 8);
  trailer.writeBigUInt64BE(BigInt(offset), 24);
  return Buffer.concat([Buffer.from("bplist00"), ...objects, table, trailer]);
}

export function giftHtml(names, count = names.length) {
  return `<div id="gc">${count}</div><div id="gl">${names.map(name => `<div class="g-item"><div class="g-unlocks"><img alt="${name}" src="https://invalid.example/test.png"></div></div>`).join("")}</div>`;
}
