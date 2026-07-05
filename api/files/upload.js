"use strict";

const { proxyFileUpload } = require("../../lib/coze-proxy");

module.exports = async function handler(req, res) {
  await proxyFileUpload(req, res);
};
