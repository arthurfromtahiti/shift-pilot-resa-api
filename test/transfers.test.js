const { test } = require("node:test");
const assert = require("node:assert/strict");
const { listTransfers, seatsLeft, isFull, bookSeats, cancelReservation } = require("../src/transfers");

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

test("bookSeats rejette seats non entier positif", () => {
  assert.deepEqual(bookSeats(1, 0), { ok: false, reason: "invalid_seats" });
  assert.deepEqual(bookSeats(1, -1), { ok: false, reason: "invalid_seats" });
  assert.deepEqual(bookSeats(1, 1.5), { ok: false, reason: "invalid_seats" });
  assert.deepEqual(bookSeats(1, "2"), { ok: false, reason: "invalid_seats" });
});

test("bookSeats retourne un reservationId", () => {
  const result = bookSeats(3, 1);
  assert.equal(result.ok, true);
  assert.equal(typeof result.reservationId, "string");
  assert.ok(result.reservationId.length > 0);
  assert.equal(typeof result.seatsLeft, "number");
});

test("cancelReservation annule une réservation existante et libère les sièges", () => {
  const booked = bookSeats(3, 2);
  assert.equal(booked.ok, true);
  const seatsBeforeCancel = booked.seatsLeft;
  const cancelled = cancelReservation(booked.reservationId, 3);
  assert.deepEqual(cancelled, { ok: true, seatsLeft: seatsBeforeCancel + 2 });
});

test("cancelReservation retourne not_found pour un ID inconnu", () => {
  assert.deepEqual(cancelReservation("00000000-0000-0000-0000-000000000000", 1), { ok: false, reason: "not_found" });
});

test("cancelReservation retourne not_found quand le transferId ne correspond pas à la réservation", () => {
  const booked = bookSeats(3, 1);
  assert.equal(booked.ok, true);
  assert.deepEqual(cancelReservation(booked.reservationId, 1), { ok: false, reason: "not_found" });
  cancelReservation(booked.reservationId, 3);
});

test("cancelReservation ne peut pas annuler deux fois la même réservation", () => {
  const booked = bookSeats(3, 1);
  cancelReservation(booked.reservationId, 3);
  assert.deepEqual(cancelReservation(booked.reservationId, 3), { ok: false, reason: "not_found" });
});
