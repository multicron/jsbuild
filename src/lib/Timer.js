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
	let elapsed_time = Date.now() - this.start_time;
	if (this.keep) {
	    this.times.push(elapsed_time);
	    if (this.keep < this.times.length) {
		this.times.shift();
	    }
	}
	this.callback(elapsed_time,this.times);
    }
};
