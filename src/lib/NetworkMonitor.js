const fs = require('fs');

module.exports = class NetworkMonitor {
    constructor(destination,key) {
	this.last_out_bytes = 0;
	this.last_out_packets = 0;
	this.last_in_bytes = 0;
	this.last_in_packets = 0;
	this.destination = destination;
	this.key = key;
    }

    run() {
	var self = this;
	
	fs.readFile('/proc/net/dev', function(err, data) {
	    if (err) {
		throw err;
	    }
	    let re = (/eth0: *(.+)/);
	    let file = data.toString();
	    let match = re.exec(file);
	    let matched_line = match[1];
	    let array = matched_line.split(/ +/);
	    let out_bytes = array[8];
	    let out_packets = array[9];
	    let in_bytes = array[0];
	    let in_packets = array[1];
	    
	    let rate_out_bytes = (out_bytes - self.last_out_bytes);
	    let rate_out_packets = (out_packets - self.last_out_packets);
	    let rate_in_bytes = (in_bytes - self.last_in_bytes);
	    let rate_in_packets = (in_packets - self.last_in_packets);
	    
	    self.store(`Out: ${rate_out_bytes.toFixed(2)} Bps ${rate_out_packets.toFixed(2)} pkt/sec In: ${rate_in_bytes.toFixed(2)} Bps ${rate_in_packets.toFixed(2)} pkt/sec`);
	    
	    self.last_out_bytes = out_bytes;
	    self.last_out_packets = out_packets;
	    self.last_in_bytes = in_bytes;
	    self.last_in_packets = in_packets;
	});
}
    store(status) {
	this.destination[this.key] = status;
    }

};
