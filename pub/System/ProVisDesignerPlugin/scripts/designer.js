/*
 * ProVis applet controller
 * Copyright (C) 2013 Modell Aachen GmbH. All rights reserved.
 */



var $anchorPattern = null;

var $undoComposition = null;

// maus-position während drag
var $mouseX;

// hält die ursprüngliche x-koordinate vor einem resize!
var $resizeX;

var $stats = {
  lanes: [],
  saving: false,
  modifying: false,
  moving: false
};



function adjustAppletSize( ui ) {
  var $area = $('div.provis-apparea');
  var $applet = $('#jDiagApplet');
  var $container = $('div.provis-right-container');

  // resize handler for jQuery Resizable
  if ( ui != null ) {
    var right = 20 + $(window).width() - ui.position.left;
    $area.css( 'right', right );

    var $adorner = $('#adorner');
    var min = 300, max = $(window).width() / 2;
    var width = ui.size.width;

    if ( width < max && width > min ) {
      $adorner.addClass( 'chevron-left-right' ).removeClass( 'chevron-left' ).removeClass( 'chevron-right' );
    } else if ( width == max ) {
      $adorner.addClass( 'chevron-right' ).removeClass( 'chevron-left' ).removeClass( 'chevron-left-right' );
    } else if ( width == min ) {
      $adorner.addClass( 'chevron-left' ).removeClass( 'chevron-left-right' ).removeClass( 'chevron-right' );
    }
  }

  // window resize
  $applet.width( $area.width() );
  $applet.height( $area.height() );
}


function applyDefaultStyles( provis ) {
  if ( !provis ) provis = document.provis;
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
        var gb = $(this).createGradientBrush( '#fff', '#ccc', 90 );
        node.setBrush( gb );
        // node.setBrush( captionBrush );

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
}

// foobar inc.
// due to compatibility reasons we have to adjust the drawing area
// by one half of the grid size
function adjustDrawingArea( diagram, offsetX, offsetY ) {
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
}


function adjustSwimlaneWidth( diagram, node ) {
  var d = $.Deferred();

  var swimlane = $(this).getSwimlane( node );
  var laneBounds = swimlane.getBounds();
  var nodeBounds = node.getBounds();

  swimlane.setBounds( laneBounds.getX(), laneBounds.getY(), nodeBounds.getWidth(), laneBounds.getHeight() );

  var width = 0;
  var offset = $config.gridSizeX / 2;
  var nodes = $stats.nodes;
  // $(this).foreach( nodes, function( node ) {
  //   var bounds = node.getBounds();
  //   if ( bounds.getX() != width + offsetX ) {
  //     var x = offsetX + width;
  //     var y = bounds.getY();
  //     node.moveTo( x, y );
  //   }

  //   width += bounds.getWidth();
  // });
  for ( var i = 0; i < $stats.lanes.length; i++ ) {
    var node = $stats.lanes[i];
    var bounds = node.getBounds();
    if ( bounds.getX() != width + offset ) {
      var x = offset + width;
      node.moveTo( x, offset );
    }

    width += bounds.getWidth();
  }

  d.resolve( diagram, width );
  return d;
}

function adjustWhitepaper( diagram, width ) {
  var d = $.Deferred();
  var whitepaper = diagram.findNode( $constants.whitepaperTag );
  var b = whitepaper.getBounds();
  whitepaper.setBounds( b.getX(), b.getY(), width, b.getHeight() );
  d.resolve( width );
  return d;
}

function applyAnchorPattern( node ) {
  if ( $anchorPattern == null ) {
    var helper = document.provis.scriptHelper;
    $anchorPattern = helper.anchorPatternFromId( 'Decision2In2Out' );
    var points = $anchorPattern.getPoints();
    for( var i = 0; i < points.size(); i++ ) {
      var pt = points.get( i );
      pt.setMarkStyle( 3 );
      pt.setColor( $(this).createColor( i < 2 ? '#0f0' : '#f00' ) );
    }
  }

  node.setAnchorPattern( $anchorPattern );
}

function createSwimlane( provis ) {
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
}

(function($) {

  $.fn.extend( {
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
      whitepaper.setHandlesStyle( 1 );
      // whitepaper.setHandlesStyle( $config.defaultHandleStyle );
    },

    foreach: function( jlist, callback ) {
      var d = $.Deferred();
      for( var i = 0; i < jlist.size(); i++ )
        callback( jlist.get( i ) );

      d.resolve();
      return d;
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
          break;
      }
    },

    getParentContainer: function( pointF ) {
      var parents = document.provis.diagram.getNodesAt( pointF );
      for ( var i = 0; i < parents.size(); i++ ) {
        var parent = parents.get( i );
        if ( parent.getTag() == $constants.swimlaneTag ) {
          return parent;
        }
      }

      return null;
    },

    onNodeClicked: function( diagram, nodeEvent ) {
      var node = nodeEvent.getNode();
    },

    onNodeCreated: function( diagram, nodeEvent ) {
      var node = nodeEvent.getNode();
      $(this).applyAnchorPattern( node );

      var bounds = node.getBounds();
      var pt = document.provis.scriptHelper.createPointF( bounds.getX(), bounds.getY() );
      var parent = $(this).getParentContainer( pt );
      if ( parent ) {
        node.attachTo( parent, 0 );
      }
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

    onNodeDoubleClicked: function( diagram, nodeEvent ) {
      var node = nodeEvent.getNode();
      if ( node.getTag() != $constants.swimlaneTag ) return;

      var bounds = node.getBounds();
      var pos = nodeEvent.getMousePosition();
      var factory = diagram.getFactory();
      var cfg = $defaults[$('div.node.node-selected').data( 'shape' )];

      var x = bounds.getX() + bounds.getWidth()/2 - cfg.width/2;
      var y = pos.getY() - cfg.height/2;
      var shape = factory.createShapeNode( x, y, cfg.width, cfg.height );
      $(this).applyAnchorPattern( shape );
      shape.attachTo( node, 0 );
    },

    onNodeModified: function( diagram, nodeEvent ) {
      var node = nodeEvent.getNode();
      var handle = nodeEvent.getAdjustmentHandle();

      // move
      if ( handle == 8 ) {
        if ( node.getTag() == $constants.swimlaneTopTag ) {
          var offsetX = $config.gridSizeX / 2;
          for( var i = 0; i < $stats.lanes.length; i++ ) {
            var lane = $stats.lanes[i];
            var bounds = lane.getBounds();
            lane.moveTo( offsetX, bounds.getY() );
            offsetX += bounds.getWidth();
          }
        } else {
          // update nodes parent swimlane
          var bounds = node.getBounds();
          var pt = document.provis.scriptHelper.createPointF( bounds.getX(), bounds.getY() );
          var parent = $(this).getParentContainer( pt );
          if ( parent ) node.attachTo( parent, 0 );
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

      // resize
      if ( handle == 5 ) $resizeX = null;

      // In case there's an unfinished (undo) composition -> execute/finish it.
      if ( $undoComposition != null ) {
        $undoComposition.execute();
        $undoComposition = null;
      }
    },

    onNodeModifying: function( diagram, nodeValidationEvent ) {
      var undoManager = diagram.getUndoManager();
      var node = nodeValidationEvent.getNode();
      var bounds = node.getBounds();

      if ( node.getTag() != $constants.swimlaneTopTag ) return;
      switch( nodeValidationEvent.getAdjustmentHandle() ) {
        // resize
        case 5:
          if ( $resizeX == null ) $resizeX = bounds.getX();
          if ( $resizeX < bounds.getX() || bounds.getWidth() < $config.swimlaneWidth ) {
            nodeValidationEvent.setCancel( true );
            nodeValidationEvent.cancelDrag();
            node.setBounds($resizeX, bounds.getY(), $config.swimlaneWidth, bounds.getHeight());
            return;
          }

          $undoComposition = undoManager.startComposite( $constants.adjustSwimlaneCommand, true );
          $.when( $(this).adjustSwimlaneWidth( diagram, node ) ).done( $(this).adjustWhitepaper );
          break;
        // move
        case 8:
          var nodeX = bounds.getX();
          var nodeW = bounds.getWidth();
          var index = $stats.lanes.indexOf( node );

          var mouseX = nodeValidationEvent.getMousePosition().getX();
          if ( $mouseX == mouseX ) return;
          var isDragLeft = $mouseX > mouseX;
          $mouseX = mouseX;

          var nodeLeft = index - 1 >= 0 ? $stats.lanes[index - 1] : null;
          var nodeRight = index + 1 < $stats.lanes.length ? nodeRight = $stats.lanes[index + 1] : null;

          if ( nodeLeft && isDragLeft ) {
            var lb = nodeLeft.getBounds();
            var trigger = lb.getX() + lb.getWidth() / 2;
            if ( nodeX <= trigger ) {
              $stats.lanes.move( index, index - 1 );
            }
          } else if ( nodeRight && !isDragLeft ) {
            var rb = nodeRight.getBounds();
            var trigger = rb.getX() + rb.getWidth() / 2;
            if ( nodeX + nodeW > trigger ) {
              $stats.lanes.move( index, index + 1 );
            }
          }
          break;
      }
    },

    onNodeTextChanged: function( diagram, textEvent ) {
      var node = textEvent.getNode();
      var tag = node.getTag();
      var font = null;

      if ( tag == $constants.swimlaneTopTag ) {
        font = document.provis.scriptHelper.createFont( 'Arial Bold', 14 );
      } else {
        var shapeName = node.getShape().getId();
        var cfg = $defaults[shapeName];

        var color = $(this).createColor( cfg.foreground );
        node.setTextColor( color );
        font = document.provis.scriptHelper.createFont( 'Arial', cfg.fontsize );
      }

      node.setFont( font );
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

    setGridBounds: function( provis, width, height ) {
      var rect = provis.scriptHelper.createRectangleF( 0, 0, width, height );
      provis.diagram.setBounds( rect );
    },

    setup: function( provis ) {
      // set default shape brush (for Rectangle)
      var defaultBrush = null;
      var cfg = $defaults["Rectangle"];
      if ( cfg.useGradient ) {
        defaultBrush = $(this).createGradientBrush( cfg.background, cfg.gradientColor, cfg.gradientAngle );
      } else {
        defaultBrush = $(this).createSolidBrush( cfg.background );
      }

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
      var $apparea = $('div.provis-apparea');
      var gridWidth = $config.gridWidth ? $config.gridWidth : ($apparea.width() - 5);
      var gridHeight = $config.gridHeight ? $config.gridHeight : ($apparea.height() - 5);
      $(this).setGridBounds( provis, gridWidth, gridHeight );

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

      // default behavior (cursor): connect
      provis.view.setBehavior( 3 );

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
      var zoom = provis.view.getZoomFactor() + $config.zoomStep;
      $(this).zoomTo( provis, zoom );
    },

    zoomOut: function( provis ) {
      var zoom = provis.view.getZoomFactor() - $config.zoomStep;
      $(this).zoomTo( provis, zoom );
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

    var applet = $('#jDiagApplet').get(0);
    this.provis = {
      applet: applet,
      diagram: applet.getDiagram(),
      scriptHelper: applet.getScriptHelper(),
      undoManager: applet.getDiagram().getUndoManager(),
      view: applet.getDiagramView()
    };

    // scrolling to 0 seems to be broken.
    this.provis.view.scrollTo( 0, -1 * $config.gridSizeY );

    // bind to (zoom) selection changed event
    $('#select-zoom').change( function() {
      $(this).zoomTo( document.provis, $(this).val() );
    });

    // reset zoom selection after page (re)load
    $('#select-zoom option:selected').removeAttr( 'selected' );
    $('#select-zoom option[value=100]').attr( 'selected', 'selected' );

    // adjust applet initial size and listen to the window's resize event
    // we gonna keep the applet sized according to its parent bounds
    $(this).adjustAppletSize();
    $(window).resize( function() {
      $(this).adjustAppletSize();
    });

    $(this).applyDefaultStyles( this.provis );

    // final initialization, default values, etc.
    $(this).setup( this.provis );

    // observer callback. Called by CKE.
    window.notify = function( d ) {
      $('div#topic-content').html( d );
    }

    // set initial topic content within preview area
    if ( window.opener.topic != null ) {
      $('div#topic-content').html( window.opener.topic );
    }

    // Some magic for the topic preview area.
    // $('div.provis-right-container').resizable({
    //   handles: "w",
    //   ghost: false, // disable eye-candy. seems broken (corrupts the absolute layout)
    //   animate: false,
    //   maxWidth: $(window).width() / 2,
    //   minWidth: 300,
    //   resize: function( e, ui ) {
    //     $(this).adjustAppletSize( ui );
    //   }
    // });

    // $('#adorner').dblclick( function( e ) {
    //   var $cnt = $('div.provis-right-container');
    //   var $area = $('div.provis-apparea');

    //   var wndWidth = $(window).width();
    //   var minWidth = 300;
    //   var maxWidth = wndWidth / 2;
    //   var speed = 400;

    //   var appLeft = $area.position().left;
    //   var appWidth = $area.width();
    //   var appRight = wndWidth - (appLeft + $area.outerWidth() );

    //   var cntLeft = $cnt.position().left;
    //   var cntWidth = $cnt.width();
    //   var cntRight = wndWidth - (cntLeft + $cnt.outerWidth() );

    //   // set animation properties explicitly.
    //   $area.css( 'left', appLeft ).css( 'right', appRight ).css( 'width', appWidth );
    //   $cnt.css( 'left', cntLeft ).css( 'right', cntRight ).css( 'width', cntWidth );

    //   // expand
    //   if ( cntWidth < maxWidth ) {
    //     var cntDiff = maxWidth - cntWidth;
    //     cntLeft = cntLeft - cntDiff;

    //     $cnt.animate({
    //       left: cntLeft,
    //       right: cntRight,
    //       width: maxWidth },
    //       speed );

    //     var offset = $area.outerWidth() - $area.width();
    //     appRight = wndWidth - cntLeft + offset;
    //     appWidth = wndWidth - appLeft - appRight - offset;
    //     $area.animate({
    //       left: appLeft,
    //       right: appRight,
    //       width: appWidth },
    //       speed, function() {
    //         $(this).adjustAppletSize( { position: { left: appLeft}, size: { width: maxWidth } } );
    //       });
    //   } else {
    //     // collapse
    //     var cntDiff = maxWidth - minWidth;
    //     cntLeft = cntLeft + cntDiff;
    //     $cnt.animate({
    //       left: cntLeft,
    //       right: cntRight,
    //       width: minWidth },
    //       speed );

    //     var offset = $area.outerWidth() - $area.width();
    //     appRight = wndWidth - cntLeft + offset;
    //     appWidth = wndWidth - appLeft - appRight - offset;
    //     $area.animate({
    //       left: appLeft,
    //       right: appRight,
    //       width: appWidth },
    //       speed, function() {
    //         $(this).adjustAppletSize( { position: { left: appLeft}, size: { width: minWidth } } );
    //       });
    //   }
    // });
  });
})(jQuery);
