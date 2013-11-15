// Allgemein gültige Einstellungen
var configDefaults = {
	startRows: 4, // Number of lanes in fresh diagram
	saveStyle: 'frame', // Render option: frame, line, noframe
	vertical: true, // Do the lanes extend downwards? (alternative: horizontal, i.e. to the right)
	AppletHeight: 1000, // Initial applet dimensions
	AppletWidth: 1000, // ...
	shapeSize: 66, // Relative size of shapes compared to lane size (as percentage)
	laneWidth: 150, // Width of lane ("across")
	laneLength: 550, // Length of lane ("along")
	laneMinLength: 80, // Minimum length of lane
	laneTrimPad: 20, // When trimming lanes, leave this much padding at the end
	laneInsertExtend: 150, // When inserting new nodes near the end, extend at least this many pixels beyond the node
	laneGrid: 20, // Distance of (virtual) grid lines across the lanes to which nodes snap
	laneHeaderSize: 40, // Height of the header ("along")
	shapePlacementConflictBelow: 5, // How closely do we check below the potential spot for a new shape?
	shapePlacementConflictAbove: 10, // How closely do we check above the potential spot for a new shape?
	shapePlacementDistance: 20, // How far to place new shapes away from nearby conflicting shapes
	shapeBoundaryDistance: 5, // How far to place new shapes away from the paper boundary
	laneTextSize: 14,
	shapeTextSize: 12,
	linkTextSize: 12,
	laneTextFont: "Arial",
	shapeTextFont: "Arial",
	linkTextFont: "Arial",
	laneBrushR: 255,
	laneBrushG: 255,
	laneBrushB: 255,
	lanePenSize: 1,
	lanePenR: 0,
	lanePenG: 0,
	lanePenB: 0,
	shapeBrushR: 242,
	shapeBrushG: 242,
	shapeBrushB: 252,
	linkBrushR: 153,
	linkBrushG: 153,
	linkBrushB: 153,
	inPlaceEditColorR: 245,
	inPlaceEditColorG: 245,
	inPlaceEditColorB: 245,
	savePenR: 180,
	savePenG: 180,
	savePenB: 180,
	savePenSize: 1,
	saveLineOffset: 5, // Remove this many pixels from each end of the save lines
	linkStyle: 2,
	LinkCrossings: 1, // 0-1-2
	LinkCrossingRadius: 5,
	LinkHeadShapeSize: 12,
	NodeVicinityCost: 18,	//Should min. 1px bigger than "LinkHeadShapeSize"
	RouteLinks: true,
	LinksSnapToBorders: true,
	ShapeHandlesStyle: 7,
	nodeTypes: {
		start: { shape: 'Start2', resizable: true },
		process: { shape: 'Rectangle' },
		decision: { shape: 'Decision2' },
		end: { shape: 'Ende' },
		join: { shape: 'Ellipse', customSize: function(posX, posY, across, along) {
			var factor = 0.3;
			var factor2 = 1;
			posX = posX + ((across-(across*factor))/2);
			across = across * factor;
			posY = posY + ((along-(along*factor))/2);
			along = across * factor2;
			return [posX, posY, across, along];
		} },
		'document': { shape: 'Document' },
		database: { shape: 'Cylinder' },
		IsoProcess: { shape: 'IsoProcess' },
		comment: { shape: 'Comment', resizable: true, transparent: true },
		Arrow7: { shape: 'Arrow7' },
		Arrow5: { shape: 'Arrow5' },
		Arrow3: { shape: 'Arrow3' },
		Alternative: { shape: 'Alternative' },
		Decision: { shape: 'Decision' }
		//, // Custom starts here
		//yellow: { shape: 'Rectangle', fillColor: [255,255,192], resizable: true }
	}
};
config = {};

function addConfig(type, values)
{
	var cfg = {};
	config[type] = cfg;
	$.each(configDefaults, function(key, val) { cfg[key] = val; });
	$.each(values, function(key, val) { cfg[key] = val; });
}

addConfig('swimlane', {
	saveStyle: "frame",
	laneLength: 450
});

addConfig('orglane', {
	saveStyle: "line",
	vertical: false,
	laneLength: 600,
	laneWidth: 120,
	lanePenR: 180,
	lanePenG: 180,
	lanePenB: 180
});

addConfig('flex', {
	vertical: false,
	laneLength: 730,
	laneWidth: 90
});

