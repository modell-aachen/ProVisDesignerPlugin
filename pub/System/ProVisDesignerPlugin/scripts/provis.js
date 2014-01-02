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
  var nodeTheme = ProVis.nodeDefaults;
  var undoComposite = null;


  /*****************************************************************************
   * private methods
   ****************************************************************************/

   /**
   * Adjusts the applet's width and height according to
   * its parent container element.
   * Called after 'window.resize' has been triggered.
   */
  var adjustAppletBounds = function() {
    var parent = provis.applet.parentElement;
    provis.applet.width = $(parent).width();
    provis.applet.height = $(parent).height();
  };

  /**
   * Adjusts the height of the diagrams whitepaper.
   * Called when a vertical swimlane has changed.
   *
   * @param newHeight The new height of the whitepaper node.
   * @return A jQuery promise containing the ItemChangeCmd.
   */
  var adjustWhitepaperHeight = function( newHeight ) {
    var deferred = $.Deferred();

    var wp = provis.diagram.findNode( constants.whitepaperTag );
    var b = wp.getBounds();

    var sh = provis.scriptHelper;
    var cc = constants.commands;

    var cmd = sh.createChangeItemCmd( wp, cc.adjustWhitepaper );
    var composite = createOrGetUndoComposite();
    wp.setBounds( b.getX(), b.getY(), b.getWidth(), newHeight );
    cmd.execute();
    composite.addSubCmd( cmd );

    deferred.resolve();
    return deferred.promise();
  };

  /**
   * Adjusts the width of the diagrams whitepaper.
   * Called when a horizontal swimlane has changed.
   *
   * @param newWidth The new width of the whitepaper.
   * @return A jQuery promise containing the ItemChangeCmd.
   */
  var adjustWhitepaperWidth = function( newWidth ) {
    var deferred = $.Deferred();

    var wp = provis.diagram.findNode( constants.whitepaperTag );
    var b = wp.getBounds();

    var sh = provis.scriptHelper;
    var cc = constants.commands;

    var composite = createOrGetUndoComposite();
    var cmd = sh.createChangeItemCmd( wp, cc.adjustWhitepaper );
    wp.setBounds( b.getX(), b.getY(), newWidth, b.getHeight() );
    cmd.execute();
    composite.addSubCmd( cmd );

    deferred.resolve();
    return deferred.promise();
  };

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
      var x = cfg.gridSizeX / 2;
      var y = cfg.gridSizeY / 2;

      // get current composite
      var composite = createOrGetUndoComposite();
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

    ensureWhitepaper().done( function() {
      var wp = provis.diagram.findNode( constants.whitepaperTag );
      var wpBounds = wp.getBounds();

      var offsetX = cfg.gridSizeX / 2;
      var offsetY = cfg.gridSizeY / 2;

      var sh = provis.scriptHelper;
      var cc = constants.commands;
      var shape = sh.shapeFromId( 'Rectangle' );

      // a swimlane consists of 2 separate nodes: caption + lane
      var caption = sh.createShapeNode( shape );
      caption.setVisible( false );
      provis.diagram.add( caption );

      var lane = sh.createShapeNode( shape );
      lane.setVisible( false );
      provis.diagram.add( lane );

      var titleBounds = sh.createRectangleF(
        offsetX + wpBounds.getWidth(),
        offsetY,
        cfg.swimlaneWidth,
        cfg.captionHeight );

      var laneBounds = sh.createRectangleF(
        offsetX + wpBounds.getWidth(),
        offsetY + cfg.captionHeight,
        cfg.swimlaneWidth,
        wpBounds.getHeight() - cfg.captionHeight );

      // create group of nodes
      lane.attachTo( caption, 0 );
      caption.getSubordinateGroup().setAutodeleteItems( true );

      // undo commands
      var captionChangeCmd = sh.createChangeItemCmd( caption, cc.newNode );
      var laneChangeCmd = sh.createChangeItemCmd( lane, cc.newNode );

      caption.setBounds( titleBounds );
      lane.setBounds( laneBounds );

      var font = sh.createFont( 'Arial Bold', cfg.captionFontSize );
      var brush = null;
      if ( cfg.captionUseGradient ) {
        brush = provis.createGradientBrush(
          cfg.captionBackground,
          cfg.captionGradientColor,
          cfg.captionGradientAngle );
      } else {
        brush = provis.createSolidBrush( cfg.captionBackground );
      }

      caption.setFont( font );
      caption.setBrush( brush );
      caption.setLocked( false );
      caption.setObstacle( true );
      caption.setText( 'ToDo: i18n' );
      caption.setTag( constants.swimlaneTopTag );
      caption.setAllowIncomingLinks( false );
      caption.setAllowOutgoingLinks( false );
      caption.setEnabledHandles( cfg.swimlaneTopHandles );
      caption.setHandlesStyle( cfg.defaultHandleStyle );
      caption.setZIndex( 1 );

      var titleConstraints = caption.getConstraints();
      titleConstraints.setMoveDirection( 1 );
      titleConstraints.setMinWidth( cfg.swimlaneMinWidth );

      lane.setZIndex(1);
      lane.setLocked( true );
      lane.setEnabledHandles( cfg.swimlaneHandles );
      lane.setHandlesStyle( cfg.defaultHandleStyle );
      lane.setBrush( provis.createSolidBrush( cfg.swimlaneBackBrush ) );
      lane.setObstacle( false );
      lane.setTag( constants.swimlaneTag );
      lane.setAllowIncomingLinks( false );
      lane.setAllowOutgoingLinks( false );

      var laneConstraints = lane.getConstraints();
      laneConstraints.setMoveDirection( 1 );

      // keep a reference to this swimlane
      swimlanes.push( caption );
      swimlaneHashes.push( caption.hashCode() );

      // set visible
      caption.setVisible( true );
      lane.setVisible( true );

      // resize whitepaper
      var newWidth = wpBounds.getWidth() + cfg.swimlaneWidth;
      adjustWhitepaperWidth( newWidth ).done( function() {
        // add all (programmatically) made changes to the composite
        captionChangeCmd.execute();
        laneChangeCmd.execute();

        var composite = createOrGetUndoComposite();
        composite.addSubCmd( captionChangeCmd );
        composite.addSubCmd( laneChangeCmd );

        deferred.resolve();
      });
    });

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
   * A method checking for the presence of a whitepaper node.
   * Called each time before a new swimlane is added to the diagram.
   *
   * @return A jQuery promise.
   */
  var ensureWhitepaper = function() {
    var deferred = $.Deferred();

    var wp = provis.diagram.findNode( constants.whitepaperTag );
    if ( wp != null ) {
      deferred.resolve();
      return deferred.promise();
    }

    // Reachable only if there's no whitepaper present
    var factory = provis.diagram.getFactory();
    var offsetX = cfg.gridSizeX / 2;
    var offsetY = cfg.gridSizeY / 2;

    whitepaper = factory.createShapeNode(
      offsetX,
      offsetY,
      0,
      cfg.captionHeight + cfg.swimlaneHeight );

    // var addCmd = provis.scriptHelper.createAddItemCmd
    var changeCmd = provis.scriptHelper.createChangeItemCmd(
      whitepaper,
      constants.commands.createWhitepaper );

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

    // add ItemChangeCommand to UndoComposite
    changeCmd.execute();

    var composite = createOrGetUndoComposite();
    composite.addSubCmd( changeCmd );

    deferred.resolve();
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

  /**
   * Gets the sum of widths of all swimlanes.
   *
   * @return The sum of width within a jQuery promise.
   */
  var getSwimlanesWidth = function() {
    var deferred = $.Deferred();

    var width = 0;
    foreachArrayItem( swimlanes, function( caption ) {
      width += caption.getBounds().getWidth();
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

  /**
   * Event handler which is called each time before a new node is created.
   * Invokes 'ProVis.prototype.applyNodeDefaults'.
   *
   * @param d 'com.mindfusion.diagramming.Diagram'
   * @param e 'com.mindfusion.diagramming.NodeValidationEvent'
   */
  var nodeCreating = function( d, e ) {
    var node = e.getNode();
    var id = node.getShape().getId();
    var theme = nodeTheme[id];
    if ( !theme ) return;

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
    if ( node.getTag() == constants.swimlaneTopTag ) {
      var wp = d.findNode( constants.whitepaperTag );
      var wpWidth = wp.getBounds().getWidth();
      var newWidth = wpWidth - node.getBounds().getWidth();
      adjustWhitepaperWidth( newWidth );

      var index = swimlanes.indexOf( node );
      swimlanes.splice( index, 1 );
      swimlaneHashes.splice( index, 1 );
      alignSwimlanes().done( function() {
        provis.view.recreateCacheImage();
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
  var nodeDoubleClicked = function( d, e ) {
    var swimlane = e.getNode();
    if ( swimlane.getTag() != constants.swimlaneTag ) return;

    var bounds = swimlane.getBounds();
    var pos = e.getMousePosition();
    var factory = d.getFactory();
    var shapeId = $('div.node.node-selected').data( 'shape' );
    var theme = nodeTheme[shapeId];

    var x = bounds.getX() + bounds.getWidth()/2 - theme.width/2;
    var y = pos.getY() - theme.height/2;

    // create and attach are implicitly added to a composite.
    var composite = createOrGetUndoComposite( constants.commands.newNode );
    var shape = provis.scriptHelper.shapeFromId( shapeId );
    d.setShapeOrientation( shapeId == 'DirectAccessStorage' ? 180 : 0 );
    d.setDefaultShape( shape );

    var node = factory.createShapeNode( x, y, theme.width, theme.height );
    provis.applyNodeDefaults( node, theme );

    node.attachTo( swimlane, 0 );
    swimlane.getSubordinateGroup().setAutodeleteItems( true );
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
    var node = e.getNode();
    var bounds = node.getBounds();
    var handle = e.getAdjustmentHandle();
    var tag = node.getTag();

    var sh = provis.scriptHelper;
    var cc = constants.commands;
    /*
     *   HandleStyles:
     *
     *   0***4***1
     *   *       *
     *   7   8   5
     *   *       *
     *   3***6***2
     */

    var undoable = false;
    switch ( handle ) {
      case 5:
        if ( tag == constants.swimlaneTopTag ) {
          getSwimlanesWidth().done( function( width ) {
            adjustWhitepaperWidth( width );
          });

          undoable = true;;
        }

        break;
      case 6: // adjust whitepaper height
          if ( tag != constants.whitepaperTag ) break;
          var newHeight = bounds.getHeight() - cfg.captionHeight;
          setSwimlanesHeight( newHeight );
          undoable = true;
          break;

      case 8:
        if ( tag == constants.swimlaneTopTag ) {
          alignSwimlanes().done( function() {
            undoable = true;
          });
        } else {
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
        if ( handle != 8 || tag != constants.swimlaneTopTag ) {
          createOrGetUndoComposite().execute();
          return;
        }

        var history = provis.undoManager.getHistory();
        var undo = history.getNextUndo();
        var title = null;
        if ( undo ) title = undo.getTitle();

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

        // update hashes
        if ( haveChanged ) {
          swimlaneHashes = [];
          var wp = provis.diagram.findNode( constants.whitepaperTag );
          var wpb = wp.getBounds();
          var x = 1 + wpb.getX();
          var y = 1 + wpb.getY();

          var sh = provis.scriptHelper;
          var lastHash = null;
          while( true ) {
            var node = provis.diagram.getNodeAt( sh.createPoint( x, y ) );
            if ( node ) {
              var hash = node.hashCode();
              if ( hash != lastHash ) {
                swimlaneHashes.push( hash );
                lastHash = hash;
              }

              x += cfg.swimlaneMinWidth;
            } else break;
          }
        }

        // finalize the undo composite.
        createOrGetUndoComposite().execute();

        // nothing changed, e.g. the user draged the last lane to the (most)
        // right side of the applet area.
        // in this case we need to merge the two most recent undo composites
        // into a new one or, if there's nothing on the stack, just undo it.
        if ( !haveChanged ) {
          if ( !title ) provis.undoManager.undo();
          else history.mergeUndoRecords( 2, title );
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
    var node = e.getNode();
    var bounds = node.getBounds();
    var handle = e.getAdjustmentHandle();
    var tag = node.getTag();

    var sh = provis.scriptHelper;
    var cc = constants.commands;

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
      case 5: // adjust swimlane width
        if ( tag != constants.swimlaneTopTag ) break;

        var group = node.getSubordinateGroup();
        var body = group.getAttachedNodes().get( 0 );

        var composite = createOrGetUndoComposite();
        var cmd = sh.createChangeItemCmd( body, cc.modifySwimlane );
        body.resize( bounds.getWidth(), body.getBounds().getHeight() );
        cmd.execute();
        composite.addSubCmd( cmd );

        getSuccessiveLanes( node ).done( function( lanes ) {
          var x = bounds.getX() + bounds.getWidth();
          var y = bounds.getY();

          foreachArrayItem( lanes, function( lane ) {
            var laneCmd = sh.createChangeItemCmd( lane, cc.modifySwimlane );
            lane.moveTo( x, y );
            laneCmd.execute();
            composite.addSubCmd( laneCmd );
            x += lane.getBounds().getWidth();
          }).done( function() {
            provis.view.recreateCacheImage();
          });
        });

        break;
      case 6: // adjust whitepaper height
        if ( tag != constants.whitepaperTag ) break;
        var newHeight = bounds.getHeight() - cfg.captionHeight;
        setSwimlanesHeight( newHeight ).done( function() {
          provis.view.recreateCacheImage();
        });

        break;
      case 8: // move swimlane
        if ( tag != constants.swimlaneTopTag ) break;

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
    // ToDo. richtigen titel setzen!!
    // createUndoComposite( constants.commands.modify );
    var title = constants.commands.modify;
    var composite = createOrGetUndoComposite( title );
    var node = e.getNode();

    var cmd = provis.scriptHelper.createChangeItemCmd( node, title );
    cmd.execute();
    composite.addSubCmd( cmd );

    if ( node.getTag() == constants.swimlaneTopTag ) {
      var lane = node.getSubordinateGroup().getAttachedNodes().get( 0 );
      var laneCmd = provis.scriptHelper.createChangeItemCmd( lane, title );
      laneCmd.execute();
      composite.addSubCmd( laneCmd );
      if ( lane.getSubordinateGroup() != null ) {
        var nodes = lane.getSubordinateGroup().getAttachedNodes();
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

    if ( tag == constants.swimlaneTopTag ) {
      font = provis.scriptHelper.createFont( 'Arial Bold', cfg.captionFontSize );
    } else {
      var shapeName = node.getShape().getId();
      var theme = nodeTheme[shapeName];

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

    var composite = createOrGetUndoComposite();
    foreachArrayItem( swimlanes, function( caption ) {
      var lane = caption.getSubordinateGroup().getAttachedNodes().get( 0 );
      var cmd = provis.scriptHelper.createChangeItemCmd(
        lane,
        constants.commands.modifySwimlane );
      lane.resize( lane.getBounds().getWidth(), newHeight );
      cmd.execute();
      composite.addSubCmd( cmd );
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
      this.anchorPattern = this.scriptHelper.anchorPatternFromId( 'Decision2In2Out' );
      var points = this.anchorPattern.getPoints();
      for( var i = 0; i < points.size(); i++ ) {
        var pt = points.get( i );
        pt.setMarkStyle( 3 );
        pt.setColor(
          this.createColor(
            i < 2 ? cfg.anchorInColor : cfg.anchorOutColor ) );
      }
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

    var borderPen = this.createPen( theme.borderWidth, theme.borderBrush );
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
    // if ( $stats.saving ) return;
    // $stats.saving = true;
    // var provis = document.provis;

    // // Resize grid to minimum required size (margin: 5px)
    // var bounds = provis.diagram.getBounds();
    // provis.diagram.resizeToFitItems( 5 );

    // // Disable grid
    // $(this).toggleGridVisibility( provis, true );

    // var imagemap = provis.applet.saveToMap('%MAPNAME%');
    // var imageaqm = provis.applet.saveToString(true);
    // var imagepng = provis.applet.saveToImage();

    // // var url = drawingSaveUrl;

    // var url = '/bin/rest/ProVisPlugin/upload';
    // var drawingSaveUrl = '/bin/rest/ProVisPlugin/upload';
    // var drawingTopic = 'Main.WebHome';
    // var drawingName = 'xcvxcv12';
    // // var drawingName = 'yxc2';
    // var drawingType = 'swimlane';

    // $stats.saving = false;

    // var form = [];
    // form.push( 'Content-Disposition: form-data; name="topic"\r\n\r\n'
    //   + drawingTopic );
    // form.push( 'Content-Disposition: form-data; name="drawing"\r\n\r\n'
    //   + drawingName );
    // form.push( 'Content-Disposition: form-data; name="aqm"\r\n\r\n'
    //   + imageaqm );
    // form.push( 'Content-Disposition: form-data; name="png"\r\n\r\n'
    //   + imagepng );
    // form.push( 'Content-Disposition: form-data; name="map"\r\n\r\n'
    //   + imagemap );

    // // Generate boundaries
    // var sep;
    // var request = form.join('\n');
    // do {
    //   sep = Math.floor( Math.random() * 1000000000 );
    // } while ( request.indexOf( sep ) != -1 );

    // request = "--" + sep + "\r\n" +
    //   form.join( '\r\n--' + sep + "\r\n" ) +
    //   "\r\n--" + sep + "--\r\n";

    // $.ajax({
    //   type: 'post',
    //   url: url,
    //   data: request,
    //   // dataType: 'json',
    //   contentType: 'multipart/form-data; boundary=' + sep,
    //   error: function( xhr, status, error ) {
    //     console.log( 'error' );
    //     // ToDo
    //   },
    //   success: function( data, status, xhr ) {
    //     console.log( 'success' );
    //     // ToDo
    //   },
    //   complete: function() {
    //     provis.diagram.setBounds( bounds );
    //     $(this).toggleGridVisibility( provis );
    //     $stats.saving = false;
    //   }
    // });
  };

  /**
   * Sets a value indicating how the control should respond to users actions.
   *
   * @param behavior One of the 'com.mindfusion.diagramming.Behavior' constants.
   */
  ProVis.prototype.setBehavior = function( behavior ) {
    this.view.setBehavior( behavior );
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

  // Sets a value indicating whether users are allowed to
  // attach links to nodes that do not have any anchor points.
  this.diagram.setAllowUnanchoredLinks( cfg.allowUnanchoredLinks );

  // Sets a value indicating users are allowed to move the end points of
  // a link after the link is created.
  this.diagram.setLinkEndsMovable( cfg.linkEndsMovable );

  // Sets whether disabled manipulation handles should be displayed.
  this.diagram.setShowDisabledHandles( !cfg.hideDisabledHandles );

  // Sets a value indicating whether newly created links are set to
  // align their end points to the borders of the nodes they connect.
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

  // Enable undo/redo functionality.
  this.undoManager.setUndoEnabled( true );
  var history = this.undoManager.getHistory();
  history.setCapacity( cfg.undoCommandHistory );
  history.clear();

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
  $(window).resize( this.adjustAppletBounds );

  // event wire up
  window.nodeCreating = nodeCreating;
  window.nodeDeleted = nodeDeleted;
  window.nodeDoubleClicked = nodeDoubleClicked;
  window.nodeModified = nodeModified;
  window.nodeModifying = nodeModifying;
  window.nodeStartModifying = nodeStartModifying;
  window.nodeTextChanged = nodeTextChanged;

  // initialize ProVis UI Controller
  this.ui.init();
};
