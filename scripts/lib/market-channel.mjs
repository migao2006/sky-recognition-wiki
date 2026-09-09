// Explicit metadata only: never infer a channel from login, title or platform.
// Unrecognized seller text remains unknown and is not copied into reports.
export const channelFor = (row) => {
  // Taoshouyou's collector stores the explicit listing channel as `client`.
  // A supplied channel remains authoritative, including an unknown value.
  if (row.channel == null && row.source === "taoshouyou") {
    const clients = {
      "安卓官方": "android-official", "苹果官方": "ios-official",
      "安卓华为": "huawei", "安卓B服": "bilibili", "安卓OPPO": "oppo",
      "安卓小米": "xiaomi", "安卓vivo": "vivo",
    };
    return Object.hasOwn(clients, row.client) ? clients[row.client] : "unknown";
  }
  const value = typeof row.channel === "string" ? row.channel.trim().toLowerCase().replace(/\s+/g, "") : "";
  const aliases = {
    "ios官服": "ios-official", "ios官服苹果官服": "ios-official", "蘋果官服": "ios-official", "苹果官服": "ios-official",
    "安卓官服": "android-official", "華為": "huawei", "华为": "huawei", "小米": "xiaomi", "哔哩哔哩": "bilibili",
  };
  return Object.hasOwn(aliases, value) ? aliases[value]
    : ["ios-official", "android-official", "huawei", "vivo", "oppo", "xiaomi", "bilibili"].includes(value) ? value : "unknown";
};
