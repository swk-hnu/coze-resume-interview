"use strict";

const { getPublicConfig, sendJson } = require("../lib/coze-proxy");

module.exports = async function handler(_req, res) {
  sendJson(res, 200, getPublicConfig());
};
