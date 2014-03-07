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

var ProVis;
MindFusion = {
  invokeInit: function( handler, applet, attempts ) {
    window.provis = new ProVis(applet);
  }
};
ProVis = function( appletId ) {

  if ( !appletId ) appletId = 'jDiagApplet';
  var applet = document.getElementById( appletId );

  // Initially sets the applet bounds to its parent container element.
  var parent = $(applet).parent();
  applet.width = parent.width();
  applet.height = parent.height();

  var isCtrlDown = false;

  /*****************************************************************************
   * private methods
   ****************************************************************************/

  /**
   * Gets a random string.
   * Used to create (hopefully) unique file names.
   *
   * @param length Optional, defaults to 32. The length of the string.
   * @return A random string.
   */
  var getRandomString = function( length ) {
    var string = '';
    var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

    if ( !length || length < 1 ) length = 32;
    for ( var i = 0; i < length; i++ ) {
      string += chars[Math.round( Math.random() * (chars.length - 1) )];
    }

    return string;
  };

  var onKeyDown = function( d, e ) {
    var key = e.getKeycode();

    if ( key != 17 && !isCtrlDown )
      return;

    switch( key ) {
      case 17:
        isCtrlDown = true;
        break;
      case 45:
        // ctrl + -
        provis.zoomOut();
        break;
      case 48:
        // ctrl + 0
        provis.zoomTo( 100 );
        break;
      case 49:
        // ctrl + 1
        $('div[data-shape=Rectangle]').click();
        break;
      case 50:
        // ctrl + 2
        $('div[data-shape=Decision]').click();
        break;
      case 51:
        // ctrl + 3
        $('div[data-shape=Document]').click();
        break;
      case 52:
        // ctrl + 4
        $('div[data-shape=Cylinder]').click();
        break;
      case 53:
        // ctrl + 5
        $('div[data-shape=Terminator]').click();
        break;
      case 54:
        // ctrl + 6
        $('div[data-shape=Ellipse]').click();
        break;
      case 55:
        // ctrl + 7
        $('div[data-shape=Comment]').click();
        break;
      case 65:
        // ctrl + a
        provis.diagram.selectAllItems();
        break;
      case 71:
        // ctrl + g
        provis.toggleSnapToGrid();
        break;
      case 78:
        // ctrl + n
        $('div[data-action=createSwimlane]').click();
        break;
      case 81:
        // ctrl + q
        $('#btn-close').click();
        break;
      case 82:
        // ctrl + r
        provis.toggleGridVisibility();
        break;
      case 83:
        // ctrl + s
        provis.save();
        break;
      case 89:
        // ctrl + y
        provis.redo();
        break;
      case 90:
        // ctrl + z
        provis.undo();
        break;
      case 521:
        // ctrl + +
        provis.zoomIn();
        break;
    }
  };

  var onKeyUp = function( d, e ) {
    var key = e.getKeycode();
    if ( key == 17 ) isCtrlDown = false;
  }

  /**
   * Link dialog.
   */
  var onNodeClicked = function( d, e ) {
    var btn = e.getMouseButton();
    var node = e.getNode();
    if ( btn == 1 || /Swimlane/.test( node.toString() ) ) return;

    var text = node.getText();
    var link = node.getHyperLink();
    provis.ui.selectLink( text, link, false ).done( function( link ) {
      if ( !link ) return;
      console.log( link );
      node.setHyperLink( link );
      node.setToolTip( link );
    });
  };


  /*****************************************************************************
   * public properties
   ****************************************************************************/

  this.applet = applet;
  this.diagram = applet.getDiagram();
  this.scriptHelper = applet.getScriptHelper();
  this.snapshotManager = applet.getDiagram().getSnapshotManager();
  this.view = applet.getDiagramView();
  this.anchorPattern = null;
  this.container = null;

  /*****************************************************************************
   * public methods
   ****************************************************************************/

  /**
   * Creates a new swimlane.
   */
  ProVis.prototype.createSwimlane = function() {
    if ( !this.container ) {
      // var type = provis.scriptHelper.getConstant( 'SwimlaneType', 'Vertical' );
      if ( !this.createSwimlaneContainer( 1 ) ) return;
    }

    this.container.addLane();
  };

  /**
   * Creates a new swimlane container.
   *
   * @param containerType A value determining whether a vertical or horizontal container shall be created.
   */
  ProVis.prototype.createSwimlaneContainer = function( containerType ) {
    if ( !this.container ) {
      this.container = this.diagram.getSwimlaneContainer( containerType );
    }

    return this.container;
  };

  /**
   * Reverts the most recent undo operation.
   */
  ProVis.prototype.redo = function() {
    try {
      this.snapshotManager.triggerRedo(this.view);
      this.container = this.diagram.getSwimlaneContainer(1);
    } catch ( ex ) {
      if(console && console.log) console.log( ex.toString() );
    }
  };

  ProVis.prototype.isDirty = function() {
    return this.diagram.getDirty();
  };

  /**
   * Saves all changes and uploads the resulting documents to the server.
   */
  ProVis.prototype.save = function( keepHidden ) {
    if ( !window.opener.provisTab || window.opener.provisTab.closed ) {
      // ToDo. user darauf hinweisen, dass die zugehörige cke instanz bereits geschlossen wurde
      // speichern ist somit nicht mehr möglich.s
      alert( 'foo');
      return;
    }

    var deferred = $.Deferred();

    $('applet').setHidden().done( function() { $.blockUI(); });

    // Resize grid to minimum required size (margin: 5px)
    var bounds = this.diagram.getBounds();
    this.diagram.resizeToFitItems( 5 );

    this.diagram.getSelection().clear();

    // Disable grid
    this.toggleGridVisibility();

    var imagemap = provis.applet.saveToMap('%MAPNAME%');
    var imagepng = provis.applet.saveToImage();
    var imageaqm = provis.applet.saveToString(true);

    var opener = window.opener.provis;
    var scriptPath = foswiki.getPreference( 'SCRIPTURLPATH' );
    var scriptSuffix = foswiki.getPreference( 'SCRIPTSUFFIX' );
    var restUrl = scriptPath + '/rest' + scriptSuffix;

    var url = restUrl + '/ProVisDesignerPlugin/upload';
    var drawingTopic = opener.web + '.' + opener.topic;
    var drawingType = 'swimlane';

    var drawingName;
    if ( opener.name ) {
      drawingName = opener.name;
    } else {
      drawingName = getRandomString( 32 );
    }

    var form = [];
    form.push( 'Content-Disposition: form-data; name="topic"\r\n\r\n'
      + drawingTopic );
    form.push( 'Content-Disposition: form-data; name="drawing"\r\n\r\n'
      + drawingName );
    form.push( 'Content-Disposition: form-data; name="aqm"\r\n\r\n'
      + imageaqm );
    form.push( 'Content-Disposition: form-data; name="png"\r\n\r\n'
      + imagepng );
    form.push( 'Content-Disposition: form-data; name="map"\r\n\r\n'
      + imagemap );

    // Generate boundaries
    var sep;
    var request = form.join('\n');
    do {
      sep = Math.floor( Math.random() * 1000000000 );
    } while ( request.indexOf( sep ) != -1 );

    request = "--" + sep + "\r\n" +
      form.join( '\r\n--' + sep + "\r\n" ) +
      "\r\n--" + sep + "--\r\n";

    $.ajax({
      type: 'post',
      url: url,
      data: request,
      contentType: 'multipart/form-data; boundary=' + sep,
      error: function( xhr, status, error ) {
        deferred.reject( error );
      },
      success: function( data, status, xhr ) {
        var r = jQuery.parseJSON( data );

        $.ajax({
          type: 'post',
          url: restUrl + '/ProVisDesignerPlugin/update',
          data: {
            name: r.name,
            w: r.web,
            t: r.topic,
            aqmrev: r.aqmrev,
            pngrev: r.pngrev,
            maprev: r.maprev
          },
          success: function( data, status, xhr ) {
            provis.diagram.setDirty( false );
            var cke = opener.getEditor();
            var data = cke.getData();

            var pattern = '%PROCESS{.*name="' + r.name + '".*}%';
            var macro = '%PROCESS{name="' + r.name + '" aqmrev="' + r.aqmrev + '" maprev="' + r.maprev + '" pngrev="' + r.pngrev + '"}%';

            var regexp = new RegExp( pattern, 'g' );
            data = data.replace( regexp, macro );
            cke.setData( data );

            // fixme!
            setTimeout( deferred.resolve, 1000 );
          },
          error: function( xhr, status, error ) {
            deferred.reject( error );
          }
        });
      },
      complete: function() {
        provis.diagram.setBounds( bounds );
        provis.toggleGridVisibility();

        if ( !keepHidden ) {
          $('applet').setVisible();
        }

        $.unblockUI();
      }
    });

    return deferred.promise();
  };

  /**
   * Toggles the visibility of the alignment grid.
   *
   * @param forceOff A value indicating whether the alignment grid is displayed.
   */
  ProVis.prototype.toggleGridVisibility = function( forceOff ) {
    var isVisible = this.diagram.getShowGrid() || forceOff;
    this.diagram.setShowGrid( !isVisible );
  };

  /**
   * Toggles whether items should be aligned to the alignment grid
   * while users draw or move them with the mouse.
   */
  ProVis.prototype.toggleSnapToGrid = function() {
    var snapToGrid = this.diagram.getAlignToGrid();
    this.diagram.setAlignToGrid( !snapToGrid );
  };

  /**
   * Reverts the most recent user changes.
   */
  ProVis.prototype.undo = function() {
    try {
      this.snapshotManager.triggerUndo(this.view);
      this.container = this.diagram.getSwimlaneContainer(1);
    } catch( ex ) {
      if(console && console.log) console.log( ex );
    }
  };

  /**
   * Increases the current zoom level.
   */
  ProVis.prototype.zoomIn = function() {
    var zoom = this.view.getZoomFactor() + this.view.getZoomStep();
    return this.zoomTo( zoom );
  };

  /**
   * Decreases the current zoom level.
   */
  ProVis.prototype.zoomOut = function() {
    var zoom = this.view.getZoomFactor() - this.view.getZoomStep();
    return this.zoomTo( zoom );
  };

  /**
   * Sets the zoom level to the provided value.
   *
   * @param value The zoom level.
   * @return The new zoom level.
   */
  ProVis.prototype.zoomTo = function( value ) {
    if ( value < 25 || value > 200 ) return;
    this.view.setZoomFactor( value );
    return value;
  };

  /*****************************************************************************
   * initialization
   ****************************************************************************/

  // load diagram
  var opener = window.opener;
  var file = opener.provis.name;
  var rev = opener.provis.aqmrev;

  // rev = 0 := new diagram
  if ( file && rev > 0 ) {
    var pub = opener.foswiki.getPreference( 'PUBURL' );
    var web = opener.provis.web;
    var topic = opener.provis.topic;
    var url = pub + '/' + web + '/' + topic + '/' + file + '.aqm?rev=' + rev;

    $.ajax({
        type: 'get',
        dataType: 'text',
        url: url,
        dataType: 'text',
        success: function( data ) {
          provis.applet.loadFromString( data );
          provis.snapshotManager.clear();
          provis.snapshotManager.markTransient();
          provis.snapshotManager.makeSnapshot("Loaded diagram");

          // java knows why...
          provis.view.scrollTo( -100, -100 );
        },
        error: function() {
          $.unblockUI();
        }
      });
  }
  // wire up applet events.
  window.onNodeClicked = onNodeClicked;
  window.onKeyDown = onKeyDown;
  window.onKeyUp = onKeyUp;

  // initialize ProVis UI Controller
  this.ui.init().done( function() {
    setTimeout( function() { $(applet).height( 1 + $(applet).height() ); }, 500 );
    setTimeout( function() { $(applet).width( 1 + $(applet).width() ); }, 500 );
  });


};
