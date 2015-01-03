var stream = require('stream'),
    fs = require('fs'),
    util = require('util'),
    events = require('events');

var Parser = function(fileName) {
  var self = this;
  this.fileName = fileName;
  this.header = this.getHeader();

  var hStart = this.header.start,
      hNumRecs = this.header.numberOfRecords,
      hRecLen = this.header.recordLength,
      hEndLoc = hStart + hNumRecs * hRecLen;

  var sequenceNumber = 0;
  var loc = hStart;
  var bufLoc = hStart;
  var overflow = null;

  var fileStream = fs.createReadStream(this.fileName);
  fileStream.on('end', function() {
    self.emit('end');
  });
  fileStream.on('readable', function() {
    var buffer = fileStream.read();
    if (bufLoc !== hStart) {
      bufLoc = 0;
    }
    if (overflow !== null) {
      buffer = overflow + buffer;
    }

    while (loc < hEndLoc && (bufLoc + hRecLen) <= buffer.length) {
      var newRec = self.parseRecord(++sequenceNumber, buffer.slice(bufLoc, bufLoc += hRecLen));
      self.emit('record', newRec);
    }
    loc += bufLoc;
    if (bufLoc < buffer.length) {
      overflow = buffer.slice(bufLoc, buffer.length);
    } else {
      overflow = null;
    }
  });

  /*var transform = new stream.Transform({objectMode: true});
  transform._transform = function(chunk, encoding, done) {

  };*/
};

util.inherits(Parser, events.EventEmitter);

Parser.prototype.parseRecord = function(sequenceNumber, buffer) {
  var self = this;

  var record = {
    '@sequenceNumber': sequenceNumber,
    '@deleted': (buffer.slice(0, 1))[0] !== 32
  };
  var loc = 1;
  for (var i = 0; i < this.header.fields.length; i++) {
    record[this.header.fields[i].name] = 
      self.parseField(buffer.slice(loc, loc += this.header.fields[i].length));
  }
  return record;
};

Parser.prototype.parseField = function(buffer) {
  return (buffer.toString('utf-8')).replace(/^\x20+|\x20+$/g, '');
};

Parser.prototype.getHeader = function() {
  var data = fs.readFileSync(this.fileName);
  return this.parseHeader(data);
};

Parser.prototype.parseHeader = function(data) {
  var header = {};
  header.type = (data.slice(0, 1)).toString('utf-8');
  header.dateUpdated = this.parseHeaderDate(data.slice(1, 4));
  header.numberOfRecords = (data.slice(4, 8)).readInt32LE(0, true);
  header.start = (data.slice(8, 10)).readInt32LE(0, true);
  header.recordLength = (data.slice(10, 12)).readInt32LE(0, true);

  var fieldData = [];
  for (var i = 32; i <= header.start - 32; i += 32) {
    fieldData.push(data.slice(i, i + 32));
  }

  header.fields = fieldData.map(this.parseFieldSubRecord);
  return header;
}

Parser.prototype.parseHeaderDate = function(buffer) {
  var day, month, year;
  year = 1900 + (buffer.slice(0, 1)).readInt32LE(0, true);
  month = ((buffer.slice(1, 2)).readInt32LE(0, true)) - 1;
  day = (buffer.slice(2, 3)).readInt32LE(0, true);
  return new Date(year, month, day);
};

Parser.prototype.parseFieldSubRecord = function(buffer) {
  var field = {
    name: ((buffer.slice(0, 11)).toString('utf-8')).replace(/[\u0000]+$/, ''),
    type: (buffer.slice(11, 12)).toString('utf-8'),
    displacement: (buffer.slice(12, 16)).readInt32LE(0, true),
    length: (buffer.slice(16, 17)).readInt32LE(0, true),
    decimalPlaces: (buffer.slice(17, 18)).readInt32LE(0, true)
  };
  return field;
};

module.exports = Parser;