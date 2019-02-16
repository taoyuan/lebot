import _ = require("lodash");
import path = require("path");
import fse = require("fs-extra");
import PromiseA = require("bluebird");
import { EventEmitter } from "events";

interface WebrootOptions {
  root?: string;
}

export = class WebrootChallenge extends EventEmitter {

  protected opts: WebrootOptions;

  static create(options: WebrootOptions) {
    return new WebrootChallenge(options);
  }

  constructor(options: WebrootOptions) {
    super();
    this.opts = options;
  }

  getOptions() {
    return this.opts;
  }

  async set(options, domain, token, secret, cb) {
    const opts = _.defaults({}, options, this.opts);

    const challengePath = path.join(opts.root || opts.webrootPath, ".well-known", "acme-challenge");

    try {
      await fse.mkdirp(challengePath);
    } catch (e) {
      console.error("Could not create webroot path '" + challengePath + "':", e.code);
      console.error("Try checking the permissions, maybe?");
      cb && cb(e);
      return PromiseA.reject(e);
    }

    const tokenfile = path.join(challengePath, token);

    try {
      await fse.writeFile(tokenfile, secret, "utf8");
    } catch (e) {
      console.error("Could not write '" + tokenfile + "':", e.code);
      cb && cb(e);
      return PromiseA.reject(e);
    }
    cb && cb();
  }

  async get(options, domain, token, cb) {
    const err = new Error("get not implemented (on purpose) in `webroot`");
    cb && cb(err);
    return PromiseA.reject(err);
  }

  async remove(options, domain, token, cb) {
    const opts = _.defaults({}, options, this.opts);
    const tokenfile = path.join(opts.root || opts.webrootPath, ".well-known", "acme-challenge", token);
    try {
      await fse.unlink(tokenfile);
    } catch (e) {
      console.error("Could not unlink '" + tokenfile + "':", e.code);
      cb(e);
      return PromiseA.reject(e);
    }
    cb && cb();
  }
}
