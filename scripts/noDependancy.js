// Write out necessary scripts in an iframe and run processing once ready

(function() {

function frameHTML(cache) {
	var html = [];
	var scriptPath = "localhost/~brian/DrawWindow/scripts/";
	var host = (("https:" == document.location.protocol) ? "https://" : "http://");
	var src = host + scriptPath + "compiled.js";
	var src1 = host + scriptPath + "jquery-1.6.1.js";
	var src2 = host + scriptPath + "drawWindow.js" + (cache ? "" : "?dt=" + (new Date()).getTime());
	var flashcanvas = host + scriptPath + "flashcanvaspro/flashcanvas.js";
	
	html.push("<html><head>");
	/*html.push("<script type='text/javascript' src='"+src+"'></script>");*/
	html.push("<script type='text/javascript' src='"+src1+"'></script>");
	html.push("<script type='text/javascript' src='"+src2+"'></script>");
	html.push("<!--[if lt IE 9]><script type='text/javascript' src='"+flashcanvas+"'></script><![endif]-->");
	html.push("</head><body>Loading</body></html>");
	return html.join('');
}

function createElement(el) {
    if (document.createElementNS && document.documentElement.namespaceURI !== null) {
        return document.createElementNS("http://www.w3.org/1999/xhtml", el)
    } 
    else {
        return document.createElement(el)
    } 
}

function writeFrame(appendTo) {

    var frame = createElement("iframe");
    frame.frameBorder = 0;
    frame.style.border = "0";
    frame.style.width = '1px';
    frame.style.height = '1px';
    frame.style.position = 'absolute';
    frame.style.top = '-2px';
    frame.style.left = '-2px';
    
    var domain = this.domain;
    var internetExplorer = document.selection && 
    	window.ActiveXObject && /MSIE/.test(navigator.userAgent);
    
    if (domain && internetExplorer) {
    	frame.h2c.html = this.frameHTML();
    	frame.src = "javascript:(function(){document.open();" +
    	  (domain ? "document.domain=\"" + domain + "\";" : "") +
    	  "document.write(window.frameElement.h2c.html);document.close();})()";
    	appendTo.appendChild(frame);
      	
    }
    else {
      	frame.src = "javascript:;";
    	appendTo.appendChild(frame);
		var doc = frame.contentWindow.document;
	  	doc.open();
	  	doc.write(frameHTML());
	  	doc.close();
    }
}


var PROGRESS = "<div class='h2c-ignore' style='position:fixed; cursor:pointer; width:400px; height:50px; background:#dfd; left:40%; top:20%; z-index:100002;'></div>";
var CLOSE = "<div style='position:absolute; cursor:pointer; width:25px; height:25px; background:red; right:10px; top:10px; z-index:100002;'></div>";

// A custom display of the image (overlay the image on top of existing page with ability to close)
window.drawWindowReady = function(innerWin, $) {
		
	var container = $("#h2c-wrapper")[0];
	var parentDoc = document;
	
	
	var prog = $(PROGRESS).appendTo(parentDoc.body).click(function() {
	    prog.remove();
	});
	function ondone(canvas) {
		var x = $(CLOSE).click(function() {
			$(canvas).remove();
			$(x).remove();
		});
		$(parentDoc.body).append(x);
		
		$(canvas).
			css("position", "absolute").
			css("top", 0).css("left", 0).
			css("background", "white").
			css("z-index", "100001");
		
		parentDoc.body.appendChild(canvas);
		
		prog.fadeOut();
		
	}
	function onprog(msg) {
		prog.html(msg);
	}
	
	innerWin.drawWindow(parentDoc, ondone, onprog);
}

window.customDrawWindow = function() {
	var doc = document;
	var div = createElement("div");
	
	div.id = 'h2c-wrapper';
	div.style.position = "absolute";
	div.style.top = "0";
	div.style.left = "0";
	div.style.width = "0";
	div.style.height = "0";
	div.style.zIndex = 100001;
	div.className = "h2c-ignore";
	
	var oldWrapper = doc.getElementById('h2c-wrapper');
	
	if (oldWrapper) {
	   oldWrapper.parentNode.removeChild(oldWrapper);
	}
	doc.body.appendChild(div);
	writeFrame(div);		
	return false;
};

})();
