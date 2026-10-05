import { fitWholeAccountModel, predictFreshModel } from "../app/valuation-fresh-core.js";
let text = "";
for await (const part of process.stdin) text += part;
const { train, test, seasons, priceKind, ridge = 1 } = JSON.parse(text);
const model = fitWholeAccountModel(train, { seasons, priceKind, ridge });
console.log(JSON.stringify(test.map(row => predictFreshModel(model, row).midpoint)));
