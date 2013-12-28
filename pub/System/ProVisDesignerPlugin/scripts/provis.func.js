// function applyConfig() {
//   // set default shape brush (for Rectangle)
//   var defaultBrush = null;
//   var cfg = $defaults["Rectangle"];
//   if ( cfg.useGradient ) {
//     defaultBrush = createGradientBrush( cfg.background, cfg.gradientColor, cfg.gradientAngle );
//   } else {
//     defaultBrush = createSolidBrush( cfg.background );
//   }

//   var d = document.provis.diagram;
//   d.setShapeBrush( defaultBrush );

//   // grid lines
//   var gridColor = $(this).createColor( $config.gridColor );
//   d.setGridColor ( gridColor );
//   d.setGridSizeX( $config.gridSizeX );
//   d.setGridSizeY( $config.gridSizeY );
//   d.setGridStyle( $config.gridStyle );
//   d.setShowGrid( true );

//   // grid size
//   var $apparea = $('div.provis-apparea');
//   var gridWidth = $config.gridWidth ? $config.gridWidth : ($apparea.width() - 5);
//   var gridHeight = $config.gridHeight ? $config.gridHeight : ($apparea.height() - 5);
//   $(this).setGridBounds( provis, gridWidth, gridHeight );

//   // fix placement of the drawing area to match grid lines x/y offset
//   var offsetX = d.getGridSizeX() / 2;
//   var offsetY = d.getGridSizeY() / 2;;
//   $(this).adjustDrawingArea( d, offsetX, offsetY );

//   // eye-candy
//   // adds a 3px border around the grid
//   var whitePen = $(this).createPen( 3, '#fff' );
//   d.setBoundsPen( whitePen );

//   // allow inplace editing of captions and shape titles
//   provis.view.setAllowInplaceEdit( true );

//   // default behavior (cursor): connect
//   provis.view.setBehavior( 3 );

//   // default handles.
//   d.setShapeHandlesStyle( $config.defaultHandleStyle );
//   d.setAdjustmentHandlesSize( 8 );

//   // Sets whether link segments can be added and removed interactively.
//   d.setAllowSplitLinks( false );

//   // Sets a value indicating whether users are allowed to attach links to nodes that do not have any anchor points.
//   d.setAllowUnanchoredLinks( true );

//   // Sets a value indicating users are allowed to move the end points of a link after the link is created.
//   d.setLinkEndsMovable( true );

//   // Sets whether disabled manipulation handles should be displayed.
//   d.setShowDisabledHandles( false );

//   // Sets a value indicating whether newly created links are set to align their end points to the borders of the nodes they connect.
//   d.setLinksSnapToBorders( true );

//   // Sets a value indicating whether anchor points will be shown on screen.
//   // 2: auto
//   d.setShowAnchors( 2 );
//   // Sets a value indicating when links snap to anchor points.
//   // 1: OnCreateOrModify
//   d.setSnapToAnchor( 1 );

//   // Sets the style that should be assigned to new links.
//   // 2: Cascading
//   d.setLinkStyle( 2 );

//   // Sets the default orientation of the first segments of cascading links.
//   // 2: vertical
//   d.setLinkCascadeOrientation( 2 );

//   // Sets the default pen that should be assigned to new links.
//   var linkPen = $(this).createPen( 1.25, '#333' );
//   d.setLinkPen( linkPen );

//   // Sets whether link segments can be added and removed interactively.
//   d.setAllowSplitLinks( true );

//   // finally, enable undo/redo. it's disabled by default.
//   provis.undoManager.setUndoEnabled( true );
//   var history = provis.undoManager.getHistory();
//   history.setCapacity( $config.undoCommandHistory );
//   history.clear();

//   // Testing..
//   var opts = d.getRoutingOptions();
//   opts.setNodeVicinitySize( 550 );
//   opts.setNodeVicinityCost( 575 );
//   opts.setSmartPolylineEnds( true );
// };

// function createColor( hexColor ) {
//   var c = getRGBColor( hexColor );
//   return document.provis.scriptHelper.createColor( c.r, c.g, c.b );
// };

// function createNode( id ) {
//   var shape = document.provis.scriptHelper.shapeFromId( id );
// };

// function createPen( width, hexColor ) {
//   var c = getRGBColor( hexColor );
//   return document.provis.scriptHelper.createPen( width, c.r, c.g, c.b );
// };

// function createSolidBrush( hexColor ) {
//   var c = getRGBColor( hexColor );
//   return document.provis.scriptHelper.createSolidBrush( c.r, c.g, c.b );
// };

// function createGradientBrush( hexFrom, hexTo, angle ) {
//   var c1 = getRGBColor( hexFrom );
//   var c2 = getRGBColor( hexTo );
//   var helper = document.provis.scriptHelper;
//   return helper.createGradientBrush( c1.r, c1.g, c1.b, c2.r, c2.g, c2.b, angle );
// };

// // http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
// function getRGBColor( hex ) {
//   // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
//   var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
//   hex = hex.replace( shorthandRegex, function( m, r, g, b ) {
//       return r + r + g + g + b + b;
//   });

//   var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec( hex );
//   return result ? {
//       r: parseInt( result[1], 16 ),
//       g: parseInt( result[2], 16 ),
//       b: parseInt( result[3], 16 )
//   } : null;
// };


// (function($) {
//   $(document).ready( function() {
//     var applet = $('#jDiagApplet').get(0);
//     this.provis = {
//       applet: applet,
//       diagram: applet.getDiagram(),
//       scriptHelper: applet.getScriptHelper(),
//       undoManager: applet.getDiagram().getUndoManager(),
//       view: applet.getDiagramView()
//     };

//     applet.onNodeDeleted = nodeDeleted;
//     applet.onNodeModifying = nodeModifying;
//     applet.onNodeModified = nodeModified;
//     applet.onNodeClicked = nodeClicked;
//     applet.onNodeCreated = nodeCreated;
//     applet.onNodeDoubleClicked = nodeDoubleClicked;
//     applet.onNodeTextChanged = nodeTextChanged;
//     applet.onNodeTextChanging = nodeTextChanging;
//     applet.onKeyDown = keyDown;
//     applet.onKeyUp = keyUp;
//   });
// })(jQuery);

// function appletStarted() {
//   if ( !window.provis )
//     window.provis = new ProVis();
// }
