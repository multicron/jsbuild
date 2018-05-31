module.exports = class Timer {
    constructor(callback) {
	this.start_time = Date.now();
	this.callback = callback;
    }

    end() {
	this.callback(Date.now() - this.start_time);
    }
};
