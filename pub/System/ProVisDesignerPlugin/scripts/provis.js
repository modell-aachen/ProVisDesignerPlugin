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

var ProVis = function( appletId ) {

  // Extends an array to move elements around.
  if ( !Array.prototype.move ) {
    Array.prototype.move = function ( from, to ) {
      this.splice( to, 0, this.splice( from, 1 )[0] );
    };
  }


// delete me
$('img#ma-logo-small').on( 'click', function() {
  provis.createSwimlane();
});
$( "#tabs" ).tabs({ heightStyle: "fill" });
$('div.provis-right-container').resizable({
  handles: "w",
  ghost: false, // disable eye-candy. seems broken (corrupts the absolute layout)
  animate: false,
  maxWidth: $(window).width() / 2,
  minWidth: 300,
  resize: function( e, ui ) {
    // var diff = $(this).width() - 300;
    // var $appArea = $('div.provis-apparea');
    // var appWidth = $appArea.width();
    // $appArea.width( appWidth - diff );
    // $(window).trigger('resize');
  }
});
//

  // Initially sets the applet bounds to its parent container element.
  if ( !appletId ) appletId = 'jDiagApplet';
  var applet = document.getElementById( appletId );
  var parent = $(applet).parent();
  applet.width = parent.width();
  applet.height = parent.height();


  /******************************
   * private members
   ******************************/

  var swimlanes = [];
  var cfg = ProVis.config;
  var constants = ProVis.strings;


  /******************************
   * private methods
   ******************************/

  /**
   * Aligns all swimlanes in a row.
   * Called after a swimlane has been moved or deleted.
   *
   * @return A jQuery promise.
   */
  var alignSwimlanes = function() {
    var deferred = $.Deferred();

    if ( swimlanes.length == 0 ) deferred.reject();
    else {
      var x = cfg.gridSizeX / 2;
      var y = cfg.gridSizeY / 2;
      foreachArrayItem( swimlanes, function( lane ) {
        lane.moveTo( x, y );
        x += lane.getBounds().getWidth();
      }).done( deferred.resolve ).fail( deferred.reject );
    }

    return deferred.promise();
  };

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
   * Gets all successive swimlanes relative to the provided ancestor node.
   *
   * @param ancestor A swimlane top (caption) node.
   * @return A jQuery promise containing the successors.
   */
  var getSuccessiveLanes = function( ancestor ) {
    var deferred = $.Deferred();

    if ( ancestor && ancestor.getTag() == constants.swimlaneTopTag ) {
      var isSuccessor = false;
      var successors = [];
      for( var i = 0; i < swimlanes.length; i++ ) {
        if ( isSuccessor ) successors.push( swimlanes[i] );
        else if ( swimlanes[i] === ancestor ) isSuccessor = true;
      }

      deferred.resolve( successors );
    } else {
      deferred.reject( 'Invalid ancestor node.' );
    }

    return deferred.promise();
  };

  /*
   * Sets the height of each swimlane.
   * Called after the whitepaper's height has changed.
   *
   * @param newHeight The height to which each swimlane shall be resized.
   * @return A jQuery promis.
   */
  var setSwimlanesHeight = function( newHeight ) {
    var deferred = $.Deferred();

    foreachArrayItem( swimlanes, function( caption ) {
      var lane = caption.getSubordinateGroup().getAttachedNodes().get( 0 );
      lane.resize( lane.getBounds().getWidth(), newHeight );
    }).done( function() {
      deferred.resolve();
    }).fail( function() {
      deferred.reject();
    });

    return deferred.promise();
  };

  /*
   * Sets the width of each swimlane.
   * Called after the whitepaper's width has changed.
   *
   * @param newWidth The width to which each swimlane shall be resized.
   * @return A jQuery promis.
   */
  var setSwimlanesWidth = function( newWidth ) {
    var deferred = $.Deferred();

    foreachArrayItem( swimlanes, function( caption ) {
      var lane = caption.getSubordinateGroup().getAttachedNodes().get( 0 );
      lane.resize( newWidth, lane.getBounds().getHeight() );
    }).done( function() {
      deferred.resolve();
    }).fail( function() {
      deferred.reject();
    });

    return deferred.promise();
  };


  /******************************
   * public properties
   ******************************/

  this.applet = applet;
  this.diagram = applet.getDiagram();
  this.scriptHelper = applet.getScriptHelper();
  this.undoManager = applet.getDiagram().getUndoManager();
  this.view = applet.getDiagramView();
  this.anchorPattern = null;


  /******************************
   * public methods
   ******************************/

  /**
   * Adjusts the applet's width and height according to its parent container element.
   * Called after 'window.resize' has been triggered.
   */
  ProVis.prototype.adjustAppletBounds = function() {
    var parent = this.applet.parentElement;
    provis.applet.width = $(parent).width();
    provis.applet.height = $(parent).height();
  };

  /**
   * Adjusts the height of the diagrams whitepaper.
   * Called when a vertical swimlane has changed.
   *
   * @param newHeight The new height of the whitepaper node.
   */
  ProVis.prototype.adjustWhitepaperHeight = function( newHeight ) {
    var whitepaper = provis.diagram.findNode( constants.whitepaperTag );
    var b = whitepaper.getBounds();
    whitepaper.setBounds( b.getX(), b.getY(), b.getWidth(), newHeight );
  };

  /**
   * Adjusts the width of the diagrams whitepaper.
   * Called when a horizontal swimlane has changed.
   *
   * @param newWidth The new width of the whitepaper.
   */
  ProVis.prototype.adjustWhitepaperWidth = function( newWidth ) {
    var whitepaper = provis.diagram.findNode( constants.whitepaperTag );
    var b = whitepaper.getBounds();
    whitepaper.setBounds( b.getX(), b.getY(), newWidth, b.getHeight() );
  };

  /**
   * Applies configuration values to a newly created node.
   * Called each time a node (either ShapeNode or DiagramNode) was created.
   *
   * @param node The node to be configured.
   * @param cfg The configuration values.
   */
  ProVis.prototype.applyNodeDefaults = function( node, cfg ) {
    if ( this.anchorPattern == null ) {
      this.anchorPattern = this.scriptHelper.anchorPatternFromId( 'Decision2In2Out' );
      var points = this.anchorPattern.getPoints();
      for( var i = 0; i < points.size(); i++ ) {
        var pt = points.get( i );
        pt.setMarkStyle( 3 );
        pt.setColor( provis.createColor( i < 2 ? ProVis.config.anchorInColor : ProVis.config.anchorOutColor ) );
      }
    }

    var brush = null;
    if ( cfg.useGradient ) {
      brush = provis.createGradientBrush(
        cfg.background,
        cfg.gradientColor,
        cfg.gradientAngle );
    } else {
      brush = provis.createSolidBrush( cfg.background );
    }

    node.setBrush( brush );
    node.setAnchorPattern( provis.anchorPattern );

    var borderPen = provis.createPen( cfg.borderWidth, cfg.borderBrush );
    node.setPen( borderPen );
  };

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
   * @param rotation A value determining whether a vertical or horizontal swimlane shall be crated.
   */
  ProVis.prototype.createSwimlane = function( rotation ) {
    provis.ensureWhitepaper();

    var oldShape = provis.diagram.getDefaultShape();
    var newShape = provis.scriptHelper.shapeFromId( 'Rectangle' );
    provis.diagram.setDefaultShape( newShape );

    // ToDo
    if ( !rotation ) rotation = 0;
    else {
      if ( rotation < 0 ) rotation = 0;
      if ( rotation > 90 ) rotation = 90;
    }

    // var composition = provis.undoManager.startComposite( 'newSwimlane', true );

    var cfg = ProVis.config;

    var wp = provis.diagram.findNode( constants.whitepaperTag );
    var wpBounds = wp.getBounds();

    var offsetX = cfg.gridSizeX / 2;
    var offsetY = cfg.gridSizeY / 2;

    var factory = provis.diagram.getFactory();
    var titleNode = factory.createShapeNode(
      offsetX + wpBounds.getWidth(),
      offsetY,
      cfg.swimlaneWidth,
      cfg.captionHeight );

    var font = provis.scriptHelper.createFont( 'Arial Bold', cfg.captionFontSize );
    titleNode.setFont( font );

    var brush = null;
    if ( cfg.captionUseGradient ) {
      brush = provis.createGradientBrush(
        cfg.captionBackground,
        cfg.captionGradientColor,
        cfg.captionGradientAngle );
    } else {
      brush = provis.createSolidBrush( cfg.captionBackground );
    }

    titleNode.setBrush( brush );
    titleNode.setLocked( false );
    titleNode.setObstacle( true );
    titleNode.setText( "Label" + (1 + swimlanes.length) );
    titleNode.setTag( constants.swimlaneTopTag );
    titleNode.setAllowIncomingLinks( false );
    titleNode.setAllowOutgoingLinks( false );
    titleNode.setEnabledHandles( cfg.swimlaneTopHandles );
    titleNode.setHandlesStyle( cfg.defaultHandleStyle );

    var titleConstraints = titleNode.getConstraints();
    titleConstraints.setMoveDirection( 1 );

    // // Content
    var laneNode = factory.createShapeNode(
      offsetX + wpBounds.getWidth(),
      offsetY + cfg.captionHeight,
      cfg.swimlaneWidth,
      wpBounds.getHeight() - cfg.captionHeight );

    laneNode.setZIndex(1);

    laneNode.setLocked( true );
    laneNode.setEnabledHandles( cfg.swimlaneHandles );
    laneNode.setHandlesStyle( cfg.defaultHandleStyle );

    var laneConstraints = laneNode.getConstraints();
    laneConstraints.setMoveDirection( 1 );
    laneNode.setBrush( provis.createSolidBrush( cfg.swimlaneBackBrush ) );
    laneNode.setObstacle( false );
    laneNode.setTag( constants.swimlaneTag );
    laneNode.attachTo( titleNode, 0 );
    laneNode.setAllowIncomingLinks( false );
    laneNode.setAllowOutgoingLinks( false );

    titleNode.getSubordinateGroup().setAutodeleteItems( true );
    titleNode.setZIndex( 2 );

    var newWidth = wpBounds.getWidth() + cfg.swimlaneWidth;
    provis.adjustWhitepaperWidth( newWidth );

    // composition.execute();

    provis.diagram.setDefaultShape( oldShape );

    swimlanes.push( titleNode );
  };

  /**
   * A method checking for the presence of a whitepaper node.
   * Called each time before a new swimlane is added to the diagram.
   */
  ProVis.prototype.ensureWhitepaper = function() {
    var wp = provis.diagram.findNode( constants.whitepaperTag );
    if ( wp != null ) return;

    // Reachable only if there's no whitepaper present
    var factory = provis.diagram.getFactory();
    var offsetX = ProVis.config.gridSizeX / 2;
    var offsetY = ProVis.config.gridSizeY / 2;

    whitepaper = factory.createShapeNode(
      offsetX,
      offsetY,
      0,
      ProVis.config.captionHeight + ProVis.config.swimlaneHeight );

    whitepaper.setTag( constants.whitepaperTag );
    whitepaper.setLocked( false );
    whitepaper.setAllowIncomingLinks( false );
    whitepaper.setAllowOutgoingLinks( false );
    whitepaper.setObstacle( false );
    whitepaper.setTransparent( true );
    whitepaper.setVisible( true );
    whitepaper.setZIndex( 0 );

    whitepaper.setEnabledHandles( 64 );
    whitepaper.setHandlesStyle( 1 );
  };

  /**
   * Gets the swimlane at the provided 'java.awt.geom.Point2D.Float'.
   *
   * @param pt The location to search for a swimlane.
   * @return The swimlane at the provided location or 'null' if no swimlane was found.
   */
  ProVis.prototype.getParentNodeAt = function( pt ) {
    var parents = provis.diagram.getNodesAt( pt );
    for ( var i = 0; i < parents.size(); i++ ) {
      var parent = parents.get( i );
      if ( parent.getTag() == constants.swimlaneTag ) {
        return parent;
      }
    }

    return null;
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
   * Event handler which is called each time before a new node is created.
   * Invokes 'ProVis.prototype.applyNodeDefaults'.
   *
   * @param d 'com.mindfusion.diagramming.Diagram'
   * @param e 'com.mindfusion.diagramming.NodeValidationEvent'
   */
  ProVis.prototype.nodeCreating = function( d, e ) {
    var node = e.getNode();
    var id = node.getShape().getId();
    var cfg = ProVis.nodeDefaults[id];
    if ( !cfg ) return;

    provis.applyNodeDefaults( node, cfg );
  };

  /**
   * Event handler which is called each time after a node was deleted.
   * Keeps track of swimlanes and adjusts (if needed) the whitepaper bounds.
   *
   * @param d 'com.mindfusion.diagramming.Diagram'
   * @param e 'com.mindfusion.diagramming.NodeEvent'
   */
  ProVis.prototype.nodeDeleted = function( d, e ) {
    var node = e.getNode();
    if ( node.getTag() == constants.swimlaneTopTag ) {
      var wp = d.findNode( constants.whitepaperTag );
      var wpWidth = wp.getBounds().getWidth();
      var newWidth = wpWidth - node.getBounds().getWidth();
      provis.adjustWhitepaperWidth( newWidth );

      swimlanes.splice( swimlanes.indexOf( node ), 1 );
      alignSwimlanes().done( function() {
        // provis.view.repaint( true );
      });
    }
  };

  /**
   * Event handler which is called each time a swimlane was double clicked.
   * Creates a new node based on the current user selection.
   *
   * @param d 'com.mindfusion.diagramming.Diagram'
   * @param e 'com.mindfusion.diagramming.NodeEvent'
   */
  ProVis.prototype.nodeDoubleClicked = function( d, e ) {
    var swimlane = e.getNode();
    if ( swimlane.getTag() != constants.swimlaneTag ) return;

    var bounds = swimlane.getBounds();
    var pos = e.getMousePosition();
    var factory = d.getFactory();
    var shapeId = $('div.node.node-selected').data( 'shape' );
    var cfg = ProVis.nodeDefaults[shapeId];

    var x = bounds.getX() + bounds.getWidth()/2 - cfg.width/2;
    var y = pos.getY() - cfg.height/2;

    var shape = provis.scriptHelper.shapeFromId( shapeId );
    d.setShapeOrientation( shapeId == 'DirectAccessStorage' ? 180 : 0 );
    d.setDefaultShape( shape );

    var node = factory.createShapeNode( x, y, cfg.width, cfg.height );
    provis.applyNodeDefaults( node, cfg );

    node.attachTo( swimlane, 0 );
  };

  /**
   * Event handler which is called after a node has changed.
   * Handles swimlane modifications.
   *
   * @param d 'com.mindfusion.diagramming.Diagram'
   * @param e 'com.mindfusion.diagramming.NodeEvent'
   */
  ProVis.prototype.nodeModified = function( d, e ) {
    provis.view.resumeRepaint();

    var node = e.getNode();
    var handle = e.getAdjustmentHandle();
    var tag = node.getTag();

    /*
     *   HandleStyles:
     *
     *   0***4***1
     *   *       *
     *   7   8   5
     *   *       *
     *   3***6***2
     */

    switch ( handle ) {
      // case 6:
      //   if ( tag != constants.whitepaperTag ) return;
      //   var newHeight = node.getBounds().getHeight() - ProVis.config.captionHeight;
      //   var nodes = d.getNodes();
      //   for( var i = 0; i < nodes.size(); i++ ) {
      //     var current = nodes.get( i );
      //     if ( current.getTag() == constants.swimlaneTag ) {
      //       var laneWidth = current.getBounds().getWidth();
      //       current.resize( laneWidth, newHeight );
      //     }
      //   }

      //   break;
      case 8:
        if ( tag == constants.swimlaneTopTag ) {
          var offsetX = ProVis.config.gridSizeX / 2;
          // for( var i = 0; i < $stats.lanes.length; i++ ) {
          //   var lane = $stats.lanes[i];
          //   var bounds = lane.getBounds();
          //   lane.moveTo( offsetX, bounds.getY() );
          //   offsetX += bounds.getWidth();
          // }
        } else {
          // update parent container (swimlane)
          var bounds = node.getBounds();
          var pt = provis.scriptHelper.createPointF( bounds.getX(), bounds.getY() );
          var parent = provis.getParentNodeAt( pt );
          if ( parent ) node.attachTo( parent, 0 );
        }

        break;
    }
  };

  /**
   * Event handler which is called while a node is changing.
   * Handles swimlane and whitepaper modifications.
   *
   * @param d 'com.mindfusion.diagramming.Diagram'
   * @param e 'com.mindfusion.diagramming.NodeEvent'
   */
  ProVis.prototype.nodeModifying = function( d, e ) {
    var node = e.getNode();
    var handle = e.getAdjustmentHandle();
    var tag = node.getTag();

    /*
     *   HandleStyles:
     *
     *   0***4***1
     *   *       *
     *   7   8   5
     *   *       *
     *   3***6***2
     */

    switch ( handle ) {
      case 5:
        if ( tag != constants.swimlaneTopTag ) return;
        var bounds = node.getBounds();

// var curTr = bounds.getX() + bounds.getWidth();
// if ( tr != curTr ) tr = curTr;
// else return;
// console.log( curTr );

        var group = node.getSubordinateGroup();
        var body = group.getAttachedNodes().get( 0 );
        body.resize( bounds.getWidth(), body.getBounds().getHeight() );

        getSuccessiveLanes( node ).done( function( lanes ) {
          var x = bounds.getX() + bounds.getWidth();
          var y = bounds.getY();

          foreachArrayItem( lanes, function( lane ) {
            lane.moveTo( x, y );
            x += lane.getBounds().getWidth();
          }).done( function() {
            // provis.view.repaint( true );
          });
        });
        break;
      case 6:
        if ( tag != constants.whitepaperTag ) return;
        var newHeight = node.getBounds().getHeight() - ProVis.config.captionHeight;
        setSwimlanesHeight( newHeight ).done( function() {
          // provis.view.repaint( true );
        });

        break;
    }
  };

  /**
   * Event handler which is called before a node is changed.
   * Disables the diagram's internal repaint event (to prevent flickering).
   *
   * @param d 'com.mindfusion.diagramming.Diagram'
   * @param e 'com.mindfusion.diagramming.NodeEvent'
   */
  ProVis.prototype.nodeStartModifying = function( d, e ) {
    provis.view.suspendRepaint();
  }

  /**
   * Event handler which is called after a node's text has changed.
   * Sets a node's font (size and color) according to its configuration.
   *
   * @param d 'com.mindfusion.diagramming.Diagram'
   * @param e 'com.mindfusion.diagramming.NodeEvent'
   */
  ProVis.prototype.nodeTextChanged = function( d, e ) {
    provis.view.resumeRepaint();

    var node = e.getNode();
    var tag = node.getTag();
    var font = null;

    if ( tag == constants.swimlaneTopTag ) {
      font = provis.scriptHelper.createFont( 'Arial Bold', cfg.captionFontSize );
    } else {
      var shapeName = node.getShape().getId();
      var cfg = ProVis.nodeDefaults[shapeName];

      var color = provis.createColor( cfg.foreground );
      node.setTextColor( color );
      font = provis.scriptHelper.createFont( 'Arial', cfg.fontsize );
    }

    node.setFont( font );
    // node.resizeToFitText( provis.scriptHelper.getConstant( 'FitSize', 'KeepRatio' ) );
  };


  /******************************
   * initialization
   ******************************/

  // enable grid
  this.diagram.setGridSizeX( cfg.gridSizeX );
  this.diagram.setGridSizeY( cfg.gridSizeY );
  this.diagram.setGridStyle( cfg.gridStyle );
  this.diagram.setShowGrid( cfg.showGrid );

  // eye candy. 3px white frame around grid
  var whitePen = this.createPen( 3, '#fff' );
  this.diagram.setBoundsPen( whitePen );

  // allow inplace editing of captions and shape titles
  this.view.setAllowInplaceEdit( cfg.allowInplaceEdit );

  // default behavior (cursor): connect
  this.view.setBehavior( cfg.defaultBehavior );

  // default handles.
  this.diagram.setShapeHandlesStyle( cfg.defaultHandleStyle );
  this.diagram.setAdjustmentHandlesSize( cfg.defaultHandleSize );

  // Sets whether link segments can be added and removed interactively.
  this.diagram.setAllowSplitLinks( cfg.allowSplitLinks );

  // Sets a value indicating whether users are allowed to attach links to nodes that do not have any anchor points.
  this.diagram.setAllowUnanchoredLinks( cfg.allowUnanchoredLinks );

  // Sets a value indicating users are allowed to move the end points of a link after the link is created.
  this.diagram.setLinkEndsMovable( cfg.linkEndsMovable );

  // Sets whether disabled manipulation handles should be displayed.
  this.diagram.setShowDisabledHandles( !cfg.hideDisabledHandles );

  // Sets a value indicating whether newly created links are set to align their end points to the borders of the nodes they connect.
  this.diagram.setLinksSnapToBorders( cfg.linksSnapToBorders );

  // Sets a value indicating whether anchor points will be shown on screen.
  // 2: auto
  this.diagram.setShowAnchors( cfg.showAnchors );

  // Sets a value indicating when links snap to anchor points.
  // 1: OnCreateOrModify
  this.diagram.setSnapToAnchor( cfg.snapToAnchor );

  // Sets the style that should be assigned to new links.
  // 2: Cascading
  this.diagram.setLinkStyle( cfg.linkStyle );

  // Sets the default orientation of the first segments of cascading links.
  // 2: vertical
  this.diagram.setLinkCascadeOrientation( cfg.linkCascadeOrientation );

  // Sets the default pen that should be assigned to new links.
  var linkPen = this.createPen( cfg.linkPenSize, cfg.linkPenColor );
  this.diagram.setLinkPen( linkPen );

  // Set inplace edit font
  var inplaceFont = this.scriptHelper.createFont( 'Arial', 12 );
  this.view.setInplaceEditFont( inplaceFont );

  // set initial diagram bounds
  // ToDo: check whether whitepaper is even bigger than applet.size
  var db = this.diagram.getBounds();
  var rect = this.scriptHelper.createRectangleF(
    db.getX(),
    db.getY(),
    this.applet.width - cfg.gridSizeX/2,
    this.applet.height - cfg.gridSizeY/2 );
  this.diagram.setBounds( rect );

  // adjust applet size each time the containing window changed its bounds
  $(window).resize( function() {
    if ( ProVis.currentInstance ) {
      ProVis.currentInstance.adjustAppletBounds();
    }
  });

  // event wire up
  window.nodeCreating = this.nodeCreating;
  window.nodeDeleted = this.nodeDeleted;
  window.nodeDoubleClicked = this.nodeDoubleClicked;
  window.nodeModified = this.nodeModified;
  window.nodeModifying = this.nodeModifying;
  window.nodeStartModifying = this.nodeStartModifying;
  window.nodeTextChanged = this.nodeTextChanged;

  ProVis.currentInstance = this;
};

// ToDo: usage of static field might be unsafe!
ProVis.currentInstance = undefined;

