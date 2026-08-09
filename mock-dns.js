
  const dns = require("dns");
  dns.lookup = (domain, options, cb) => {
    if (typeof options === "function") cb = options;
    process.nextTick(() => cb(Object.assign(new Error("ENOTFOUND " + domain), { code: "ENOTFOUND" })));
  };
