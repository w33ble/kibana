define(function (require) {
  var _ = require('lodash');
  require('elasticsearch');

  var es; // share the client amoungst all apps
  var request = {};
  require('modules')
    .get('kibana', ['elasticsearch', 'kibana/config'])
    .service('es', function (esFactory, configFile, $q) {
      if (es) return es;

      es = esFactory({
        host: configFile.elasticsearch,
        log: 'info',
        requestTimeout: 60000
      });

      es.validateQuery = function (query, index) {
        var type;

        // use default index if one is not passed in
        if (index == null) {
          useDefaults();
        }

        return es.indices.validateQuery({
          index: index,
          type: type,
          explain: true,
          ignoreUnavailable: true,
          body: {
            query: query || { match_all: {} }
          }
        });

        function useDefaults() {
          index = configFile.kibanaIndex;
          type = '__kibanaQueryValidator';
        }
      };

      return es;
    });
});
