const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const server = require("../src/server");

let baseUrl;

before(() => new Promise((resolve) => {
  server.listen(0, () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    resolve();
  });
}));

after(() => new Promise((resolve) => server.close(resolve)));

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function deleteRequest(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${baseUrl}${path}`, { method: "DELETE" }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("POST /transfers/1/reserve → 200, seatsLeft diminue de 1", async () => {
  const res = await postJson("/transfers/1/reserve", {});
  assert.equal(res.status, 200);
  assert.equal(res.body.transferId, 1);
  // transfer 1 : seats=40, sold=12 → seatsLeft=28 → après réservation seatsLeft=27
  assert.equal(res.body.seatsLeft, 27);
});

test("POST /transfers/2/reserve (complet) → 409", async () => {
  const res = await postJson("/transfers/2/reserve", {});
  assert.equal(res.status, 409);
  assert.equal(res.body.error, "Transfer full");
});

test("POST /transfers/999/reserve (inexistant) → 404", async () => {
  const res = await postJson("/transfers/999/reserve", {});
  assert.equal(res.status, 404);
  assert.equal(res.body.error, "Transfer not found");
});

test("POST /transfers/3/reserve seats=0 → 400", async () => {
  const res = await postJson("/transfers/3/reserve", { seats: 0 });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "seats must be a positive integer");
});

test("POST /transfers/3/reserve seats=-1 → 400", async () => {
  const res = await postJson("/transfers/3/reserve", { seats: -1 });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "seats must be a positive integer");
});

test("POST /transfers/3/reserve seats=1.5 (non-entier) → 400", async () => {
  const res = await postJson("/transfers/3/reserve", { seats: 1.5 });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "seats must be a positive integer");
});

test("POST /reserve retourne un reservationId", async () => {
  const res = await postJson("/transfers/3/reserve", {});
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.reservationId, "string");
  assert.ok(res.body.reservationId.length > 0);
  assert.equal(res.body.transferId, 3);
});

test("DELETE /transfers/:id/reservations/:reservationId → 200 avec seatsLeft correct", async () => {
  const book = await postJson("/transfers/3/reserve", { seats: 2 });
  assert.equal(book.status, 200);
  const seatsAfterBook = book.body.seatsLeft;
  const del = await deleteRequest(`/transfers/3/reservations/${book.body.reservationId}`);
  assert.equal(del.status, 200);
  assert.equal(del.body.seatsLeft, seatsAfterBook + 2);
});

test("DELETE /transfers/3/reservations/unknown → 404", async () => {
  const res = await deleteRequest("/transfers/3/reservations/00000000-0000-0000-0000-000000000000");
  assert.equal(res.status, 404);
  assert.equal(res.body.error, "Reservation not found");
});
