const constant = require('./constant.js');
const globals = require('./globals.js');

// PlayerUpdate Constructor

module.exports = function PlayerUpdate() {
    this.id = undefined;
    this.size = undefined;
    this.position = {
	x: 0,
	y: 0,
    };
    this.shade  = {
	h: 0,
	s: 0,
	l: 0
    };
    this.scale  = 1.0;
    this.first_cell = 0;
    this.last_cell = 0;
    this.last_cells = [];
};
