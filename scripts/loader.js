// Copy this into a script tag, or leave it here

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

window.drawWindow = function() {
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
