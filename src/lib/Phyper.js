// Phyper Constructor

const debug = require('debug')('blubio');

let logger = function(...args) {
    debug(...args);
};

module.exports = function Phyper() {

    let _process = (function(tag, close, ...args) {
	let text = "";
	let params = {};

	let _process_args = (function(...args) {
	    // Iterate through all the args of the call
	    for (let a = 0; a < args.length; a++) {
		let arg = args[a];
		switch (typeof arg) {
		case "string":
		    // If it is a string, just append it to the text
		    text += arg;
		    break;
		case "number":
		    // If it is a number, just append it to the text
		    text += String(arg);
		    break;
		case "object":
		    if (arg.constructor === Object) {
			// If it is an object (hashmap), add it to our list of parameters
			for (let p in arg) {
			    if (arg.hasOwnProperty(p)) {
				params[p] = arg[p];
			    }
			}
		    }
		    else if (arg.constructor === Array) {
			// If it is an object (array), process each item individually
			for (let i = 0; i < arg.length; i++) {
			    _process_args(arg[i]);
			}
		    }
		    break;
		case "function":
		    text += arg();
		    break;
		}
	    }
	});

	_process_args(...args);

	// Done with all our parameters so we convert it to a string

	let param_str = "";

	for (let p in params) {
	    if (params.hasOwnProperty(p)) {
		param_str += " ";
		let param_value = params[p];
		if (param_value === null) {
		    param_str += p;
		}
		else {
		    param_str += p + "=" + '"' + param_value + '"';
		}
	    }
	}

	if (close === 0) {
	    return "<" + tag + param_str + ">\n";
	}
	else if (close === 1) {
	    return "<" + tag + param_str + ">" + text + "</" + tag + ">\n";
	}
	else {
	    throw new Error("Invalid value for tag close flag");
	}
    });
    
    let _process_css = (function(...args) {
	let params = {};

	let _process_css_args = (function(...args) {
	    // Iterate through all the args of the call
	    for (let a = 0; a < args.length; a++) {
		let arg = args[a];
		switch (typeof arg) {
		case "object":
		    if (arg.constructor === Object) {
			// If it is an object (hashmap), add it to our list of parameters
			for (let p in arg) {
			    if (arg.hasOwnProperty(p)) {
				params[p] = arg[p];
			    }
			}
		    }
		    else if (arg.constructor === Array) {
			// If it is an object (array), process each item individually
			for (let i = 0; i < arg.length; i++) {
			    _process_args(arg[i]);
			}
		    }
		    break;
		}
	    }
	});

	_process_css_args(...args);

	// Done with all our parameters so we convert it to a string

	let param_str = "";

	for (let p in params) {
	    if (params.hasOwnProperty(p)) {
		param_str += " ";
		let param_value = params[p];
		param_str += p + ": " + param_value + ';';
		}
	    }
	return param_str;
    });
    
    this.CSS = (function(...args){return _process_css(...args);});

    this.a = (function(...args){return _process("a",1,...args);});
    this.abbr = (function(...args){return _process("abbr",1,...args);});
    this.acronym = (function(...args){return _process("acronym",1,...args);});
    this.address = (function(...args){return _process("address",1,...args);});
    this.applet = (function(...args){return _process("applet",1,...args);});
    this.area = (function(...args){return _process("area",0,...args);});
    this.article = (function(...args){return _process("article",1,...args);});
    this.aside = (function(...args){return _process("aside",1,...args);});
    this.audio = (function(...args){return _process("audio",1,...args);});
    this.b = (function(...args){return _process("b",1,...args);});
    this.base = (function(...args){return _process("base",0,...args);});
    this.basefont = (function(...args){return _process("basefont",1,...args);});
    this.bdi = (function(...args){return _process("bdi",1,...args);});
    this.bdo = (function(...args){return _process("bdo",1,...args);});
    this.big = (function(...args){return _process("big",1,...args);});
    this.blockquote = (function(...args){return _process("blockquote",1,...args);});
    this.body = (function(...args){return _process("body",1,...args);});
    this.br = (function(...args){return _process("br",0,...args);});
    this.button = (function(...args){return _process("button",1,...args);});
    this.canvas = (function(...args){return _process("canvas",1,...args);});
    this.caption = (function(...args){return _process("caption",1,...args);});
    this.center = (function(...args){return _process("center",1,...args);});
    this.cite = (function(...args){return _process("cite",1,...args);});
    this.code = (function(...args){return _process("code",1,...args);});
    this.col = (function(...args){return _process("col",0,...args);});
    this.colgroup = (function(...args){return _process("colgroup",1,...args);});
    this.command = (function(...args){return _process("command",1,...args);});
    this.datalist = (function(...args){return _process("datalist",1,...args);});
    this.dd = (function(...args){return _process("dd",1,...args);});
    this.del = (function(...args){return _process("del",1,...args);});
    this.details = (function(...args){return _process("details",1,...args);});
    this.dfn = (function(...args){return _process("dfn",1,...args);});
    this.dir = (function(...args){return _process("dir",1,...args);});
    this.div = (function(...args){return _process("div",1,...args);});
    this.dl = (function(...args){return _process("dl",1,...args);});
    this.dt = (function(...args){return _process("dt",1,...args);});
    this.em = (function(...args){return _process("em",1,...args);});
    this.embed = (function(...args){return _process("embed",0,...args);});
    this.fieldset = (function(...args){return _process("fieldset",1,...args);});
    this.figcaption = (function(...args){return _process("figcaption",1,...args);});
    this.figure = (function(...args){return _process("figure",1,...args);});
    this.font = (function(...args){return _process("font",1,...args);});
    this.footer = (function(...args){return _process("footer",1,...args);});
    this.form = (function(...args){return _process("form",1,...args);});
    this.frame = (function(...args){return _process("frame",1,...args);});
    this.frameset = (function(...args){return _process("frameset",1,...args);});
    this.h1 = (function(...args){return _process("h1",1,...args);});
    this.h2 = (function(...args){return _process("h2",1,...args);});
    this.h3 = (function(...args){return _process("h3",1,...args);});
    this.h4 = (function(...args){return _process("h4",1,...args);});
    this.h5 = (function(...args){return _process("h5",1,...args);});
    this.h6 = (function(...args){return _process("h6",1,...args);});
    this.head = (function(...args){return _process("head",1,...args);});
    this.header = (function(...args){return _process("header",1,...args);});
    this.hgroup = (function(...args){return _process("hgroup",1,...args);});
    this.hr = (function(...args){return _process("hr",0,...args);});
    this.html = (function(...args){return _process("html",1,...args);});
    this.i = (function(...args){return _process("i",1,...args);});
    this.iframe = (function(...args){return _process("iframe",1,...args);});
    this.img = (function(...args){return _process("img",0,...args);});
    this.input = (function(...args){return _process("input",0,...args);});
    this.ins = (function(...args){return _process("ins",1,...args);});
    this.kbd = (function(...args){return _process("kbd",1,...args);});
    this.keygen = (function(...args){return _process("keygen",0,...args);});
    this.label = (function(...args){return _process("label",1,...args);});
    this.legend = (function(...args){return _process("legend",1,...args);});
    this.li = (function(...args){return _process("li",1,...args);});
    this.link = (function(...args){return _process("link",0,...args);});
    this.map = (function(...args){return _process("map",1,...args);});
    this.mark = (function(...args){return _process("mark",1,...args);});
    this.menu = (function(...args){return _process("menu",1,...args);});
    this.meta = (function(...args){return _process("meta",0,...args);});
    this.meter = (function(...args){return _process("meter",1,...args);});
    this.nav = (function(...args){return _process("nav",1,...args);});
    this.noframes = (function(...args){return _process("noframes",1,...args);});
    this.noscript = (function(...args){return _process("noscript",1,...args);});
    this.object = (function(...args){return _process("object",1,...args);});
    this.ol = (function(...args){return _process("ol",1,...args);});
    this.optgroup = (function(...args){return _process("optgroup",1,...args);});
    this.option = (function(...args){return _process("option",1,...args);});
    this.output = (function(...args){return _process("output",1,...args);});
    this.p = (function(...args){return _process("p",1,...args);});
    this.param = (function(...args){return _process("param",0,...args);});
    this.pre = (function(...args){return _process("pre",1,...args);});
    this.progress = (function(...args){return _process("progress",1,...args);});
    this.q = (function(...args){return _process("q",1,...args);});
    this.rp = (function(...args){return _process("rp",1,...args);});
    this.rt = (function(...args){return _process("rt",1,...args);});
    this.ruby = (function(...args){return _process("ruby",1,...args);});
    this.s = (function(...args){return _process("s",1,...args);});
    this.samp = (function(...args){return _process("samp",1,...args);});
    this.script = (function(...args){return _process("script",1,...args);});
    this.section = (function(...args){return _process("section",1,...args);});
    this.select = (function(...args){return _process("select",1,...args);});
    this.small = (function(...args){return _process("small",1,...args);});
    this.source = (function(...args){return _process("source",0,...args);});
    this.span = (function(...args){return _process("span",1,...args);});
    this.strike = (function(...args){return _process("strike",1,...args);});
    this.strong = (function(...args){return _process("strong",1,...args);});
    this.style = (function(...args){return _process("style",1,...args);});
    this.sub = (function(...args){return _process("sub",1,...args);});
    this.summary = (function(...args){return _process("summary",1,...args);});
    this.sup = (function(...args){return _process("sup",1,...args);});
    this.table = (function(...args){return _process("table",1,...args);});
    this.tbody = (function(...args){return _process("tbody",1,...args);});
    this.td = (function(...args){return _process("td",1,...args);});
    this.textarea = (function(...args){return _process("textarea",1,...args);});
    this.tfoot = (function(...args){return _process("tfoot",1,...args);});
    this.th = (function(...args){return _process("th",1,...args);});
    this.thead = (function(...args){return _process("thead",1,...args);});
    this.time = (function(...args){return _process("time",1,...args);});
    this.title = (function(...args){return _process("title",1,...args);});
    this.tr = (function(...args){return _process("tr",1,...args);});
    this.track = (function(...args){return _process("track",0,...args);});
    this.tt = (function(...args){return _process("tt",1,...args);});
    this.u = (function(...args){return _process("u",1,...args);});
    this.ul = (function(...args){return _process("ul",1,...args);});
    this.var = (function(...args){return _process("var",1,...args);});
    this.video = (function(...args){return _process("video",1,...args);});
    this.wbr = (function(...args){return _process("wbr",0,...args);});
};
