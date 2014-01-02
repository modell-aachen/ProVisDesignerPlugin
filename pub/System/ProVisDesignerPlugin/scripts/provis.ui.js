// Copyright (C) 2013 Modell Aachen GmbH

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

if ( ProVis && !ProVis.prototype.ui ) {
  var ProVisUIController = function() {

    /***************************************************************************
     * private methods
     **************************************************************************/

    /**
     * Event handler. Invoked after the user has clicked the close button.
     */
    var closeButtonClicked = function() {
      var isDirty = provis.diagram.getDirty();
      if ( isDirty ) {
        showBeforeCloseHint();
      }

      return false;
    }

    /**
     * Initializes element tooltips as provided by Bootstrap.
     */
    var initTooltips = function() {
      $.each( $('.ui-tooltip'), function( i, e ) {
        $(e).tooltip({
          delay: 250,
          trigger: 'hover',
          placement: $(e).data('tooltip-placement')
        });
      });
    };

    /**
     * Event handler. Invoked after the user has clicked any menu button.
     */
    var menuButtonClicked = function() {
      var selectable = $(this).data( 'selectable' );
      if ( selectable == '1' ) {
        $('a.btn-selected').removeClass( 'btn-selected' );
        $(this).addClass( 'btn-selected' );
      }

      var toggable = $(this).data( 'toggable' );
      if ( toggable == '1' ) {
        if ( $(this).hasClass( 'btn-toggled' ) ) {
          $(this).removeClass( 'btn-toggled' );
        } else {
          $(this).addClass( 'btn-toggled' );
        }
      }

      var action = $(this).data( 'action' );
      var args = $(this).data( 'actionargs' );
      var retval = null;
      if ( action ) {
        retval = provis[action]( args );
        var actionName = action.toString();
        if ( /zoom/.test( actionName ) ) {
          $('#select-zoom option:selected').removeAttr( 'selected' );
          $('#select-zoom option[value=' + retval + ']').attr( 'selected', 'selected' );
        }
      }

      return false;
    };

    /**
     * Event handler. Invoked after the user has selected a shape.
     */
    var shapeButtonClicked = function() {
      $('div.node.node-selected').removeClass( 'node-selected' );
      $(this).addClass( 'node-selected' );
      return false;
    };

    /**
     * Shows a modal dialog to the user to let him choose whether he wants to
     * discard unsaved changes.
     */
    var showBeforeCloseHint = function() {
      $(provis.applet).css( 'visibility', 'hidden' );
      $('#modal-close').modal().on('hidden.bs.modal', function() {
        $(provis.applet).css( 'visibility', 'visible' );
      });
    };

    /**
     * Event handler. Invoked after the user has changed the zoom level dropdown.
     */
    var zoomSelectionChanged = function() {
      provis.zoomTo( $(this).val() );
      return false;
    };


    /***************************************************************************
     * public methods
     **************************************************************************/

    /**
     * Initializes this instance.
     */
    ProVisUIController.prototype.init = function() {
      initTooltips();

      $('#btn-close').on( 'click', closeButtonClicked );
      // $(window).bind("beforeunload", closeButtonClicked );

      $('a.btn').on( 'click', menuButtonClicked );
      $('div.node').on( 'click', shapeButtonClicked );
      $('#select-zoom').on( 'change', zoomSelectionChanged );

// delete me
$('img#ma-logo-small').on( 'click', function() {
  provis.createSwimlane();
});


$('div.provis-right-container').resizable({
  handles: "w",
  ghost: false, // disable eye-candy. seems broken (corrupts the absolute layout)
  animate: false,
  maxWidth: $(window).width() / 2, // ToDo!! hier sollte nicht die aktuelle window-breite verwendet werden
  minWidth: 300,
  resize: function( e, ui ) {
    var r = $('div.provis-right-container');
    var pos = r.position();
    console.log( ui.size.width + pos.left );
  }
});
//

      // observer callback. Called by CKE.
      window.notify = function( d ) {
        $('div#topic-content').html( d );
      }

      // set initial topic content within preview area
      if ( window.opener.topic != null ) {
        $('div#topic-content').html( window.opener.topic );
      }
    };
  };

  // populate
  ProVis.prototype.ui = function() {
    return new ProVisUIController();
  }();
}
