import assert from "node:assert/strict";
import test from "node:test";
import { loadRuntimeCatalog } from "../scripts/load-runtime-catalog.mjs";

const catalog = await loadRuntimeCatalog();

test("dragon scale earrings resolve the paid fortune head accessory, not a bracelet", () => {
  for (const term of ["龍鱗耳墜", "金鱗耳墜", "幸運節龍耳飾", "福瑞龍手環"]) {
    const match = resolver.resolve(term);
    assert.deepEqual(match.candidates.map(item => item.guid), ["xsTxIqIX8E"]);
    const [item] = match.candidates;
    assert.deepEqual([item.id, item.order, item.name, item.type, item.collection],
      [2055, 1400, "Fortune Dragon Bangles", "HeadAccessory", "days-of-fortune"]);
    assert.equal(catalog.zhItemName(item), "幸運節龍耳飾");
    assert.equal(catalog.isPaidItem(item), true);
  }
  assert.equal(resolver.scan("龍鱗耳墜｜金鱗耳墜｜幸運節龍耳飾").matched.length, 1);
  assert.equal(resolver.scan("沒有龍鱗耳墜").matched.length, 0);
  assert.equal(resolver.scan("龍鱗耳墜｜月光耳墜｜太陽耳墜").matched.length, 3);
});

test("sun earrings use the player name while preserving the official sunlight identity", () => {
  for (const term of ["太陽耳環", "太陽耳墜", "陽光太陽神圓環"]) {
    const match = resolver.resolve(term);
    assert.deepEqual(match.candidates.map(item => item.guid), ["lv_MnKorJN"]);
    const [item] = match.candidates;
    assert.deepEqual([item.id, item.order, item.name, item.type, item.collection],
      [2290, 1900, "Sunlight Helios Hoops", "HeadAccessory", "days-of-sunlight"]);
    assert.equal(catalog.zhItemName(item), "太陽耳環");
    assert.equal(catalog.saleItemName(item), "太陽耳環");
    assert.equal(catalog.isPaidItem(item), true);
  }
  assert.equal(resolver.scan("太陽耳環｜太陽耳墜").matched.length, 1);
  assert.equal(resolver.scan("沒有太陽耳環").matched.length, 0);
  assert.equal(resolver.scan("太陽耳環｜月光耳墜｜向日葵耳飾").matched.length, 3);
});

test("marshmallow rack aliases resolve the paid snack kit as a single prop", () => {
  for (const term of ["棉花糖架", "烤棉花糖架", "烤棉花糖禮包", "營火點心套組"]) {
    const match = resolver.resolve(term);
    assert.deepEqual(match.candidates.map(item => item.guid), ["TXYOTW9Qyn"]);
    const [item] = match.candidates;
    assert.deepEqual([item.id, item.order, item.name, item.type, item.collection],
      [1915, 5900, "Campfire Snack Kit", "SmallProp", "days-of-sunlight"]);
    assert.equal(catalog.isPaidItem(item), true);
  }
  const repeated = resolver.scan("棉花糖架｜烤棉花糖禮包｜營火點心套組");
  assert.equal(repeated.matched.length, 1);
  assert.equal(repeated.groups.length, 0);
  assert.equal(resolver.scan("沒有棉花糖架").matched.length, 0);
});

test("moonlight earring wording resolves one paid moonlight item without duplicate counting", () => {
  for (const term of ["月光耳墜", "月華耳環", "星月耳環", "月光耳環"]) {
    const match = resolver.resolve(term);
    assert.deepEqual(match.candidates.map(item => item.guid), ["XURacs6BHP"]);
    const [item] = match.candidates;
    assert.deepEqual([item.id, item.order, item.type, item.name, item.collection],
      [2306, 2000, "HeadAccessory", "Moonlight Earrings", "days-of-moonlight"]);
    assert.equal(catalog.isPaidItem(item), true);
  }
  assert.equal(resolver.scan("月光耳墜｜月華耳環｜星月耳環").matched.length, 1);
  assert.equal(resolver.scan("沒有月光耳墜").matched.length, 0);
  assert.equal(resolver.scan("月光耳墜｜幸運節龍耳飾").matched.length, 2);
});

test("office cape aliases refer to the paid founder cape, not the beta reward", () => {
  for (const term of ["辦公室斗", "辦公室斗篷", "辦公室藍斗篷"]) {
    const match = resolver.resolve(term);
    assert.deepEqual(match.candidates.map(item => item.guid), ["DI0RLfo9Sj"]);
    const [item] = match.candidates;
    assert.deepEqual([item.id, item.order, item.name, item.type], [1937, 300, "Founder's Cape", "Cape"]);
    assert.equal(catalog.isPaidItem(item), true);
  }
  assert.deepEqual(resolver.resolve("白底TGC斗篷").candidates.map(item => item.guid), ["xaX_sfWwKV"]);
  assert.equal(resolver.scan("沒有辦公室斗篷").matched.length, 0);
});

test("fortune doll set preserves three official members and respects negative wording", () => {
  for (const [guid, id, order, type, name] of [
    ["rNDDbcjS4G", 1729, 14500, "Hair", "Fortune Bun Hair"],
    ["HnCWgj7aoA", 1728, 9100, "Mask", "Fortune Blushing Mask"],
    ["o8CAzM0x1c", 1727, 12700, "Cape", "Fortune Cape"],
  ]) {
    const item = catalog.wikiItems.find(item => item.guid === guid);
    assert.deepEqual([item.id, item.order, item.type, item.name, item.collection], [id, order, type, name, "days-of-fortune"]);
    assert.equal(catalog.isPaidItem(item), true);
    assert.notEqual(catalog.zhItemName(item), "福娃套裝");
  }
  assert.equal(resolver.scan("沒有福娃套裝").groups.length, 0);
  const repeated = resolver.scan("福娃套裝｜新春福娃套裝");
  assert.equal(new Set(repeated.groups.flatMap(group => group.candidates.map(item => item.guid))).size, 3);
});

test("fortune muralist pants aliases remain paid and separate from white cotton pants", () => {
  for (const term of ["祥雲褲", "壁畫家褲子", "福瑞壁畫家工作服", "兔尾褲", "兔子棉褲"]) {
    const match = resolver.resolve(term);
    assert.deepEqual(match.candidates.map(item => item.guid), ["ADJiva5H2Z"]);
    const [item] = match.candidates;
    assert.deepEqual([item.id, item.order, item.type, item.name, item.collection], [1734, 3600, "OutfitShoes", "Fortune Muralist's Smock", "days-of-fortune"]);
    assert.equal(catalog.isPaidItem(item), true);
    assert.equal(catalog.zhItemName(item), "祥雲褲");
    assert.equal(catalog.saleItemName(item), "祥雲褲");
  }
  assert.equal(resolver.scan("祥雲褲｜壁畫家褲子").matched.length, 1);
  assert.equal(resolver.scan("沒有祥雲褲").matched.length, 0);
  const cotton = resolver.resolve("白棉褲").candidates;
  assert.deepEqual(cotton.map(item => item.guid), ["qrP9vZPLlk"]);
  assert.equal(catalog.isPaidItem(cotton[0]), false);
});

test("white bow wording resolves the paid love cravat rather than a seasonal bowtie", () => {
  for (const term of ["白色領結", "優雅領巾"]) {
    const match = resolver.resolve(term);
    assert.deepEqual(match.candidates.map(item => item.guid), ["PuFWddickP"]);
    const [item] = match.candidates;
    assert.deepEqual([item.id, item.order, item.type, item.name, item.collection], [1755, 4400, "Necklace", "Days of Love Classy Cravat", "days-of-love"]);
    assert.equal(catalog.isPaidItem(item), true);
  }
  assert.equal(resolver.scan("白色領結｜優雅領巾").matched.length, 1);
  assert.equal(resolver.scan("沒有白色領結").matched.length, 0);
  assert.equal(resolver.scan("白色領結｜健行壞脾氣領結｜大耳狗領結").matched.length, 3);
});

test("bloom tea aliases preserve the two paid tables and do not invent generic table identities", () => {
  for (const [guid, id, order, name, terms] of [
    ["sTIyha_lg1", 1766, 3600, "Pink Bloom Teaset", ["櫻花茶桌", "粉紅色花憩茶具"]],
    ["l6GE013zrh", 1771, 3800, "Purple Bloom Teaset", ["紫藤花茶桌", "紫藤花茶具", "紫色花憩茶具"]],
  ]) {
    for (const term of terms) {
      const match = resolver.resolve(term);
      assert.deepEqual(match.candidates.map(item => item.guid), [guid]);
      const [item] = match.candidates;
      assert.deepEqual([item.id, item.order, item.name, item.type, item.collection], [id, order, name, "LargeProp", "days-of-bloom"]);
      assert.equal(catalog.isPaidItem(item), true);
    }
    assert.equal(resolver.scan(terms.join("｜")).matched.length, 1);
  }
  assert.equal(resolver.scan("櫻花茶桌｜紫藤花茶桌").matched.length, 2);
  assert.equal(resolver.scan("沒有櫻花茶桌｜缺紫藤花茶桌").matched.length, 0);
  assert.equal(resolver.scan("雙人茶几｜三人茶桌").matched.length, 0);
});

test("green folded ears and hermit snow boots retain their paid identities", () => {
  for (const [guid, id, order, name, type, terms] of [
    ["2XujEQcN6n", 2931, 7200, "Green Folded Ears", "HairAccessory", ["綠絨卷耳", "綠絨絨卷耳髮飾", "毛茸綠折耳"]],
    ["pT4AVkYVZP", 1979, 2200, "Cozy Hermit Boots", "Shoes", ["隱士雪人靴", "雪人靴", "暖心隱士靴子"]],
  ]) {
    for (const term of terms) {
      const match = resolver.resolve(term);
      assert.deepEqual(match.candidates.map(item => item.guid), [guid]);
      const [item] = match.candidates;
      assert.deepEqual([item.id, item.order, item.name, item.type], [id, order, name, type]);
      assert.equal(catalog.isPaidItem(item), true);
    }
    assert.equal(resolver.scan(terms.join("｜")).matched.length, 1);
  }
  assert.equal(resolver.scan("沒有綠絨卷耳｜沒有雪人靴").matched.length, 0);
});

test("Cinnamoroll head accessory means the mini companion rather than the cape bowtie", () => {
  const match = resolver.resolve("大耳狗頭飾");
  assert.deepEqual(match.candidates.map(item => item.guid), ["eWqTtgnrmt"]);
  const [item] = match.candidates;
  assert.deepEqual([item.id, item.order, item.type, item.name], [2141, 7000, "HairAccessory", "Cinnamoroll Mini Companion"]);
  assert.equal(catalog.isPaidItem(item), true);
  assert.deepEqual(resolver.resolve("大耳狗領結").candidates.map(item => item.guid), ["VZsaoYRkCQ"]);
  assert.equal(resolver.scan("大耳狗頭飾｜大耳狗小夥伴｜迷你大耳狗髮飾").matched.length, 1);
  assert.equal(resolver.scan("大耳狗頭飾｜大耳狗領結｜大耳狗耳朵").matched.length, 3);
  assert.equal(resolver.scan("沒有大耳狗頭飾").matched.length, 0);
});

test("anniversary puppy aliases do not become Cinnamoroll collaboration items", () => {
  for (const [term, guid, id, order, type, name] of [
    ["小狗頭飾", "z648Yl_rsv", 2230, 5300, "HairAccessory", "Skyfest Oreo Headband"],
    ["小狗拖鞋", "YdP0vtpTMi", 3190, 2900, "Shoes", "Oreo Slippers"],
  ]) {
    const match = resolver.resolve(term);
    assert.deepEqual(match.candidates.map(item => item.guid), [guid]);
    const [item] = match.candidates;
    assert.deepEqual([item.id, item.order, item.type, item.name, item.collection], [id, order, type, name, "event-sky-anniversary"]);
    assert.equal(catalog.isPaidItem(item), true);
  }
  assert.equal(resolver.scan("小狗頭飾｜奧利奧小狗頭飾｜奧利奧頭帶").matched.length, 1);
  assert.equal(resolver.scan("沒有小狗頭飾｜沒有小狗拖鞋").matched.length, 0);
  assert.equal(resolver.scan("小狗頭飾｜大耳狗小夥伴｜大耳狗耳朵").matched.length, 3);
});

test("white-gold fur cape aliases retain the paid Winter Ancestor identity", () => {
  for (const term of ["白金絨斗", "白金絨斗篷", "冬日先祖斗篷"]) {
    const match = resolver.resolve(term);
    assert.deepEqual(match.candidates.map(item => item.guid), ["B3YJxxJKJX"]);
    const [item] = match.candidates;
    assert.deepEqual([item.id, item.order, item.name, item.type], [1895, 17000, "Winter Ancestor Cape", "Cape"]);
    assert.equal(catalog.isPaidItem(item), true);
    assert.equal(catalog.zhItemName(item), "冬日先祖斗篷");
  }
  assert.equal(resolver.scan("白金絨斗｜白金絨斗篷｜冬日先祖斗篷").matched.length, 1);
  assert.equal(resolver.scan("沒有白金絨斗").matched.length, 0);
  assert.equal(resolver.scan("白金絨斗｜雪怪斗篷｜雪花斗篷").matched.length, 3);
});

test("yeti cape aliases identify the paid Cozy Hermit Cape without duplicating it", () => {
  for (const term of ["雪怪斗篷", "暖洋洋雪怪斗篷", "暖心隱士斗篷", "Cozy Hermit Cape"]) {
    const match = resolver.resolve(term);
    assert.deepEqual(match.candidates.map(item => item.guid), ["Nep9ocMylo"]);
    const [item] = match.candidates;
    assert.deepEqual([item.id, item.order, item.name, item.type], [1900, 17100, "Cozy Hermit Cape", "Cape"]);
    assert.equal(catalog.isPaidItem(item), true);
    assert.equal(catalog.zhItemName(item), "暖心隱士斗篷");
  }
  assert.equal(resolver.scan("雪怪斗篷｜暖心隱士斗篷").matched.length, 1);
  assert.equal(resolver.scan("沒有雪怪斗篷").matched.length, 0);
});

test("new-year umbrella and fan aliases preserve paid held-prop identities", () => {
  // Fortune fan: https://www.dcard.tw/f/sky/p/257849027
  // Umbrella identity: Days_of_Fortune/2023#Days_of_Fortune_Enchanted_Umbrella
  for (const [guid, id, order, english, terms] of [
    ["uzos22Ysp3", 1735, 4700, "Fortune Enchanted Umbrella", ["新年紙傘", "新年紅傘", "福瑞魔法傘"]],
    ["HEV8fvTQwQ", 2503, 4800, "Fortune Hand Fan", ["新年手扇", "新春摺扇", "福瑞手持扇", "幸運扇子"]],
  ]) {
    for (const term of terms) {
      const match = resolver.resolve(term);
      assert.deepEqual(match.candidates.map(item => item.guid), [guid]);
      const [item] = match.candidates;
      assert.deepEqual([item.id, item.order, item.name, item.type], [id, order, english, "HeldProp"]);
      assert.equal(catalog.isPaidItem(item), true);
    }
  }
  const scan = resolver.scan("新年紙傘｜新年紅傘｜新年手扇｜新春摺扇");
  assert.equal(scan.matched.length, 2, "synonyms must not duplicate items");
  assert.equal(scan.ambiguous.length, 0);
  assert.equal(resolver.scan("沒有新年紙傘｜沒有新年手扇").matched.length, 0);
});

test("rainbow dangling braid remains free and distinct from paid rainbow earrings", () => {
  // Taiwan distinction: https://www.dcard.tw/f/sky/p/239253148
  for (const [term, guid, id, order, name, paid] of [
    ["彩虹耳墜", "4XMYa4Wj-M", 1789, 1500, "Rainbow Braid", false],
    ["彩虹耳釘", "f-X2dDeB9w", 1807, 1600, "Rainbow Earrings", true],
    ["暗彩虹耳墜", "krzIL86J83", 1814, 1800, "Dark Rainbow Earrings", true],
  ]) {
    const result = resolver.resolve(term);
    assert.deepEqual(result.candidates.map(item => item.guid), [guid]);
    const [item] = result.candidates;
    assert.deepEqual([item.id, item.order, item.name, item.type], [id, order, name, "HeadAccessory"]);
    assert.equal(catalog.isPaidItem(item), paid);
  }
  const result = resolver.scan("彩虹耳墜｜彩虹耳釘｜暗彩虹耳墜");
  assert.equal(result.matched.length, 3);
  assert.equal(result.ambiguous.length, 0);
  assert.equal(result.matched.filter(match => catalog.isPaidItem(match.candidates[0])).length, 2);
  assert.equal(resolver.scan("沒有彩虹耳墜").matched.length, 0);
});

test("frequent listing aliases resolve paid shell hairpin and wave hair without matching anniversary props", () => {
  // Identity: Nature/2024 Wave-Touched Hair; Days of Summer Shell Hairpin (2021).
  for (const [term, guid, id, type, display] of [
    ["水漾髮型", "jWAPWGsEd-", 2167, "Hair", "海浪髮型"],
    ["貝殼頭飾", "eruG9WiyJZ", 1908, "HairAccessory", "貝殼髮飾"],
  ]) {
    const match = resolver.resolve(term);
    assert.deepEqual(match.candidates.map(item => item.guid), [guid]);
    const [item] = match.candidates;
    assert.deepEqual([item.id, item.type, catalog.zhItemName(item)], [id, type, display]);
    assert.equal(catalog.isPaidItem(item), true);
  }
  const scan = resolver.scan("水漾髮型｜貝殼頭飾");
  assert.equal(scan.unmatched.length, 0);
  assert.equal(scan.ambiguous.length, 0);
  assert.equal(scan.matched.length, 2);
  assert.equal(resolver.scan("沒有貝殼頭飾").matched.length, 0);
});

test("blue sunglasses player names retain the Nature paid item identity", () => {
  // Taiwan player usage: https://www.youtube.com/watch?v=gYsDdAliO0s
  // Taiwan editorial confirmation: https://apps.apple.com/tw/iphone/story/id1682105205
  const item = catalog.wikiItems.find(item => item.guid === "IOBWcIpOY9");
  assert.deepEqual([item.id, item.order, item.name, item.type], [1787, 2100, "Nature Glasses", "FaceAccessory"]);
  assert.equal(catalog.isPaidItem(item), true);
  assert.equal(catalog.zhItemName(item), "藍色墨鏡");
  assert.equal(catalog.saleItemName(item), "藍色墨鏡");
  for (const term of ["藍色墨鏡", "自然日眼鏡", "自然墨鏡", "海洋日墨鏡", "Nature Glasses"])
    assert.deepEqual(resolver.resolve(term).candidates.map(item => item.guid), [item.guid], term);
});
const resolver = catalog.buildCatalogNameResolver(
  catalog.wikiItems,
  catalog.zhItemSearchNames,
);

test("event hair player names distinguish free braids from paid twin tails", () => {
  // https://www.dcard.tw/f/sky/p/257944195 distinguishes ticket braids and paid twin tails.
  // https://www.dcard.tw/f/sky/p/255652135 uses 海浪髮型 for the 2024 paid hair.
  for (const [guid, id, order, english, name, paid, aliases] of [
    ["V0Y7dn2l4H", 2519, 17500, "Days Of Love Braids", "挑染短辮", false, ["挑染短辮髮型", "日之愛之日辮子"]],
    ["Yxt4jz3je6", 2516, 17400, "Days Of Love Amethyst-Tipped Tails", "挑染雙馬尾", true, ["情人節雙馬尾", "日之愛之日紫水晶尖端尾巴"]],
    ["jWAPWGsEd-", 2167, 15500, "Nature Wave-Touched Hair", "海浪髮型", true, ["自然水漾髮型", "自然海浪輕拂髮型"]],
  ]) {
    const item = catalog.wikiItems.find(item => item.guid === guid);
    assert.deepEqual([item.id, item.order, item.name, item.type], [id, order, english, "Hair"]);
    assert.equal(catalog.zhItemName(item), name);
    assert.equal(catalog.saleItemName(item), name);
    assert.equal(catalog.isPaidItem(item), paid);
    for (const term of [name, english, ...aliases])
      assert.deepEqual(resolver.resolve(term).candidates.map(item => item.guid), [guid], term);
  }
  assert.ok(!resolver.resolve("雙馬尾").candidates.some(item => item.guid === "V0Y7dn2l4H"));
  assert.deepEqual(new Set(resolver.resolve("挑染髮型").candidates.map(item => item.guid)),
    new Set(["V0Y7dn2l4H", "Yxt4jz3je6"]));
  assert.equal(resolver.scan("挑染髮型").matched.length, 0);
  const scan = resolver.scan("挑染短辮｜情人節雙馬尾｜海浪髮型");
  assert.equal(scan.ambiguous.length, 0);
  assert.deepEqual(new Set(scan.matched.map(match => match.candidates[0].guid)),
    new Set(["V0Y7dn2l4H", "Yxt4jz3je6", "jWAPWGsEd-"]));
});

test("common instrument player names retain exact official identities and old aliases", () => {
  // Taiwan player glossary: https://www.dcard.tw/f/sky/p/234859690
  // Independent high-piano usage: https://www.dcard.tw/f/sky/p/235297354
  for (const [guid, id, order, english, group, name, aliases] of [
    ["k1JghrvRyd", 261, 300, "Contrabass", "", "貝斯", ["低音提琴", "屁琴"]],
    ["o8VUub-4vw", 232, 400, "Piano", "", "鋼琴", ["鋼琴鍵盤"]],
    ["M1MCfh7sVo", 905, 1400, "Winter Piano", "SeasonPass", "高音鋼琴", ["冬季鋼琴", "冬日鋼琴"]],
    // Belonging returning spirit: https://daydaynews.cc/video/959594.html
    ["Zvi-5bPtxs", 824, 1000, "Guitar", "SeasonPass", "紅吉他", ["吉他"]],
    // Taiwan glossary: https://forum.gamer.com.tw/Co.php?bsn=33024&sn=4630
    ["xpq4O_F_Md", 1145, 1800, "Lute", "SeasonPass", "琵琶", ["魯特琴"]],
  ]) {
    const item = catalog.wikiItems.find(item => item.guid === guid);
    assert.deepEqual([item.id, item.order, item.name, item.type, item.group], [id, order, english, "Instrument", group]);
    assert.equal(catalog.zhItemName(item), name);
    assert.equal(catalog.saleItemName(item), name);
    assert.equal(catalog.isPaidItem(item), false);
    for (const term of [name, english, ...aliases])
      assert.deepEqual(resolver.resolve(term).candidates.map(item => item.guid), [guid], term);
  }
  assert.deepEqual(new Set(resolver.scan("貝斯｜鋼琴｜高音鋼琴").matched.map(match => match.candidates[0].guid)),
    new Set(["k1JghrvRyd", "o8VUub-4vw", "M1MCfh7sVo"]));
  const scan = resolver.scan("紅吉他｜白吉他｜電吉他｜藍色電吉他｜琵琶");
  assert.equal(scan.ambiguous.length, 0);
  assert.deepEqual(new Set(scan.matched.map(match => match.candidates[0].guid)),
    new Set(["Zvi-5bPtxs", "bOQzUAzYfV", "ARf5D2Bu4v", "hcuS6xsmHg", "xpq4O_F_Md"]));
});

test("rainbow mask variants remain ambiguous unless year or paid variant is explicit", () => {
  // 2026 paid item: https://www.dcard.tw/f/sky/p/261580685
  const paid = catalog.wikiItems.find(item => item.guid === "bQIy02O8pa");
  const free = catalog.wikiItems.find(item => item.guid === "NdTO2GQkMc");
  assert.deepEqual([paid.id, paid.order, paid.name], [3155, 10200, "Rainbow Mask"]);
  assert.deepEqual([free.id, free.order, free.name], [2211, 10000, "Dark Rainbow Mask"]);
  assert.equal(catalog.isPaidItem(paid), true);
  assert.equal(catalog.isPaidItem(free), false);
  for (const name of ["2026彩虹面具", "付費彩虹面具", "彩虹面具禮包"]) {
    assert.deepEqual(resolver.resolve(name).candidates.map(item => item.guid), [paid.guid]);
  }
  for (const name of ["黑彩虹面具", "2024黑彩虹面具", "兌換黑彩虹面具"]) {
    assert.deepEqual(resolver.resolve(name).candidates.map(item => item.guid), [free.guid]);
  }
  assert.deepEqual(new Set(resolver.resolve("彩虹面具").candidates.map(item => item.guid)), new Set([paid.guid, free.guid]));
  assert.equal(resolver.scan("彩虹面具").matched.length, 0);
});

test("reviewed short names agree across wardrobe and sharing without losing old searches", () => {
  for (const [guid, id, order, name, terms] of [
    // Taiwan player description: https://www.dcard.tw/f/sky/p/238946230
    ["bOQzUAzYfV", 1940, 1100, "白吉他", ["音韻吉他", "節奏吉他", "白色吉他"]],
    // Taiwan player usage: https://www.dcard.tw/f/sky/p/256468904
    // Shoulder item also named by https://www.youtube.com/watch?v=1eSi02ackQg
    ["Ay3g-0JAeW", 1913, 4800, "水母肩飾", ["果凍肩部夥伴"]],
    ["gsACsrp16_", 1921, 1700, "夏日涼鞋", ["陽光厚底涼鞋", "夏日涼鞋禮包"]],
    ["NEmfcbHb-I", 1922, 6600, "夏日衝浪板", ["陽光衝浪板", "夏日衝浪禮包"]],
    // Existing reviewed sale names; 3D glasses corroborated by
    // https://www.dcard.tw/f/sky/p/259260519 (not the whole cinema bundle).
    ["5F_G_puJb7", 2539, 13500, "玫瑰斗", ["花憩玫瑰刺繡斗篷"]],
    ["c1sclAR_k8", 3003, 6600, "錦標滑冰服", ["錦標賽俐落滑冰服裝"]],
    ["jcCb_Tc5ms", 3051, 4600, "向日葵裙", ["花憩向日葵夏日洋裝"]],
    ["PuFWddickP", 1755, 4400, "優雅領巾", ["日之愛之日優雅領巾"]],
    ["eruG9WiyJZ", 1908, 6400, "貝殼髮飾", ["日之夏日貝殼髮夾", "貝殼髮夾"]],
    ["IZNxLq33GB", 2657, 2800, "3D眼鏡", ["週年電影院 3D 眼鏡"]],
    // Taiwan player usage: https://www.dcard.tw/f/sky/p/256819080
    ["4c-yCAGV5U", 2323, 6000, "襯衫套裝", ["時尚紳士西裝"]],
    ["gZoseEbqGz", 2324, 2500, "單邊眼鏡", ["時尚紳士單片眼鏡"]],
    ["yuO7uDMle8", 2325, 4900, "領帶", ["時尚紳士領帶"]],
    ["BWUjIgnjnu", 1844, 2300, "火焰墨鏡", ["時尚火焰墨鏡", "時尚火焰太陽眼鏡"]],
    ["3HeVKqT39a", 1843, 2400, "愛心墨鏡", ["時尚愛心墨鏡", "時尚愛心太陽眼鏡"]],
    ["E7RAu04_xI", 1841, 5800, "闊腿牛仔褲", ["時尚寬型腿部牛仔褲", "闊腿牛仔褲禮包"]],
    ["bcKjyS-_p3", 1870, 16500, "薄紗斗", ["惡作劇薄紗斗篷", "蛛絲斗篷", "蛛絲斗"]],
    ["txwX8D1yKh", 1871, 16600, "蟹伯爵斗", ["惡作劇蟹伯爵披風", "吸蟹伯爵斗篷", "吸蟹伯爵斗"]],
    ["jc8Pyt7eLR", 2716, 2400, "蝴蝶白靈花", ["蝴蝶花紀念品", "蝴蝶花朵紀念物"]],
  ]) {
    const item = catalog.wikiItems.find(item => item.guid === guid);
    assert.equal(item.id, id);
    assert.equal(item.order, order);
    assert.equal(catalog.zhItemName(item), name);
    assert.equal(catalog.saleItemName(item), name);
    assert.equal(catalog.isPaidItem(item), true);
    for (const term of [name, ...terms]) {
      assert.deepEqual(resolver.resolve(term).candidates.map(item => item.guid), [guid], term);
    }
  }
});

test("Sanctuary graduation handpan stays distinguishable from the paid recolor", () => {
  // Player comparison: https://www.dcard.tw/f/sky/p/238946230
  // Paid alias: https://forum.gamer.com.tw/Co.php?bsn=33024&sn=5577
  const ultimate = catalog.wikiItems.find(item => item.guid === "Hvq52gCeih");
  const paid = catalog.wikiItems.find(item => item.guid === "McTvO9Z8EQ");
  assert.deepEqual([ultimate.id, ultimate.order, ultimate.name], [394, 1500, "Sanctuary Ultimate Handpan"]);
  assert.deepEqual([paid.id, paid.order, paid.name], [1941, 1600, "Triumph Handpan"]);
  assert.equal(catalog.zhItemName(ultimate), "聖島手碟");
  assert.equal(catalog.saleItemName(ultimate), "聖島手碟");
  assert.equal(catalog.isPaidItem(ultimate), false);
  assert.equal(catalog.isPaidItem(paid), true);
  for (const term of ["聖島手碟", "聖島季畢業禮手碟"]) {
    assert.deepEqual(resolver.resolve(term).candidates.map(item => item.guid), [ultimate.guid]);
  }
  assert.deepEqual(resolver.resolve("霞谷手盤").candidates.map(item => item.guid), [paid.guid]);
  assert.ok(catalog.zhItemSearchNames(ultimate).includes("聖島季畢業禮道具"));
});

test("graduation drum and bugle use recognizable instrument names with stable identities", () => {
  // Taiwan player terms: https://www.dcard.tw/f/sky/p/238946230
  for (const [guid, id, order, english, name, aliases] of [
    ["wGQSuhVWXD", 410, 1700, "Prophecy Ultimate Drum", "預言鼓", ["預言季鼓", "預言季畢業禮鼓", "預言季畢業禮道具"]],
    ["B59f4_ru60", 438, 1900, "Assembly Ultimate Bugle", "重組小號", ["重組季小號", "重組季畢業禮號角", "集結季畢業禮道具"]],
  ]) {
    const item = catalog.wikiItems.find(item => item.guid === guid);
    assert.deepEqual([item.id, item.order, item.name], [id, order, english]);
    assert.equal(catalog.zhItemName(item), name);
    assert.equal(catalog.saleItemName(item), name);
    assert.equal(catalog.isPaidItem(item), false);
    for (const term of [name, ...aliases]) {
      assert.deepEqual(resolver.resolve(term).candidates.map(item => item.guid), [guid], term);
    }
  }
});

test("graduation umbrella and camera names identify the item rather than only the season", () => {
  // Seasonal item references: https://forum.gamer.com.tw/Co.php?bsn=33024&sn=2316
  for (const [guid, id, order, english, name, terms] of [
    ["2o3CEU9QhM", 371, 3800, "Lightseekers Ultimate Umbrella", "大傘", ["追光大傘", "大雨傘", "追光季畢業禮道具"]],
    ["W-3Nh_yWGv", 637, 3900, "Moments Ultimate Camera", "拾光畢業相機", ["拾光季畢業相機", "拾光季畢業禮道具"]],
  ]) {
    const item = catalog.wikiItems.find(item => item.guid === guid);
    assert.deepEqual([item.id, item.order, item.name], [id, order, english]);
    assert.equal(catalog.zhItemName(item), name);
    assert.equal(catalog.saleItemName(item), name);
    assert.equal(catalog.isPaidItem(item), false);
    for (const term of [name, ...terms]) {
      assert.deepEqual(resolver.resolve(term).candidates.map(item => item.guid), [guid], term);
    }
  }
  const regularCamera = catalog.wikiItems.find(item => item.guid === "K_OhSP_gST");
  assert.equal(catalog.zhItemName(regularCamera), "相機");
  assert.notEqual(catalog.saleItemName(regularCamera), "拾光畢業相機");
});

test("Moomin red umbrella keeps its identity and does not replace the Lightseekers umbrella", () => {
  // Taiwan player description: https://www.dcard.tw/f/sky/p/256907106
  const item = catalog.wikiItems.find(item => item.guid === "dkfdFCaemY");
  assert.deepEqual([item.id, item.order, item.name, item.group, item.collection],
    [2341, 4100, "Moomin Ultimate Umbrella", "Ultimate", "moomin"]);
  assert.equal(catalog.zhItemName(item), "姆明紅傘");
  assert.equal(catalog.saleItemName(item), "姆明紅傘");
  assert.equal(catalog.isPaidItem(item), false);
  for (const term of ["姆明紅傘", "姆明傘", "姆明雨傘", "姆明大傘", "姆明季畢業傘", "姆明季畢業禮道具"]) {
    assert.deepEqual(resolver.resolve(term).candidates.map(value => value.guid), [item.guid], term);
  }
  assert.deepEqual(resolver.resolve("大傘").candidates.map(value => value.guid), ["2o3CEU9QhM"]);
});

test("Flight graduation outfit names identify the pants and retain official identity", () => {
  // Pants context: https://game.xiaomi.com/viewpoint/1312958803_1631021803629_13
  // Identity is verified independently against the official catalog, not the article's test-server details.
  const item = catalog.wikiItems.find(item => item.guid === "SxX0bNDJaR");
  assert.deepEqual([item.id, item.order, item.name, item.group], [478, 1200, "Flight Ultimate Outfit", "Ultimate"]);
  assert.equal(catalog.zhItemName(item), "飛行畢業褲");
  assert.equal(catalog.saleItemName(item), "飛行畢業褲");
  assert.equal(catalog.isPaidItem(item), false);
  for (const name of ["飛行畢業褲", "風行季畢業禮", "風行季畢業禮服裝", "飛行季畢業褲", "飛翔季畢業褲"]) {
    assert.deepEqual(resolver.resolve(name).candidates.map(item => item.guid), [item.guid], name);
  }
});

test("paid summer surfboard stays distinct from the 2026 sporty surfboard", () => {
  // SkyGame-Data 1.3.10: separate official IDs/orders; only the 2023 board has IAPs.
  const item = catalog.wikiItems.find(item => item.guid === "amo581C-E4");
  assert.equal(item.id, 3274);
  assert.equal(item.order, 6650);
  assert.equal(item.name, "Sunlight Sporty Surfboard");
  assert.equal(catalog.isPaidItem(item), false);
  assert.deepEqual(resolver.resolve(catalog.zhItemName(item)).candidates.map(item => item.guid), [item.guid]);
});

test("spider hair uses the evidenced short name and preserves old searches", () => {
  const item = catalog.wikiItems.find(item => item.guid === "ARZC1Eg2jx");
  assert.equal(item.type, "Hair");
  assert.equal(catalog.zhItemName(item), "蜘蛛頭");
  assert.equal(catalog.isPaidItem(item), true);
  for (const name of ["蜘蛛頭", "蜘蛛龐克", "惡作劇蜘蛛飛機頭"]) {
    assert.deepEqual(resolver.resolve(name).candidates.map(item => item.guid), [item.guid]);
  }
});

test("resolves a unique player-facing name to its official GUID", () => {
  const match = resolver.resolve("星夜之傘");
  assert.ok(match);
  assert.equal(match.candidates.length, 1);
  assert.equal(match.candidates[0].name, "Starry Night's Canopy");
  assert.ok(match.candidates[0].guid);
});

test("resolves the Little Prince sword outfit from seller wording", () => {
  const match = resolver.resolve("小王子佩劍禮服");
  assert.ok(match);
  assert.equal(match.candidates.length, 1);
  assert.equal(match.candidates[0].guid, "l_C7GM60an");
  assert.equal(catalog.isLimitedItem(match.candidates[0]), true);
});

test("resolves reviewed event wording without changing paid identity", () => {
  const cases = [
    ["玉兔拖鞋", "MuQrbnmbdp", true],
    ["玉兔髮飾", "EEFIpR6x7Q", true],
    ["玉兔尾巴頸飾", "inAM509HYO", false],
    ["活力海牛耳飾", "y69WKTTyw7", true],
    ["活力海牛頸飾", "cXaPt2zi0Q", true],
    ["週年影院沙發椅", "P09UDA73qQ", false],
    // SkyGame-Data 1.3.10: Beta Cape offer IquijQ-cfu is zero-price, not a paid bundle.
    ["白底TGC斗篷", "xaX_sfWwKV", false],
    ["蛛絲斗篷", "bcKjyS-_p3", true],
    ["惡作劇飛行掃帚道具", "8rYQfi8VP3", true],
    ["彩虹小花髮飾", "KpS-2FdasB", true],
    ["兔兔頭飾", "EEFIpR6x7Q", true],
    ["兔兔拖鞋", "MuQrbnmbdp", true],
    ["南瓜擺飾", "nMt5KsLO6Y", true],
    ["雪花頭飾", "VZyiD3Wmtp", true],
    ["宏音海螺", "gHfkqCK-A8", true],
    ["海浪斗篷", "wMsUtkvt3s", true],
    ["擬人聲樂器", "K0NBv__mv8", true],
    ["雛鳥之琴", "1xIwQnxHV-", true],
    ["星夜斗篷", "tz-IwazQ7k", true],
    ["彩繪面具", "Z9HZ5p9DX7", true],
    ["大耳狗娃娃", "Pyk6fYvTVM", true],
    ["蝴蝶白靈花", "jc8Pyt7eLR", true],
    ["星夜面具", "C3Amjr4SgJ", true],
  ];
  for (const [term, guid, paid] of cases) {
    const match = resolver.resolve(term);
    assert.ok(match, term);
    assert.equal(match.method, "exact", term);
    assert.deepEqual(match.candidates.map((item) => item.guid), [guid], term);
    assert.equal(catalog.isPaidItem(match.candidates[0]), paid, term);
  }
});

test("uses reviewed player display names for the Drive-confirmed paid items", () => {
  const cases = [
    ["EEFIpR6x7Q", "兔兔頭飾"],
    ["MuQrbnmbdp", "兔兔拖鞋"],
    ["nMt5KsLO6Y", "南瓜擺飾"],
    ["VZyiD3Wmtp", "雪花頭飾"],
    ["gHfkqCK-A8", "宏音海螺"],
    ["wMsUtkvt3s", "海浪斗篷"],
    ["1xIwQnxHV-", "雛鳥之琴"],
    ["tz-IwazQ7k", "星夜斗篷"],
    ["Z9HZ5p9DX7", "彩繪面具"],
    ["Pyk6fYvTVM", "大耳狗娃娃"],
    ["jc8Pyt7eLR", "蝴蝶白靈花"],
    ["C3Amjr4SgJ", "星夜面具"],
    ["K0NBv__mv8", "人聲樂器"],
  ];
  for (const [guid, displayName] of cases) {
    const item = catalog.wikiItems.find((candidate) => candidate.guid === guid);
    assert.ok(item, guid);
    assert.equal(catalog.zhItemName(item), displayName, guid);
    assert.equal(catalog.isPaidItem(item), true, guid);
  }
});

test("does not import a China-only store term into the global resolver", () => {
  assert.equal(resolver.resolve("四葉草頭飾"), null);
});

test("keeps reviewed ultimate gifts distinct from season pendants", () => {
  const graduationGuids = [
    "1IhlCcq61j",
    "FjxHIvszIu",
    "cbWKMsAh7H",
    "nBg1iBLlGM",
    "8z8SeKQRk8",
    "FlOSNmw_38",
  ];
  const pendantGuids = ["TQUcvFL8k7", "JCRIpETL35", "9uVcch8mbe", "1uyZfKjJg5"];
  for (const guid of graduationGuids) {
    const item = catalog.wikiItems.find((candidate) => candidate.guid === guid);
    assert.ok(item, guid);
    assert.equal(catalog.isGraduationGift(item), true, guid);
  }
  for (const guid of pendantGuids) {
    const item = catalog.wikiItems.find((candidate) => candidate.guid === guid);
    assert.ok(item, guid);
    assert.equal(catalog.isGraduationGift(item), false, guid);
  }
});

test("never guesses between same-named catalog items", () => {
  const match = resolver.resolve("Moonlight Lantern");
  assert.ok(match);
  assert.ok(match.candidates.length > 1);
  assert.deepEqual(
    new Set(match.candidates.map((item) => item.guid)).size,
    match.candidates.length,
  );
});

test("keeps bundle aliases as multiple candidates instead of one fake item", () => {
  const match = resolver.resolve("林克套組");
  assert.ok(match);
  assert.ok(match.candidates.length >= 3);
  assert.ok(match.candidates.every((item) => item.guid));
});

test("expands only confirmed player-facing set aliases during a text scan", () => {
  const result = resolver.scan("林克套組｜絆愛三件套");
  assert.equal(result.groups.length, 2);
  assert.equal(result.ambiguous.length, 0);
  assert.deepEqual(
    result.groups.map((group) => group.candidates.length),
    [3, 3],
  );
});

const confirmedSets = new Map([
  ["錦鯉套裝", ["A26TJj3cSl", "mzF6ZaHa1s"]],
  ["福娃套裝", ["rNDDbcjS4G", "HnCWgj7aoA", "o8CAzM0x1c"]],
  ["新春福娃套裝", ["rNDDbcjS4G", "HnCWgj7aoA", "o8CAzM0x1c"]],
  ["貓咪耳尾", ["Dhkf_3dAhf", "wXLGNti3db"]],
  ["冥龍耳尾組", ["Io4R50c-s1", "nBIm3PkDea"]],
  ["海牛耳尾組", ["cXaPt2zi0Q", "y69WKTTyw7"]],
  ["爆米花組", ["IZNxLq33GB", "vPenDMkJkY"]],
  ["週年影院套餐", ["IZNxLq33GB", "vPenDMkJkY"]],
  ["超凡風旅", ["OfOc3xQdCQ", "RpAC3rlPrR", "TfItBIVTeP"]],
  ["姆明耳尾組", ["3gb3myYbBB", "JIMbTWase4"]],
  ["姆明飾品套裝", ["3gb3myYbBB", "JIMbTWase4"]],
  ["冥龍套裝", ["Io4R50c-s1", "nBIm3PkDea"]],
  ["活力海牛套裝", ["cXaPt2zi0Q", "y69WKTTyw7"]],
  ["星夜披風套裝", ["tgeTchWQfN", "tz-IwazQ7k"]],
  ["林克套組", ["4c9HLTfREP", "KtlqKC7whS", "MHArTLwxyq"]],
  ["絆愛三件套", ["FLMn1Hib7k", "daH57TClK7", "u7q3xg2y55"]],
]);

test("pins every confirmed player-facing set to its reviewed GUID members", () => {
  for (const [term, expected] of confirmedSets) {
    const result = resolver.scan(term);
    assert.equal(result.groups.length, 1, term);
    assert.deepEqual(
      result.groups[0].candidates.map((item) => item.guid).sort(),
      [...expected].sort(),
      term,
    );
  }
});

test("scans listing separators and excludes ambiguous or unknown terms", () => {
  const result = resolver.scan("星夜之傘⸝Moonlight Lantern⸝完全不存在的道具");
  assert.equal(result.matched.length, 1);
  assert.equal(result.matched[0].candidates[0].name, "Starry Night's Canopy");
  assert.equal(result.groups.length, 0);
  assert.equal(result.excluded.length, 0);
  assert.equal(result.ambiguous.length, 1);
  assert.ok(result.ambiguous[0].candidates.length > 1);
  assert.equal(result.unmatched.length, 1);
});

test("does not turn explicitly missing items into owned GUIDs", () => {
  const result = resolver.scan(
    "沒有星夜之傘｜缺星夜之傘｜不含星夜之傘｜沒有：星夜之傘｜已售星夜之傘｜不帶星夜之傘｜未收星夜之傘｜星夜之傘拔掉",
  );
  assert.equal(result.matched.length, 0);
  assert.equal(result.excluded.length, 1);
  assert.equal(result.excluded[0].candidates[0].name, "Starry Night's Canopy");
});

test("finds multiple non-overlapping item names in one listing segment", () => {
  const result = resolver.scan("九色鹿鹿角 九色鹿面具");
  assert.deepEqual(
    new Set(result.matched.map((match) => match.candidates[0].name)),
    new Set([
      "Gift of the Nine-Colored Deer Antlers",
      "Gift of the Nine-Colored Deer Mask",
    ]),
  );
});

test("keeps the item name before a colon", () => {
  const result = resolver.scan("九色鹿面具：有");
  assert.equal(result.matched.length, 1);
  assert.equal(
    result.matched[0].candidates[0].name,
    "Gift of the Nine-Colored Deer Mask",
  );
});
