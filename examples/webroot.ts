const { ACME_STAGING_URL, Agent } = require("../src");

(async () => {
  const agent = await Agent.create({
    message: true,
    acmeUrl: ACME_STAGING_URL,
    configdir: "~/temp/acme"
  });

  agent.on("message", console.log);

  await agent.run({
    domains: "test.uugo.xyz",
    agreeTos: true,
    email: "uugolab@gmail.com",
    communityMember: true,
    http: {
      root: '~/www/test.uugo.xyz'
    }
  });
})();
