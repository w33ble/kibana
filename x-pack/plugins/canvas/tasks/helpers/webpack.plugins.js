/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { writeFileSync } from 'fs';
import path from 'path';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { createServerCodeTransformer } from '@kbn/interpreter/tasks/build/server_code_transformer';
import { ImportWhitelistPlugin } from './import_whitelist_plugin';

const sourceDir = path.resolve(__dirname, '../../canvas_plugin_src');
const buildDir = path.resolve(__dirname, '../../canvas_plugin');
const sharedDir = path.resolve(__dirname, '../../shared');
const KIBANA_ROOT = path.resolve(__dirname, '../../../../..');
const PACKAGE_ROOT = path.resolve(KIBANA_ROOT, 'packages');

const whitelistModules = [
  path.join(PACKAGE_ROOT, 'elastic-datemath'),
  path.join(PACKAGE_ROOT, 'kbn-interpreter'),
];

export function getWebpackConfig({ devtool, watch, production } = {}) {
  return {
    watch,
    devtool,
    mode: production ? 'production' : 'none',
    entry: {
      'elements/all': path.join(sourceDir, 'elements/register.js'),
      'renderers/all': path.join(sourceDir, 'renderers/register.js'),
      'uis/transforms/all': path.join(sourceDir, 'uis/transforms/register.js'),
      'uis/models/all': path.join(sourceDir, 'uis/models/register.js'),
      'uis/views/all': path.join(sourceDir, 'uis/views/register.js'),
      'uis/datasources/all': path.join(sourceDir, 'uis/datasources/register.js'),
      'uis/arguments/all': path.join(sourceDir, 'uis/arguments/register.js'),
      'functions/browser/all': path.join(sourceDir, 'functions/browser/register.js'),
      'functions/browser/common': path.join(sourceDir, 'functions/common/register.js'),
      'templates/all': path.join(sourceDir, 'templates/register.js'),
      'uis/tags/all': path.join(sourceDir, 'uis/tags/register.js'),
    },

    // there were problems with the node and web targets since this code is actually
    // targetting both the browser and node.js. If there was a hybrid target we'd use
    // it, but this seems to work either way.
    target: 'webworker',

    output: {
      path: buildDir,
      filename: '[name].js', // Need long paths here.
      libraryTarget: 'umd',
      // Note: this is needed due to a not yet resolved bug on
      // webpack 4 with umd modules generation.
      // For now we have 2 quick workarounds: one is what is implemented
      // below another is to change the libraryTarget to commonjs
      //
      // The issues can be followed on:
      // https://github.com/webpack/webpack/issues/6642
      // https://github.com/webpack/webpack/issues/6525
      // https://github.com/webpack/webpack/issues/6677
      globalObject: `(typeof self !== 'undefined' ? self : this)`,
    },

    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.json'],
      mainFields: ['browser', 'main'],
      plugins: [
        // whitelist imports from the canvas_plugin_src directory
        // to ensure that only modules in its own directory and node_modules
        // are included in the canvas_plugin bundle. An additional /shared/
        // directory at the root of canvas is included so that code can be shared
        // with the rest of the canvas app
        new ImportWhitelistPlugin({
          from: sourceDir,
          whitelist: [/[\/\\]node_modules[\/\\]/, sourceDir, sharedDir, ...whitelistModules],
        }),
        // only whitelist node_modules and code within the shared directory so that
        // they can safely be imported by the canvas_plugin_src or the canvas app
        new ImportWhitelistPlugin({
          from: sharedDir,
          whitelist: [/[\/\\]node_modules[\/\\]/, sharedDir],
        }),
      ],
    },

    plugins: [
      function LoaderFailHandlerPlugin() {
        // bails on error, including loader errors
        // see https://github.com/webpack/webpack/issues/708, which does not fix loader errors
        this.hooks.done.tapPromise('LoaderFailHandlerPlugin', async stats => {
          if (!stats.hasErrors()) {
            return;
          }
          const errorMessage = stats.toString('errors-only');
          if (watch) {
            console.error(errorMessage);
          } else {
            throw new Error(errorMessage);
          }
        });
      },
      new CopyWebpackPlugin([
        {
          from: path.resolve(sourceDir, 'functions/server'),
          to: path.resolve(buildDir, 'functions/server'),
          transform: createServerCodeTransformer(!!devtool),
          ignore: '**/__tests__/**',
        },
        {
          from: path.resolve(sourceDir, 'functions/common'),
          to: path.resolve(buildDir, 'functions/common'),
          transform: createServerCodeTransformer(!!devtool),
          ignore: '**/__tests__/**',
        },
        {
          from: path.resolve(sourceDir, 'lib'),
          to: path.resolve(buildDir, 'lib'),
          transform: createServerCodeTransformer(!!devtool),
          ignore: '**/__tests__/**',
        },
      ]),
      function canvasStatsGenerator() {
        if (!process.env.CANVAS_GENERATE_STATS) {
          return;
        }

        this.hooks.done.tap('canvas_stats', stats => {
          const content = JSON.stringify(stats.toJson());
          writeFileSync(path.resolve(__dirname, '../../webpack_stats.json'), content);
        });
      },
    ],

    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: [/node_modules/],
          loaders: 'babel-loader',
          options: {
            babelrc: false,
            presets: [require.resolve('@kbn/babel-preset/webpack_preset')],
          },
        },
        {
          test: /\.(png|jpg|gif|jpeg|svg)$/,
          loaders: ['url-loader'],
        },
        {
          test: /\.(css|scss)$/,
          loaders: ['style-loader', 'css-loader', 'sass-loader'],
        },
        {
          test: /\.tsx?$/,
          include: sourceDir,
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                experimentalWatchApi: true,
                onlyCompileBundledFiles: true,
                configFile: require.resolve('../../../../tsconfig.json'),
                compilerOptions: {
                  sourceMap: Boolean(devtool),
                },
              },
            },
          ],
        },
      ],
    },

    node: {
      // Don't replace built-in globals
      __filename: false,
      __dirname: false,
    },

    watchOptions: {
      ignored: [/node_modules/],
    },

    stats: {
      // when typescript doesn't do a full type check, as we have the ts-loader
      // configured here, it does not have enough information to determine
      // whether an imported name is a type or not, so when the name is then
      // exported, typescript has no choice but to emit the export. Fortunately,
      // the extraneous export should not be harmful, so we just suppress these warnings
      // https://github.com/TypeStrong/ts-loader#transpileonly-boolean-defaultfalse
      warningsFilter: /export .* was not found in/,
    },
  };
}
