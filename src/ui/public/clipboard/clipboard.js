define(function (require) {
  var $ = require('jquery');
  var html = require('ui/clipboard/clipboard.html');

  require('ui/modules')
  .get('kibana')
  .directive('kbnClipboard', function ($compile, $timeout) {
    return {
      restrict: 'E',
      template: html,
      replace: true,
      scope: {
        copyText: '=copy'
      },
      transclude: true,
      link: function ($scope, $el, attr) {
        var $input = $el.find('input');

        var copyAvailable = document.queryCommandSupported('copy');
        if (!copyAvailable) {
          $scope.disabled = true;
          return;
        }

        $scope.tipPlacement = attr.tipPlacement || 'top';
        $scope.tipText = attr.tipText || 'Copy to clipboard';
        $scope.tipSuccess = attr.tipSuccess = 'Copied!';
        $scope.tipFailed = attr.tipFailed = 'Copied!';
        $scope.icon = attr.icon || 'fa-clipboard';

        function resetTooltip() {
          $scope.shownText = $scope.tipText;
        }
        resetTooltip();
        $el.on('mouseleave', resetTooltip);

        $el.on('click', function () {
          var success;

          try {
            $input.get(0).select();
            success = document.execCommand('copy');
          } catch (e) {
            success = false;
          }

          if (success) $scope.shownText = $scope.tipSuccess;
          else $scope.shownText = $scope.tipFailed;

          // Reposition tooltip to account for text length change
          $('a', $el).mouseenter();
        });

        $scope.$on('$destroy', function () {
          $el.off('click');
          $el.off('mouseleave');
        });
      }
    };
  });
});
