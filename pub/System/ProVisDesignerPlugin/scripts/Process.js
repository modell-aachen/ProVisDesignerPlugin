/*
 * ProVis applet controller
 * Copyright (C) 2012 Modell Aachen UG. All rights reserved.
 */

var applet, diagram, scriptHelper, inplace;

var isCtrl = false;
debugMode = false;
var ctx = {
		type: null,		// possible values: swimlane, orglane[, flex]
		activeShape: null,
		activeShapeMoveX: null,
		activeShapeMoveY: null,
		numLanes: null,
		laneLength: null,
		saveStyle: 'frame',
		animTemp: false,
		sorted: false,		// *Don't modify
		rec: false,
		undo: false
};
var cfg, tdata;
var typeData = {
	swimlane: {
		headerTag: 'Swimlane_top',
		mainTag: 'Swimlane'
	},
	orglane: {
		headerTag: 'Orglane_top',
		textTag: 'Orglane_text',
		mainTag: 'Orglane'
	},
	flex: {
	}
};
var font, hyperlinkfont, lanefont;
var linktextstyle;
var brush, nodebrush, linkbrush;
var inplacecolor;
var lanepen, savepen;

// Management of external event subscribers {{{

var handlers = {};

function subscribeEvent(type, func) {
	if (handlers[type] === undefined) handlers[type] = [];
	handlers[type].push(func);
}
function notifyEvent(type)
{
	var args = Array.prototype.slice.call(arguments);
	args.shift();
	if (handlers[type] === undefined) return;
	$.each(handlers[type], function(_idx, func) {
		func.apply(null, args);
	});
}

// Management of external event subscribers }}}

// Config utility functions {{{
function cfgGet(key, defaultValue)
{
	if (typeof cfg[key] != 'undefined') return cfg[key];
	return defaultValue;
}
// }}}

/*
 * Überprüft und setzt Diagram Typ.
 */
function AppletStarted()
{
	applet = document.getElementById("jDiagApplet");
	diagram = applet.getDiagram();
	scriptHelper = applet.getScriptHelper();
	inplace = applet.getDiagramView().getInplaceTextArea();
	if (typeof diagram != 'object' && typeof diagram != 'function') {
		// TODO: pass error
		return;
	}

	initDiagram(drawingType, false);
	initLinkDialog();
	applet.setAttribute('border', 0);
	notifyEvent('applet_loaded');
}


function getDiagramHeight() {
	return diagram.getBounds().getHeight();
}

function getDiagramWidth() {
	return diagram.getBounds().getWidth();
}

// Find a position to place a new shape, based on a point given
function findPlaceForShape(x,y) {
	// Check if a node below is in the way
	var xdelta = cfg.vertical ? 0 : cfg.shapePlacementConflictBelow;
	var ydelta = cfg.vertical ? cfg.shapePlacementConflictBelow : 0;
	var node = diagram.getNodeAt(scriptHelper.createPoint(x + xdelta, y + ydelta), false, true);
	if (node && !node.getTag())
		return relAlong(node) + relLength(node) + cfg.shapePlacementDistance;

	xdelta = cfg.vertical ? 0 : cfg.shapePlacementConflictAbove;
	ydelta = cfg.vertical ? cfg.shapePlacementConflictAbove : 0;
	node = diagram.getNodeAt(scriptHelper.createPoint(x + xdelta, y - ydelta), false, true);
	if (node && !node.getTag())
		return relAlong(node) + relLength(node) + cfg.shapePlacementDistance;

	return cfg.vertical ? y : x;
}

function setAppletBounds()
{
	if (getDiagramWidth()+25 != applet.getAttribute('width') || getDiagramHeight()+25 != applet.getAttribute('height')) {
		applet.setAttribute('width',getDiagramWidth()+25);
		applet.setAttribute('height',getDiagramHeight()+25);
	}
}

function makeWhitepaper(MGroupWidth, MGroupLength)
{
	var whitepaper;
	if (cfg.vertical)
		whitepaper = diagram.getFactory().createShapeNode(0, 0, MGroupWidth, MGroupLength);
	else
		whitepaper = diagram.getFactory().createShapeNode(0, 0, MGroupLength, MGroupWidth);

	whitepaper.setLocked(false);
	whitepaper.setObstacle(false);
	whitepaper.setTransparent(true);
	whitepaper.setVisible(true);
	whitepaper.setBrush(brush);
	whitepaper.setPen(scriptHelper.createPen(1, 240 , 240, 240));

	whitepaper.setTag("whitepaper");
	whitepaper.setAllowIncomingLinks(false);
	whitepaper.setAllowOutgoingLinks(false);
	whitepaper.setHandlesStyle(10);
	whitepaper.setEnabledHandles(cfg.vertical ? 64 : 32);
	whitepaper.setZIndex(0);

	return whitepaper;
}

function initDiagram(newType, forceNew)
{
	var type;
	var isNew = forceNew;
	// TODO: can't we encode the diagram type in the diagram data?
	foreachNode(function(node) {
		if (node.getTag() == 'Swimlane') {
			type = 'swimlane';
			return 1;
		}
		if (node.getTag() == 'Orglane') {
			type = 'orglane';
			return 1;
		}
		if (node.getTag() == 'Flex') {
			type = 'flex';
			return 1;
		}
	});

	if (!type) {
		isNew = true;
		type = newType || 'swimlane';
	} else if (forceNew && newType)
		type = newType;

	ctx.type = type;
	cfg = config[type];
	tdata = typeData[type];
	ctx.laneLength = cfg.laneLength;

	// We'll reuse these a LOT...
	lanefont = scriptHelper.createFont(cfg.laneTextFont, cfg.laneTextSize);
	shapefont = scriptHelper.createFont(cfg.shapeTextFont, cfg.shapeTextSize);
	hyperlinkfont = scriptHelper.createHyperlinkFont(cfg.shapeTextFont, cfg.shapeTextSize);
	linkfont = scriptHelper.createFont(cfg.linkTextFont, cfg.linkTextSize);
	linktextstyle = scriptHelper.getConstant('LinkTextStyle', cfgGet('linkTextStyle', 'OverLongestSegment'));
	brush = scriptHelper.createSolidBrush(cfg.laneBrushR , cfg.laneBrushG, cfg.laneBrushB);
	nodebrush = scriptHelper.createSolidBrush(cfg.shapeBrushR, cfg.shapeBrushG, cfg.shapeBrushB);
	linkbrush = scriptHelper.createSolidBrush(cfg.linkBrushR, cfg.linkBrushG, cfg.linkBrushB);
	inplacecolor = scriptHelper.createColor(cfg.inPlaceEditColorR,cfg.inPlaceEditColorG,cfg.inPlaceEditColorB);
	lanepen = scriptHelper.createPen(cfg.lanePenSize, cfg.lanePenR, cfg.lanePenG, cfg.lanePenB);
	savepen = scriptHelper.createPen(cfg.savePenSize, cfg.savePenR, cfg.savePenG, cfg.savePenB);

	if (isNew) {
		// Create an all new one
		diagram.clearAll();
		var bounds = scriptHelper.createRectangleF(0, 0, applet.height - 10, applet.width - 10);
		diagram.setBounds(bounds);

		diagram.setLinkBrush(linkbrush);
		diagram.setLinkStyle(cfg.linkStyle);
		diagram.setRouteLinks(cfg.RouteLinks);
		diagram.getRoutingOptions().setNodeVicinityCost(cfg.NodeVicinityCost);
		diagram.setShowAnchors(2);
		diagram.setLinksSnapToBorders(cfg.LinksSnapToBorders);
		diagram.setLinkHeadShapeSize(cfg.LinkHeadShapeSize);
		diagram.setLinkCrossings(cfg.LinkCrossings);
		diagram.setCrossingRadius(cfg.LinkCrossingRadius);
		diagram.setShapeHandlesStyle(cfg.ShapeHandlesStyle);

		var	MGroupWidth = cfg.startRows * cfg.laneWidth,
			MGroupLength = cfg.laneLength + cfg.laneHeaderSize;

		makeWhitepaper(MGroupWidth, MGroupLength);

		for (var i = 0; i < cfg.startRows; i++) {
			makeNewLane();
		}
	} else {
		foreachNode(function(node) {
			ctx.laneLength = relLength(node);
		}, tdata.mainTag);
	}

	OnLoad();

	inplace.setBackground(inplacecolor);
	inplace.setLineWrap(true);
	inplace.setWrapStyleWord(true);
	applet.getDiagramView().setAllowInplaceEdit(true);
	applet.getDiagramView().setInplaceEditCancelOnEsc(true);
	applet.getDiagramView().setInplaceEditAcceptOnEnter(true);
	applet.getDiagramView().setInplaceEditFont(lanefont);
	countLanes();
	TrimDiagram();
}

// Create a new lane
function makeNewLane()
{
	if (cfg.vertical)
		makeVerticalLane(ctx.numLanes);
	else
		makeHorizontalLane(ctx.numLanes);
	ctx.numLanes++;
	resizeWhitepaper();
}

function makeVerticalLane(idx)
{
	var fac = diagram.getFactory();

	// Title
	var titleNode = fac.createShapeNode(idx * cfg.laneWidth, 0, cfg.laneWidth, cfg.laneHeaderSize);
	titleNode.setPen(lanepen);
	titleNode.setLocked(false);
	titleNode.setFont(lanefont);
	titleNode.setBrush(brush);
	titleNode.setObstacle(true);
	titleNode.setText("Label"+ (idx+1));
	titleNode.setTag(tdata.headerTag);
	titleNode.setAllowIncomingLinks(false);
	titleNode.setAllowOutgoingLinks(false);

	// meyer testing
	titleNode.setEnabledHandles( 184 );
	titleNode.setHandlesStyle( 2 );

	var titleConstraints = titleNode.getConstraints();
	titleConstraints.setMoveDirection(1);

	// Content
	var laneNode = fac.createShapeNode(idx * cfg.laneWidth, cfg.laneHeaderSize, cfg.laneWidth, ctx.laneLength);
	laneNode.setPen(lanepen);
	laneNode.setZIndex(1);
	// laneNode.setLocked(true);

	laneNode.setLocked( false );
	laneNode.setEnabledHandles( 184 );
	laneNode.setHandlesStyle( 2 );

	var laneConstraints = laneNode.getConstraints();
	laneConstraints.setMoveDirection(1);
	laneNode.setBrush(brush);
	laneNode.setObstacle(false);
	laneNode.setTag(tdata.mainTag);
	// laneNode.attachTo(titleNode, 0);
	laneNode.setAllowIncomingLinks(false);
	laneNode.setAllowOutgoingLinks(false);
	titleNode.getSubordinateGroup().setAutodeleteItems(true);
	titleNode.setZIndex(2);
}

function makeHorizontalLane(idx)
{
	var RotateOffset = (cfg.laneWidth - cfg.laneHeaderSize)/2;
	var fac = diagram.getFactory();

	var newnode2 = fac.createShapeNode(0, idx * cfg.laneWidth, cfg.laneHeaderSize, cfg.laneWidth);
	newnode2.setPen(lanepen);
	newnode2.setRotateText(true);
	newnode2.setLocked(false);
	newnode2.setFont(lanefont);
	newnode2.setBrush(brush);
	newnode2.setObstacle(true);
	newnode2.setText("");
	newnode2.setTag(tdata.headerTag);
	newnode2.setAllowIncomingLinks(false);
	newnode2.setAllowOutgoingLinks(false);
	var nodeconst = newnode2.getConstraints();
	nodeconst.setMoveDirection(2);

	var newnode3 = fac.createShapeNode(0, idx * cfg.laneWidth, cfg.laneWidth, cfg.laneHeaderSize);
	newnode3.setPen(lanepen);
	newnode3.setRotateText(true);
	newnode3.setRotate(-90);
	newnode3.setBounds(0, idx * cfg.laneWidth, cfg.laneWidth, cfg.laneHeaderSize);
	newnode3.moveTo(-RotateOffset, idx * cfg.laneWidth + RotateOffset);
	newnode3.setLocked(true);
	newnode3.setFont(lanefont);
	newnode3.setBrush(brush);
	newnode3.setObstacle(true);
	newnode3.setText("Label"+ (idx+1));
	newnode3.setTag(tdata.textTag);
	newnode3.setAllowIncomingLinks(false);
	newnode3.setAllowOutgoingLinks(false);
	var nodeconst = newnode3.getConstraints();
	nodeconst.setMoveDirection(2);

	var newnode1 = fac.createShapeNode(cfg.laneHeaderSize, idx * cfg.laneWidth, ctx.laneLength, cfg.laneWidth);
	newnode1.setPen(lanepen);
	newnode1.setZIndex(1);
	newnode1.setLocked(true);
	var nodeconst2 = newnode1.getConstraints();
	nodeconst2.setMoveDirection(2);
	newnode1.setBrush(brush);
	newnode1.setTransparent(false);
	newnode1.setObstacle(false);
	newnode1.setTag(tdata.mainTag);

	newnode1.attachTo(newnode2, 0);
	newnode3.attachTo(newnode2, 0);
	newnode1.setAllowIncomingLinks(false);
	newnode1.setAllowOutgoingLinks(false);
	newnode2.getSubordinateGroup().setAutodeleteItems(true);
	newnode1.setZIndex(1);
	newnode2.setZIndex(2);
	newnode3.setZIndex(3);
}

function setShape(shape, notify)
{
	ctx.activeShape = shape;
	if (notify === false) return;
	notifyEvent('change_shape', shape);
}

function setSaveStyle(style, notify)
{
	ctx.saveStyle = style;
	getConfig().setText(style);
	if (notify === false) return;
	notifyEvent('change_savestyle', style);
}

// XXX: is there any way to make use of this? What does it even do?
function overwriteDefaults_Flow()
{
	var ende=true;
	var i=0;
	do
	{
		try
		{
			var node=diagram.getNodes().get(i);
			if (node.getTag() == "Swimlane" || node.getTag() == "Swimlane_top")
			{
				node.setAllowIncomingLinks(false);
				node.setAllowOutgoingLinks(false);

				if (node.getFont != scriptHelper.createFont(cfgFlow.laneTextFont, cfgFlow.laneTextSize)) node.setFont(scriptHelper.createFont(cfgFlow.laneTextFont, cfgFlow.laneTextSize));
			}
			if (node.getTag() == null && node.getHyperLink() == "")
			{
				if (node.getFont != scriptHelper.createFont(cfgFlow.shapeTextFont, cfgFlow.shapeTextSize)) node.setFont(scriptHelper.createFont(cfgFlow.shapeTextFont, cfgFlow.shapeTextSize));
			}
			if (node.getTag() == null && node.getHyperLink() != "")
			{
				if (node.getFont != scriptHelper.createHyperlinkFont(cfgFlow.shapeTextFont, cfgFlow.shapeTextSize)) node.setFont(scriptHelper.createHyperlinkFont(cfgFlow.shapeTextFont, cfgFlow.shapeTextSize));
			}
		i++;
		}
		catch (e)
		{
			ende = false;
		}
	}
	while(ende==true);
}

// Initialize links/shapes after load
// Get rid of save lines if necessary
// Lanes etc. were hidden if savestyle != frame
function OnLoad()
{
	lockLinks(false);
	var remove = [];
	foreachNode(function(node) {
		if (node.getTag() == tdata.mainTag)
			node.setVisible(true);
		else if (node.getTag() == tdata.headerTag) {
			node.setVisible(true); // legacy from Orglane_top handling
			node.setTransparent(false);
		} else if (tdata.textTag && node.getTag() == tdata.textTag) {
			node.setPen(lanepen);
			node.setVisible(true); // legacy
			node.setTransparent(false);
			node.ZTop();
		}
		if (node.getTag() == "save_line")
			remove.push(node);
	});
	$.each(remove, function(_i, node) { diagram.getNodes().remove(node); });

	setSaveStyle(getConfig().getText());
}

// Fix style according to savestyle
function OnSave()
{
	lockLinks(true);
	if (ctx.saveStyle == 'frame') return;

	foreachNode(function(node) {
		if (node.getTag() == tdata.mainTag)
			node.setVisible(false);
		else if (node.getTag() == tdata.headerTag)
			node.setTransparent(true);
		else if (tdata.textTag && node.getTag() == tdata.textTag)
			node.setTransparent(true);
	});

	if (ctx.saveStyle == 'line') addSaveLines();
}

//Events-ABfangen
//----------------------------------------------------------------------------------


function nodeDeleted(sender, event)
{
	var node = event.getNode();
	if (node.getTag() != tdata.mainTag) return;
	ctx.numLanes--;
	OrganizeLanes();
	resizeWhitepaper();
}

function nodeDeleting(sender, event)
{
	if (getWhitePaper() == event.getNode()) event.setCancel(true);
}

function initLinkDialog()
{
		$('#provisLinkDlg').bind('dialogclose', function() {
			$('#jDiagApplet').css('visibility', 'visible');
		});
		$('#provisLinkField').keypress(function(e) {
			if (e.charCode == 13) $('#provisLinkSubmit').click();
		});
		$('#provisLinkCancel').click(function() {
			$('#provisLinkDlg').dialog('close');
			return false;
		});
}
function nodeClicked(sender, event)
{
	var node = event.getNode();
	var link = diagram.getLinkAt(event.getMousePosition(), 10, false);
	var btn = event.getMouseButton();
	if (link) {
		deSelectAll();
		link.setSelected(true);
	} else if (node.getTag() == tdata.mainTag && btn == 1) {
		var whitepaper = getWhitePaper();
		if (whitepaper) {
			deSelectAll();
			whitepaper.setSelected(true);
		}
	} else if (btn > 1 && !node.getTag()) {
		var $ = jQuery;
		$('#provisLinkDlg #provisLinkField').val(node.getHyperLink());
		$('#jDiagApplet').css('visibility', 'hidden');
		$('#provisLinkNodeLabel').text(node.getText());
		$('#provisLinkDlg').dialog('open');
		$('#provisLinkSubmit').one('click', function() {
			var url = $('#provisLinkField').val();
			if (url) {
				node.setHyperLink(url);
				node.setFont(hyperlinkfont);
				node.setToolTip("Link: "+ url);
			} else if (url !== null) {
				node.setHyperLink(null);
				node.setFont(shapefont);
				node.setTooltip(null);
			}
			$('#provisLinkDlg').dialog('close');
			return false;
		});
	}
	selectionCheck();
}

var undoComp = null;
function beginUndoComposite(title)
{
	if (!ctx.undo || undoComp !== null) return;
	undoComp = diagram.getUndoManager().startComposite(title);
}
function commitUndoComposite()
{
	if (undoComp === null) return;
	undoComp.execute();
	undoComp = null;
}

// XXX: This does nothing right now. Need docs for the undo API to fix it.
function recordItemChange(item, title, changeFunc)
{
//	var change = scriptHelper.createChangeItemCmd(item, title);
	changeFunc.apply(item, []);
//	change.execute();
}

function nodeModified(sender, event)
{
	var node = event.getNode();
	var position = event.getMousePosition();
	var whitepaper = getWhitePaper();
	var draggedNode = sender.getNodeAt(position, false, true);
	beginUndoComposite("Trim after node modified");

	var wlength = relLength(whitepaper);
	var wwidth = relWidth(whitepaper);
	var node_across = relAcross(node);
	var node_along = relAlong(node);
	var node_length = relLength(node);
	var node_width = relWidth(node);
	var startDistance = cfg.laneHeaderSize + cfg.laneTrimPad;

	if (node == whitepaper) {
		setLaneLength(wlength);
		TrimDiagram();
	} else if (node.getTag() == tdata.headerTag) {
		OrganizeLanes();
		deSelectAll();
	} else if (!draggedNode && !node.getTag()) {
		var trim = false;

		if (node_across < startDistance || node_along < 0 || node_along > wlength || node_across > wwidth) {
			if (node_across < 0) node_across = cfg.shapeBoundaryDistance;
			if (node_along < startDistance) node_along = startDistance;
			if (node_along > wlength) node_along = wlength - laneTrimPad;
			if (node_across > wwidth) node_across = wwidth - cfg.shapeBoundaryDistance;
			recordItemChange(node, "Move node", function() {
				relModify(this, 'moveTo', node_across, node_along);
			});
			if (node_along + node_length > wlength) TrimDiagram();
			snapAlignShape(node);
		}
	} else if (draggedNode && !node.getTag()) {
		snapAlignShape(node);
	}
	commitUndoComposite();
}

function nodeModifying(sender, event)
{
	var tag = event.getNode().getTag();
	if (tag == tdata.headerTag || tdata.textTag && tag == tdata.textTag) OrganizeLanes();
}

function nodeCreating(sender, event)
{
	event.cancelDrag();
}

function keyUp(sender, event)
{
	if (event.getkeycode() == 17) isCtrl = false;
}

function keyDown(sender, event)
{
	if (event.getkeycode() == 17) isCtrl = true;
	if (event.getkeycode() == 90 && isCtrl) unDone();
	if (event.getkeycode() == 89 && isCtrl) reDone();
	if (event.getkeycode() == 40 && isCtrl) copyNode();
	if (event.getkeycode() == 59 && isCtrl) pasteNode();
}

function createNode(posX, posY, breite, hoehe)
{
	var customShape = null;
	var customPattern = "Decision2In2Out";
	var transparent = false;
	var resizable = false;
	var sh = scriptHelper;
	var handlesstyle = sh.getConstant('HandlesStyle', 'HatchHandles2');
	var newnodebrush = null;

	var nodeType = ctx.activeShape;
	if (cfg.nodeTypes[nodeType] !== undefined) {
		var def = cfg.nodeTypes[nodeType];
		customShape = def.shape;
		resizable = (typeof def['resizable'] !== 'undefined') ? def.resizable : false;
		transparent = (typeof def['transparent'] !== 'undefined') ? def.transparent : false;
		if (typeof def['fillColor'] !== 'undefined')
			newnodebrush = scriptHelper.createSolidBrush(def.fillColor[0], def.fillColor[1], def.fillColor[2]);
		if (typeof def['customSize'] !== 'undefined') {
			var res = def.customSize(posX, posY, breite, hoehe);
			posX = res[0]; posY = res[1]; breite = res[2]; hoehe = res[3];
		}
	} else {
		customShape = 'Rectangle';
	}

	var textformat = scriptHelper.createTextFormat(1,1,false,true);
	var shape = scriptHelper.shapeFromId(customShape);
	var anchorPattern = scriptHelper.anchorPatternFromId(customPattern);

	var newnode = diagram.getFactory().createShapeNode(posX, posY, breite, hoehe);
	newnode.setTransparent(transparent);
	newnode.setTextFormat(textformat);
	newnode.setShape(shape);
	newnode.setAnchorPattern(anchorPattern);
	if (newnodebrush !== null) newnode.setBrush(newnodebrush);

	if (resizable) {
		newnode.setEnabledHandles(sh.getConstant('AdjustmentHandles', 'All') - sh.getConstant('AdjustmentHandles', 'Rotate'));
		newnode.setHandlesStyle(handlesstyle);
	}
	return newnode;
}

function onLinkCreation(sender, event)
{
	var link = event.getLink();
	link.setFont(linkfont);
	link.setTextStyle(linktextstyle);
	link.zTop();
}

// Double click handler:
// - create new shapes
// - edit shape/link text
// - edit lane title
function nodeDoubleClicked(sender, event)
{
	diagram.setGridSizeX(1);
	diagram.setGridSizeY(1);
	diagram.setAlignToGrid(true);

	var link = diagram.getLinkAt(event.getMousePosition(), 10, false);
	var node = event.getNode();
	if (link) {
		inplace.setFont(link.getFont());
		applet.getDiagramView().beginEdit(link);
		return;
	}
	if (!node.getTag()) {
		inplace.setFont(node.getFont());
		applet.getDiagramView().beginEdit(node);
		return;
	}
	if (node.getTag() == tdata.headerTag || tdata.textTag && node.getTag() == tdata.textTag) {
		var subnodes;
		try {
			subnodes = event.getNode().getMasterGroup().getAttachedNodes();
		} catch (e) {
			// Hackety hack
			subnodes = {size: function() { return 0; }};
		}
		for (var i = 0; i < subnodes.size(); i++) {
			var tnode = subnodes.get(i);
			if (tnode.getTag() != tdata.textTag) continue;

			var inplace_instance = applet.getDiagramView().beginEditOrglaneText(tnode, 10, tnode.getBounds().getY(), cfg.laneWidth, cfg.laneHeaderSize);
			inplace_instance.setFont(tnode.getFont());
			inplace_instance.setBackground(inplacecolor);
			inplace_instance.setLineWrap(true);
			inplace_instance.setWrapStyleWord(true);
			return;
		}
	}

	// The only other thing we care about is double clicks on the lane area
	// -> new shape
	if (node.getTag() != tdata.mainTag) return;

	var width_factor = (cfg.shapeSize / 100) || 0.8;
	var height_factor = cfg.vertical ? 58/96 : 96/58;

	var width = parseInt(cfg.laneWidth * width_factor);
	var distance = parseInt((cfg.laneWidth - width)/2);
	var posAcross = relAcross(node);
	posAcross += distance;

	var height = parseInt(height_factor * width);
	var posAlong = cfg.vertical ? event.getMousePosition().getY() : event.getMousePosition().getX();
	posAlong -= 0.5 * height;

	var startDistance = cfg.laneHeaderSize + cfg.laneTrimPad;
	if (posAlong < startDistance) posAlong = startDistance;

	posAlong -= posAlong % cfg.laneGrid;
	if (cfg.vertical)
		// XXX: -10? Why?
		posAlong = findPlaceForShape(posAcross - 10 + width/2, posAlong);
	else
		posAlong = findPlaceForShape(posAlong, posAcross - 10 + width/2);

	// Erzeuge Node
	var posX = cfg.vertical ? posAcross : posAlong;
	var posY = cfg.vertical ? posAlong : posAcross;
	var absWidth = cfg.vertical ? width : height;
	var absHeight = cfg.vertical ? height : width;
	var newnode = createNode(posX, posY, absWidth, absHeight);
	newnode.attachTo(node, 0);
	newnode.setFont(shapefont);
	node.getSubordinateGroup().setAutodeleteItems(true);

	TrimDiagram(false, posAlong + height + cfg.laneInsertExtend);
	applet.getDiagramView().beginEdit(newnode);
}


//Events-END
//----------------------------------------------------------------------------------


//Restl. Funktionen
function foreachNode(handler, tag)
{
	var nodes = diagram.getNodes();
	if (typeof tag == 'string') {
		var singleTag = tag;
		tag = {}; tag[singleTag] = 1;
	}
	for (var i = 0; i < nodes.size(); i++) {
		if (tag && !tag[nodes.get(i).getTag()]) continue;
		if (handler(nodes.get(i), i)) break;
	}
}

function foreachLink(handler)
{
	var links = diagram.getLinks();
	for (var i = 0; i < links.size(); i++) {
		if (handler(links.get(i), i)) break;
	}
}

function getNodesBBox()
{
	var xmin = -1, xmax = 0, ymin = -1, ymax = 0;
	foreachNode(function(node) {
		if (node.getTag()) return;
		var node_xmin = node.getBounds().getX();
		var node_xmax = node_xmin + node.getBounds().getWidth();
		var node_ymin = node.getBounds().getY();
		var node_ymax = node_ymin + node.getBounds().getHeight();
		if (node_xmin < xmin || xmin == -1) xmin = node_xmin;
		if (node_ymin < ymin || ymin == -1) ymin = node_ymin;
		if (node_xmax > xmax) xmax = node_xmax;
		if (node_ymax > ymax) ymax = node_ymax;
	});
	return {xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax};
}

function setLaneLength(height)
{
	foreachNode(function(node) {
		recordItemChange(node, "Resize lane", function() {
			relModify(this, 'resize', cfg.laneWidth, height - cfg.laneHeaderSize);
		});

	}, tdata.mainTag);
	ctx.laneLength = height - cfg.laneHeaderSize;
	resizeWhitepaper();
}

// The 'rel' refers to the dimensions, which are seen relative to the diagram orientiation
// In other words:
//   - for a vertical diagram (swimlane), across = X and along = Y
//   - otherwise, across = Y and along = X
function relVertHorzBound(node, vert, horz)
{
	if (cfg.vertical) return node.getBounds()['get'+ vert]();
	return node.getBounds()['get'+ horz]();
}
function relAcross(node) { return relVertHorzBound(node, 'X', 'Y'); } // Position 'across' lane direction
function relAlong(node) { return relVertHorzBound(node, 'Y', 'X'); } // Position 'along' lane direction
function relWidth(node) { return relVertHorzBound(node, 'Width', 'Height'); } // Width in lane (towards other lanes)
function relLength(node) { return relVertHorzBound(node, 'Height', 'Width'); } // Length in lane (down the lane)
function relModify(node, type, across, along)
{
	if (cfg.vertical) return node[type](across, along);
	node[type](along, across);
}

function countLanes()
{
	ctx.numLanes = 0;
	foreachNode(function(node) { ctx.numLanes++; }, tdata.headerTag);
}

function OrganizeLanes()
{
	// Count lanes so we can reuse this bit of information in a number of places
	var lanes = [];
	var pos = [];
	foreachNode(function(node) {
		lanes.push(node);
		pos.push(relAcross(node));
	}, tdata.headerTag);
	ctx.numLanes = lanes.length;

	// "Discretize" lanes: go through them by increasing X position
	// and align them to the 'grid' that lanes are positioned onto

	// Implemented as insertion sort which is simple enough and has pretty much
	// linear performance in realistic cases
	var sortedUpTo = 0;
	while (sortedUpTo+1 < lanes.length) {
		var nodeToSort = lanes[sortedUpTo+1];
		var curpos = pos[sortedUpTo+1];
		var i = sortedUpTo;
		while (i >= 0 && pos[i] > curpos) {
			lanes[i+1] = lanes[i];
			pos[i+1] = pos[i]
			i--;
		}
		lanes[i+1] = nodeToSort;
		pos[i+1] = curpos;
		sortedUpTo++;
	}

	// Reposition nodes in order;
	var acrossPos = 0;
	var reposCounter = 0;
	for (var i = 0; i < lanes.length; i++) {
		if (relAcross(lanes[i]) != acrossPos) {
			relModify(lanes[i], 'moveTo', acrossPos, 0);
			reposCounter++;
		}
		acrossPos += relWidth(lanes[i]);
	}
	if (reposCounter >= 2) applet.getDiagramView().recreateCacheImage();
	putLinksOnTop();
	diagram.routeAllLinks();
}

// Change length of diagram so that all nodes fit into it exactly
function TrimDiagram(allowShrink, minLength)
{
	beginUndoComposite('Trim');

	var bbox = getNodesBBox();
	var last = cfg.vertical ? bbox.ymax : bbox.xmax;
	if (last < cfg.laneMinLength) last = cfg.laneMinLength;
	if (last < minLength) last = minLength;
	var cur = relLength(getWhitePaper());
	if (!allowShrink && cur >= last) {
		resizeWhitepaper();
		return;
	}

	setLaneLength(last + cfg.laneTrimPad);
}

// If exactly one node was selected, tell the WYSIWYG editor about the current shape
function selectionCheck()
{
	var count=0;
	var select;
	foreachNode(function(node) {
		if (!node.getSelected()) return;
		count++;
		select = node;
	});

	if (count == 1 && select.getTag() == null) {
		var id = shapeMap(select.getShape().getId());
		if (id != "notSet") setShape(id);
	}
	return;
}

// Map internal node names to WYSIWYG names
function shapeMap(id){
	var newID;
	switch (id){
	case "Ende":
		newID = "end";
		break;
	case "Start2":
		newID = "start";
		break;
	case "Decision2":
		newID = "decision";
		break;
	case "Ellipse":
		newID = "join";
		break;
	case "Comment":
		newID = "comment";
		break;
	case "Document":
		newID = "document";
		break;
	case "Cylinder":
		newID = "database";
		break;
	case "Rectangle":
		newID = "process";
		break;
	default:
		newID = "notSet";
		break;
	}
	return newID;
}


function copyNode()
{
	// TODO
}

function pasteNode()
{
	// TODO
}

// Adapt whitepaper size to the bounding box of the lanes
function resizeWhitepaper()
{
	var whitepaper = getWhitePaper();
	if (!whitepaper) return;
	var curLaneWidth = 0;
	var curLaneHeight = 0;

	foreachNode(function(node) {
		var resize_posX = node.getBounds().getX();
		var resize_posY = node.getBounds().getY();
		var resize_breite = node.getBounds().getWidth();
		var resize_hoehe = node.getBounds().getHeight();

		if (curLaneWidth < (resize_posX + resize_breite)) {
			curLaneWidth = (resize_posX + resize_breite);
		}
		if (curLaneHeight < (resize_posY + resize_hoehe)) {
			curLaneHeight = (resize_posY + resize_hoehe);
		}
	}, tdata.mainTag);

	whitepaper.zBottom();
	whitepaper = whitepaper.setBounds(0, 0, curLaneWidth, curLaneHeight);
	diagram.resizeToFitItems(0);
	setAppletBounds();
}

// Position a shape so that it snaps to the grid and doesn't conflict with another shape.
function snapAlignShape(node)
{
	var position = scriptHelper.createPoint(node.getBounds().getX(), node.getBounds().getY());
	var draggedNode = diagram.getNodeAt(position, false, true);

	var dacross = relAcross(draggedNode);
	var dwidth = relWidth(draggedNode);
	var nwidth = relWidth(node);
	var nalong = relAlong(node);
	var nacross = relAcross(node);

	var laneStart = cfg.laneHeaderSize + cfg.laneTrimPad;
	if (nalong < laneStart) nalong = laneStart;
	if (cfg.vertical)
		nalong = findPlaceForShape(dacross + nacross/2, nalong - nalong % cfg.laneGrid);
	else
		nalong = findPlaceForShape(nalong - nalong % cfg.laneGrid, dacross + nacross/2);
	nalong -= nalong % cfg.laneGrid;

	relModify(node, 'moveTo', dacross + (dwidth - nwidth)/2, nalong);
	TrimDiagram();
	diagram.routeAllLinks();

	if (draggedNode.getTag() != tdata.mainTag) return;
	node.detach();
	node.attachTo(draggedNode, 0);
	draggedNode.getSubordinateGroup().setAutodeleteItems(true);
}

function PrintPreview()
{
	applet.getDiagramView().printPreview();
}

function DirektPrint()
{
	applet.getDiagramView().print();
}

function deSelectAll() {
	foreachNode(function(node) {
		if (node.getSelected()) node.setSelected(false);
	});
}

// XXX: fundamentally broken. Need docs to fix this.
function unDone() {
	diagram.getUndoManager().undo();
	diagram.getUndoManager().setUndo(false);
	SortLanes();
	diagram.resizeToFitItems(0);
	deSelectAll();
	diagram.getUndoManager().setUndo(true);
	setAppletBounds();
}

function reDone() {
	diagram.getUndoManager().redo();
	diagram.getUndoManager().setUndo(false);
	SortLanes();
	diagram.resizeToFitItems(0);
	deSelectAll();
	diagram.getUndoManager().setUndo(true);
	setAppletBounds();
}

function addSaveLines()
{
	var pos=0;
	var length = relLength(diagram.findNode(tdata.mainTag)) + relLength(diagram.findNode(tdata.headerTag));

	foreachNode(function(node) {
		var	x = node.getBounds().getX(),
			y = node.getBounds().getY();

		// Skip before first lane
		if (cfg.vertical && (x == 0) || !cfg.vertical && (y == 0)) return;

		var newnode = diagram.getFactory().createShapeNode(1,1,1,1);
		newnode.setObstacle(false);
		newnode.setZIndex(4);
		var shape = scriptHelper.shapeFromId(cfg.vertical ? 'LineVertical' : 'LineHorizontal');
		newnode.setShape(shape);
		newnode.setTag('save_line');
		newnode.setPen(savepen);
		newnode.ZTop();
		if (cfg.vertical)
			newnode.setBounds(x, y + cfg.saveLineOffset, 1, length - 2 * cfg.saveLineOffset);
		else
			newnode.setBounds(x + cfg.saveLineOffset, y, x + length - 2 * cfg.saveLineOffset, 1);
	}, tdata.headerTag);
	// Make sure things are in front of the lines
	putLinksOnTop();
}

// Arrange all links in the foreground
function putLinksOnTop()
{
	foreachLink(function(link) { link.ZTop(); });
}

// Prevent a link from being changed
function lockLinks(value)
{
	foreachLink(function(link) {
		link.setIgnoreLayout(value);
		link.setLocked(value);
	});
}

function getWhitePaper(){
	var whitePaper = null;
	whitePaper = diagram.findNode("whitepaper");
	//wenn WhitePaper Tag nicht gesetzt. (alt last)
	if (whitePaper == null) {
		// Legacy fix
		whitePaper = diagram.findNode("v1.0");
		if (whitePaper == null) {
			// Pre-legacy fix: make it up
			var bbox = getNodesBBox();
			var width, length;
			if (cfg.vertical) {
				width = bbox.ymax + 1;
				length = bbox.xmax + 1;
			} else {
				width = bbox.xmax + 1;
				length = bbox.ymax + 1;
			}
			whitePaper = makeWhitepaper(width, length);
		} else {
			whitePaper.setTag("whitepaper");
		}
	}
	return whitePaper;
}

// Fetches (or creates) configuration embedded in diagram data
function getConfig(){
	if (!diagram.findNode("config"))
		return createConfig();

	var node = diagram.findNode("config");
	// Legacy handling
	if (node.getText() == "0") node.setText(cfg.saveStyle);
	return node;
}

// XXX: there must be a better way than this...
function createConfig()
{
	var node = applet.getDiagram().getFactory().createShapeNode(0, 0, 2, 2);
	node.setLocked(false);
	node.setObstacle(false);
	node.setTransparent(true);
	node.setVisible(true);
	node.setPen(scriptHelper.createPen(1, 240 , 240, 240));
	node.setTag("config");
	node.setText(cfg.saveStyle);
	node.setAllowIncomingLinks(false);
	node.setAllowOutgoingLinks(false);
	node.setHandlesStyle(10);
	node.setEnabledHandles(64);
	node.setZIndex(0);
	return node;
}

function saveProvis(opts) { // {{{
	OnSave();
	deSelectAll();

	var imagemap = applet.saveToMap('%MAPNAME%');
	var imageaqm = applet.saveToString(true);
	var imagepng = applet.saveToImage();

	//Datenübertragung

	var url = drawingSaveUrl;
	var form = [];
	form.push('Content-Disposition: form-data; name="topic"\r\n\r\n'
		+ drawingTopic);
	form.push('Content-Disposition: form-data; name="drawing"\r\n\r\n'
		+ drawingName);
	form.push('Content-Disposition: form-data; name="aqm"\r\n\r\n'
		+ imageaqm);
	form.push('Content-Disposition: form-data; name="png"\r\n\r\n'
		+ imagepng);
	form.push('Content-Disposition: form-data; name="map"\r\n\r\n'
		+ imagemap);

	// Generate boundaries
	var sep;
	var request = form.join('\n');
	do {
		sep = Math.floor(Math.random() * 1000000000);
	} while (request.indexOf(sep) != -1);

	request = "--" + sep + "\r\n" +
		form.join('\r\n--' + sep + "\r\n") +
		"\r\n--" + sep + "--\r\n";

	$.ajax({
		type: 'POST',
		url: url,
		data: request,
		dataType: 'json',
		contentType: 'multipart/form-data; boundary='+ sep,
		error: opts.error,
		success: opts.success
	});
} // saveProvis }}}

