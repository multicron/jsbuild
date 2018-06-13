const constant = require('constant.js');
const globals = require('globals.js');

// Player Constructor

module.exports = class Player {
    constructor() {
	this.id = undefined;
	this.name = undefined;
	this.is_robot = false;
	this.alive = 1;
	this.create_time = Date.now();
	this.dir = Math.floor(Math.random() * 4) + 1;
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
    }

    get_collision_object(x,y) {
	if (x <=0 || 
	    y <=0 || 
	    x >= globals.world_dim.width ||
	    y >= globals.world_dim.height) {
	    return false;
	}
	return global.all_cells[x][y];
    }

    move() {
	
	let new_pos = this.predict_position(1);
	
	this.position.x = new_pos.x;
	this.position.y = new_pos.y;
    }

    one_step() {
	// Change direction (for robots)

	if (this.is_robot) {
	    this.turn();
	}

	// Change the position of the head
	this.move();

	// See if we bumped into anything

	if (this.check_edge_death()) {
	    this.alive = 0;
	}
	else {
	    let killer = this.check_collision();
	    if (killer) {
		this.award_collision(this,killer);
		this.alive = 0;
	    }
	}

	// Update all_cells with new position of head

	if (this.alive) {
	    global.all_cells[this.position.x][this.position.y] = this;
	    this.shift_player();
	}
    }
    
    
    award_collision(killed,killer) {
	let awarded = killed.cells.length - 90;
	
	if (awarded > 0) {
	    killer.size += awarded;
	}
	
	killed.size = 1;
    }

    shift_player() {
	
	if (this.cells.length >= this.size) {
	    this.cells.shift();
	    this.first_cell++;
	}
	
	this.cells.push({x: this.position.x,
			 y: this.position.y
			});
	
	this.last_cell++;
    }
    
    check_edge_death() {
	if (this.position.x < 0 || this.position.y < 0 || this.position.x >= globals.world_dim.width || this.position.y >= globals.world_dim.height) {
	    return true;
	}
	return false;
    }
    
    check_collision() {
	let c = this.get_collision_object(this.position.x,this.position.y);
	
	if (c===false) {
	    return false;
	}
	if (c === this) {
	    return false;
	}
	if (!c.alive) {
	    return false;
	}
	// Can't kill anyone for a while after spawning
	if (Date.now() - c.create_time < globals.safety_time) {
	    return false;
	}
	// Can't be killed by anyone for a while after spawning
	if (Date.now() - this.create_time < globals.safety_time) {
	    return false;
	}

	return c;
    }
    
    predict_position(steps) {

	let delta = {
	    x: 0,
	    y: 0,
	};
	
	switch (this.dir) {
	case constant.direction.right: 
	    delta.x = 1;
	    delta.y = 0;
	    break;
	case constant.direction.down: 
	    delta.x = 0;
	    delta.y = 1;
	    break;
	case constant.direction.left: 
	    delta.x = -1;
	    delta.y = 0;
	    break;
	case constant.direction.up: 
	    delta.x = 0;
	    delta.y = -1;
	    break;
	case constant.direction.stopped:
	    delta.x = 0;
	    delta.y = 0;
	    break;
	}
	
	let new_pos = {x: this.position.x + delta.x * steps,
		       y: this.position.y + delta.y * steps,
		      };
	
	return new_pos;
    }

    update_viewport_scale() {
	this.scale = 1 + Math.min(4,((this.size - globals.startsize) / 1000));
    }

    update_shade() {
	this.shade.h += this.shade_delta.h;
	if (this.shade.h > this.shade_max.h || this.shade.h < this.shade_min.h) {
	    this.shade_delta.h = 0 - this.shade_delta.h;
	}
	
	this.shade.l += this.shade_delta.l;
	if (this.shade.l > this.shade_max.l || this.shade.l < this.shade_min.l) {
	    this.shade_delta.l = 0 - this.shade_delta.l;
	}
	
	this.shade.s += this.shade_delta.s;
	if (this.shade.s > this.shade_max.s || this.shade.s < this.shade_min.s) {
	    this.shade_delta.s = 0 - this.shade_delta.s;
	}
    }

};
