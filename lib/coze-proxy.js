"use strict";

const DEFAULT_API_BASE = "https://api.coze.cn";
const DEFAULT_WORKFLOW_ID = "7658482627423731718";

function getRuntimeConfig() {
  const workflowId = String(process.env.COZE_WORKFLOW_ID || DEFAULT_WORKFLOW_ID).trim();
  const workflowToken = String(process.env.COZE_WORKFLOW_TOKEN || process.env.COZE_PAT || "").trim();
  const accessToken = String(process.env.COZE_ACCESS_TOKEN || workflowToken).trim();
  const apiBase = String(process.env.COZE_API_BASE || DEFAULT_API_BASE).trim() || DEFAULT_API_BASE;

  return {
    workflowId,
    workflowToken,
    accessToken,
    apiBase,
  };
}

function buildCozeUrl(pathname) {
  const { apiBase } = getRuntimeConfig();
  const withProtocol = /^https?:\/\//i.test(apiBase) ? apiBase : `https://${apiBase}`;
  const url = new URL(withProtocol);
  url.hash = "";
  url.search = "";
  url.pathname = pathname;
  return url.toString();
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function methodNotAllowed(res, allow = "POST") {
  res.setHeader("Allow", allow);
  sendJson(res, 405, {
    code: -1,
    msg: `Method ${allow} required.`,
  });
}

function missingConfigMessage(tokenName) {
  return `Server env ${tokenName} is not configured.`;
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function readJsonBody(req) {
  const rawBody = await readRawBody(req);
  if (!rawBody.length) {
    return {};
  }

  return JSON.parse(rawBody.toString("utf8"));
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

async function proxyWorkflowRequest(req, res, pathname) {
  if (req.method !== "POST") {
    methodNotAllowed(res);
    return;
  }

  const { workflowId, workflowToken } = getRuntimeConfig();
  if (!workflowToken) {
    sendJson(res, 500, {
      code: -1,
      msg: missingConfigMessage("COZE_WORKFLOW_TOKEN"),
    });
    return;
  }

  const payload = await readJsonBody(req);
  payload.workflow_id = workflowId || payload.workflow_id || "";

  const upstream = await fetch(buildCozeUrl(pathname), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${workflowToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  await pipeUpstream(res, upstream);
}

async function proxyFileUpload(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res);
    return;
  }

  const { accessToken } = getRuntimeConfig();
  if (!accessToken) {
    sendJson(res, 500, {
      code: -1,
      msg: missingConfigMessage("COZE_ACCESS_TOKEN"),
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

  const rawBody = await readRawBody(req);
  const upstream = await fetch(buildCozeUrl("/v1/files/upload"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
    },
    body: rawBody,
  });

  await pipeUpstream(res, upstream);
}

function getPublicConfig() {
  const { workflowId } = getRuntimeConfig();
  return {
    proxyEnabled: true,
    apiBase: "/api",
    workflowId,
  };
}

module.exports = {
  getRuntimeConfig,
  getPublicConfig,
  proxyFileUpload,
  proxyWorkflowRequest,
  sendJson,
};
