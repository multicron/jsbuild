// Phyper Constructor

const debug = require('debug')('blubio');

let logger = function(...args) {
    debug(...args);
};

module.exports = function Phyper() {

    let _process = (function(tag, ...args) {
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
		param_value = params[p];
		if (param_value === null) {
		    param_str += p;
		}
		else {
		    param_str += p + "=" + '"' + param_value + '"';
		}
	    }
	}

	return "<" + tag + param_str + ">" + text + "</" + tag + ">\n";
    });
    this.a = (function(...args){return _process("a",...args);});
    this.b = (function(...args){return _process("b",...args);});
    this.br = (function(...args){return _process("br",...args);});
    this.div = (function(...args){return _process("div",...args);});
    this.select = (function(...args){return _process("select",...args);});
    this.option = (function(...args){return _process("option",...args);});
};


