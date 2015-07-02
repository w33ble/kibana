define(function (require) {
  return function TileMapVisType(Private, getAppState, courier, config) {
    var VislibVisType = Private(require('components/vislib_vis_type/VislibVisType'));
    var Schemas = Private(require('components/vis/Schemas'));
    var geoJsonConverter = Private(require('components/agg_response/geo_json/geo_json'));
    var syncMaps = require('plugins/kbn_vislib_vis_types/_sync_maps');
    var _ = require('lodash');
    var supports = require('utils/supports');

    return new VislibVisType({
      name: 'tile_map',
      title: 'Tile map',
      icon: 'fa-map-marker',
      description: 'Your source for geographic maps. Requires an elasticsearch geo_point field. More specifically, a field ' +
       'that is mapped as type:geo_point with latitude and longitude coordinates.',
      params: {
        defaults: {
          mapType: 'Scaled Circle Markers',
          isDesaturated: true,
          addTooltip: true,
          heatMaxZoom: 16,
          heatMinOpacity: 0.1,
          heatRadius: 25,
          heatBlur: 15,
          heatNormalizeData: true,
        },
        mapTypes: ['Scaled Circle Markers', 'Shaded Circle Markers', 'Shaded Geohash Grid', 'Heatmap'],
        canDesaturate: !!supports.cssFilters,
        editor: require('text!plugins/kbn_vislib_vis_types/editors/tile_map.html')
      },
      listeners: {
        rectangle: function (ev) {
          var agg = _.get(ev, 'chart.geohashGridAgg');
          if (!agg) return;

          var pushFilter = Private(require('components/filter_bar/push_filter'))(getAppState());
          var indexPatternName = agg.vis.indexPattern.id;
          var field = agg.fieldName();
          var filter = {geo_bounding_box: {}};
          filter.geo_bounding_box[field] = ev.bounds;

          pushFilter(filter, false, indexPatternName);
        },
        mapMoveEnd: function (ev, handler) {
          var agg = _.get(ev, 'chart.geohashGridAgg');
          if (!agg) return;

          var zoom = agg.params.mapZoom = ev.zoom;
          var center = agg.params.mapCenter = [ev.center.lat, ev.center.lng];

          var chartMaps = _.flatten(_.pluck(handler.charts, 'maps'));
          syncMaps(ev.map, chartMaps, center, zoom);

          var editableVis = agg.vis.getEditableVis();
          if (!editableVis) return;

          var editableAgg = editableVis.aggs.byId[agg.id];
          if (editableAgg) {
            editableAgg.params.mapZoom = zoom;
            editableAgg.params.mapCenter = center;
          }
        },
        mapZoomEnd: function (ev) {
          var agg = _.get(ev, 'chart.geohashGridAgg');
          if (!agg || !agg.params.autoPrecision) return;

          // zoomPrecision maps ev.zoom to a geohash precision value
          // ev.limit is the configurable max geohash precision
          // default max precision is 7, configurable up to 12
          var zoomPrecision = {
            1: 2,
            2: 2,
            3: 2,
            4: 3,
            5: 3,
            6: 4,
            7: 4,
            8: 5,
            9: 5,
            10: 6,
            11: 6,
            12: 7,
            13: 7,
            14: 8,
            15: 9,
            16: 10,
            17: 11,
            18: 12
          };

          var precision = config.get('visualization:tileMap:maxPrecision');
          agg.params.precision = Math.min(zoomPrecision[ev.zoom], precision);

          courier.fetch();
        }
      },
      responseConverter: geoJsonConverter,
      schemas: new Schemas([
        {
          group: 'metrics',
          name: 'metric',
          title: 'Value',
          min: 1,
          max: 1,
          aggFilter: ['count', 'avg', 'sum', 'min', 'max', 'cardinality'],
          defaults: [
            { schema: 'metric', type: 'count' }
          ]
        },
        {
          group: 'buckets',
          name: 'segment',
          title: 'Geo Coordinates',
          aggFilter: 'geohash_grid',
          min: 1,
          max: 1
        },
        {
          group: 'buckets',
          name: 'split',
          title: 'Split Chart',
          min: 0,
          max: 1
        }
      ])
    });
  };
});
