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


  /*****************************************************************************
   * private methods
   ****************************************************************************/

  /**
   * Aligns all swimlanes in a row.
   * Called after a swimlane has been moved, resized or deleted.
   *
   * @return A jQuery promise.
   */
  var alignSwimlanes = function() {
    return alignSwimlanesEx( null );
  };

  /**
   * Aligns all swimlanes in a row while excluding the given node.
   * Directly called when a swimlane is dragged.
   *
   * @param exclude The node to exclude.
   * @return A jQuery promise.
   */
  var alignSwimlanesEx = function( exclude ) {
    var deferred = $.Deferred();

    if ( swimlanes.length == 0 ) {
      deferred.reject();
    } else {
      var x = 0;
      var y = 0;

      // get current composite
      var composite = createOrGetUndoComposite();

      if ( isDebug ) {
        console.log( '@alignSwimlanesEx: current composite: ' + composite.getTitle() );
      }

      foreachArrayItem( swimlanes, function( lane ) {
        if ( lane != exclude ) {
          var cmd = provis.scriptHelper.createChangeItemCmd(
            lane,
            constants.commands.moveSwimlane );
          lane.moveTo( x, y );
          cmd.execute();
          composite.addSubCmd( cmd );
        }

        x += lane.getBounds().getWidth();
      }).done( deferred.resolve ).fail( deferred.reject );
    }

    return deferred.promise();
  };

  var createSwimlaneEx = function( rotation ) {
    var deferred = $.Deferred();

    var offsetX = 0;
    var offsetY = 0;

    getSwimlanesWidth().done( function( width ) { offsetX = width; } );

    var sh = provis.scriptHelper;
    var cc = constants.commands;

    var container = provis.scriptHelper.createSwimlane();
    container.setBounds(
      offsetX,
      offsetY,
      cfg.swimlaneWidth,
      cfg.swimlaneHeight - cfg.captionHeight
    );

    // var container = provis.diagram.getFactory().createContainerNode(
    //   offsetX,
    //   offsetY,
    //   cfg.swimlaneWidth,
    //   cfg.swimlaneHeight - cfg.captionHeight );
    container.setCaptionHeight( cfg.captionHeight );
    container.setMinimumSize( sh.createSizeF( cfg.swimlaneMinWidth, cfg.swimlaneMinHeight + cfg.captionHeight ) );

    container.setFoldable( false );
    container.setVisible( false );

    provis.diagram.add( container );

    // undo commands
    var containerChangeCmd = sh.createChangeItemCmd( container, cc.newNode );

    var fg = provis.createColor( curTheme.captionForeground );
    container.setCaptionColor( fg );
    var font = sh.createFont( 'Arial Bold', curTheme.captionFontSize );
    container.setFont( font );
    container.setCaption( 'Label' + (1 + swimlanes.length) );
    container.setBrush( provis.createSolidBrush( cfg.swimlaneBackBrush ) );

    container.setLocked( false );
    container.setObstacle( false );
    container.setTag( constants.swimlaneTag );
    container.setAllowIncomingLinks( false );
    container.setAllowOutgoingLinks( false );
    container.setEnabledHandles( cfg.swimlaneTopHandles );
    container.setHandlesStyle( cfg.defaultHandleStyle );
    container.zTop();

    var constraints = container.getConstraints();
    constraints.setMoveDirection( 1 );
    constraints.setMinWidth( cfg.swimlaneMinWidth );
    constraints.setMinHeight( cfg.swimlaneMinHeight );

    var lanePen = provis.createPen(
      curTheme.laneBorderWidth,
      curTheme.laneBorderColor );

    container.setPen( lanePen );

    var brush = null;
    if ( curTheme.captionUseGradient ) {
      brush = provis.createGradientBrush(
        curTheme.captionBackground,
        curTheme.captionGradientColor,
        curTheme.captionGradientAngle );
    } else {
      brush = provis.createSolidBrush( curTheme.captionBackground );
    }
    container.setCaptionBrush( brush );

    var captionPen = provis.createPen(
      curTheme.captionBorderWidth,
      curTheme.captionBorderColor );
    container.setCaptionDividerPen( captionPen );

    // keep a reference to this swimlane
    swimlanes.push( container );
    swimlaneHashes.push( container.hashCode() );

    // set visible
    container.setVisible( true );

    // execute undo command
    containerChangeCmd.execute();
    var composite = createOrGetUndoComposite();
    composite.addSubCmd( containerChangeCmd );

    deferred.resolve( container );
    return deferred.promise();
  };

  /**
   * Creates or gets the current undo composite.
   *
   * @param title Required. The title of this composite.
   * @return A jQuery promise.
   */
  var createOrGetUndoComposite = function( title ) {
    if ( !title ) title = 'current';
    return provis.undoManager.startComposite( title, true );
  }

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

    if ( isDebug ) {
      console.log( '@getRandomString: created: ' + string );
    }

    return string;
  };

  /**
   * Gets the sum of widths of all swimlanes.
   *
   * @return The sum of width within a jQuery promise.
   */
  var getSwimlanesWidth = function() {
    var deferred = $.Deferred();

    var width = 0;
    foreachArrayItem( swimlanes, function( container ) {
      width += container.getBounds().getWidth();
    }).done( function() {
      deferred.resolve( width );
    }).fail( function() {
      deferred.reject();
    });

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

    if ( ancestor && ancestor.getTag() == constants.swimlaneTag ) {
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

  var initialize = function( p ) {
    if ( p ) provis = p;

    // enable grid
    provis.diagram.setGridSizeX( cfg.gridSizeX );
    provis.diagram.setGridSizeY( cfg.gridSizeY );
    provis.diagram.setGridStyle( cfg.gridStyle );
    provis.diagram.setShowGrid( cfg.showGrid );
    var gridColor = provis.createColor( cfg.gridColor );
    provis.diagram.setGridColor( gridColor );

    // eye candy. 3px white frame around grid
    var whitePen = provis.createPen( 3, '#fff' );
    provis.diagram.setBoundsPen( whitePen );

    // allow inplace editing of captions and shape titles
    provis.view.setAllowInplaceEdit( cfg.allowInplaceEdit );
    var inplace = provis.view.getInplaceTextArea();
    inplace.setLineWrap( true );
    inplace.setWrapStyleWord( true );
    provis.view.setInplaceEditAcceptOnEnter( true );

    // default behavior (cursor): connect
    provis.view.setBehavior( cfg.defaultBehavior );

    // default handles.
    provis.diagram.setShapeHandlesStyle( cfg.defaultHandleStyle );
    provis.diagram.setAdjustmentHandlesSize( cfg.defaultHandleSize );

    // Sets whether link segments can be added and removed interactively.
    provis.diagram.setAllowSplitLinks( cfg.allowSplitLinks );

    // Sets a value indicating whether users are allowed to
    // attach links to nodes that do not have any anchor points.
    provis.diagram.setAllowUnanchoredLinks( cfg.allowUnanchoredLinks );

    // Sets a value indicating users are allowed to move the end points of
    // a link after the link is created.
    // provis.diagram.setLinkEndsMovable( cfg.linkEndsMovable );

    // Sets whether disabled manipulation handles should be displayed.
    provis.diagram.setShowDisabledHandles( !cfg.hideDisabledHandles );

    // Sets a value indicating whether newly created links are set to
    // align their end points to the borders of the nodes they connect.
    // provis.diagram.setLinksSnapToBorders( cfg.linksSnapToBorders );

    // Sets a value indicating whether anchor points will be shown on screen.
    // 2: auto
    provis.diagram.setShowAnchors( cfg.showAnchors );

    // Sets a value indicating when links snap to anchor points.
    // 1: OnCreateOrModify
    provis.diagram.setSnapToAnchor( cfg.snapToAnchor );

    // Sets the style that should be assigned to new links.
    // 2: Cascading
    provis.diagram.setLinkStyle( cfg.linkStyle );

    // Sets the default orientation of the first segments of cascading links.
    // 2: vertical
    provis.diagram.setLinkCascadeOrientation( cfg.linkCascadeOrientation );

    // Sets the default pen that should be assigned to new links.
    // var linkPen = provis.createPen( cfg.linkPenSize, cfg.linkPenColor );
    // provis.diagram.setLinkPen( linkPen );

    // Set inplace edit font
    var inplaceFont = provis.scriptHelper.createFont( 'Arial', 12 );
    provis.view.setInplaceEditFont( inplaceFont );

    // Enable undo/redo functionality.
    provis.undoManager.setUndoEnabled( true );
    var history = provis.undoManager.getHistory();
    history.setCapacity( cfg.undoCommandHistory );
    history.clear();

    // set initial diagram bounds
    // DIN A4@300ppi: 2480x3508 [px]
    var db = provis.diagram.getBounds();
    var rect = provis.scriptHelper.createRectangleF(
      db.getX(),
      db.getY(),
      cfg.diagramWidth,
      cfg.diagramHeight );
    provis.diagram.setBounds( rect );

    provis.diagram.setDirty( false );
  };

  var linkCreated = function( d, e ) {
    var link = e.getLink();

    var brush = provis.createSolidBrush( curTheme.linkColor );
    link.setBrush( brush );

    var pen = provis.createPen( curTheme.linkWidth, curTheme.linkColor );
    link.setPen( pen );

    try {
      link.setStyle( curTheme.linkStyle );
      link.setTextStyle( curTheme.linkTextStyle );
    } catch ( e ) {
      console.log( e.message );
      console.log( e.stack );
    }

    var font = provis.scriptHelper.createFont( 'Arial', curTheme.captionFontSize );
    link.setFont( font );

    var textColor = provis.createColor( curTheme.linkTextColor );
    link.setTextColor( textColor );
  };

  var nodeClicked = function( d, e ) {
    var node = e.getNode();
    var link = provis.diagram.getLinkAt( e.getMousePosition(), 10, false );
    if ( link ) {
      var selection = provis.diagram.getSelection();
      if ( selection ) selection.clear();
      link.setLocked( false );
      link.setSelected( true );
    }
  };

  /**
   * Event handler which is called each time before a new node is created.
   * Invokes 'ProVis.prototype.applyNodeDefaults'.
   *
   * @param d 'com.mindfusion.diagramming.Diagram'
   * @param e 'com.mindfusion.diagramming.NodeValidationEvent'
   */
  var nodeCreating = function( d, e ) {
    var node = e.getNode();
    var id = $('div.node.node-selected').data( 'shape' );
    var shape = provis.scriptHelper.shapeFromId( id );
    node.setShape( shape );
    if ( id == 'DirectAccessStorage' ) {
      node.setRotationAngle( 90 );
    }

    var theme = curTheme[id];
    if ( !theme ) {
      return;
    }

    provis.applyNodeDefaults( node, theme );
  };

  /**
   * Event handler which is called each time after a node was deleted.
   * Keeps track of swimlanes and adjusts (if needed) the whitepaper bounds.
   *
   * @param d 'com.mindfusion.diagramming.Diagram'
   * @param e 'com.mindfusion.diagramming.NodeEvent'
   */
  var nodeDeleted = function( d, e ) {
    var node = e.getNode();

    if ( node.getTag() == constants.swimlaneTag ) {
      var index = swimlanes.indexOf( node );
      swimlanes.splice( index, 1 );
      swimlaneHashes.splice( index, 1 );

      alignSwimlanes().done( function() {
        provis.view.recreateCacheImage();
      });
    } else {
      // wtf?
      // ToDo. hier muss vermutlich der entsprechende undo command erzeugt
      // und ausgeführt werden.
      // Shape node removed, undo autoresize damage
      // var wp = d.findNode( constants.whitepaperTag );
      // adjustSwimlaneHeight( wp.getBounds().getHeight() );
    }
  };

  var nodeDeleting = function( d, e ) {
    var node = e.getNode();

    switch ( node.getTag() ) {
      // diagram (esp. theme) configuration should not be deleteable.
      case constants.themeConfig:
        e.setCancel( true );
        break;
    }
  }

  /**
   * Event handler which is called each time a swimlane was double clicked.
   * Creates a new node based on the current user selection.
   *
   * @param d 'com.mindfusion.diagramming.Diagram'
   * @param e 'com.mindfusion.diagramming.NodeEvent'
   */
  var nodeDoubleClicked = function( d, e ) {
    var pos = e.getMousePosition();
    var link = provis.diagram.getLinkAt( pos, 10, false );
    if ( link ) {
      provis.view.beginEdit( link );
      return;
    }

    var swimlane = e.getNode();
    if ( swimlane.getTag() != constants.swimlaneTag ) {
      return;
    }

    // Don't create node in header area
    var bounds = swimlane.getBounds();
    if (pos.getY() < bounds.getY() + cfg.captionHeight ) return;

    var factory = d.getFactory();
    var shapeId = $('div.node.node-selected').data( 'shape' );
    var theme = curTheme[shapeId];

    var x = bounds.getX() + bounds.getWidth()/2 - theme.width/2;
    var y = pos.getY() - theme.height/2;

    // create and attach are implicitly added to a composite.
    var composite = createOrGetUndoComposite( constants.commands.newNode );
    var shape = provis.scriptHelper.shapeFromId( shapeId );
    d.setShapeOrientation( shapeId == 'DirectAccessStorage' ? 90 : 0 );
    d.setDefaultShape( shape );

    var node = factory.createShapeNode( x, y, theme.width, theme.height );
    provis.applyNodeDefaults( node, theme );

    swimlane.add( node );
    // double-clicking the swimlane auto-triggered the caption editor. Cancel.
    provis.view.endEdit( false );
    provis.view.beginEdit( node );
    composite.execute();
  };

  /**
   * Event handler which is called after a node has changed.
   * Handles swimlane modifications.
   *
   * @param d 'com.mindfusion.diagramming.Diagram'
   * @param e 'com.mindfusion.diagramming.NodeEvent'
   */
  var nodeModified = function( d, e ) {
    return;
    var node = e.getNode();
    var bounds = node.getBounds();
    var handle = e.getAdjustmentHandle();
    var tag = node.getTag();

    var sh = provis.scriptHelper;
    var cc = constants.commands;
    var undoable = false;
    switch ( handle ) {
      case 5:
        if ( tag == constants.swimlaneTag ) {
          getSwimlanesWidth().done( function( width ) {
            // adjustWhitepaperWidth( width );
          });

          undoable = true;
        }

        break;

      case 6: // adjust whitepaper height
          if ( tag != constants.swimlaneTag ) break;
          // unter verwendung von container ist das falsch hier.!!
          var newHeight = bounds.getHeight() - cfg.captionHeight;
          setSwimlanesHeight( newHeight );
          // adjustWhitepaperHeight( newHeight );
          undoable = true;
          break;

      case 8:
        if ( tag == constants.swimlaneTag ) {
          alignSwimlanes().done( function() {
            undoable = true;
          });
        } else {
          return; // TODO -KRU
          // update parent container (swimlane)
          var b = node.getBounds();
          var pt = provis.scriptHelper.createPointF( b.getX(), b.getY() );
          var parent = provis.getParentNodeAt( pt );
          if ( parent ) {
            node.attachTo( parent, 0 );
            parent.getSubordinateGroup().setAutodeleteItems( true );
          }

          undoable = true;
        }

        break;
    }

    // finalize the existing undo composite.
    // (creating a new composite will return the unfinished composite)
    //
    // word-around:
    // The UndoManager's current ModifyCommand will be executed when this
    // method returns. To be able to add that ModifyCommand to the existing
    // composite, we delay its finalization by 100ms (should be more than enough).
    if ( undoable ) {
      setTimeout( function() {
        // If the current node event was not a move of a swimlane, just
        // finish the undo composite.
        if ( handle != 8 || tag != constants.swimlaneTag ) {
          var composite = createOrGetUndoComposite();
          composite.execute();
          return;
        }

        var history = provis.undoManager.getHistory();
        var undo = history.getNextUndo();
        var title = null;
        if ( undo ) title = undo.getTitle();

        // compare references of swimlanes to their according hashes.
        // a difference between those two arrays indicates a change, for instance
        // deletion or move.

        // different array sizes are the very most obvious indicator for recent changes.
        var haveChanged = swimlanes.length != swimlaneHashes.length;

        // dig deeper :)
        if ( !haveChanged ) {
          for( var i = 0; i < swimlanes.length; i++ ) {
            if( swimlanes[i].hashCode() != swimlaneHashes[i] ) {
              haveChanged = true;
              break;
            }
          }
        }

        // ToDo. wp gibt's nicht mehr.

        // update hashes
        // if ( haveChanged ) {
        //   swimlaneHashes = [];
        //   var wp = provis.diagram.findNode( constants.whitepaperTag );
        //   var wpb = wp.getBounds();
        //   var x = 1 + wpb.getX();
        //   var y = 1 + wpb.getY();

        //   var sh = provis.scriptHelper;
        //   var lastHash = null;
        //   while( true ) {
        //     var node = provis.diagram.getNodeAt( sh.createPoint( x, y ) );
        //     if ( node ) {
        //       var hash = node.hashCode();
        //       if ( hash != lastHash ) {
        //         swimlaneHashes.push( hash );
        //         lastHash = hash;
        //       }

        //       x += cfg.swimlaneMinWidth;
        //     } else break;
        //   }
        // }

        // finalize the undo composite.
        var composite = createOrGetUndoComposite();
        composite.execute();

        // nothing changed, e.g. the user draged the last lane to the (most)
        // right side of the applet area.
        // in this case we need to merge the two most recent undo composites
        // into a new one or, if there's nothing on the stack, just undo it.
        if ( !haveChanged ) {
          if ( !title ) provis.undoManager.undo();
          else history.mergeUndoRecords( 2, title );

          if ( isDebug ) {
            console.log( '@nodeModified: merged two most recent undos due to insignificant changes.' );
          }
        }
      }, 100 );
    }
  };


  /**
   * Event handler which is called while a node is changing.
   * Handles swimlane and whitepaper modifications.
   *
   * @param d 'com.mindfusion.diagramming.Diagram'
   * @param e 'com.mindfusion.diagramming.NodeEvent'
   */
  var nodeModifying = function( d, e ) {
    return;
    var node = e.getNode();
    var bounds = node.getBounds();
    var handle = e.getAdjustmentHandle();
    var tag = node.getTag();

    var sh = provis.scriptHelper;
    var cc = constants.commands;

    switch ( handle ) {
      case 5: // adjust swimlane width
        if ( tag != constants.swimlaneTag ) break;

        var composite = createOrGetUndoComposite();
        var cmd = sh.createChangeItemCmd( node, cc.modifySwimlane );
        cmd.execute();
        composite.addSubCmd( cmd );

        getSuccessiveLanes( node ).done( function( lanes ) {
          var x = bounds.getX() + bounds.getWidth();
          var y = bounds.getY();

          foreachArrayItem( lanes, function( lane ) {
            var laneCmd = null;
            try {
              laneCmd = sh.createChangeItemCmd( lane, cc.modifySwimlane );
            } catch( e ) {
              console.log( e.message );
              console.log( e.stack );
            }

            lane.moveTo( x, y );
            x += lane.getBounds().getWidth();
            if ( laneCmd != null ) {
              laneCmd.execute();
              composite.addSubCmd( laneCmd );
            }
          }).done( function() {
            provis.view.recreateCacheImage();
          });
        });

        break;
      case 6: // adjust whitepaper height
        if ( tag != constants.swimlaneTag ) break;
        var newHeight = bounds.getHeight();
        setSwimlanesHeight( newHeight ).done( function() {
          provis.view.recreateCacheImage();
        });

        break;
      case 8: // move swimlane
        if ( tag != constants.swimlaneTag ) break;

        var curTrigger = bounds.getX();
        var curIndex = swimlanes.indexOf( node );
        var hasLeft = curIndex - 1 >= 0;
        var hasRight = curIndex + 1 <= swimlanes.length - 1;
        var hasChanged = false;

        if ( hasLeft ) {
          var left = swimlanes[curIndex - 1];
          var leftBounds = left.getBounds();
          var trigger = leftBounds.getX() + leftBounds.getWidth() / 2;
          if ( curTrigger < trigger ) {
            swimlanes.move( curIndex, curIndex - 1 );
            hasChanged = true;
          }
        }

        if ( !hasChanged && hasRight ) {
          var right = swimlanes[curIndex + 1];
          var rightBounds = right.getBounds();
          var trigger = rightBounds.getX() + rightBounds.getWidth() / 2;
          curTrigger += bounds.getWidth();
          if ( curTrigger > trigger ) {
            swimlanes.move( curIndex + 1, curIndex );
            hasChanged = true;
          }
        }

        if ( hasChanged ) {
          alignSwimlanesEx( node ).done( function() {
            provis.view.recreateCacheImage();
          });
        }

        break;
    }
  };

  /**
   * Event handler which is called before a node is changed.
   * Starts a new undo composite.
   *
   * @param d 'com.mindfusion.diagramming.Diagram'
   * @param e 'com.mindfusion.diagramming.NodeEvent'
   */
  var nodeStartModifying = function( d, e ) {
    return;
    // ToDo. richtigen titel setzen!!
    // createUndoComposite( constants.commands.modify );
    var title = constants.commands.modify;
    var composite = createOrGetUndoComposite( title );
    var node = e.getNode();

    var cmd = provis.scriptHelper.createChangeItemCmd( node, title );
    cmd.execute();
    composite.addSubCmd( cmd );

    if ( node.getTag() == constants.swimlaneTag ) {
      var laneCmd = provis.scriptHelper.createChangeItemCmd( node, title );
      laneCmd.execute();
      composite.addSubCmd( laneCmd );
      if ( node.getSubordinateGroup() != null ) {
        var nodes = node.getSubordinateGroup().getAttachedNodes();
        for( var i = 0; i < nodes.size(); i++ ) {
          var n = nodes.get( i );
          var nodeCmd = provis.scriptHelper.createChangeItemCmd( n, title );
          nodeCmd.execute();
          composite.addSubCmd( nodeCmd );
        }
      }
    }
  };

  /**
   * Event handler which is called after a node's text has changed.
   * Sets a node's font (size and color) according to its configuration.
   *
   * @param d 'com.mindfusion.diagramming.Diagram'
   * @param e 'com.mindfusion.diagramming.NodeEvent'
   */
  var nodeTextChanged = function( d, e ) {
    var node = e.getNode();
    var tag = node.getTag();
    var font = null;

    var shapeName = node.getShape ? node.getShape().getId() : '';
    var theme = curTheme[shapeName];

    if ( tag == constants.swimlaneTag ) {
      font = provis.scriptHelper.createFont( 'Arial Bold', curTheme.captionFontSize );
      var fg = provis.createColor( curTheme.captionForeground );
      node.setCaptionColor( fg );
    } else {
      var color = provis.createColor( theme.foreground );
      node.setTextColor( color );
      font = provis.scriptHelper.createFont( 'Arial', theme.fontsize );
    }

    node.setFont( font );
  };

  /*
   * Sets the height of each swimlane.
   * Called after the whitepaper's height has changed.
   *
   * @param newHeight The height to which each swimlane shall be resized.
   * @return A jQuery promise.
   */
  var setSwimlanesHeight = function( newHeight ) {
    var deferred = $.Deferred();
    foreachArrayItem( swimlanes, function( lane ) {
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
   * @return A jQuery promise.
   */
  var setSwimlanesWidth = function( newWidth ) {
    var deferred = $.Deferred();

    foreachArrayItem( swimlanes, function( container ) {
      container.resize( newWidth, container.getBounds().getHeight() );
    }).done( function() {
      deferred.resolve();
    }).fail( function() {
      deferred.reject();
    });

    return deferred.promise();
  };


  var updateSwimlaneCounter = function() {
    // ToDo. nach undo/redo müssen die referenzen auf die captions
    // geupdatet werden. (undo: entfernen, redo: hinzufügen)
  }

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
   * Applies configuration values to a newly created node.
   * Called each time a node (either ShapeNode or DiagramNode) was created.
   *
   * @param node The node to be configured.
   * @param theme The configuration values.
   */
  ProVis.prototype.applyNodeDefaults = function( node, theme ) {
    if ( this.anchorPattern == null ) {
      this.anchorPattern = this.scriptHelper.anchorPatternFromId( 'ProVis2In2Out' );
    }

    var brush = null;
    if ( theme.useGradient ) {
      brush = this.createGradientBrush(
        theme.background,
        theme.gradientColor,
        theme.gradientAngle );
    } else {
      brush = this.createSolidBrush( theme.background );
    }

    node.setBrush( brush );
    node.setAnchorPattern( this.anchorPattern );
    node.setEnabledHandles( theme.adjustmentHandles );
    node.setHandlesStyle( theme.handleStyle );

    var textColor = provis.createColor( theme.foreground );
    node.setTextColor( textColor );

    var font = provis.scriptHelper.createFont( 'Arial', theme.fontsize );
    node.setFont( font );

    var borderPen = this.createPen( theme.borderWidth, theme.borderBrush );
    node.setPen( borderPen );

    if ( theme.dropShadow ) {
      var shadowBrush = this.createSolidBrush( theme.shadowColor );
      node.setShadowBrush( shadowBrush );
      node.setShadowOffsetX( theme.shadowOffsetX );
      node.setShadowOffsetY( theme.shadowOffsetY );
    }
  };

  // ToDo: refactor. die hälfte hier von ist identisch zu createSwimlaneEx, ensureWhitepaper, linkCreated...
  ProVis.prototype.applyTheme = function( theme ) {
    var deferred = $.Deferred();

    if ( theme ) {
      curTheme = ProVis.themes[theme];
    }

    var nodes = provis.diagram.getNodes();
    var links = provis.diagram.getLinks();

    for( var i = 0; i < nodes.size(); ++i ) {
      var node = nodes.get( i );
      var tag = node.getTag();
      switch( tag ) {
        case constants.swimlaneTopTag:
/* TODO: nach ContainerNode konvertieren -KRU
          var font = provis.scriptHelper.createFont( 'Arial Bold', curTheme.captionFontSize );
          var fg = provis.createColor( curTheme.captionForeground );
          node.setFont( font );
          node.setTextColor( fg );

          var brush = null;
          if ( curTheme.captionUseGradient ) {
            brush = provis.createGradientBrush(
              curTheme.captionBackground,
              curTheme.captionGradientColor,
              curTheme.captionGradientAngle );
          } else {
            brush = provis.createSolidBrush( curTheme.captionBackground );
          }

          node.setLocked( false );
          node.setObstacle( true );
          node.setAllowIncomingLinks( false );
          node.setAllowOutgoingLinks( false );
          node.setEnabledHandles( cfg.swimlaneTopHandles );
          node.setHandlesStyle( cfg.defaultHandleStyle );
          node.setBrush( brush );
          node.setZIndex( 1 );

          var topConstraints = node.getConstraints();
          topConstraints.setMoveDirection( 1 );
          topConstraints.setMinWidth( cfg.swimlaneMinWidth );

          var captionPen = provis.createPen(
            curTheme.captionBorderWidth,
            curTheme.captionBorderColor );
          node.setPen( captionPen );
*/
          break;
        case constants.swimlaneTag:
          node.setZIndex( 1 );
          node.setLocked( false );
          node.setEnabledHandles( cfg.swimlaneTopHandles );
          node.setHandlesStyle( cfg.defaultHandleStyle );
          node.setBrush( provis.createSolidBrush( cfg.swimlaneBackBrush ) );
          node.setObstacle( false );
          node.setAllowIncomingLinks( false );
          node.setAllowOutgoingLinks( false );

          var nodeConstraints = node.getConstraints();
          nodeConstraints.setMoveDirection( 1 );
          nodeConstraints.setMinWidth( cfg.swimlaneMinWidth );
          nodeConstraints.setMinHeight( cfg. swimlaneMinHeight );

          var lanePen = provis.createPen(
            curTheme.laneBorderWidth,
            curTheme.laneBorderColor );
          node.setPen( lanePen );
          break;
        // case constants.whitepaperTag:
        //   node.setLocked( false );
        //   node.setAllowIncomingLinks( false );
        //   node.setAllowOutgoingLinks( false );
        //   node.setObstacle( false );
        //   node.setTransparent( true );
        //   node.setVisible( true );
        //   node.setEnabledHandles( 64 );
        //   node.setHandlesStyle( 1 );
        //   node.zBottom();
        //   break;
        default:
          var shape = node.getShape().getId();
          switch ( shape ) {
            case 'Start2':
              shape = 'Terminator';
              node.setShape( provis.scriptHelper.shapeFromId( shape ) );
              break;
            case 'Decision2':
              shape = 'Decision';
              node.setShape( provis.scriptHelper.shapeFromId( shape ) );
              break;
          }

          provis.applyNodeDefaults( node, curTheme[shape] );
          break;
      }
    }

    this.diagram.setAllowSplitLinks( true );
    for( var i = 0; i < links.size(); ++i ) {
      var link = links.get( i );
      var brush = provis.createSolidBrush( curTheme.linkColor );
      link.setBrush( brush );

      var pen = provis.createPen( curTheme.linkWidth, curTheme.linkColor );
      link.setPen( pen );
      link.setHeadPen( pen );

      try {
        link.setStyle( curTheme.linkStyle );
        link.setTextStyle( curTheme.linkTextStyle );
      } catch ( e ) {
        if ( isDebug ) {
          console.log( e.message );
          console.log( e.stack );
        }
      }

      var font = provis.scriptHelper.createFont( 'Arial', curTheme.captionFontSize );
      link.setFont( font );

      var textColor = provis.createColor( curTheme.linkTextColor );
      link.setTextColor( textColor );

      link.zTop();
      link.setRetainForm( true );
      link.setAllowMoveStart( true );
      link.setAllowMoveEnd( true );
    }


    // MEY: ToDo. gibt kein wp mehr
    // var wp = this.diagram.findNode( constants.whitepaperTag );
    // var wpb = wp.getBounds();
    // var themeNode = this.diagram.findNode( constants.themeConfig );
    // if ( themeNode == null ) {
    //   var factory = this.diagram.getFactory();
    //   themeNode = factory.createShapeNode( wpb.getX(), wpb.getY(), 1, 1 );
    //   themeNode.setLocked( true );
    //   themeNode.setVisible( false );
    //   themeNode.setTransparent( true ); // the more the merrier ;)
    //   themeNode.setTag( constants.themeConfig );
    //   themeNode.setText( theme || defaultTheme );
    //   themeNode.attachTo( wp, 0 );
    //   themeNode.zBottom();
    // }

    deferred.resolve();
    return deferred.promise();
  }

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
  ProVis.prototype.createSwimlane = function( orientation ) {
    var composite = createOrGetUndoComposite( constants.commands.createSwimlane );
    createSwimlaneEx().done( function() {
      composite.execute();
    });
  };

  /**
   * Gets the swimlane at the provided 'java.awt.geom.Point2D.Float'.
   *
   * @param pt The location to search for a swimlane.
   * @return The swimlane at the provided location or 'null' if no swimlane was found.
   */
  ProVis.prototype.getParentNodeAt = function( pt ) {
    var parents = this.diagram.getNodesAt( pt );
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
    var imageaqm = provis.applet.saveToString(true);
    var imagepng = provis.applet.saveToImage();

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

    $('applet').setHidden().done( function() {
      $.ajax({
        type: 'get',
        dataType: 'text',
        url: url,
        success: function( data ) {
          provis.applet.loadFromString( data );

          var themeNode = provis.diagram.findNode( constants.themeConfig );
          if ( !themeNode || !themeNode.getText() ) {
            provis.applyTheme( defaultTheme ).done( function() {
              $('applet').setVisible();
            });
          } else {
            curTheme = ProVis.themes[themeNode.getText()];
            if ( curTheme == null ) curTheme = ProVis.themes[defaultTheme];
            $('applet').setVisible();
          }

          // ToDo
          // // re-create swimlane and swimlane hashes references.
          // swimlanes = [];
          // swimlaneHashes = [];
          // var wp = provis.diagram.findNode( constants.whitepaperTag );
          // var wpb = wp.getBounds();
          // var x = 1 + wpb.getX();
          // var y = 1 + wpb.getY();

          // var sh = provis.scriptHelper;
          // var lastHash = null;
          // while( true ) {
          //   var node = provis.diagram.getNodeAt( sh.createPoint( x, y ) );
          //   if ( node ) {
          //     var hash = node.hashCode();
          //     if ( hash != lastHash ) {
          //       swimlanes.push( node );
          //       swimlaneHashes.push( node.hashCode() );
          //       lastHash = hash;
          //     }

          //     x += cfg.swimlaneMinWidth;
          //   } else break;
          // }

          initialize();
        },
        error: function() {
          $.unblockUI();
          initialize();
        }
      });
    });
  } else {
    initialize( this );
  }

  // event wire up
  window.linkCreated = linkCreated;
  window.nodeClicked = nodeClicked;
  window.nodeCreating = nodeCreating;
  window.nodeDeleted = nodeDeleted;
  window.nodeDeleting = nodeDeleting;
  window.nodeDoubleClicked = nodeDoubleClicked;
  window.nodeModified = nodeModified;
  window.nodeModifying = nodeModifying;
  window.nodeStartModifying = nodeStartModifying;
  window.nodeTextChanged = nodeTextChanged;
  window.appletStarted = initialize;

  // initialize ProVis UI Controller
  this.ui.init().done( function() {
    setTimeout( function() { $(applet).height( 1 + $(applet).height() ); }, 500 );
    setTimeout( function() { $(applet).width( 1 + $(applet).width() ); }, 500 );
  });
};
