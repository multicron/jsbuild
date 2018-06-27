// jshint lastsemic: true
// jshint browser: true

const constant = require('constant.js');
const globals = require('globals.js');
const PowerUp = require('PowerUp.js');
const clock = require('clock.js');

// Player Constructor

module.exports = class Player {
    constructor() {
	this.id = undefined;
	this.name = undefined;
	this.is_robot = false;
	this.alive = 1;
	this.create_time = clock.time;
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
	this.powerups = [];
	this.direction_change_queue = [];
	this.killed_by = undefined;
    }

    get score() {
    	return Math.floor(this.cells.length * 100  + (clock.time - this.create_time)/1000);
    }

    get pending_score() {
	return Math.floor((this.size - this.cells.length) * 100);
    }

    queue_direction_change(new_dir) {
	this.direction_change_queue.push(new_dir);
    }

    change_direction() {
	let old_dir = this.dir;
	let new_dir = this.direction_change_queue.shift();

	if (old_dir == new_dir) {
	    // Do nothing
	}
	else if ((old_dir!=constant.direction.left && old_dir!=constant.direction.right) && (new_dir==constant.direction.left || new_dir==constant.direction.right)) {
	    this.dir = new_dir;
	}
	else if ((old_dir!=constant.direction.up && old_dir!=constant.direction.down) && (new_dir==constant.direction.up || new_dir==constant.direction.down)) {
	    this.dir = new_dir;
	}
    }

    get_collision_object(x,y) {
	if (x < 0 || 
	    y < 0 || 
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
	else {
	    this.change_direction();
	}

	// Change the position of the head
	this.move();

	// See if we bumped into anything

	if (this.check_edge_death()) {
	    this.alive = 0;
	}
	else {
	    let hit_object = this.check_collision();

	    // hit_object is false if no collision

	    if (hit_object) {
		if (hit_object instanceof PowerUp) {
		    this.award_powerup(hit_object);
		    hit_object.alive = 0;
		}
		else if (hit_object instanceof Player) {
		    this.award_collision(hit_object);
		    this.alive = 0;
		}
		else {
		}
	    }
	}

	if (this.alive) {
	    // Update all_cells with new position of head
	    global.all_cells[this.position.x][this.position.y] = this;

	    this.shift_player();
	}
    }
    
    award_collision(killer) {
	this.killed_by = killer.name;

	let awarded = Math.max(0,this.cells.length - 90);
	
	if (awarded > 0) {
	    killer.size += awarded;
	}
	if (killer.powerups.some((powerup) => powerup.type === constant.powerup.multiplier)) {
	    killer.size += awarded;
	}

	this.size = 1;
    }

    award_powerup(powerup) {
	powerup.set_end_time(30000);
	this.powerups.push(powerup);
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
	
	if (c === undefined) {
	    return false;
	}
	if (c === 0) {
	    return false;
	}
	if (c === this) {
	    return false;
	}
	if (!c.alive) {
	    return false;
	}
	// Can't kill anyone for a while after spawning
	if (clock.time - this.create_time < globals.safety_time) {
	    return false;
	}
	// Can't be killed by anyone for a while after spawning
	if (clock.time - this.create_time < globals.safety_time) {
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

    get_powerup_time_left(powerup_type) {
	let now = clock.time;
	let pups = this.powerups.filter((p) => p.type===powerup_type);
	let times = pups.map((p) => (p.end_time - now) / 1000);
	times.push(0); // default value
	return Math.max.apply(null,times);
    }

    update_viewport_scale() {
	this.scale = 1.0 + Math.min(4,((this.size - globals.startsize) / 10000));

	if (this.scale <= 4 && this.powerups.some((powerup) => powerup.type === constant.powerup.scale) > 0) {
	    this.scale = this.scale + 0.25;
	}
    }

    get_name_size() {
	let scale = 1 + Math.min(5,((this.size - globals.startsize) / 10000));
	return Math.floor(13 * scale);
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
