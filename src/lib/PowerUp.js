const constant = require('constant.js');
const globals = require('globals.js');

// PowerUp Constructor

module.exports = class PowerUp {
    constructor() {
	this.end_time = Date.now() + 30000;
	this.type = Math.floor(Math.random()*2)+1;
	this.alive = 1;
	this.position = {
	    x: Math.floor(Math.random() * (globals.world_dim.width-50)) + 25,
	    y: Math.floor(Math.random() * (globals.world_dim.height-50)) + 25,
	};
    }
};
