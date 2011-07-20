(function() {

window.drawWindow = render;

var logLevel = 1;
var ignoreTags = { 'style':1, 'br': 1, 'script': 1, 'link': 1 };
var styleAttributes = [
	'border-top-style', 'border-top-color',
	'border-right-style', 'border-right-color',
	'border-bottom-style', 'border-bottom-color',
	'border-left-style', 'border-left-color',
	'outline-style', 'outline-color', 'overflow',
	'display', 'text-decoration',
	'font-family', 'font-style', 'font-weight', 'color',
	'position', 'float', 'clear', 'overflow',
	'background-color', 'background-image', 'background-repeat', 'background-position',
	'z-index', 'text-transform'
];
var styleAttributesPx = [
	'padding-top','padding-right','padding-bottom','padding-left',
	'margin-top','margin-right','margin-bottom','margin-left',
	'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
	'outline-width',
	'top', 'bottom', 'left', 'right', 
	'line-height', 'font-size'
];

function el(dom, onready) {	
	
	this.dom = dom;	
	dom._element = this;
	
	this.tagName = dom.tagName.toLowerCase();
	this.isBody = this.tagName == "body";
	
	
	if (this.isBody) {
		var body = this.body = this.parent = this;
		this.pendingResources = 0;
		this.checkImages = function() {
			if (this.childrenInitialized && this.pendingResources <= 0) {
				onready(this);
			}
		};
		this.loadImage = function(src, useBroken, element) {
			this.pendingResources++;
			retrieveImage(src, function(img) {
				element.loadedImage = img;
				log("Set elements loaded image", img);
				body.pendingResources--;
				body.checkImages();
			}, dom.ownerDocument, useBroken);
		}
	}
	else {
		this.parent = dom.parentNode._element;
		this.scrollParent = this.parent.scrollParent;
		this.body = this.parent.body;
	}
	
	this.initializeDOM();
	
	//log("Initialized " + this.tagName, this);
	
	this.children = $(dom).children(":not(.drawWindow-ignore)").map(function() {
	    return new el(this);
	}).sort(orderByZIndex);
	
	this.childrenInitialized = true;
	
	if (this.isBody) {
		this.checkImages();
	}

}

el.prototype.clip = function(rect) {
	return rect;
};

el.prototype.initializeDOM = function() {

	var dom = this.dom;
	var $dom = $(this.dom);
	var css = this.css = { };
	
	var computedStyleNormal = computedStyle(dom, styleAttributes);
	for (var i in computedStyleNormal) {
	    css[i] = computedStyleNormal[i];
	}
	var computedStylePx = computedStyle(dom, styleAttributesPx);
	for (var i in computedStylePx) {
	    css[i] = parseInt(computedStylePx[i]) || 0;
	}
	
	this.boundingClientRect = getScrolledRects([dom.getBoundingClientRect()], dom)[0];
	this.clientRects = getScrolledRects(dom.getClientRects(), dom);
	this.clippingRect = getClippingRect(dom, css);
	
	var noBorders = this.boundingClientRectNoBorders = $.extend({}, this.boundingClientRect);
	noBorders.top += css.borderTopWidth;
	noBorders.height -= (css.borderTopWidth + css.borderBottomWidth);
	noBorders.left += css.borderLeftWidth;
	noBorders.width -= (css.borderLeftWidth + css.borderRightWidth);
	
	if (this.isBody) {
		var doc = this.doc = dom.ownerDocument || document;
		this.boundingClientRect = {
			top: 0, left: 0, width: $(doc).width(), height: $(doc).height()
		};
		this.boundingClientRect.bottom = this.boundingClientRect.height;
		this.boundingClientRect.right = this.boundingClientRect.width;
	}
	
	
	var boundingClientRect = this.boundingClientRect;
	var parentBoundingClientRect = this.parent.boundingClientRect;
	
	this.isOverflowing = (this.parent.css.overflow != "visible") &&
	   ( boundingClientRect.width > parentBoundingClientRect.width ||
	     boundingClientRect.height > parentBoundingClientRect.height );
	
	var scrollTop = this.scrollTop = dom.scrollTop;
	var scrollLeft = this.scrollLeft = dom.scrollLeft;
	if ((scrollTop > 0 || scrollLeft > 0) && this.body != this) { this.scrollParent = this; }
	
	this.shouldRender = $dom.is(":visible");
	
	
	if (css.backgroundImage == "none") {
		css.backgroundImage = false;
	}
	if (css.backgroundColor == "rgba(0, 0, 0, 0)" || css.backgroundColor == "transparent") {
		css.backgroundColor = false;
	}
	
	this.id = $dom.attr("id") || false;
	this.src = this.tagName == 'img' ? $dom.attr("src") : css.backgroundImage;
	
	css.font = $.trim(
		css.fontStyle + " " + css.fontWeight + " " + 
		css.fontSize + "px " + css.fontFamily
	);
	
	css.zIndex = parseInt(css.zIndex) || 0;
	
	
	// Collect all of the text nodes for future reference 
	var textNodes = this.textNodes = [];
	var childNodes = dom.childNodes;
	for (var j = 0, l = childNodes.length; j < l; j++) {
		if (childNodes[j].nodeType == 3) {
			textNodes.push(childNodes[j]);
		}
	}
	
	// Fetch any images that are necessary for rendering
	if (this.shouldRender && this.src) {
		// Strip out the background image: url() rule
	    var cssRule = new RegExp(/url\((.*)\)/);
	    //this.src = this.src.replace(/['"]/g,''); trim quotes?
	    var matched = this.src.match(cssRule);
	    if (matched && matched[1]) {
	    	this.src = matched[1];
	    }
	    
	    // Make sure a relative URL gets qualified
		this.src = qualifyURL(this.src);
		
		var loadBroken = this.tagName == "img";
		this.body.loadImage(this.src, loadBroken, this);
	}
};

el.prototype.render = function(ctx) {

	var renderCtx = ctx;
	var mockCanvas;
		
	// If an element is overflowing, render it into a seperate canvas, so we can
	// clip it and render only what is necessary.
	if (this.shouldRender && this.isOverflowing) {
	    mockCanvas = createCanvas(this.body.doc, ctx.canvas.width, ctx.canvas.height);
	    renderCtx = mockCanvas.getContext("2d");		
	}
		
	if (this.shouldRender) {
		
		// Render background and borders for each rectangle (inline elements spanning 
		// multiple lines could have more than one clientRect)
		
		var rects = this.isBody ? [this.boundingClientRect] : this.clientRects;
		
		for (var i = 0, j = rects.length; i < j; i++) {
			this.renderBackground(renderCtx, rects[i]);
			this.renderBorders(renderCtx, rects[i]);
		}
		
		// Render text character by character
		this.renderText(renderCtx);
	}
	
	// Render all children
	var children = this.children;
	for (var i = 0, l = children.length; i < l; i++) {
		children[i].render(renderCtx);
	}
	
	if (this.shouldRender && this.isOverflowing) {
		
		// Do the actual clipping of an overflowing child.  See:
		// https://developer.mozilla.org/en/Canvas_tutorial/Using_images "Slicing"
		
		var b = this.parent.clippingRect;
		var l = this.parent.scrollLeft;
		var t = this.parent.scrollTop;
		
		ctx.drawImage(
			mockCanvas,
			b.left + l, b.top + t,
			b.width, b.height,
			b.left, b.top,
			b.width, b.height
		);
	}
};

el.prototype.renderText = function(ctx) {

	var css = this.css;
  	ctx.font = css.font;
  	ctx.fillStyle = css.color;
	ctx.textBaseline = "bottom";
	
	var scrollParent = this.scrollParent;
	
	var transform = css.textTransform;
	var nodes = this.textNodes;
	
	for (var i = 0 ; i < nodes.length; i++) {
	    var text = nodes[i].data;
	    
	    if (transform == "uppercase") { text = text.toUpperCase(); }
	    else if (transform == "lowercase") { text = text.toLowerCase(); }
	    
	    for (var f = 0; f < text.length; f++) {
	    	
	    	// Don't print any whitespace
	    	if (text[f].match(/\s/)) {
	    		continue;
	    	}
	    	
	    	// Get the coordinates for this letter, and draw it to the canvas
	    	var rect = getLetterRect(nodes[i], f, true);
	    	
	    	if (rect) {
	    		rect = this.clip(rect);
	    	
	    		//log(f, text[f], text.length, rect, this.tagName);
	    		ctx.fillText(text[f], rect.left, rect.bottom);
	    	}
	    }
	}
};

el.prototype.renderBackground = function(ctx, rect) {

	var css = this.css;
	var isBody = this.isBody;
	var backgroundColor = css.backgroundColor;
	var loadedImage = this.loadedImage;
	var backgroundRect = rect;
	
	if (backgroundColor) {
	   ctx.fillStyle = backgroundColor;
	   ctx.fillRect(
	   		backgroundRect.left, backgroundRect.top, 
	   		backgroundRect.width, backgroundRect.height
	   );
	}
	
	if (loadedImage) {
		
		//log("Rendering", loadedImage, this.src, backgroundRect, repeat);
	  	
	   	var repeat = this.tagName == "img" ? "no-repeat" : css.backgroundRepeat;
	   	
	   	if (repeat == "no-repeat") {
			ctx.drawImage(retrieveImageFromCache(this.src),backgroundRect.left, backgroundRect.top,
				backgroundRect.width, backgroundRect.height);
	   	}
	   	else {
	   		var pattern = ctx.createPattern(loadedImage, repeat);
			
			ctx.fillStyle = pattern;
			ctx.fillRect(
	   			backgroundRect.left, backgroundRect.top, 
	   			backgroundRect.width, backgroundRect.height
			);
		}
	}
};
el.prototype.renderBorders = function(ctx, rect) {
	var css = this.css,
		left = rect.left, 
		top = rect.top, 
		width = rect.width, 
		height = rect.height,
		borderLeftWidth = css.borderLeftWidth,
		borderTopWidth = css.borderTopWidth,
		borderBottomWidth = css.borderBottomWidth,
		borderRightWidth = css.borderRightWidth,
		outlineWidth = css.outlineWidth;
		
	if (borderLeftWidth) {
		ctx.fillStyle = css.borderLeftColor;
		ctx.fillRect(
			left, top, 
			borderLeftWidth, height);
	}
	
	if (borderTopWidth) {		
		ctx.fillStyle = css.borderTopColor;
		ctx.fillRect(
			left, top, 
			width, borderTopWidth);
	}
	
	if (borderBottomWidth) {		
		ctx.fillStyle = css.borderBottomColor;
		ctx.fillRect(
			left, top + height - borderBottomWidth, 
			width, borderBottomWidth);
	}
	
	if (borderRightWidth) {		
		ctx.fillStyle = css.borderRightColor;
		ctx.fillRect(
			left + width - borderRightWidth, 
			top, borderRightWidth, height);
	}
	
	if (outlineWidth > 0) {
	    ctx.strokeStyle = css.outlineColor;
	    ctx.lineWidth = outlineWidth;
	    ctx.strokeRect(
	    	left - (outlineWidth / 2), top - (outlineWidth / 2), 
	    	rect + outlineWidth, rect + outlineWidth);
	}
};

function render(doc, cb, progCallback) {
	var body = doc.body;
	var canvas = createCanvas(doc);
	var ctx = canvas.getContext("2d");
	
	cb = cb || function() { };
	progCallback = progCallback || function() { };
	
	
	body.normalize();
	
	var width = $(doc).width()
		height = $(doc).height();
		
	canvas.width = width;
	canvas.height = height;
	//ctx.fillStyle = "rgba(255,0,0,.2)";
	//ctx.fillRect(0, 0, width, height);
	
	time("Initializing");
	progCallback("Initilizing Elements");
	new el(body, function(bodyElement) {
		timeEnd("Initializing");
		time("Render");
		progCallback("Taking Screenshot");
		bodyElement.render(ctx);
		timeEnd("Render");
		cb(canvas);
	});
}


// retrieveImage: a method to interface with image loading, errors, and proxy
function retrieveImageFromCache(src) {
	assert(retrieveImage.cache.hasOwnProperty(src), "Error: image has not been loaded into cache");
	return retrieveImage.cache[src];
}

function qualifyURL(url) {
	var a = document.createElement('a');
    a.href = url;
    return a.href;
}

function retrieveImage(src, cb, ownerDocument, useBroken) {
	if (!$.isFunction(cb)) {
		cb = function() { };
	}
	
	if (retrieveImage.cache[src]) {
		log("Cache hit", src, retrieveImage.cache[src]);
		return cb(retrieveImageFromCache(src));	
	}
	
	// TODO: Load the image from a proxy to prevent cross domain permission problems with reading imageData
	var img = new Image();
	img.onload = sendSuccess;
	img.onerror = sendError;
	img.src = src;
	
	function sendError() {
		var img = new Image();
		img.onload = sendSuccess;
		img.src = useBroken ? retrieveImage.brokenImage : retrieveImage.transparentImage;
	}
	
	function sendSuccess() {
		retrieveImage.cache[src] = this;
	    cb(this);
	}
}


function orderByZIndex(el1, el2) {
   return el1.css.zIndex - el2.css.zIndex;
}

function getScrolledRects(rects, scrollElement) {

	scrollElement = scrollElement || rectElement;
	var body = scrollElement.ownerDocument.body;
	
	var scrollTop = body.scrollTop, scrollLeft = body.scrollLeft;
	
	// http://stackoverflow.com/questions/442404/dynamically-retrieve-html-element-x-y-position-with-javascript
	// offsetParent if we want to treat frames the same way??
	
	var parent = scrollElement;
	while (parent != body) {
		parent = parent.parentNode;
		if (parent == body) { break; }
		
		scrollTop += parent.scrollTop;
		scrollLeft += parent.scrollLeft;
	}
	
	var clientRects = [];
	
	for (var i = 0; i < rects.length; i++) {
		var rect = rects[i];
		clientRects.push({
			left: rect.left + scrollLeft,
			top: rect.top + scrollTop,
			bottom: rect.bottom + scrollTop,
			right: rect.right + scrollLeft,
			width: rect.width,
			height: rect.height
		})
	}
	
	return clientRects;
}

function getClippingRect(dom, css) {
	var outerHeight = $(dom).outerHeight();
	var outerWidth = $(dom).outerWidth();
	var borderLeftWidth = css.borderLeftWidth;
	var borderTopWidth = css.borderTopWidth;
	var borderRightWidth = css.borderRightWidth;
	var borderBottomWidth = css.borderBottomWidth;
	
	var rect = {
		top: dom.offsetTop + borderTopWidth,
		left: dom.offsetLeft + borderLeftWidth,
		width: outerWidth - borderLeftWidth - borderRightWidth,
		height: outerHeight - borderTopWidth - borderBottomWidth
	};
	
	rect.bottom = rect.top + rect.height;
	rect.right = rect.left + rect.width;
	return rect;
}

function getLetterRect(el, offset) {
	var doc = el.ownerDocument;
	var range = doc.createRange();
	var win = doc.defaultView;
	
	range.setStart(el, offset);
	range.setEnd(el, offset + 1);
	
	var sel = win.getSelection();
	sel.removeAllRanges();
	sel.addRange(range);
	
	var rangeRects = sel.getRangeAt(0).getClientRects();
	var clientRect = getScrolledRects(rangeRects, el.parentNode)[0];
	sel.removeAllRanges()
	return clientRect;
}


function computedStyle(elem, styles) {

	// IE - Use jQuery CSS.  Others - Load the computedStyle once and read from it
	
	var ret = { };
	
	if ($.browser.msie) {
		var el = $(elem);
		for (var i = 0, len = styles.length; i < len; i++) {
			var attr = styles[i], val;
			if (attr == 'outline-width') { val = 0; }
			else { val = el.css(attr); }
			
			ret[$.camelCase(attr)] = val;
		}
	}
	else {	
		var defaultView = elem.ownerDocument.defaultView;
		var computedStyle = defaultView.getComputedStyle( elem, true );
		for (var i = 0, len = styles.length; i < len; i++) {
			ret[$.camelCase(styles[i])] = computedStyle.getPropertyValue( styles[i] );
		}
	}
	
	return ret;
}

function createCanvas(doc, w, h) {
	var c = (doc || document).createElement("canvas");
    if (typeof FlashCanvas != "undefined") {
      FlashCanvas.initElement(c);
    }
    if (w && h) {
    	c.width = w;
    	c.height = h;
    }
    return c;	
}
function getDoctypeString(doc) {
	if ($.browser.msie) {
		var doctype = doc.all[0].text;
		return doctype || "";
	}
	else {
		var doctype = doc.doctype;
		if (!doctype) {
			return "";
		}
		var publicID = doctype.publicId;
		var systemID = doctype.systemId;
		var name = doctype.name;
		
		if (!publicID) {
			return "<!DOCTYPE " + name + ">"
		}
		
		return "<!DOCTYPE " + name + " PUBLIC \"" + publicID + "\" \"" + systemID + "\">";
	}
}


function assert(isTrue) {if (!isTrue){ log("ASSERTION FAILURE", arguments); }}
function log() { if (window.console) { console.log(Array.prototype.slice.apply(arguments)); } }
function time(n) { if (window.console) { console.time(n); } }
function timeEnd(n) { if (window.console) { console.timeEnd(n); } }
function log1() { if (logLevel >= 1) { log.apply(this, arguments); } }
function log2() { if (logLevel >= 2) { log.apply(this, arguments); } }
function error(msg) { throw "[drawWindow] " + msg; return false; }

retrieveImage.cache = { };
retrieveImage.transparentImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAACWCAYAAABkW7XSAAADLUlEQVR4Ae3QQREAAAiAMPqXVjv4HUeCNXWLAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwENgAfmTAf/IVJfgAAAAAElFTkSuQmCC";

retrieveImage.brokenImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAVBAMAAABWJ8jiAAAAIVBMVEUAAAAA//8A/wDAwMD/AP//AACAgIAAAID///8AgAAAAP87p9+eAAAAb0lEQVQImWPogIEGBmQmAwhkgJkcIKE0CNMYCDIyIEzLycYZbRDmpAnGDAwQ5swJxsYNEKYBM5xpbLxqAcQEU2PjhVCmSbDxqgoo09UYqB/CdAnuaIYwDYBOgjKNgSyoYRAngh0JZDBALMbuCzgTAD+sVWJQUviMAAAAAElFTkSuQmCC";

// Kick off rendering if this has been loaded into an iframe
if (window.parent != window && window.parent.drawWindowReady) {
	$(function() { window.parent.drawWindowReady(window, $); });
}

})();