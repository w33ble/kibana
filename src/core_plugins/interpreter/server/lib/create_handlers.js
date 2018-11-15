/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import boom from 'boom';
import { SECURITY_AUTH_MESSAGE } from '../../../../../x-pack/plugins/canvas/common/lib/constants';
import { isSecurityEnabled } from './feature_check';

export const createHandlers = (request, server) => {
  const { callWithRequest } = server.plugins.elasticsearch.getCluster('data');
  const config = server.config();

  return {
    environment: 'server',
    serverUri:
      config.has('server.rewriteBasePath') && config.get('server.rewriteBasePath')
        ? `${server.info.uri}${config.get('server.basePath')}`
        : server.info.uri,
    httpHeaders: request.headers,
    elasticsearchClient: async (...args) => {
      // check if the session is valid because continuing to use it
      if (isSecurityEnabled(server)) {
        try {
          const authenticationResult = await server.plugins.security.authenticate(request);
          if (!authenticationResult.succeeded()) {
            throw boom.unauthorized(authenticationResult.error);
          }
        } catch (e) {
          // if authenticate throws, show error in development
          if (process.env.NODE_ENV !== 'production') {
            e.message = `elasticsearchClient failed: ${e.message}`;
            console.error(e);
          }

          // hide all failure information from the user
          throw boom.unauthorized(SECURITY_AUTH_MESSAGE);
        }
      }

      return callWithRequest(request, ...args);
    },
  };
};
