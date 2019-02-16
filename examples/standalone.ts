const { ACME_STAGING_URL, Agent } = require("../src");

(async () => {
  const agent = await Agent.create({
    message: true, // enable message event for renewing and installed message
    acmeUrl: ACME_STAGING_URL,
    configdir: "~/temp/acme"
  });

  agent.on("server", (event, data) => {
    if (event === "req") {
      const { req } = data;
      console.info(req.method, req.headers.host + req.url);
    } else if (event === "res") {
      const { value } = data;
      if (value) {
        console.info("Responding with authorization token '" + value + "'");
      } else {
        console.info("No authorization token found");
      }
    } else if (event === "listen") {
      const { server, tls } = data;
      console.info(`Listening http${tls ? "s" : ""} on ${server.address()}`);
    }
  });

  agent.on("error", (error, data) => {
    const err = error.nested || error;
    if ("EADDRINUSE" === err.code) {
      console.error("You already have a different server running on port '" + data.port + "'.");
      console.error("You should probably use the `webroot` instead of `standalone`.");
      return process.exit(1);
    }
    throw error;
  });

  agent.on("message", console.log);

  await agent.run({
    domains: "test.uugo.xyz",
    agreeTos: true,
    email: "uugolab@gmail.com",
    communityMember: true
  });
})();

process.on("unhandledRejection", (reason, promise) => {
  console.log("Unhandled Rejection at:", reason.stack || reason);
});
