import _ = require("lodash");
import { homedir } from "os";
import fse = require("fs-extra");
import { EventEmitter } from "events";
import arrify = require("arrify");
import * as path from "path";

import GreenLock = require("greenlock");

import ManualChallenge = require("le-challenge-manual");
import StandaloneChallenge = require("le-challenge-standalone");
import DDNSChallenge = require("lebot-challenge-ddns");
import WebrootChallenge = require("./webroot");

import Store = require("le-store-certbot");

import { collectAndForwardEvent, populate, load } from "./utils";
import { Server } from "./server";
import messages = require("./messages");

export type ChallengeType = "http-01" | "dns-01";

const DAY = 24 * 60 * 60 * 1000;

export interface AgentOptions {
  debug?: boolean;
  message?: boolean;
  acmeVersion?: string;
  acmeUrl?: string;

  certpath?: string;
  fullchainpath?: string;
  bundlepath?: string;
  chainpath?: string;
  privkeypath?: string;
  configdir?: string;

  renewWithin?: number;
}

export interface AgentSettings {
  debug: boolean;
  message: boolean;
  acmeVersion: string;
  acmeUrl: string;

  certpath: string;
  fullchainpath: string;
  bundlepath: string;
  chainpath: string;
  privkeypath: string;
  configdir: string;

  renewWithin: number;
}

export interface ChallengeHttpOptions {
  root?: string;
  port?: number;
  tlsPort?: number;
}

export interface ChallengeDnsOptions {
  provider: string;
  credsfile?: string;
  user?: string;
  pass?: string;
  token?: string;
}

export interface RunOptions {
  email?: string;
  agreeTos?: boolean;
  communityMember?: boolean;
  domains: string | string[];
  rsaKeySize?: number;
  manual?: boolean;
  http?: ChallengeHttpOptions;
  dns?: ChallengeDnsOptions;
}

export const ACME_URL = "https://acme-v02.api.letsencrypt.org/directory";
export const ACME_STAGING_URL = "https://acme-staging-v02.api.letsencrypt.org/directory";

const DEFAULT_OPTIONS: AgentOptions = {
  debug: false,
  message: false,
  acmeVersion: "draft-12",
  acmeUrl: ACME_STAGING_URL,
  configdir: "~/letsencrypt/etc/",
  bundlepath: ":configdir/live/:hostname/bundle.pem",
  certpath: ":configdir/live/:hostname/cert.pem",
  chainpath: ":configdir/live/:hostname/chain.pem",
  fullchainpath: ":configdir/live/:hostname/fullchain.pem",
  privkeypath: ":configdir/live/:hostname/privkey.pem",
  renewWithin: 7
};

const home = homedir();

export class Agent extends EventEmitter {

  protected settings: AgentSettings;

  static async create(args: AgentOptions): Promise<Agent> {
    const opts = _.defaults({}, args, DEFAULT_OPTIONS);


    populate(opts, /^~/, home);
    populate(opts, /(:configdir)|(:configDir)|(:config)/, opts.configdir);

    if (!opts.configdir) {
      throw new Error("`configdir` is required");
    }

    await fse.mkdirp(opts.configdir);
    return new Agent(<AgentSettings>opts);
  }

  on(event: "renewing", listener: (data: { certs }) => void): this;
  on(event: "installed", listener: (data: { certs, opts }) => void): this;
  on(event: "message", listener: (message: string) => void): this;
  on(event: "server", listener: (event, ...args) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }

  protected constructor(settings: AgentSettings) {
    super();

    if (!settings.acmeUrl) {
      throw new Error("You must specify the ACME server url with --acme-url");
    }
    if (!settings.acmeVersion) {
      throw new Error("You must specify the ACME API version with --acme-version");
    }

    this.settings = { ...settings };

    this.setup();
  }

  protected setup() {
    if (this.settings.message) {
      this.on("renewing", ({ certs }) => this.emit("message", messages.renewing(certs)));
      this.on("installed", ({ certs, opts }) => this.emit("message", messages.installed(certs, opts)));
    }
  }

  protected createServer(challenge) {
    const server = new Server(challenge);
    Server.SupportedEvents.forEach(event => collectAndForwardEvent(server, this, event, "server"));
    return server;
  }

  async run(options: RunOptions) {
    let challengeType: ChallengeType;
    let challenge;
    let server: Server | null = null;

    const { settings } = this;
    const opts = { ...settings, ...options };

    opts.domains = arrify(opts.domains);

    if (opts.dns) {
      challengeType = "dns-01";
      opts.http = undefined;
    } else {
      challengeType = "http-01";
      opts.http = opts.http || {};
    }

    if (opts.manual) {
      challenge = ManualChallenge.create({});
    } else if (opts.dns) {
      const {dns} = opts;
      let creds;
      if (dns.credsfile) {
        creds = load(path.resolve(dns.credsfile.replace(/^~/, home)));
      } else {
        creds = _.pick(dns, ['user', 'pass', 'token']);
      }
      challenge = DDNSChallenge.create({debug: opts.debug, dns: dns.provider, ...creds});
    } else if (opts.http) {
      if (opts.http.root) { // webroot
        challenge = WebrootChallenge.create({ root: opts.http.root });
      } else { // standalone
        challenge = StandaloneChallenge.create({});
        server = this.createServer(challenge);
      }
    }

    const store = Store.create({
      configDir: settings.configdir,
      privkeyPath: settings.privkeypath,
      fullchainPath: settings.fullchainpath,
      certPath: settings.certpath,
      chainPath: settings.chainpath,
      bundlePath: settings.bundlepath,
      webrootPath: opts.http && opts.http.root
    });

    const challenges = {
      [challengeType]: challenge
    };

    const greenlock = GreenLock.create({
      debug: settings.debug,
      server: settings.acmeUrl,
      version: settings.acmeVersion,
      renewWithin: settings.renewWithin * DAY,
      store,
      challenges
    });

    if (server && opts.http) {
      if (opts.http.tlsPort) {
        server.start({ tlsPorts: opts.http.tlsPort, debug: opts.debug, tlsOptions: greenlock.tlsOptions });
      } else {
        server.start({ ports: opts.http.port || 80, debug: opts.debug });
      }
    }

    let certs = await greenlock.register({
      debug: settings.debug,
      email: opts.email,
      agreeTos: opts.agreeTos,
      communityMember: opts.communityMember,
      domains: opts.domains,
      rsaKeySize: opts.rsaKeySize,
      challengeType
    });


    if (certs.renewing) {
      this.emit("renewing", { certs, opts });
      certs = await certs.renewing;
    }

    this.emit("installed", { certs, opts });

    if (server) {
      await server.stop({ debug: settings.debug });
    }
  }

}
