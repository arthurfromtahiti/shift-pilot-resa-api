// Transferts inter-îles — données en mémoire, pilote de démonstration.

const transfers = [
  { id: 1, from: "Papeete", to: "Moorea", seats: 40, sold: 12, price: 3500 },
  { id: 2, from: "Papeete", to: "Bora Bora", seats: 60, sold: 60, price: 21000 },
  { id: 3, from: "Raiatea", to: "Tahaa", seats: 20, sold: 5, price: 1800 },
];

function listTransfers() {
  return transfers;
}

function seatsLeft(transfer) {
  return transfer.seats - transfer.sold;
}

function isFull(transfer) {
  return seatsLeft(transfer) === 0;
}

module.exports = { listTransfers, seatsLeft, isFull };
