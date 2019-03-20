var stream = require('stream'),
    fs = require('fs'),
    util = require('util'),
    iconv = require('iconv-lite'),
    events = require('events');

var Parser = function(fileName, options) {
  var self = this;
  this.fileName   = fileName;
  this._fd        = 0;
  this.parseTypes = true;
  this.recAsArray = false;
  this.encoding   = 'utf-8';
  this.lowercase  = false; // lowercase the field names or not
  this.withMeta   = true;

  if (options) {
    if ( options.parseTypes != undefined )
      this.parseTypes = options.parseTypes;
    if ( options.recAsArray != undefined )
      this.recAsArray = options.recAsArray;
    if ( options.encoding != undefined )
      this.encoding = options.encoding;
    if ( options.lowercase != undefined )
      this.lowercase = options.lowercase;
    if ( options.withMeta != undefined )
      this.withMeta = options.withMeta;
  }

  this.header     = this.getHeader();
  this.fieldsCnt  = this.header.fields.length;


  var hNumRecs  = this.header.numberOfRecords,
      hRecLen   = this.header.recordLength,
      hDataSize = hNumRecs * hRecLen;

  var seqNumber  = 0,
      skipBytes  = this.header.headerLength,
      byteReaded = 0,
      buffer     = new Buffer(0);

  var pushRecords = function pushRecords( stream, buffer, buff_offset ) {
    var buffPos = buff_offset,
        buffLen = buffer.length,
        rec;
    
    while ( byteReaded<hDataSize && (buffPos+hRecLen)<=buffLen ) {
      if( self.recAsArray ) {
        rec = self.parseRecordToArray(
                ++seqNumber,
                buffer.slice( buffPos, buffPos+hRecLen )
        );
      }
      else {
        rec = self.parseRecordToObject(
                ++seqNumber,
                buffer.slice( buffPos, buffPos+hRecLen )
        );
      }
      buffPos += hRecLen;
      byteReaded += hRecLen;
      stream.push( rec );
    }
    return buffPos;
  };
  
  this.stream = new stream.Transform({ 'objectMode': true });
  this.stream._transform = function( chunk, encoding, done ) {
    var buffPos = 0;
    buffer  = Buffer.concat([ buffer, chunk ]);
    
    buffPos = pushRecords( this, buffer, buffPos );
    buffer = buffer.slice( buffPos, buffer.length );
    done();
  };
  this.stream._flush = function( done ) {
    if( buffer.length > 0 ) {
      pushRecords( this, buffer, 0 );
    }
    done();
  };

  fs.createReadStream(this.fileName, {'start': skipBytes, 'fd': this._fd})
    .pipe(this.stream);
};

util.inherits(Parser, events.EventEmitter);

Parser.prototype.getFieldNo = function( field_name, case_sensitivity ) {
  if( ! case_sensitivity ) {
    field_name = field_name.toLowerCase();
  }
  for( var i=0, n; i<this.fieldsCnt; i++ ) {
    n = this.header.fields[i].name;
    if( ! case_sensitivity ) {
      n = n.toLowerCase();
    }
    if( field_name === n ) {
      return i+2; // 2 service fields at beginning
    }
  }
  return -1;
};

function isValidType(type) {
  return type !== 0 && type !== '0' && type !== '\u0000';
}
Parser.prototype.parseRecordToObject = function(sequenceNumber, buffer) {
  var record = this.withMeta ? {
    '@sequenceNumber': sequenceNumber,
    '@deleted'       : buffer[0] !== 32
  } : {};
  for ( var i=0, pos=1, fld; i < this.fieldsCnt; i++ ) {
    fld = this.header.fields[i];
    if (isValidType(fld.type)) {
      record[fld.name] = this.parseField( fld, buffer.slice(pos, pos+fld.length) );
      pos += fld.length;
    }
  }
  return record;
};

Parser.prototype.parseRecordToArray = function(sequenceNumber, buffer) {
  var record = new Array( this.fieldsCnt+2 );
  record[0] = sequenceNumber;
  record[1] = buffer[0] !== 32;
  for ( var i=0, pos=1, fld; i < this.fieldsCnt; i++ ) {
    fld = this.header.fields[i];
    record[i+2] = this.parseField( fld, buffer.slice(pos, pos+fld.length) );
    pos += fld.length;
  }
  return record;
};

Parser.prototype.parseField = function(field, buffer) {
  var st  = 0,
      end = buffer.length;
  while( end>st && buffer[end-1]===32 ) end--;
  while( st<end && buffer[st   ]===32 ) st++;
  
  if( field.raw ) {
        return buffer.slice( st, end );
  }

  var data = iconv.decode(buffer.slice(st, end), this.encoding);
  if ( this.parseTypes ) {
    if ( field.type==='N' || field.type==='F' ) {
      data = Number( data );
    }
  }

  return data;
};


Parser.prototype.getHeader = function() {
  var buff = new Buffer( 32 ),
      header;
  this._fd = fs.openSync( this.fileName, 'r' );
  fs.readSync( this._fd, buff, 0, 32, 0 );
  header = this.parseBaseHeader( buff );
  buff = new Buffer( header.headerLength );
  fs.readSync( this._fd, buff, 0, header.headerLength, 0 );
  this.parseFieldsHeader( header, buff );
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

  var func = this.parseFieldSubRecord.bind(this);
  header.fields = fieldData.map(func);
};

Parser.prototype.parseHeaderDate = function(buffer) {
  var day   = buffer.readUInt8( 0, true ) + 1900,
      month = buffer.readUInt8( 1, true ) - 1,
      year  = buffer.readUInt8( 2, true );
  return new Date( year, month, day );
};

Parser.prototype.parseFieldSubRecord = function(buffer) {
  var fieldName = iconv.decode(buffer.slice(0, 11), this.encoding).replace( /\x00+$/, '' );
  if (this.lowercase) {
    fieldName = fieldName.toLowerCase();
  }
  var field = {
    'name'         : fieldName,
    'type'         : buffer.toString( 'utf-8', 11, 12 ), // use ASCII or UTF-8
    'displacement' : buffer.readInt32LE( 12, true ),
    'length'       : buffer.readUInt8( 16, true ),
    'decimalPlaces': buffer.readUInt8( 17, true ),
    'indexFlag'    : buffer.readUInt8( 31, true )
  };
  return field;
};

module.exports = Parser;
