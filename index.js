'use strict';

var util = require('util');
var stream = require('stream');
var lifx = require('lifx');
//lifx.setDebug(true);

util.inherits(Driver, stream);
util.inherits(Bulb, stream);
module.exports = Driver;

function Driver(opts,app) {
  var self = this;

  this._app = app;
  this._opts = opts;
  this._opts.stations = opts.stations || [];

  var devices = {};

  app.once('client::up', function() {
    self.log.info('Firing up!');
    var lx = lifx.init();

    lx.on('bulb', function(bulb) {
      self.log.info('New bulb found: ', bulb);

      var device  = new Bulb(bulb, lx);
      if (!devices[device.G]) {
        self.log.info('Registering bulb');
        devices[device.G] = device;

        self.emit('register', device);
      }
    });
  });
}

function Bulb(bulb, lx) {

  var self = this;

  this.lx = lx;
  this.bulb = bulb;

  this.writeable = true;
  this.readable = true;
  this.V = 0;
  this.D = 1008;
  this.G = 'Lifx' + bulb.lifxAddress.toString('hex');
  this.name = 'Lifx - ' + (bulb.name||'(No Name)');

  this.lx.on('packet', function(p) {
    if (p.preamble.bulbAddress.toString('hex') === this.bulb.lifxAddress.toString('hex')) {

      if (p.packetTypeShortName == 'lightStatus') {

        if (this.log) this.log.trace('Light status', p);

        this.emit('data', {
          hue: p.payload.hue,
          sat: p.payload.saturation / 256,
          bri: p.payload.brightness / 256,
          on: p.payload.power > 0
        });
      }
    }
  }.bind(this));

}

Bulb.prototype.write = function(data) {
  if (typeof data === 'string') {
    data = JSON.parse(data);
  }

  if (!data.on) {
    this.lx.lightsOff(this.bulb);
  }

  this.lx.lightsColour(data.hue, data.sat*256, data.bri*256, 0x0dac/*TODO*/, data.transitiontime||200, this.bulb);

  if (data.on) {
    this.lx.lightsOn(this.bulb);
  }
};

