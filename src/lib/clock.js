// Clock Constructor
const debug = require('debug')('splines');

class Clock {
    constructor() {
	this.global = undefined;

	if (typeof window !== 'undefined') {
	    debug("Using window");
	    this.global = window;
	}
	else {
	    debug("Using global");
	    this.global = global;
	}
	
	this.global.MY_CLOCK_VARIABLE_NAME = 0;
    }

    get time() {
	return this.global.MY_CLOCK_VARIABLE_NAME;
    }
    
    set time(value) {
	this.global.MY_CLOCK_VARIABLE_NAME = value;
    }
}

module.exports = new Clock();
