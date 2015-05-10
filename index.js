var stream = require('stream'),
    fs = require('fs'),
    util = require('util'),
    events = require('events');

var Parser = function(fileName, options) {
  var self = this;
  this.fileName = fileName;
  this.header = this.getHeader();
  this.parseTypes = true;

  if (options) {
    if (typeof options.parseTypes !== 'undefined')
      this.parseTypes = options.parseTypes;
  }

  var hStart = this.header.headerLength,
      hNumRecs = this.header.numberOfRecords,
      hRecLen = this.header.recordLength,
      hEndLoc = hStart + hNumRecs * hRecLen;

  var sequenceNumber = 0;
  var loc = hStart;
  var bufLoc = hStart;
  var overflow = null;

  this.stream = new stream.Transform({objectMode: true});
  this.stream._transform = function(chunk, encoding, done) {
    var buffer = chunk;
    if (bufLoc !== hStart) {
      bufLoc = 0;
    }
    if (overflow !== null) {
      buffer = Buffer.concat([overflow,buffer]);
    }

    while (loc < hEndLoc && (bufLoc + hRecLen) <= buffer.length) {
      var newRec = self.parseRecord(++sequenceNumber, buffer.slice(bufLoc, bufLoc += hRecLen));
      this.push(newRec);
    }
    loc += bufLoc;
    if (bufLoc < buffer.length) {
      overflow = buffer.slice(bufLoc, buffer.length);
    } else {
      overflow = null;
    }
    done();
  };

  fs.createReadStream(this.fileName).pipe(this.stream);
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
    (function(field){
      record[field.name] = self.parseField(field, buffer.slice(loc, loc += field.length));
    })(this.header.fields[i]);
  }
  return record;
};

Parser.prototype.parseField = function(field, buffer) {
  var data = buffer.toString('utf-8').replace(/^\x20+|\x20+$/g, '');

  if (this.parseTypes) {
    if (field.type === 'N' || field.type === 'F') data = Number(data);
  }

  return data;
};


Parser.prototype.getHeader = function() {
  var fd = fs.openSync( this.fileName, 'r' )
    , buff = new Buffer( 32 )
    , header;
  fs.readSync( fd, buff, 0, 32, 0 );
  header = this.parseBaseHeader( buff );
  buff = new Buffer( header.headerLength );
  fs.readSync( fd, buff, 0, header.headerLength, 0 );
  this.parseFieldsHeader( header, buff );
  fs.closeSync( fd );
  return header;
};

Parser.prototype.parseBaseHeader = function(data) {
  var header = {
    'version'        : data.readUInt8  (  0, true ),
    'dateUpdated'    : this.parseHeaderDate( data.slice(1, 4) ),
    'numberOfRecords': data.readInt32LE(  4, true ),
    'headerLength'   : data.readInt16LE(  8, true ),
    'recordLength'   : data.readInt16LE( 10, true ),
    'fields'         : []
  };
  return header;
};

Parser.prototype.parseFieldsHeader = function(header, data) {
  var fieldData = [];
  for (var i = 32; i <= header.headerLength-32; i += 32) {
    fieldData.push( data.slice(i, i + 32) );
  }

  header.fields = fieldData.map(this.parseFieldSubRecord);
};

Parser.prototype.parseHeaderDate = function(buffer) {
  var day   = buffer.readUInt8( 0, true ) + 1900
    , month = buffer.readUInt8( 1, true ) - 1
    , year  = buffer.readUInt8( 2, true );
  return new Date( year, month, day );
};

Parser.prototype.parseFieldSubRecord = function(buffer) {
  var field = {
    'name'         : buffer.toString( 'utf-8',  0, 11 ).replace( /\u0000+$/, '' ),
    'type'         : buffer.toString( 'utf-8', 11, 12 ),
    'displacement' : buffer.readInt32LE( 12, true ),
    'length'       : buffer.readUInt8( 16, true ),
    'decimalPlaces': buffer.readUInt8( 17, true ),
    'indexFlag'    : buffer.readUInt8( 31, true )
  };
  return field;
};

module.exports = Parser;