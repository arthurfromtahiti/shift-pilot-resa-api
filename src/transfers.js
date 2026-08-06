// Transferts inter-îles — données en mémoire, pilote de démonstration.

const { randomUUID } = require("node:crypto");

const transfers = [
  { id: 1, from: "Papeete", to: "Moorea", seats: 40, sold: 12, price: 3500 },
  { id: 2, from: "Papeete", to: "Bora Bora", seats: 60, sold: 60, price: 21000 },
  { id: 3, from: "Raiatea", to: "Tahaa", seats: 20, sold: 5, price: 1800 },
];

const reservations = new Map();

function listTransfers() {
  return transfers;
}

function seatsLeft(transfer) {
  return transfer.seats - transfer.sold;
}

function isFull(transfer) {
  return seatsLeft(transfer) === 0;
}

function bookSeats(transferId, seats = 1) {
  if (!Number.isInteger(seats) || seats < 1) return { ok: false, reason: "invalid_seats" };
  const transfer = transfers.find((t) => t.id === transferId);
  if (!transfer) return { ok: false, reason: "not_found" };
  if (seatsLeft(transfer) < seats) return { ok: false, reason: "full" };
  transfer.sold += seats;
  const reservationId = randomUUID();
  reservations.set(reservationId, { transferId, seats });
  return { ok: true, reservationId, seatsLeft: seatsLeft(transfer) };
}

function cancelReservation(reservationId) {
  const reservation = reservations.get(reservationId);
  if (!reservation) return { ok: false, reason: "not_found" };
  const transfer = transfers.find((t) => t.id === reservation.transferId);
  transfer.sold -= reservation.seats;
  reservations.delete(reservationId);
  return { ok: true, seatsLeft: seatsLeft(transfer) };
}

module.exports = { listTransfers, seatsLeft, isFull, bookSeats, cancelReservation };
