const constant = require('constant.js');
const globals = require('globals.js');

// Leader Constructor

module.exports = class Leader {

    // Note that some of these items copied from player are objects and must not be modified
    // or they will change the data in the original players array.

    constructor(player) {
	let now = Date.now();

	this.id = player.id;
	this.name = player.name;
	this.alive = player.alive;
	this.size = player.size;
	this.dash = player.dash;
	this.cellcount = player.cells.length;
	this.shade = player.shade_min;
	this.score = Math.floor(player.cells.length * 100 + (now - player.create_time) / 1000);
	this.add_score = Math.floor(player.size * 100 + (now - player.create_time) / 1000) - this.score;
    }
};
