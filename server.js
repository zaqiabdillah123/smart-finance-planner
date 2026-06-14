const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || process.argv[2]) || 5500;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");
let memoryHistory = [];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, "[]\n", "utf8");
  }
}

function readHistory() {
  ensureDataFile();
  try {
    const data = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
    memoryHistory = Array.isArray(data) ? data : [];
    return memoryHistory;
  } catch {
    return memoryHistory;
  }
}

function writeHistory(history) {
  ensureDataFile();
  memoryHistory = history;
  const temporaryFile = path.join(DATA_DIR, `history-${process.pid}.tmp`);
  try {
    fs.writeFileSync(temporaryFile, `${JSON.stringify(history, null, 2)}\n`, "utf8");
    try {
      fs.renameSync(temporaryFile, HISTORY_FILE);
    } catch {
      fs.copyFileSync(temporaryFile, HISTORY_FILE);
      fs.unlinkSync(temporaryFile);
    }
    return true;
  } catch (error) {
    try {
      if (fs.existsSync(temporaryFile)) {
        fs.unlinkSync(temporaryFile);
      }
    } catch {
      // Data tetap tersedia di memori selama server hidup.
    }
    console.warn(`Riwayat hanya tersimpan sementara: ${error.message}`);
    return false;
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100_000) {
        reject(new Error("Payload terlalu besar."));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Format JSON tidak valid."));
      }
    });

    request.on("error", reject);
  });
}

function parseAmount(value) {
  if (typeof value === "number") {
    return value;
  }
  return Number(String(value || "").replace(/[^\d]/g, ""));
}

function validateFinanceInput(payload) {
  const name = String(payload.name || "").trim();
  const totalMoney = parseAmount(payload.totalMoney);
  const monthlyIncome = parseAmount(payload.monthlyIncome);
  const savingTarget = parseAmount(payload.savingTarget);

  if (name.length < 2 || name.length > 80) {
    return { error: "Nama harus terdiri dari 2 sampai 80 karakter." };
  }
  if (![totalMoney, monthlyIncome, savingTarget].every(Number.isFinite)) {
    return { error: "Semua nilai keuangan harus berupa angka." };
  }
  if (totalMoney < 0 || monthlyIncome <= 0 || savingTarget <= 0) {
    return { error: "Pendapatan dan target harus lebih besar dari nol." };
  }
  if ([totalMoney, monthlyIncome, savingTarget].some((amount) => amount > 1_000_000_000_000)) {
    return { error: "Nilai keuangan melebihi batas yang didukung." };
  }

  return { name, totalMoney, monthlyIncome, savingTarget };
}

function calculatePlan(input) {
  const monthlyExpense = Math.round(input.monthlyIncome * 0.5);
  const monthlySavings = Math.round(input.monthlyIncome * 0.2);
  const emergencyTarget = monthlyExpense * 6;
  const goalProgress = Math.min(100, Math.round((input.totalMoney / input.savingTarget) * 100));
  const emergencyCoverage = emergencyTarget === 0
    ? 0
    : Math.min(100, Math.round((input.totalMoney / emergencyTarget) * 100));
  const remainingTarget = Math.max(0, input.savingTarget - input.totalMoney);
  const monthsToTarget = monthlySavings > 0 ? Math.ceil(remainingTarget / monthlySavings) : null;
  const status = emergencyCoverage >= 100
    ? "Sehat"
    : emergencyCoverage >= 50
      ? "Cukup"
      : "Perlu Perhatian";

  return {
    ...input,
    monthlyExpense,
    monthlySavings,
    emergencyTarget,
    emergencyCoverage,
    goalProgress,
    remainingTarget,
    monthsToTarget,
    status,
    createdAt: new Date().toISOString()
  };
}

async function handleApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, { status: "ok" });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/history") {
    sendJson(response, 200, { history: readHistory().slice(0, 12) });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/finance") {
    try {
      const payload = await readJsonBody(request);
      const validation = validateFinanceInput(payload);

      if (validation.error) {
        sendJson(response, 400, { error: validation.error });
        return true;
      }

      const result = calculatePlan(validation);
      const history = readHistory();
      history.unshift({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ...result
      });
      const persisted = writeHistory(history.slice(0, 100));
      const message = persisted
        ? "Rencana keuangan berhasil dihitung."
        : "Rencana berhasil dihitung. Riwayat tersimpan sementara selama server aktif.";
      sendJson(response, 201, { message, result, persisted });
    } catch (error) {
      sendJson(response, 400, { error: error.message || "Permintaan tidak dapat diproses." });
    }
    return true;
  }

  return false;
}

function serveStatic(response, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(ROOT, `.${decodeURIComponent(requestedPath)}`);
  const relativePath = path.relative(ROOT, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Halaman tidak ditemukan.");
      return;
    }

    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": contentType.startsWith("text/html") ? "no-cache" : "public, max-age=3600"
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

ensureDataFile();

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (url.pathname.startsWith("/api/")) {
    const handled = await handleApi(request, response, url.pathname);
    if (!handled) {
      sendJson(response, 404, { error: "Endpoint tidak ditemukan." });
    }
    return;
  }

  serveStatic(response, url.pathname);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Smart Finance Planner berjalan di http://127.0.0.1:${PORT}`);
});
