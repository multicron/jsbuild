module.exports = class Timer {
    constructor(callback) {
	this.start_time = Date.now();
	this.callback = callback;
    }

    start() {
	this.start_time = Date.now();
    }

    end() {
	this.callback(Date.now() - this.start_time);
    }

    time(callback) {
	this.start();
	callback();
	this.end();
    }
};
