/*
 * ProVis applet controller
 * Copyright (C) 2013 Modell Aachen GmbH. All rights reserved.
 */

(function($) {
  var $keyboard = {
    isCtrl: false,
    isShift: false,
    isAlt: false
  };

  // 3508x2480 =  DIN A4 @ 300dpi, landscape
  // see http://www.din-formate.de/reihe-a-din-groessen-mm-pixel-dpi.html
  var $config = {
    gridWidth: 3508,
    gridHeight: 2480,
    gridSizeX: 15,
    gridSizeY: 15,
    gridColor: '#eee',
    gridStyle: 1,
    defaultShapeBrush: '#6494c8',
    defaultCaptionBrush: '#777',
    defaultShapeTextColor: '#fff',
    defaultCaptionTextColor: '#fff',
    defaultHandleStyle: 5,
    swimlaneHandles: 0,
    swimlaneTopHandles: 32 + 128 + 256,
    swimlaneBackBrush: '#fff',
    swimlaneWidth: 150,
    swimlaneHeight: 500,
    undoCommandHistory: 25,
    zoomStep: 25,
    captionHeight: 40
  };

  var $constants = {
    swimlaneTopTag: 'Swimlane_top',
    swimlaneTag: 'Swimlane',
    whitepaperTag: 'whitepaper',
    adjustSwimlaneCommand: 'adjustSwimlaneWidth',
    adjustWhitepaperCommand: 'adjustWhitepaperHeight',
    modifyCommand: 'Modify'
  };

  var $anchorPattern = null;

  var $undoComposition = null;

  var $mouseX;

  var $stats = {
    lanes: [],
    saving: false,
    modifying: false
  };

  $.fn.extend( {
    adjustAppletSize: function() {
      var area = $('div.provis-apparea');
      var cssToInt = function( selector ) {
        return parseInt( area.css(selector).replace( 'px', '' ) );
      }

      var padLeft = cssToInt( 'padding-left' );
      var padRight = cssToInt( 'padding-right' );
      var padTop = cssToInt( 'padding-top' );
      var padBottom = cssToInt( 'padding-bottom' );
      var posTop = cssToInt( 'top' );
      var left = cssToInt( 'left' );

      var width = $(this).width() - left - (padLeft + padRight);
      var height = $(this).height() - (padTop + padBottom + posTop);

      var applet = $('#jDiagApplet');
      applet.width( width );
      applet.height( height );
    },

    // foobar inc.
    // due to compatibility reasons we have to adjust the drawing area
    // by one half of the grid size
    adjustDrawingArea: function( diagram, offsetX, offsetY ) {
      return;
      var whitepaper = diagram.findNode( $constants.whitepaperTag );
      var wb = whitepaper.getBounds();
      whitepaper.setBounds( offsetX + wb.getX(), offsetY + wb.getY(), wb.getWidth(), wb.getHeight() );

      var nodes = diagram.getNodes();
      $(this).foreach( nodes, function( node) {
        var tag = node.getTag();
        if ( /Swimlane/.test( tag ) ) {
          var nb = node.getBounds();
          var ox = 0, oy = offsetY + nb.getY();;
          if ( tag == $constants.swimlaneTopTag ) ox = offsetX + nb.getX();
          if ( tag == $constants.swimlaneTag ) ox = nb.getX();
          node.setBounds( ox, oy, nb.getWidth(), nb.getHeight() );
        }
      });
    },

    adjustSwimlaneWidth: function( diagram, node ) {
      var d = $.Deferred();

      var swimlane = $(this).getSwimlane( node );
      var laneBounds = swimlane.getBounds();
      var nodeBounds = node.getBounds();

      swimlane.setBounds( laneBounds.getX(), laneBounds.getY(), nodeBounds.getWidth(), laneBounds.getHeight() );

      var width = 0;
      var offsetX = $config.gridSizeX / 2;
      var nodes = diagram.getNodes();
      $(this).foreach( nodes, function( node ) {
        if ( node.getTag() == $constants.swimlaneTopTag ) {
          var bounds = node.getBounds();
          if ( bounds.getX() != width + offsetX ) {
            var x = offsetX + width;
            var y = bounds.getY();
            node.moveTo( x, y );
          }

          width += bounds.getWidth();
        }
      });

      d.resolve( diagram, width );
      return d;
    },

    adjustWhitepaper: function( diagram, width ) {
      var d = $.Deferred();
      var whitepaper = diagram.findNode( $constants.whitepaperTag );
      var b = whitepaper.getBounds();
      whitepaper.setBounds( b.getX(), b.getY(), width, b.getHeight() );
      d.resolve( width );
      return d;
    },

    applyAnchorPattern: function( node ) {
      if ( $anchorPattern == null ) {
        var helper = document.provis.scriptHelper;
        $anchorPattern = helper.anchorPatternFromId( 'Decision2In2Out' );
        var points = $anchorPattern.getPoints();
        for( var i = 0; i < points.size(); i++ ) {
          var pt = points.get( i );
          pt.setMarkStyle( 3 );
        }
      }

      node.setAnchorPattern( $anchorPattern );
    },

    applyDefaultStyles: function( provis ) {
      var laneBrush = $(this).createSolidBrush( $config.swimlaneBackBrush );
      var shapeBrush = $(this).createSolidBrush( $config.defaultShapeBrush );
      var captionBrush = $(this).createSolidBrush( $config.defaultCaptionBrush );
      var shapeTextColor = $(this).createColor( $config.defaultShapeTextColor );
      var captionTextColor = $(this).createColor( $config.defaultCaptionTextColor );

      var nodes = provis.diagram.getNodes();
      $(this).foreach( nodes, function( node ) {
        var shape = node.getShape();
        var shapeId = shape.getId();
        var tag = node.getTag();

        node.setHandlesStyle( $config.defaultHandleStyle );

        // not swimlane
        if ( tag == null ) {
          node.setBrush( shapeBrush );
          node.setTextColor( shapeTextColor );
          $(this).applyAnchorPattern( node );
        }

        if ( /Swimlane/.test( tag ) ) {
          if ( tag == $constants.swimlaneTopTag ) {
            // $stats.lanes++;
            $stats.lanes.push( node );
            node.setLocked( false );
            node.setEnabledHandles( $config.swimlaneTopHandles );
            node.setBrush( captionBrush );

            var text = '<b>' + node.getText() + '</b>';
            node.setEnableStyledText( true );
            node.setTextColor( captionTextColor );
            node.setText( text );
          }

          if ( tag == $constants.swimlaneTag ) {
            node.setLocked( true );
            node.setEnabledHandles( $config.swimlaneHandles );
            node.setBrush( laneBrush );
          }
        }
      });
    },

    createSwimlane: function( provis ) {
      var composition = provis.undoManager.startComposite( 'newSwimlane', true );

      $(this).ensureWhitepaper( provis );
      var wp = provis.diagram.findNode( $constants.whitepaperTag );
      var wpb = wp.getBounds();

      var offsetX = $config.gridSizeX / 2;
      var offsetY = $config.gridSizeY / 2;

      var factory = provis.diagram.getFactory();
      var titleNode = factory.createShapeNode( offsetX + wpb.getWidth(), offsetY, $config.swimlaneWidth, $config.captionHeight );

      titleNode.setLocked( false );
      // ToDo: lanefont + lanepen (siehe applyDefaultStyle)
      // titleNode.setFont( lanefont );
      // titleNode.setPen( lanepen );
      titleNode.setBrush( $(this).createSolidBrush( $config.defaultCaptionBrush ) );
      titleNode.setObstacle( true );
      titleNode.setText( "Label" + ($stats.lanes.length + 1) ); // ToDo!!
      titleNode.setTag( $constants.swimlaneTopTag );
      titleNode.setAllowIncomingLinks( false );
      titleNode.setAllowOutgoingLinks( false );

      titleNode.setEnabledHandles( $config.swimlaneTopHandles );
      titleNode.setHandlesStyle( $config.defaultHandleStyle );

      var titleConstraints = titleNode.getConstraints();
      titleConstraints.setMoveDirection( 1 );

      // Add to lanes array
      $stats.lanes.push( titleNode );

      // // Content
      var laneNode = factory.createShapeNode( offsetX + wpb.getWidth(), offsetY + $config.captionHeight, $config.swimlaneWidth, wpb.getHeight() - $config.captionHeight );
      // laneNode.setPen(lanepen);
      laneNode.setZIndex(1);

      laneNode.setLocked( true );
      laneNode.setEnabledHandles( $config.swimlaneHandles );
      laneNode.setHandlesStyle( $config.defaultHandleStyle );

      var laneConstraints = laneNode.getConstraints();
      laneConstraints.setMoveDirection( 1 );
      laneNode.setBrush( $(this).createSolidBrush( $config.swimlaneBackBrush ) );
      laneNode.setObstacle( false );
      laneNode.setTag( $constants.swimlaneTag );
      laneNode.attachTo( titleNode, 0 );
      laneNode.setAllowIncomingLinks( false );
      laneNode.setAllowOutgoingLinks( false );
      titleNode.getSubordinateGroup().setAutodeleteItems( true );
      titleNode.setZIndex( 2 );

      var newWidth = wpb.getWidth() + $config.swimlaneWidth;
      $(this).adjustWhitepaper( provis.diagram, newWidth );
      composition.execute();
    },

    createColor: function( hexColor ) {
      var c = $(this).getRGBColor( hexColor );
      return document.provis.scriptHelper.createColor( c.r, c.g, c.b );
    },

    createNode: function( provis, id ) {
      var shape = provis.scriptHelper.shapeFromId( id );
    },

    createPen: function( width, hexColor ) {
      var c = $(this).getRGBColor( hexColor );
      return document.provis.scriptHelper.createPen( width, c.r, c.g, c.b );
    },

    createSolidBrush: function( hexColor ) {
      var c = $(this).getRGBColor( hexColor );
      return document.provis.scriptHelper.createSolidBrush( c.r, c.g, c.b );
    },

    // called when the user tries to add a new swimlane
    ensureWhitepaper: function( provis ) {
      var wp = provis.diagram.findNode( $constants.whitepaperTag );
      if ( wp != null ) return;
      var factory = provis.diagram.getFactory();

      // there's no whitepaper present -> create it
      var offsetX = $config.gridSizeX / 2;
      var offsetY = $config.gridSizeY / 2;

      whitepaper = factory.createShapeNode( offsetX, offsetY, 0, $config.captionHeight + $config.swimlaneHeight );
      whitepaper.setTag( $constants.whitepaperTag );
      whitepaper.setLocked( false );
      whitepaper.setAllowIncomingLinks( false );
      whitepaper.setAllowOutgoingLinks( false );
      whitepaper.setObstacle( false );
      whitepaper.setTransparent( true );
      whitepaper.setVisible( true );
      whitepaper.setZIndex( 0 );

      // whitepaper.setEnabledHandles( 32);
      whitepaper.setEnabledHandles( 64 );
      whitepaper.setHandlesStyle( $config.defaultHandleStyle );
    },

    foreach: function( jlist, callback ) {
      var d = $.Deferred();
      for( var i = 0; i < jlist.size(); i++ )
        callback( jlist.get( i ) );

      d.resolve();
      return d;
    },

    // Taken from:
    // http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
    getRGBColor: function( hex ) {
      // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
      var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
      hex = hex.replace(shorthandRegex, function(m, r, g, b) {
          return r + r + g + g + b + b;
      });

      var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
      } : null;
    },

    getSwimlane: function( swimlaneTop ) {
      var group = swimlaneTop.getSubordinateGroup();
      var nodes = group.getAttachedNodes();
      return nodes.get( 0 );
    },

    onCancel: function( provis ) {
      var d = provis.diagram;
      if ( d.getDirty() ) {

      }

      window.close();
    },

    onKeyDown: function( view, keyEvent ) {
      var code = keyEvent.getKeyCode();
      // console.log( code );
      if ( $keyboard.isAlt ) {
        switch( code ) {
          case 49: // 1
            $('div.node[data-shape=Rectangle]').click();
            break;
          case 50: // 2
            $('div.node[data-shape=Decision2]').click();
            break;
          case 51: // 3
            $('div.node[data-shape=Document]').click();
            break;
          case 52: // 4
            $('div.node[data-shape=Cylinder]').click();
            break;
          case 53: // 5
            $('div.node[data-shape=Terminator]').click();
            break;
          case 54: // 6
            $('div.node[data-shape=Ellipse]').click();
            break;
        }
      }

      if ( $keyboard.isCtrl ) {
        switch( code ) {
          case 45: // -
            $(this).zoomOut( document.provis );
            break;
          case 48: // 0
            $(this).zoomReset( document.provis );
            break;
          // ToDo: java.policy
          // case 67: // c
          //   if ( !view.copyToClipboard( true ) ) {
          //     // ToDo: raise error!
          //   }
          //   break;
          // case 86: // v
          //   if ( !view.pasteFromClipboard( 0, 0 ) ) {
          //     // ToDo: raise error!
          //   }
          //   break;
          // case 88: // x
          //   if ( !view.cutToClipboard( true ) ) {
          //     // ToDo: raise error!
          //   }
          //   break;
          case 65: // A
            var nodes = view.getDiagram().getNodes();
            var links = view.getDiagram().getLinks();
            $(this).foreach( nodes, function( n ) { n.setSelected( true ); } );
            $(this).foreach( links, function( l ) { l.setSelected( true ); } );
            break;
          case 521: // +
            $(this).zoomIn( document.provis );
            break;
        }
      } else {
        switch( code ) {
          case 16:
            $keyboard.isShift = true;
            break;
          case 17:
            $keyboard.isCtrl = true;
            break;
          case 18:
            $keyboard.isAlt = true;
            setTimeout( function() {
              if ( $keyboard.isAlt ) {
                $('.hint').show( 'slow' );
              }
            }, 250 );
            break;
        }
      }
    },

    onKeyUp: function( view, keyEvent ) {
      var code = keyEvent.getKeyCode();
      switch( code ) {
        case 16:
          $keyboard.isShift = false;
          break;
        case 17:
          $keyboard.isCtrl = false;
          break;
        case 18:
          $keyboard.isAlt = false;
          $('.hint').hide( 'slow' );
          break;
      }
    },

    onNodeClicked: function( diagram, nodeEvent ) {
      var node = nodeEvent.getNode();
    },

    onNodeCreated: function( diagram, nodeEvent ) {
      var node = nodeEvent.getNode();
      $(this).applyAnchorPattern( node );
    },

    onNodeDeleted: function( diagram, nodeEvent ) {
      var node = nodeEvent.getNode();
      var pattern = new RegExp( $constants.swimlaneTopTag, 'g' );
      if ( pattern.test( node.getTag() ) ) {
        // $stats.lanes--;
        var index = $stats.lanes.indexOf( node );
        $stats.lanes.splice( index, 1 );
      }
    },

    onNodeDeleting: function() {},

    onNodeModified: function( diagram, nodeEvent ) {
      var node = nodeEvent.getNode();
      var handle = nodeEvent.getAdjustmentHandle();
      if ( handle == 8 && node.getTag() == $constants.swimlaneTopTag ) {
        var offsetX = $config.gridSizeX / 2;
        for( var i = 0; i < $stats.lanes.length; i++ ) {
          var lane = $stats.lanes[i];
          var laneB = lane.getBounds();
          lane.moveTo( offsetX, laneB.getY() );
          offsetX += laneB.getWidth();
        }
      }

      // Adjust the height of all swimlanes according to the whitepaper bounds
      if ( node.getTag() == $constants.whitepaperTag ) {
        var undoManager = diagram.getUndoManager();
        var bounds = node.getBounds();
        $undoComposition = undoManager.startComposite( $constants.adjustWhitepaperCommand, true );
        var nodes = diagram.getNodes();
        $(this).foreach( nodes, function( item ) {
          if ( item.getTag() == $constants.swimlaneTopTag ) {
            var swimlane = $(this).getSwimlane( item );
            var b = swimlane.getBounds();
            swimlane.setBounds( b.getX(), b.getY(), b.getWidth(), bounds.getHeight() - $config.captionHeight );
          }
        });
      }

      // In case there's an unfinished (undo) composition -> execute/finish it.
      if ( $undoComposition != null ) {
        $undoComposition.execute();
        $undoComposition = null;
      }
    },

    onNodeModifying: function( diagram, nodeValidationEvent ) {
      // for( var i = 0; i < $stats.lanes.length; i++ ) {
      //   var c = $stats.lanes[i];
      // }

      var undoManager = diagram.getUndoManager();
      var node = nodeValidationEvent.getNode();
      var bounds = node.getBounds();

      if ( node.getTag() == $constants.swimlaneTopTag ) {
        var handle = nodeValidationEvent.getAdjustmentHandle();

        // move:
        if ( handle == 8 ) {
          var nodeX = bounds.getX();
          var nodeW = bounds.getWidth();
          var nodeIndex = $stats.lanes.indexOf( node );

          var mouseX = nodeValidationEvent.getMousePosition().getX();
          if ( $mouseX == null ) $mouseX = mouseX;
          if ( $mouseX == mouseX ) return;

          var isDragLeft = $mouseX > mouseX;
          $mouseX = mouseX;

          var nodeLeft = null, nodeRight = null;
          if ( nodeIndex - 1 >= 0 ) nodeLeft = $stats.lanes[nodeIndex - 1];
          if ( nodeIndex + 1 < $stats.lanes.length ) nodeRight = $stats.lanes[nodeIndex + 1];

          if ( nodeLeft != null && isDragLeft ) {
            var leftBounds = nodeLeft.getBounds();
            var leftTrigger = leftBounds.getX() + leftBounds.getWidth() / 2;
            if ( nodeX < leftTrigger ) {
              $stats.lanes.move( nodeIndex, nodeIndex - 1 );
              nodeLeft.moveTo( leftBounds.getX() + nodeW, leftBounds.getY() );
            }
          }

          if ( nodeRight != null && !isDragLeft ) {
            var rightBounds = nodeRight.getBounds();
            var rightTrigger = rightBounds.getX() + rightBounds.getWidth() / 2;
            if ( nodeX + nodeW > rightTrigger ) {
              $stats.lanes.move( nodeIndex, nodeIndex + 1 );
              nodeRight.moveTo( rightBounds.getX() - nodeW, rightBounds.getY() );
            }
          }
        } else {
          // resize:
          $undoComposition = undoManager.startComposite( $constants.adjustSwimlaneCommand, true );
          $.when(
            $(this).adjustSwimlaneWidth( diagram, node )
          ).done(
            $(this).adjustWhitepaper
          );
        }
      }
    },

    onNodeTextChanged: function( diagram, textEvent ) {
      var node = textEvent.getNode();
      var tag = node.getTag();
      if ( tag == $constants.swimlaneTopTag ) {
        var text = textEvent.getNewText();
        node.setText( '<b>' + text + '</b>' );
      }
    },

    onNodeTextChanging: function( diagram, textEvent ) {
      var node = textEvent.getNode();
      var tag = node.getTag();
      if ( tag == $constants.swimlaneTopTag ) {
        var text = node.getText();
        var pattern =  /\<b\>(.+)\<\/b\>/;
        var match = pattern.exec( text );
        if ( match != null && match.length == 2 ) {
          node.setText( match[1] );
        }
      }
    },

    onSave: function() {
      if ( $stats.saving ) return;
      $stats.saving = true;

      var provis = document.provis;

      // Resize grid to minimum required size (margin: 5px)
      var bounds = provis.diagram.getBounds();
      provis.diagram.resizeToFitItems( 5 );

      // Disable grid
      $(this).toggleGridVisibility( provis, true );

      var imagemap = provis.applet.saveToMap('%MAPNAME%');
      var imageaqm = provis.applet.saveToString(true);
      var imagepng = provis.applet.saveToImage();

      // var url = drawingSaveUrl;

      var url = '/bin/rest/ProVisPlugin/upload';
      var drawingSaveUrl = '/bin/rest/ProVisPlugin/upload';
      var drawingTopic = 'Main.WebHome';
      var drawingName = 'xcvxcv12';
      // var drawingName = 'yxc2';
      var drawingType = 'swimlane';

      $stats.saving = false;

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
        // dataType: 'json',
        contentType: 'multipart/form-data; boundary='+ sep,
        error: function( xhr, status, error ) {
          console.log( 'error' );
          // ToDo
        },
        success: function( data, status, xhr ) {
          console.log( 'success' );
          // ToDo
        },
        complete: function() {
          provis.diagram.setBounds( bounds );
          $(this).toggleGridVisibility( provis );
          $stats.saving = false;
        }
      });
    },

    redo: function( provis ) {
      var undoManager = provis.undoManager;
      var history = undoManager.getHistory();
      var current = history.getNextRedo();
      if ( current != null ) {
        var title = current.getTitle();
        undoManager.redo();

        var redoTwice = title == $constants.adjustSwimlaneCommand || title == $constants.adjustWhitepaperCommand;
        if ( redoTwice ) {
          var next = history.getNextRedo();
          if ( next != null && next.getTitle() == $constants.modifyCommand ) {
            undoManager.redo();
          }
        }
      }
    },

    setBehavior: function( provis, behavior) {
      provis.view.setBehavior( behavior );
    },

    setup: function( provis ) {
      // set default shape brush
      var defaultBrush = $(this).createSolidBrush( $config.defaultShapeBrush );

      var d = provis.diagram;
      d.setShapeBrush( defaultBrush );

      // grid lines
      var gridColor = $(this).createColor( $config.gridColor );
      d.setGridColor ( gridColor );
      d.setGridSizeX( $config.gridSizeX );
      d.setGridSizeY( $config.gridSizeY );
      d.setGridStyle( $config.gridStyle );
      d.setShowGrid( true );

      // grid size
      var rect = provis.scriptHelper.createRectangleF( 0, 0, $config.gridWidth, $config.gridHeight );
      d.setBounds( rect );

      // fix placement of the drawing area to match grid lines x/y offset
      var offsetX = d.getGridSizeX() / 2;
      var offsetY = d.getGridSizeY() / 2;;
      $(this).adjustDrawingArea( d, offsetX, offsetY );

      // eye-candy
      // adds a 3px border around the grid
      var whitePen = $(this).createPen( 3, '#fff' );
      d.setBoundsPen( whitePen );

      // allow inplace editing of captions and shape titles
      provis.view.setAllowInplaceEdit( true );

      // default behavior (cursor): modify
      provis.view.setBehavior( 0 );

      // default handles.
      d.setShapeHandlesStyle( $config.defaultHandleStyle );
      d.setAdjustmentHandlesSize( 8 );

      // Sets whether link segments can be added and removed interactively.
      d.setAllowSplitLinks( false );

      // Sets a value indicating whether users are allowed to attach links to nodes that do not have any anchor points.
      d.setAllowUnanchoredLinks( true );

      // Sets a value indicating users are allowed to move the end points of a link after the link is created.
      d.setLinkEndsMovable( true );

      // Sets whether disabled manipulation handles should be displayed.
      d.setShowDisabledHandles( false );

      // Sets a value indicating whether newly created links are set to align their end points to the borders of the nodes they connect.
      d.setLinksSnapToBorders( true );

      // Sets a value indicating whether anchor points will be shown on screen.
      // 2: auto
      d.setShowAnchors( 2 );
      // Sets a value indicating when links snap to anchor points.
      // 1: OnCreateOrModify
      d.setSnapToAnchor( 1 );

      // Sets the style that should be assigned to new links.
      // 2: Cascading
      d.setLinkStyle( 2 );

      // Sets the default orientation of the first segments of cascading links.
      // 2: vertical
      d.setLinkCascadeOrientation( 2 );

      // Sets the default pen that should be assigned to new links.
      var linkPen = $(this).createPen( 1.25, '#333' );
      d.setLinkPen( linkPen );

      // Sets whether link segments can be added and removed interactively.
      d.setAllowSplitLinks( true );

      // finally, enable undo/redo. it's disabled by default.
      provis.undoManager.setUndoEnabled( true );
      var history = provis.undoManager.getHistory();
      history.setCapacity( $config.undoCommandHistory );
      history.clear();



      // Testing..
      var opts = d.getRoutingOptions();
      opts.setNodeVicinitySize( 550 );
      opts.setNodeVicinityCost( 575 );
      opts.setSmartPolylineEnds( true );
    },

    toggleGridVisibility: function( provis, forceOff ) {
      var isVisible = provis.diagram.getShowGrid() || forceOff;
      provis.diagram.setShowGrid( !isVisible );
    },

    toggleSnapToGrid: function( provis ) {
      var snapToGrid = provis.diagram.getAlignToGrid();
      provis.diagram.setAlignToGrid( !snapToGrid );
    },

    undo: function( provis ) {
      var undoManager = provis.undoManager;
      var history = undoManager.getHistory();
      var current = history.getNextUndo();
      if ( current != null ) {
        var title = current.getTitle();
        undoManager.undo();

        var next = history.getNextUndo();
        if ( next != null && title == $constants.modifyCommand ) {
          var nextTitle = next.getTitle();
          var undoTwice = nextTitle == $constants.adjustWhitepaperCommand || nextTitle == $constants.adjustSwimlaneCommand;
          if( undoTwice ) {
            undoManager.undo();
          }
        }
      }
    },

    zoomIn: function( provis ) {
      var zoom = provis.view.getZoomFactor();
      $(this).zoomTo( provis, zoom + $config.zoomStep );
    },

    zoomOut: function( provis ) {
      var zoom = provis.view.getZoomFactor();
      $(this).zoomTo( provis, zoom - $config.zoomStep );
    },

    zoomTo: function( provis, value ) {
      if ( value < 25 || value > 200 ) return;
      provis.view.setZoomFactor( value );
      $('#select-zoom option:selected').removeAttr( 'selected' );
      $('#select-zoom option[value=' + value + ']').attr( 'selected', 'selected' );
    },

    zoomReset: function( provis ) {
      $(this).zoomTo( provis, 100 );
    }
  });

  $(document).ready( function() {
    Array.prototype.move = function ( from, to ) {
      this.splice( to, 0, this.splice( from, 1 )[0] );
    };

    window.onNodeDeleted = $(this).onNodeDeleted;
    window.onNodeModifying = $(this).onNodeModifying;
    window.onNodeModified = $(this).onNodeModified;
    window.onNodeClicked = $(this).onNodeClicked;
    window.onNodeCreated = $(this).onNodeCreated;
    window.onNodeDoubleClicked = $(this).onNodeDoubleClicked;
    window.onNodeTextChanged = $(this).onNodeTextChanged;
    window.onNodeTextChanging = $(this).onNodeTextChanging;
    window.onKeyDown = $(this).onKeyDown;
    window.onKeyUp = $(this).onKeyUp;

    var provis = new Object();
    provis.applet = $('#jDiagApplet').get(0);
    provis.diagram = provis.applet.getDiagram();
    provis.scriptHelper = provis.applet.getScriptHelper();
    provis.undoManager = provis.diagram.getUndoManager();
    provis.view = provis.applet.getDiagramView();
    this.provis = provis;

    // var uri = 'http://qwiki.ma.lan/pub/Main/WebHome/xcvxcv12.aqm';
    // $.ajax({
    //   url: uri,
    //   dataType: 'text',
    //   error: function( xhr, status, error ) { console.log( error ); },
    //   success: function( data, status, xhr ) {
    //     provis.diagram.loadFromString( data );
    //   }
    // });

    // top menu
    $('a.btn').on( 'click', function() {
      var selectable = $(this).data( 'selectable' );
      if ( selectable == '1' ) {
        $('a.selected').removeClass( 'selected' );
        $(this).addClass( 'selected' );
      }

      // toggable, e.g. 'Snap to grid' or 'Show grid'
      var toggable = $(this).data( 'toggable' );
      if ( toggable == '1' ) {
        if ( $(this).hasClass( 'toggled' ) ) {
          $(this).removeClass( 'toggled' );
        } else {
          $(this).addClass( 'toggled' );
        }
      }

      // invoke
      var action = $(this).data( 'action' );
      var args = $(this).data( 'actionargs' );
      if ( action ) {
        if ( args != null ) {
          $(this)[action]( document.provis, args );
        } else {
          $(this)[action]( document.provis );
        }
      }

      return false;
    });

    $('#btn-save').on( 'click', function() {
      $(this).onSave( document.provis );
      return false;
    });

    $('#btn-cancel').on( 'click', function() {
      $(this).onCancel( document.provis );
    });

    // shapes menu
    $('div.node').on( 'click', function() {
      $('div.node.selected').removeClass('selected');
      $(this).addClass('selected');
      var shapeName = $(this).data('shape');
      var shape = provis.scriptHelper.shapeFromId( shapeName );
      provis.diagram.setDefaultShape( shape );
      provis.diagram.setShapeOrientation( shapeName == 'Cylinder' ? 90 : 0 );
    });

    // layout menu
    $('div.layout').on( 'click', function() {
      $('div.layout.selected').removeClass('selected');
      $(this).addClass('selected');
    });

    // bind to (zoom) selection changed event
    $('#select-zoom').change( function() {
      $(this).zoomTo( document.provis, $(this).val() );
    });

    // reset zoom selection after page (re)load
    $('#select-zoom option:selected').removeAttr( 'selected' );
    $('#select-zoom option[value=100]').attr( 'selected', 'selected' );

    // adjust applet size and listen to the window's resize event
    // we gonna keep the applet sized according to its parent bounds
    $(this).adjustAppletSize();
    $(window).resize( function() {
      $(this).adjustAppletSize();
    });

    $(this).applyDefaultStyles( this.provis );

    // final initialization, default values, etc.
    $(this).setup( this.provis );
  });
})(jQuery);
