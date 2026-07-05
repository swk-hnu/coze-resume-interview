"use strict";

const express = require("express");
const path = require("path");

const { getPublicConfig, getRuntimeConfig } = require("./lib/coze-proxy");

const DEFAULT_API_BASE = "https://api.coze.cn";
const ROOT_DIR = __dirname;
const PORT = Number(process.env.PORT || 3000);
const RAW_LIMIT = "25mb";

const app = express();
const rawBodyParser = express.raw({ type: "*/*", limit: RAW_LIMIT });

app.disable("x-powered-by");

app.get("/api/config", (_req, res) => {
  sendJson(res, 200, getPublicConfig());
});

app.post("/api/workflow/run", rawBodyParser, async (req, res) => {
  await proxyWorkflowJson(req, res, "/v1/workflow/run");
});

app.post("/api/workflow/resume", rawBodyParser, async (req, res) => {
  await proxyWorkflowJson(req, res, "/v1/workflows/resume");
});

app.post("/api/workflow/stream_run", rawBodyParser, async (req, res) => {
  await proxyWorkflowJson(req, res, "/v1/workflow/stream_run");
});

app.post("/api/workflow/stream_resume", rawBodyParser, async (req, res) => {
  await proxyWorkflowJson(req, res, "/v1/workflow/stream_resume");
});

app.post("/api/files/upload", rawBodyParser, async (req, res) => {
  await proxyFileUploadBuffer(req, res);
});

app.use(express.static(ROOT_DIR));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    sendJson(res, 404, {
      code: -1,
      msg: `Unknown API route: ${req.path}`,
    });
    return;
  }

  res.sendFile(path.join(ROOT_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

async function proxyWorkflowJson(req, res, pathname) {
  const { workflowId, workflowToken } = getRuntimeConfig();
  if (!workflowToken) {
    sendJson(res, 500, {
      code: -1,
      msg: "Server env COZE_WORKFLOW_TOKEN is not configured.",
    });
    return;
  }

  let payload;
  try {
    payload = parseJsonBody(req.body);
  } catch (error) {
    sendJson(res, 400, {
      code: -1,
      msg: `Invalid JSON body: ${error.message}`,
    });
    return;
  }

  payload.workflow_id = workflowId || payload.workflow_id || "";

  try {
    const upstream = await fetch(buildCozeUrl(pathname), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${workflowToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    await pipeUpstream(res, upstream);
  } catch (error) {
    sendJson(res, 502, {
      code: -1,
      msg: `Failed to reach Coze workflow API: ${error.message}`,
    });
  }
}

async function proxyFileUploadBuffer(req, res) {
  const { accessToken } = getRuntimeConfig();
  if (!accessToken) {
    sendJson(res, 500, {
      code: -1,
      msg: "Server env COZE_ACCESS_TOKEN is not configured.",
    });
    return;
  }

  const contentType = String(req.headers["content-type"] || "");
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    sendJson(res, 400, {
      code: -1,
      msg: "Expected multipart/form-data upload.",
    });
    return;
  }

  try {
    const upstream = await fetch(buildCozeUrl("/v1/files/upload"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": contentType,
      },
      body: req.body,
    });

    await pipeUpstream(res, upstream);
  } catch (error) {
    sendJson(res, 502, {
      code: -1,
      msg: `Failed to reach Coze file API: ${error.message}`,
    });
  }
}

function parseJsonBody(body) {
  if (!body || (Buffer.isBuffer(body) && body.length === 0)) {
    return {};
  }

  if (Buffer.isBuffer(body)) {
    return JSON.parse(body.toString("utf8"));
  }

  if (typeof body === "string") {
    return JSON.parse(body);
  }

  return body;
}

function buildCozeUrl(pathname) {
  const { apiBase } = getRuntimeConfig();
  const base = String(apiBase || DEFAULT_API_BASE).trim() || DEFAULT_API_BASE;
  const withProtocol = /^https?:\/\//i.test(base) ? base : `https://${base}`;
  const url = new URL(withProtocol);
  url.hash = "";
  url.search = "";
  url.pathname = pathname;
  return url.toString();
}

async function pipeUpstream(res, upstream) {
  res.statusCode = upstream.status;
  res.setHeader("Cache-Control", "no-store");

  const contentType = upstream.headers.get("content-type");
  const contentLength = upstream.headers.get("content-length");

  if (contentType) {
    res.setHeader("Content-Type", contentType);
  }
  if (contentLength) {
    res.setHeader("Content-Length", contentLength);
  }

  if (!upstream.body) {
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      res.write(Buffer.from(value));
    }
  }

  res.end();
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}
