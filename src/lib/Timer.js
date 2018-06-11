module.exports = class Timer {
    constructor(callback,keep) {
	this.start_time = Date.now();
	this.callback = callback;
	this.times = [];
	this.keep = keep;
    }

    start() {
	this.start_time = Date.now();
    }

    end() {
	this.time = Date.now() - this.start_time;
	if (this.keep) {
	    this.times.unshift(this.time);
	    if (this.keep < this.times.length) {
		this.times.pop();
	    }
	}
	this.callback(this);
    }
};
