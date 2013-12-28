(function($) {
  $.fn.extend( {
    // top menu
    menuButtonClicked: function() {
      var selectable = $(this).data( 'selectable' );
      if ( selectable == '1' ) {
        $('a.btn-selected').removeClass( 'btn-selected' );
        $(this).addClass( 'btn-selected' );
      }

      // toggable, e.g. 'Snap to grid' or 'Show grid'
      var toggable = $(this).data( 'toggable' );
      if ( toggable == '1' ) {
        if ( $(this).hasClass( 'btn-toggled' ) ) {
          $(this).removeClass( 'btn-toggled' );
        } else {
          $(this).addClass( 'btn-toggled' );
        }
      }

      // invoke
      // var action = $(this).data( 'action' );
      // var args = $(this).data( 'actionargs' );
      // if ( action ) {
      //   if ( args != null ) {
      //     $(this)[action]( document.provis, args );
      //   } else {
      //     $(this)[action]( document.provis );
      //   }
      // }

      return event.preventDefault();
    },

    saveButtonClicked: function() {
      // var str = document.provis.applet.saveToImage();
      // console.log( str );
      // return false;
      return event.preventDefault();
    },

    cancelButtonClicked: function() {
      // $(this).onCancel( document.provis );
      return event.preventDefault();
    },

    shapeItemClicked: function() {
      $('div.node.node-selected').removeClass('node-selected');
      $(this).addClass('node-selected');

      // var shapeName = $(this).data('shape');
      // var shape = document.provis.scriptHelper.shapeFromId( shapeName );
      // document.provis.diagram.setDefaultShape( shape );
      // document.provis.diagram.setShapeOrientation( shapeName == 'DirectAccessStorage' ? 180 : 0 );

      // var brush = null;
      // var cfg = $defaults[shapeName];
      // if ( cfg.useGradient ) {
      //   brush = $(this).createGradientBrush( cfg.background, cfg.gradientColor, cfg.gradientAngle );
      // } else {
      //   brush = $(this).createSolidBrush( cfg.background );
      // }

      // document.provis.diagram.setShapeBrush( brush );
      return event.preventDefault();
    }
  });

  $(document).ready( function() {
    $('a.btn').on( 'click', $(this).menuButtonClicked );
    $('#btn-save').on( 'click', $(this).saveButtonClicked );
    $('#btn-cancel').on( 'click', $(this).cancelButtonClicked );
    $('div.node').on( 'click', $(this).shapeItemClicked );
  });
})(jQuery);
