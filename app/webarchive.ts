// Read only the main resource of a Safari binary plist. Never visit embedded URLs.
export const WEBARCHIVE_MAX_BYTES = 20 * 1024 * 1024;
const HTML_MAX_BYTES = 2 * 1024 * 1024;
const invalid = () => new Error("封存檔格式不支援或已損壞，請使用 Safari 儲存網頁封存檔");

export function readWebarchive(bytes: Uint8Array): string {
  if (bytes.length > WEBARCHIVE_MAX_BYTES) throw new Error("封存檔不可超過 20 MB");
  if (bytes.length < 40 || new TextDecoder().decode(bytes.subarray(0, 8)) !== "bplist00") throw invalid();
  const trailer = bytes.length - 32;
  const uint = (at: number, size: number, end = bytes.length): number => {
    if (![1, 2, 4, 8].includes(size) || at < 0 || at + size > end) throw invalid();
    let n = 0;
    for (let i = 0; i < size; i++) n = n * 256 + bytes[at + i];
    if (!Number.isSafeInteger(n)) throw invalid();
    return n;
  };
  const offsetSize = bytes[trailer + 6], refSize = bytes[trailer + 7];
  const count = uint(trailer + 8, 8), root = uint(trailer + 16, 8), table = uint(trailer + 24, 8);
  if (count < 1 || count > 100_000 || table < 8 || table + count * offsetSize > trailer) throw invalid();
  const object = (id: number) => {
    if (id < 0 || id >= count) throw invalid();
    const at = uint(table + id * offsetSize, offsetSize, trailer);
    if (at < 8 || at >= table) throw invalid();
    const type = bytes[at] >> 4;
    let length = bytes[at] & 15, start = at + 1;
    if (length === 15) {
      if (start >= table || bytes[start] >> 4 !== 1) throw invalid();
      const size = 2 ** (bytes[start] & 15);
      length = uint(start + 1, size, table);
      start += 1 + size;
    }
    return { type, length, start };
  };
  const string = (id: number) => {
    const { type, length, start } = object(id);
    if (![5, 6].includes(type) || length > HTML_MAX_BYTES) throw invalid();
    const end = start + length * (type === 6 ? 2 : 1);
    if (end > table) throw invalid();
    return new TextDecoder(type === 6 ? "utf-16be" : "utf-8", { fatal: true }).decode(bytes.subarray(start, end));
  };
  const field = (id: number, key: string) => {
    const { type, length, start } = object(id);
    if (type !== 13 || length > 1000 || start + length * refSize * 2 > table) throw invalid();
    for (let i = 0; i < length; i++) {
      if (string(uint(start + i * refSize, refSize, table)) === key)
        return uint(start + (length + i) * refSize, refSize, table);
    }
    throw invalid();
  };
  const main = field(root, "WebMainResource");
  const url = new URL(string(field(main, "WebResourceURL")));
  if (url.origin !== "https://skyinfoweb.pages.dev" || string(field(main, "WebResourceMIMEType")) !== "text/html")
    throw new Error("請匯入 Sky Info 禮包查詢站的網頁封存檔");
  const data = object(field(main, "WebResourceData"));
  if (data.type !== 4 || data.length > HTML_MAX_BYTES || data.start + data.length > table) throw invalid();
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(data.start, data.start + data.length));
}
