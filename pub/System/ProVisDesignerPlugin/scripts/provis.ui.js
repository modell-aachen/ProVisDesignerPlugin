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

    var forceClose = false;
    var isMouseDown = false;
    var mouseX = -1;
    var isOptionsVisible = false;

    /***************************************************************************
     * public properties
     **************************************************************************/

    this.appletMinWidth = 0;
    this.appletMaxWidth = 0;

    /***************************************************************************
     * private methods
     **************************************************************************/

    var adjustAppletSize = function() {
      // return;
      var applet = $('.col-applet applet');
      var col = applet.parent();

      var left = $('.provis-preview').position().left;
      var first = $('#table-container table td:first-child').innerWidth()
      var prev = $('#table-container table td:last-child').prev().innerWidth()
      var last = $('#table-container table td:last-child').innerWidth()
      var width = left - (first + last + prev + 25);

      applet.width( width)
      applet.height( $('.provis-preview').height() );

      col.width( width );
      col.height( $('.provis-preview').height() );
    }

    /**
     * Event handler. Invoked after the user has clicked the close button.
     */
    var closeButtonClicked = function() {
      if ( provis.isDirty() ) {
        $('applet').setHidden();
        $('#modal-close').modal('show');
      } else {
        window.close();
      }

      return false;
    }

    var modalDismissed = function() {
      $('applet').setVisible();
    };

    var closeModalDiscard = function() {
      forceClose = true;
      window.close();
    };

    var closeModalSave = function() {
      provis.save( true ).done( function() {
        forceClose = true;
        window.close();
      }).fail( function( e ) { alert( e ); });
    };

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
        if ( action == 'save' ){
          provis.save( true ).done( function() {
            forceClose = true;
            window.close();
          }).fail( function( e ) { alert( e ); });
        } else {
          retval = provis[action]( args );
          var actionName = action.toString();
          if ( /zoom/.test( actionName ) ) {
            $('#select-zoom option:selected').removeAttr( 'selected' );
            $('#select-zoom option[value=' + retval + ']').attr( 'selected', 'selected' );
          }
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
      var options = $('#provis-preview');
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
    var shapeButtonClicked = function( e ) {
      if ( !$(e.target).parents('.node').hasClass('lane') ) {
        $('div.node.node-selected').removeClass( 'node-selected' );
        $(this).addClass( 'node-selected' );

        // tell the applet which shape is currently selected.
        var shapeType = provis.scriptHelper.getConstant( 'ProVisShapeType', $(this).data( 'shape' ) );
        provis.view.setCurrentShape( shapeType );
      }

      return false;
    };

    var toggleTopicPreview = function( e ) {
      var link = $('#preview-toggle');
      if ( !isOptionsVisible ) {
        link.addClass('coty-bg');
        $('#provis-applet').setHidden();
        $('#provis-preview').width( $(window).width() - 125 );
        $('#preview-topic').setVisible();
        $('#provis-preview').show( 'slide', {direction: 'right'}, 400, function() {
          isOptionsVisible = true;
        });
      } else {
        $('#provis-preview').hide( 'slide', {direction: 'right'}, 400, function() {
          isOptionsVisible = false;
          $('#preview-topic').setHidden();
          $('#provis-applet').setVisible();
          link.removeClass('coty-bg');
        });
      }

      return false;
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
      var deferred = $.Deferred();
      $.blockUI();
      initTooltips();

      $('#modal-close').on( 'hidden.bs.modal', modalDismissed );
      $('#modal-link').on( 'hidden.bs.modal', modalDismissed );

      $('#btn-close-save').on( 'click', closeModalSave );
      $('#btn-close-discard').on( 'click', closeModalDiscard );
      $('#btn-select-link').on( 'click', function() {
        var modal = $('#modal-link');
        modal.data( 'selected', true );
        modal.modal('hide');
      });

      $('.provis-topbar').show( 'slide', {direction: 'up'}, 500 );
      $('#provis-shapes').show( 'slide', {direction: 'left'}, 500 );

      $('#btn-close').on( 'click', closeButtonClicked );
      // $(window).bind("beforeunload", closeButtonClicked );

      $('a#preview-toggle').on( 'click', toggleTopicPreview );

      $('a.btn').on( 'click', menuButtonClicked );
      $('div.node').on( 'click', shapeButtonClicked );
      $('#select-zoom').on( 'change', zoomSelectionChanged );
      $('div.node.lane').on( 'click', function() {
        var action = $(this).data( 'action' );
        if ( action ) provis[action]();
      });

      // wire up mouse events. used to resize content
      $('#opts-adorner').on( 'mousedown', onMouseDown );
      $(window).on( 'mouseup', onMouseUp );
      $(window).on( 'mousemove', onMouseMove );

      // beforeunload
      $(window).on( 'beforeunload', null, null, function( e ) {
        if ( forceClose ) return;
        if ( !provis.isDirty() ) return;

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
      $('applet').toParentBounds().done( function() {
        $(window).trigger('resize');
        deferred.resolve();
      });

      // autocomplete

      // auto complete for link dialog(s)
      $('ul.ui-autocomplete.ui-menu.ui-widget').livequery( function() {
        var ul = $(this);
        ul.css( 'z-index', 1051 );
      });

      var proto = $.ui.autocomplete.prototype;
      var initSource = proto._initSource;

      function filter( array, term ) {
        var matcher = new RegExp( $.ui.autocomplete.escapeRegex(term), "i" );
        return $.grep( array, function(value) {
          return matcher.test( $( "<div>" ).html( value.label || value.value || value ).text() );
        });
      }

      $.extend( proto, {
        _initSource: function() {
          if ( this.options.html && $.isArray(this.options.source) ) {
            this.source = function( request, response ) {
              response( filter( this.options.source, request.term ) );
            };
          } else {
            initSource.call( this );
          }
        },

        _renderItem: function( ul, item) {
          return $( "<li></li>" )
            .data( "item.autocomplete", item )
            .append( $( "<a></a>" )[ this.options.html ? "html" : "text" ]( item.label ) )
            .appendTo( ul );
        }
      });

      $('input.autocomplete').livequery( function() {
        var e = $(this);
        e.autocomplete({
          html: true,
          source: function(req, resp) {
            $.ajax({
              'url': foswiki.getPreference('SCRIPTURLPATH') +'/view/System/AjaxHelper?section=topic;contenttype=text/plain;skin=text;excludeweb=Trash+System+TWiki+Sandbox+Custom;input='+encodeURIComponent(req.term.toLowerCase())+';t='+((new Date()).getTime()),
              dataType: 'json',
              success: function(data) {
                resp($.map(data, function(val) {
                  var o = {};
                  o.label = '<div class="autocomplete_label">'+val.label+'</div>'+
                    '<div class="autocomplete_sublabel">'+val.sublabel+'</div>';
                  o.value = val.value;
                  return o;
                }));
              },
              error: function() { resp([]); }
            });
          }
        });
      });

      $.unblockUI();
      return deferred.promise();
    };

    ProVisUIController.prototype.selectLink = function( caption, link, showDelete ) {
      var deferred = $.Deferred();
      var applet = $('applet');
      applet.setHidden();

      var dialog = $('#modal-link');

      $('#input-link').val( link );
      $('#node-text').text( caption );
      if ( !showDelete )
        $('#btn-delete-link').setHidden();
      dialog.modal('show');

      var callback = function( e ) {
        dialog.off( 'hide.bs.modal' );

        var isSelected = $(this).data( 'selected');
        $(this).data( 'selected', '' );

        deferred.resolve( isSelected ? $('#input-link').val() : null );
      };

      dialog.on('hide.bs.modal', callback );
      return deferred.promise();
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
      deferred.resolve();
      return deferred.promise();
    },

    setHidden: function() {
      var deferred = $.Deferred();
      deferred.resolve( this.css('visibility', 'hidden') );
      deferred.resolve();
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
    var isFirstLoad = true;
    $(window).resize( function() {
      var options = $('#provis-preview');
      var rightbar = $('#provis-rightbar');
      var container = $('#provis-applet');
      var adorner = $('#opts-adorner');
      var width = $(this).width();
      var left = container.position().left;

      if ( width > 1024 ) {
        rightbar.hide();

        // fix for previously shown options/preview pane.
        isOptionsVisible = false;
        options.width( 450 );

        /*
          ToDo. remove slide animation
                as hotfix for know, set animation duration to 1ms (will cause flicker)
         */
        options.show( 'slide', {direction: left}, 1, function() {
          $('#preview-topic').setVisible();
          adorner.fadeIn();
          container.width( width - (70 + options.width() + left) );
          $('applet').toParentBounds().done( function() {
            $('#provis-applet').setVisible();
          });
        });
      } else {
        options.hide();
        adorner.hide();
        $('#preview-topic').setHidden().done( function() {
          rightbar.show( 'slide', {direction: left}, 1 );
          container.width( width - (90 + left) );
          if ( isFirstLoad ) {
            isFirstLoad = false;
            $('#provis-applet').setVisible();
          }
          $('applet').toParentBounds();
        });
      }
    });

    // fix ie10/11
    $(window).trigger('resize');

    // observer callback. Called by CKE.
    window.notify = function( d ) {
      $('#preview-topic').html( d );
    }

    // set initial topic content within preview area
    if ( window.opener.provis ) {
      $('#preview-topic').html( window.opener.provis.topicContent );
    }
  });
})(jQuery);

