import { EventEmitter } from "events";
import Yaml = require('js-yaml');
import fse = require('fs-extra');
import { NestedError } from "./errors";

export function populate(target: { [name: string]: any }, condition: string | RegExp, value?: any) {
  const regex = typeof condition === "string" ? new RegExp(condition) : condition;
  const keys = Object.keys(target);
  for (const k of keys) {
    let v = target[k];
    if (typeof v === "string") {
      v = v.replace(regex, value);
    }
    target[k] = v;
  }
}

export function collectAndForwardEvent(src: EventEmitter, dest: EventEmitter, event: string, collectEventName?: string) {
  if (event === 'error') {
    src.on(event, (error, ...args) => dest.emit(event, new NestedError('Standalone Server Error', error), ...args));
  } else {
    src.on(event, (...args) => dest.emit(collectEventName || src.constructor.name, event, ...args));
  }
}

export function load(file: string) {
  return Yaml.safeLoad(fse.readFileSync(file, 'utf8'));
}
