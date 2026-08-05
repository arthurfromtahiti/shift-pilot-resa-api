const { test } = require("node:test");
const assert = require("node:assert/strict");
const { listTransfers, seatsLeft, isFull } = require("../src/transfers");

test("seatsLeft calcule les places restantes", () => {
  assert.equal(seatsLeft({ seats: 40, sold: 12 }), 28);
});

test("isFull detecte un transfert complet", () => {
  assert.equal(isFull({ seats: 60, sold: 60 }), true);
  assert.equal(isFull({ seats: 40, sold: 12 }), false);
});

test("listTransfers retourne les 3 transferts", () => {
  assert.equal(listTransfers().length, 3);
});
