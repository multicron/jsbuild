const constant = require('constant.js');
const globals = require('globals.js');

// PlayerUpdate Constructor

module.exports = class PlayerUpdate {

    // Note that some of these items copied from player are objects and must not be modified
    // or they will change the data in the original players array.

    constructor(player,num_cells) {
	this.id = player.id;
	this.name = player.name;
	this.killed_by = player.killed_by;
	this.alive = player.alive;
	this.size = player.size;
	this.dash = player.dash;
	this.position = {
	    x: player.position.x,
	    y: player.position.y,
	};
	this.shade  = {
	    h: player.shade.h,
	    s: player.shade.s,
	    l: player.shade.l
	};
	this.scale  = player.scale;
	this.first_cell = player.first_cell; // Number of times "shift" has been called
	this.last_cell = player.last_cell; // Number of times "push" has been called
	this.last_cells = player.cells.slice(0 - num_cells); // Last N cells
    }
};
