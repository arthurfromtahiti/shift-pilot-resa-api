const http = require("node:http");
const { URL } = require("node:url");
const { listTransfers, seatsLeft } = require("./transfers");

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

  sendJson(res, 404, { error: "Not found" });
});

const PORT = process.env.PORT || 3100;
if (require.main === module) {
  server.listen(PORT, () => console.log(`resa-api on :${PORT}`));
}
module.exports = server;
