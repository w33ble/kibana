define(function (require) {
  var workers = 0;

  return function syncMaps(map, chartMaps, center, zoom) {
    if (workers > 0) return --workers;
    workers = chartMaps.length - 1;

    chartMaps.forEach(function (chartMap) {
      if (chartMap.map === map) return;
      chartMap.map.setView(center, zoom, { animate: false });
    });
  };
});
