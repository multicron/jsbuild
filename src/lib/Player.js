const constant = require('./constant.js');
var global = require('./global.js');

// Player Constructor

module.exports = function Player() {
    this.id = undefined;
    this.is_robot = false;
    this.alive = 1;
    this.dir = constant.direction.up;
    this.dash =  (Math.random() > 0.5);
    this.speed = 1.0;
    this.size = 25;
    this.position = {
	x: Math.floor(Math.random() * (global.world_dim.width-50)) + 25,
	y: Math.floor(Math.random() * (global.world_dim.height-50)) + 25,
    };
    this.shade  = {
	h: Math.floor(Math.random()*360),
	s: 50,
	l: 50,
    };
    this.shade_delta  = {
	h: 3.0,
	s: 1.0,
	l: 0.5,
    };
    this.scale  = 1.0;
    this.cells = [];
};
