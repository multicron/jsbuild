const constant = require('./constant.js');
const globals = require('./globals.js');

// Player Constructor

module.exports = function Player() {
    this.id = undefined;
    this.name = undefined;
    this.is_robot = false;
    this.alive = 1;
    this.dir = constant.direction.up;
    this.dash =  0; // (Math.random() > 0.5);
    this.speed = 1.0;
    this.size = globals.startsize;
    this.position = {
	x: Math.floor(Math.random() * (globals.world_dim.width-50)) + 25,
	y: Math.floor(Math.random() * (globals.world_dim.height-50)) + 25,
    };
    this.shade_min  = {
	h: Math.floor(Math.random()*360),
	s: 50,
	l: 70,
    };
    this.shade_max  = {
	h: Math.floor(Math.random()*30) + this.shade_min.h,
	s: Math.floor(Math.random()*40) + this.shade_min.s,
	l: 70,
    };
    this.shade  = {
	h: this.shade_min.h,
	s: this.shade_min.s,
	l: this.shade_min.l,
    };
    this.shade_delta  = {
	h: 2.0,
	s: 2.0,
	l: 0.0,
    };
    this.scale  = 1.0;
    this.cells = [];
    this.first_cell = 0;
    this.last_cell = 0;
    this.lines = [];
};
