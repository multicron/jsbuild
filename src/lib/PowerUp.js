// jshint browser: true

const constant = require('constant.js');
const globals = require('globals.js');
const clock = require('clock.js');

// PowerUp Constructor

module.exports = class PowerUp {
    constructor() {
	this.type = Math.floor(Math.random()*2)+1;
	this.alive = 1;
	this.position = {
	    x: Math.floor(Math.random() * (globals.world_dim.width-50)) + 25,
	    y: Math.floor(Math.random() * (globals.world_dim.height-50)) + 25,
	};
	this.set_end_time(30000);
    }

    set_end_time(msecs) {
	this.end_time = Math.floor(clock.time + msecs);
    }
};
