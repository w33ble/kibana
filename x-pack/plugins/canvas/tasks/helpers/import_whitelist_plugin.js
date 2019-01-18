/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { relative, resolve } from 'path';
import { openSync } from 'fs';
import chalk from 'chalk';
import isPathInside from 'path-is-inside';

const KIBANA_ROOT = resolve(__dirname, '../../../../..');

function exists(path) {
  try {
    openSync(path, 'r');
    return true;
  } catch (e) {
    return false;
  }
}

function match(path, pathsOrRegexps) {
  return [].concat(pathsOrRegexps).some(pathOrRegexp => {
    if (pathOrRegexp instanceof RegExp) {
      return pathOrRegexp.test(path);
    }

    return isPathInside(path, pathOrRegexp);
  });
}

export class ImportWhitelistPlugin {
  constructor({ from, whitelist }) {
    this.from = from;
    this.whitelist = whitelist;
  }

  apply(resolver) {
    resolver.hooks.file.tap('ImportWhitelistPlugin', request => {
      if (!request.context || !request.context.issuer) {
        // ignore internal requests that don't have an issuer
        return;
      }

      if (!match(request.context.issuer, this.from)) {
        // request is not filtered by this whitelist unless it comes
        // from a module matching the from directory/regex
        return;
      }

      if (exists(request.path) && !match(request.path, this.whitelist)) {
        throw new Error(
          `Attempted to import "${chalk.yellow(relative(KIBANA_ROOT, request.path))}" which ` +
            `is not in the whitelist for the ${chalk.cyan(relative(KIBANA_ROOT, this.from))} ` +
            `directory.`
        );
      }
    });
  }
}
