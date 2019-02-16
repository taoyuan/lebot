import _ = require("lodash");
import https = require("https");
import http = require("http");
import arrify = require("arrify");
import * as net from "net";
import { EventEmitter } from "events";
import { IncomingMessage, ServerResponse } from "http";
import * as tls from "tls";

export interface StartOptions {
  debug?: boolean;
  ports?: number | number[];
  tlsPorts?: number | number[];
  tlsOptions?: { [name: string]: any }
}

export interface StopOptions {
  debug?: boolean;
}

// export interface ServerEvents {
//   on(event: 'req', handler: (data: {req: IncomingMessage, res: ServerResponse}) => void);
//   on(event: 'res', handler: (data: {req: IncomingMessage, res: ServerResponse, data: string}) => void);
//   on(event: 'listen', handler: (data: {server: net.Server, tls: boolean}) => void);
//   on(event: 'error', handler: (error: any, data: {server: net.Server, tls: boolean}) => void);
//   on(event: 'stop', handler: () => void);
// }

export class Server extends EventEmitter {

  static SupportedEvents: string[] = ['req', 'res', 'listen', 'error', 'stop'];

  protected challenge;
  protected servers: net.Server[] = [];

  constructor(challenge) {
    super();
    this.challenge = challenge;
  }

  on(event: 'req', handler: (data: {req: IncomingMessage, res: ServerResponse}) => void): this;
  on(event: 'res', handler: (data: {req: IncomingMessage, res: ServerResponse, value?: string}) => void): this;
  on(event: 'listen', handler: (data: {server: net.Server, tls: boolean}) => void): this;
  on(event: 'error', handler: (error: any, data: {server: net.Server, port: number, tls: boolean}) => void): this;
  on(event: 'stop', handler: () => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }

  protected async handle(req: IncomingMessage, res: ServerResponse) {
    this.emit('req', {req, res});
    const acmeChallengePrefix = "/.well-known/acme-challenge/";

    // @ts-ignore
    if (0 !== req.url.indexOf(acmeChallengePrefix)) {
      res.end("`lebot` Commandline: https://github.com/taoyuan/lebot");
      return;
    }

    // @ts-ignore
    const token = req.url.slice(acmeChallengePrefix.length);

    // @ts-ignore
    await this.challenge.get({}, req.headers.host.replace(/:.*/, ""), token, (err, value) => {
      this.emit('res', {req, res, value});
      res.end(value || "_ ERROR challenge not found _");
    });
  }

  start(options?: StartOptions) {
    const opts = options || {};

    const ports = arrify(opts.ports);
    const tlsPorts = arrify(opts.tlsPorts);
    const tlsOptions = opts.tlsOptions || {};

    if (this.servers.length) {
      return;
    }

    const listener = (req, res) => this.handle(req, res);

    // http-01-port
    _.forEach(ports, port => this.createServer(port, () => http.createServer(listener)));
    // tls-sni-01-port
    _.forEach(tlsPorts, port => this.createServer(port, () => https.createServer(tlsOptions, listener)));
  }

  createServer(port: number, creator: () => net.Server) {
    const server: net.Server = creator();
    const secure: boolean = server instanceof tls.Server;

    this.servers.push(server);

    server.listen(port, () => {
      this.emit('listen', {server, tls: secure});
    });

    server.on('error', error => this.emit('error', error, {server, port, tls: secure}));
    // server.on("error", err => {
    //   // @ts-ignore
    //   if ("EADDRINUSE" === err.code) {
    //     console.error("");
    //     console.error("You already have a different server running on port '" + port + "'.");
    //     return;
    //   }
    //   throw err;
    // });
  }

  async stop(options?: StopOptions) {
    const opts = options || {};
    return new Promise(resolve => {
      const serversToClose = this.servers.length;
      if (0 === serversToClose) {
        return resolve();
      }

      let closed = 0;
      this.servers.forEach(server => server.close(() => {
        server.removeAllListeners();
        if (serversToClose === ++closed) {
          this.emit('stop');
          if (opts.debug) {
            console.info("Closed all servers");
          }
          this.servers = [];
          resolve();
        }
      }));
    });
  }
}
