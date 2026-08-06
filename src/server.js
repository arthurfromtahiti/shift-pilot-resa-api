const http = require("node:http");
const { URL } = require("node:url");
const { listTransfers, seatsLeft, bookSeats, cancelReservation } = require("./transfers");

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/transfers" && req.method === "GET") {
    return sendJson(res, 200, listTransfers().map((t) => ({
      id: t.id,
      from: t.from,
      to: t.to,
      price: t.price,
      seatsLeft: seatsLeft(t),
    })));
  }

  const reserveMatch = url.pathname.match(/^\/transfers\/(\d+)\/reserve$/);
  if (reserveMatch && req.method === "POST") {
    const id = parseInt(reserveMatch[1], 10);
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      let seats;
      try {
        const parsed = body ? JSON.parse(body) : {};
        seats = parsed.seats;
      } catch {
        seats = undefined;
      }
      const seatsValue = seats ?? 1;
      if (!Number.isInteger(seatsValue) || seatsValue < 1) {
        return sendJson(res, 400, { error: "seats must be a positive integer" });
      }
      const result = bookSeats(id, seatsValue);
      if (result.reason === "not_found") return sendJson(res, 404, { error: "Transfer not found" });
      if (result.reason === "full") return sendJson(res, 409, { error: "Transfer full" });
      return sendJson(res, 200, { reservationId: result.reservationId, transferId: id, seatsLeft: result.seatsLeft });
    });
    return;
  }

  const cancelMatch = url.pathname.match(/^\/transfers\/(\d+)\/reservations\/([^/]+)$/);
  if (cancelMatch && req.method === "DELETE") {
    const reservationId = cancelMatch[2];
    const result = cancelReservation(reservationId);
    if (!result.ok) return sendJson(res, 404, { error: "Reservation not found" });
    return sendJson(res, 200, { seatsLeft: result.seatsLeft });
  }

  sendJson(res, 404, { error: "Not found" });
});

const PORT = process.env.PORT || 3100;
if (require.main === module) {
  server.listen(PORT, () => console.log(`resa-api on :${PORT}`));
}
module.exports = server;
