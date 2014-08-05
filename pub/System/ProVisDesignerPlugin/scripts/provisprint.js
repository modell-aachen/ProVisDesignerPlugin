(function($) {
  var attachHandler = function() {
    var imgs = $('img[src*="__provis_"]');
    for ( var i = 0; i < imgs.length; ++i ) {
      var img = imgs[i];
      $(img).wrap( '<span class="print-container"></span>' );
    }

    $('.print-container').on( 'mouseenter', function() {
      var $this = $(this);
      var label = window.foswiki.preferences.provis.label;
      var $menu = $('<span class="print-button">' + label + '</span>');

      var height = $this.children('img').height();
      var width = $this.children('img').width();
      var pos = $this.position();

      $menu.css('left', pos.left + 15);
      $menu.css('top', pos.top - height - 9);

      $menu.appendTo($this);
      $menu.on( 'click', $this, print );
    }).on( 'mouseleave', function() {
      var $this = $(this);
      var $menu = $this.children('.print-button');

      $menu.off( 'click', $this, print );
      $menu.remove();
    });
  };

  var print = function( evt ) {
    var container = evt.data.clone();
    container.children('span').remove();
    var img = container.children('img');
    img.removeAttr('usemap');
    img.attr( 'id', 'diagram' );

    var w = img.width();
    var h = img.height();

    var title = 'ProVis Print';
    var prefs = foswiki.preferences;
    if ( prefs.provis && prefs.provis.title ) {
      title = prefs.provis.title;

      if ( prefs.provis.version ) {
        title += ', ' + prefs.provis.version;
      }
    }

    var dim = 'width=' + w + ',height=' + h;
    var wnd = window.open();
    var html = [
      '<html><head><title>',
      title,
      '</title></head><body>',
      '<div>',
        container.prop('innerHTML'),
      '</div>',
      '<script>document.getElementById("diagram").onload = function() { ',
        'document.close();',
        'window.focus();',
        'window.print();',
      '};</script>',
      '</body></html>'
    ];

    wnd.document.write( html.join('\n') );
    evt.preventDefault()
  };

  $(document).ready(function() {
    attachHandler();
  });
})(jQuery);
