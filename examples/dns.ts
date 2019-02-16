const { ACME_STAGING_URL, Agent } = require("../src");

(async () => {
  const agent = await Agent.create({
    debug: true,
    message: true,
    acmeUrl: ACME_STAGING_URL,
    configdir: "~/temp/acme"
  });

  agent.on("message", console.log);

  await agent.run({
    domains: ["t1.uugo.xyz", "t2.uugo.xyz"],
    agreeTos: true,
    email: "uugolab@gmail.com",
    communityMember: true,
    dns: {
      provider: "cloudflare",
      credsfile: "~/.secrets/lebot/cloudflare.yml"
    }
  });
})();
