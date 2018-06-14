const constant = require('constant.js');
const globals = require('globals.js');

// PowerUp Constructor

module.exports = class PowerUp {
    constructor() {
	this.create_time = Date.now();
	this.type = constant.powerup.scale;
	this.is_powerup = 1;
	this.position = {
	    x: Math.floor(Math.random() * (globals.world_dim.width-50)) + 25,
	    y: Math.floor(Math.random() * (globals.world_dim.height-50)) + 25,
	};
    }
};
