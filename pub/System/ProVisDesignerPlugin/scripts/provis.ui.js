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
     * private members
     **************************************************************************/

    var isMouseDown = false;
    var mouseX = -1;


    /***************************************************************************
     * public properties
     **************************************************************************/

    this.appletMinWidth = 0;
    this.appletMaxWidth = 0;

    /***************************************************************************
     * private methods
     **************************************************************************/

    var adjustAppletSize = function() {
      return;
      var applet = $('.col-applet applet');
      var col = applet.parent();

      var left = $('.provis-options').position().left;
      var first = $('#table-container table td:first-child').innerWidth()
      var prev = $('#table-container table td:last-child').prev().innerWidth()
      var last = $('#table-container table td:last-child').innerWidth()
      var width = left - (first + last + prev + 25);

      applet.width( width)
      applet.height( $('.provis-options').height() );

      col.width( width );
      col.height( $('.provis-options').height() );
    }

    /**
     * Event handler. Invoked after the user has clicked the close button.
     */
    var closeButtonClicked = function() {
      window.close();
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
     * Event handler.
     */
    var onMouseDown = function() {
      isMouseDown = true;
      $(window).disableSelection();
    };

    /**
     * Event handler. Resizes the applet and options container.
     */
    var onMouseMove = function( e ) {
      if ( !isMouseDown ) return;

      if ( mouseX < 0 ) {
        mouseX = e.pageX;
        return;
      }

      var applet = $('#provis-applet');
      var adorner = $('#opts-adorner');
      var options = $('#provis-options');
      var appletWidth = applet.width() - (mouseX - e.pageX);
      var optionsWidth = options.width() + (mouseX - e.pageX);

      if ( appletWidth <= provis.ui.appletMinWidth ) {
        adorner.removeClass('chevron-left-right');
        adorner.addClass('chevron-right');
        return;
      }

      if ( appletWidth >= provis.ui.appletMaxWidth ) {
        adorner.removeClass('chevron-left-right');
        adorner.addClass('chevron-left');
        return;
      }

      adorner.removeClass('chevron-left');
      adorner.removeClass('chevron-right');
      adorner.addClass('chevron-left-right');

      applet.width( appletWidth );
      $('applet').toParentBounds().done( function() {
        options.width( optionsWidth );
        adorner.css( 'right', 21 + optionsWidth );
      });

      mouseX = e.pageX;
    };

    /**
     * Event handler.
     */
    var onMouseUp = function() {
      if ( !isMouseDown ) return;

      isMouseDown = false;
      $(window).enableSelection();
      mouseX = -1;
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

      // wire up mouse events. used to resize content
      $('#opts-adorner').on( 'mousedown', onMouseDown );
      $(window).on( 'mouseup', onMouseUp );
      $(window).on( 'mousemove', onMouseMove );

      // beforeunload
      $(window).on( 'beforeunload', null, null, function( e ) {
        var isDirty = provis.diagram.getDirty();
        if ( !isDirty ) return;

        var warning = $('#close-text').text();
        var oe = e.originalEvent || window.event;
        if (oe) oe.returnValue = warning;
        return warning;
      });

      // initially set the applet's max. allowed witdh.
      // ToDo: settings!!!
      this.appletMaxWidth = $('#provis-applet').width();
      this.appletMinWidth = 600; // testing.

      // ToDo. buggy in webkit
      $('applet').toParentBounds();
    };
  };

  // populate
  ProVis.prototype.ui = function() {
    return new ProVisUIController();
  }();
}

(function($) {
  $.fn.extend( {
    setVisible: function() {
      var deferred = $.Deferred();
      deferred.resolve( this.css('visibility', 'visible') );
      return deferred.promise();
    },

    setHidden: function() {
      var deferred = $.Deferred();
      deferred.resolve( this.css('visibility', 'hidden') );
      return deferred.promise();
    },

    toParentBounds: function() {
      var deferred = $.Deferred();

      var parent = this.parent();
      if ( !parent ) {
        deferred.reject( 'No parent node found!' );
        return deferred.promise();
      }

      this.width( parent.width() );
      this.height( parent.height() );

      deferred.resolve();
      return deferred.promise();
    }
  });

  $(document).ready( function() {
    $(window).resize( function() {
      var options = $('#provis-options');
      var rightbar = $('#provis-rightbar');
      var container = $('#provis-applet');
      var adorner = $('#opts-adorner');
      var width = $(this).width();
      var left = container.position().left;

      if ( width > 1024 ) {
        $('applet').toParentBounds();

        rightbar.hide( 'slow' );
        adorner.setVisible();
        options.show( 'slow', function() {
          $('#opts-topic').setVisible();
          container.width( width - (70 + options.width() + left) );
          $('applet').toParentBounds();
        });
      } else {
        options.hide();
        adorner.setHidden();
        $('#opts-topic').setHidden().done( function() {
          rightbar.show( 'slow' );
          container.width( width - (90 + left) );
          $('applet').toParentBounds();
        });
      }
    });

    // todo
    $( window ).unload(function() {});

    // observer callback. Called by CKE.
    window.notify = function( d ) {
      $('#opts-topic').html( d );
    }

    // set initial topic content within preview area
    if ( window.opener.provis ) {
      $('#opts-topic').html( window.opener.provis.topicContent );
    }
  });
})(jQuery);

