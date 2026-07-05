"use strict";

const { proxyWorkflowRequest } = require("../../lib/coze-proxy");

module.exports = async function handler(req, res) {
  await proxyWorkflowRequest(req, res, "/v1/workflows/resume");
};
