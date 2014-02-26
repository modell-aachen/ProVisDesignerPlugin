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

  // Extends an array to move elements around.
  if ( !Array.prototype.move ) {
    Array.prototype.move = function ( from, to ) {
      this.splice( to, 0, this.splice( from, 1 )[0] );
    };
  }

  /**
   * Note:
   *
   * Neither WebKit nor Trident (at least v7 as used by IE11) won't recognize
   * the applet's 'appletStarted' event.
   *
   * As workaround an instance of this "class" is created and injected into
   * the window by the applet itself. During applet startup this constructor is
   * invoked without passing a proper argument.
   *
   * Therefore it is mandatory to initialize the ctor's argument with an
   * accurate default value (a.k.a. applet id).
   */
  if ( !appletId ) appletId = 'jDiagApplet';
  var applet = document.getElementById( appletId );

  // Initially sets the applet bounds to its parent container element.
  var parent = $(applet).parent();
  applet.width = parent.width();
  applet.height = parent.height();


  /*****************************************************************************
   * private members
   ****************************************************************************/

  var swimlanes = [];
  var swimlaneHashes = [];
  var cfg = ProVis.config;
  var constants = ProVis.strings;
  var defaultTheme = "ModAc"
  var curTheme = ProVis.themes[defaultTheme];
  var undoComposite = null;
  var isDebug = false;
  var swimlaneContainer = null;


  /*****************************************************************************
   * private methods
   ****************************************************************************/

   /**
    * Helper method to iterate through a Java list synchronously.
    *
    * @param list The list.
    * @param action A callback to which each list item is passed to.
    * @return A jQuery promise.
    */
  var foreachListItem = function( list, action ) {
    var deferred = $.Deferred();
    for( var i = 0; i < list.size(); i++ )
      action( list.get( i ) );

    deferred.resolve();
    return deferred.promise();
  };

  /**
    * Helper method to iterate through a JavaScript array synchronously.
    *
    * @param array The list.
    * @param action A callback to which each element is passed to.
    * @return A jQuery promise.
    */
  var foreachArrayItem = function( array, action ) {
    var deferred = $.Deferred();
    for( var i = 0; i < array.length; i++ )
      action( array[i] );

    deferred.resolve();
    return deferred.promise();
  };

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

  var initialize = function( p ) {
    if ( p ) provis = p;
    provis.diagram.setDirty( false );
  };


  /*****************************************************************************
   * public properties
   ****************************************************************************/

  this.applet = applet;
  this.diagram = applet.getDiagram();
  this.scriptHelper = applet.getScriptHelper();
  this.undoManager = applet.getDiagram().getUndoManager();
  this.view = applet.getDiagramView();
  this.anchorPattern = null;


  /*****************************************************************************
   * public methods
   ****************************************************************************/

  /**
   * Wrapper/Helper method.
   * Creates a new 'java.awt.Color' instance.
   *
   * @param hexColor The color value.
   * @return An 'java.awt.Color' instance.
   */
  ProVis.prototype.createColor = function( hexColor ) {
    var c = this.getRGBColor( hexColor );
    return this.scriptHelper.createColor( c.r, c.g, c.b );
  };

  /**
   * Wrapper/Helper method.
   * Creates a new 'com.mindfusion.diagramming.Pen' instance.
   *
   * @param width The width (in px) this pen should draw.
   * @param hexColor The color of this pen.
   * @return An 'com.mindfusion.diagramming.Pen' instance.
   */
  ProVis.prototype.createPen = function( width, hexColor ) {
    var c = this.getRGBColor( hexColor );
    return this.scriptHelper.createPen( width, c.r, c.g, c.b );
  };

  /**
   * Wrapper/Helper method.
   * Creates a new 'com.mindfusion.diagramming.SolidBrush' instance.
   *
   * @param hecColor The color of this brush.
   * @return An 'com.mindfusion.diagramming.SolidBrush' instance.
   */
  ProVis.prototype.createSolidBrush = function( hexColor ) {
    var c = this.getRGBColor( hexColor );
    return this.scriptHelper.createSolidBrush( c.r, c.g, c.b );
  };

  /**
   * Wrapper/Helper method.
   * Creates a new 'com.mindfusion.diagramming.GradientBrush' instance.
   *
   * @param hexFrom The starting color.
   * @param hexTo The ending color.
   * @param angle The gradient angle.
   * @return An 'com.mindfusion.diagramming.GradientBrush' instance.
   */
  ProVis.prototype.createGradientBrush = function( hexFrom, hexTo, angle ) {
    var c1 = this.getRGBColor( hexFrom );
    var c2 = this.getRGBColor( hexTo );
    var sc = this.scriptHelper;
    return sc.createGradientBrush( c1.r, c1.g, c1.b, c2.r, c2.g, c2.b, angle );
  };

  /**
   * Creates a new swimlane and adds it to the diagram's whitepaper.
   *
   * @param orientation A value determining whether a vertical or horizontal swimlane shall be created.
   */
  ProVis.prototype.createSwimlane = function() {
    if ( !swimlaneContainer ) {
      swimlaneContainer = this.diagram.getSwimlaneContainer();
      if ( swimlaneContainer == null ) {
        var type = provis.scriptHelper.getConstant( 'SwimlaneType', 'Horizontal' );
        var fac = provis.diagram.getFactory();
        swimlaneContainer = fac.createSwimlaneContainer( type );
      }
    }

    swimlaneContainer.addLane();
    provis.container = swimlaneContainer;
  };

  /**
   * Helper method to convert a hex color string to a RGB color object.
   * Taken from: 'http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb'.
   *
   * @param hex The hex color.
   * @return An object representing the color in RGB notation.
   */
  ProVis.prototype.getRGBColor = function( hex ) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace( shorthandRegex, function( m, r, g, b ) {
        return r + r + g + g + b + b;
    });

    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec( hex );
    return result ? {
        r: parseInt( result[1], 16 ),
        g: parseInt( result[2], 16 ),
        b: parseInt( result[3], 16 )
    } : null;
  };

  /**
   * Reverts the most recent undo operation.
   */
  ProVis.prototype.redo = function() {
    var history = this.undoManager.getHistory();
    var redo = history.getNextRedo();
    if ( redo != null ) {
      try {
        this.undoManager.redo();
      } catch ( ex ) {
        console.log( ex.toString() );
      }
    }
  };

  /**
   * Saves all changes and uploads the resulting documents to the server.
   */
  ProVis.prototype.save = function() {
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
        // ToDo!!
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
            var macro = '%PROCESS{name="' + r.name + '" type="swimlane" aqmrev="' + r.aqmrev + '" maprev="' + r.maprev + '" pngrev="' + r.pngrev + '"}%';

            var regexp = new RegExp( pattern, 'g' );
            data = data.replace( regexp, macro );
            cke.setData( data );
          },
          error: function( xhr, status, error ) {
            console.log( 'update error' );
            console.log( xhr );
            console.log( status );
            console.log( error );
          }
        });
      },
      complete: function() {
        provis.diagram.setBounds( bounds );
        provis.toggleGridVisibility();
        $('applet').setVisible().done( function() { $.unblockUI(); });
      }
    });
  };

  /**
   * Sets a value indicating how the control should respond to users actions.
   *
   * @param behavior One of the 'com.mindfusion.diagramming.Behavior' constants.
   */
  ProVis.prototype.setBehavior = function( behavior ) {
    this.view.setBehavior( behavior );
  };

  ProVis.prototype.setDebug = function( state ) {
    isDebug = state && state != null;
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
    var history = this.undoManager.getHistory();
    var undo = history.getNextUndo();
    if ( undo != null ) {
      try {
        this.undoManager.undo();
      } catch( ex ) {
        console.log( ex );
      }
    }
  };

  /**
   *
   */
  ProVis.prototype.zoomIn = function() {
    var zoom = this.view.getZoomFactor() + cfg.zoomStep;
    return this.zoomTo( zoom );
  };

  /**
   *
   */
  ProVis.prototype.zoomOut = function() {
    var zoom = this.view.getZoomFactor() - cfg.zoomStep;
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
        success: function( data ) {
          provis.applet.loadFromString( data );
          initialize();
        },
        error: function() {
          $.unblockUI();
          initialize();
        }
      });
  } else {
    initialize( this );
  }

  // event wire up
  window.appletStarted = initialize;

  // initialize ProVis UI Controller
  this.ui.init().done( function() {
    setTimeout( function() { $(applet).height( 1 + $(applet).height() ); }, 500 );
    setTimeout( function() { $(applet).width( 1 + $(applet).width() ); }, 500 );
  });
};
