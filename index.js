var stream = require( 'stream' );
var fs = require( 'fs' );
var util = require( 'util' );
var events = require( 'events' );

var Parser = function( input, options ) {
  options = options || {};
  var self = this;
  this.parser = options.parser;
  this.parseTypes = ( typeof( options.parseTypes ) !== 'undefined' ) ? true : options.parseTypes;
  this.recordAsArray = ( typeof( options.recordAsArray ) !== 'undefined' ) ? false : options.recordAsArray;
  this.rawFieldValue = ( typeof( options.rawFieldValue ) !== 'undefined' ) ? false : options.rawFieldValue;

  this.inputStream = ( typeof( input ) === 'object' ) ? input : fs.createReadStream( input );
  this.stream = new stream.Transform( { objectMode: true } );
  this.header = {};

  var hLength, hNumRecs, hRecLen, hEndLoc;

  var sequenceNumber = 0;
  var byteReaded = 0;
  var buffer = new Buffer( 0 );

  function parseBuffer( stream, lBuffer ) {
    var buffPos = 0;
    var bLength = lBuffer.length;
    if ( byteReaded < 32 ) {
      self.header = self.parseHeader( lBuffer );
      hLength = self.header.headerLength;
      hNumRecs = self.header.numberOfRecords;
      hRecLen = self.header.recordLength;
      hEndLoc = hLength + hNumRecs * hRecLen;
      buffPos = byteReaded = 32;
    }
    if ( hLength ) {
      if ( byteReaded < hLength ) {
        var headerSize = hLength - 32;
        while ( buffPos < headerSize && ( buffPos + 32 ) <= bLength ) {
          self.header.fields.push( self.parseFieldSubRecord( lBuffer.slice( buffPos, buffPos += 32 ) ) );
        }
        if ( buffPos == hLength - 1 ) {
          byteReaded = ++buffPos;
        }
      } else {
        while ( byteReaded < hEndLoc && ( buffPos + hRecLen ) <= bLength ) {
          stream.push( self.parseRecord( ++sequenceNumber, lBuffer.slice( buffPos, buffPos += hRecLen ) ) );
          byteReaded += hRecLen;
        }
      }
    }
    return buffPos;
  }

  this.stream._transform = function( chunk, encoding, done ) {
    var buffPos;
    buffer = Buffer.concat( [ buffer, chunk ] );
    buffPos = parseBuffer( this, buffer );
    buffer = buffer.slice( buffPos, buffer.length );
    done();
  };

  this.stream._flush = function( done ) {
    if( buffer.length > 0 ) {
      parseBuffer( this, buffer );
    }
    done();
  };

  this.inputStream.pipe( this.stream );
};
util.inherits( Parser, events.EventEmitter );

Parser.prototype.getFieldNo = function( field_name, case_sensitivity ) {
  if ( !case_sensitivity ) {
    field_name = field_name.toLowerCase();
  }
  for ( var i = 0, n; i < this.fieldsCnt; i++ ) {
    n = this.header.fields[ i ].name;
    if ( !case_sensitivity ) {
      n = n.toLowerCase();
    }
    if ( field_name === n ) {
      return n + 2; // 2 service fields at beginning
    }
  }
  return -1;
};

Parser.prototype.parseRecord = function( sequenceNumber, buffer ) {
  var record = new Array( this.fieldsCnt + 2 );
  record[ 0 ] = sequenceNumber;
  record[ 1 ] = buffer[ 0 ] !== 32;

  var loc = 1;
  for ( var i = 0, field; field = this.header.fields[ i ]; i++ ) {
    record[ i + 2 ] = this.parseField( field, buffer.slice( loc, loc += field.length ) );
  }
  if ( !this.recordAsArray ) {
    var obj = {
      '@sequenceNumber': record[ 0 ],
      '@deleted': record[ 1 ]
    };
    for ( i = 0, field; field = this.header.fields[ i ]; i++ ) {
      obj[ field.name ] = record[ i + 2 ];
    }
    return obj;
  }
  return record;
};

Parser.prototype.parseField = function( field, buffer ) {
  var self = this;

  var startPos = 0;
  var endPos = buffer.length;
  while ( endPos > startPos && buffer[ endPos - 1 ] === 32 ) endPos--;
  while ( startPos < endPos && buffer[ startPos ] === 32 ) startPos++;
  buffer = buffer.slice( startPos, endPos );

  if( this.rawFieldValue ) {
    return buffer;
  }

  var value = this.parser ? this.parser( field, buffer ) : null;
  if ( !value ) {
    value = buffer.toString( 'utf-8' );
    if ( this.parseTypes && ( field.type === 'N' || field.type === 'F' ) ) {
      value = +value;
    }
  }

  return value;
};

Parser.prototype.parseHeader = function( data ) {
  return {
    'version': data.readUInt8( 0, true ),
    'dateUpdated': this.parseHeaderDate( data.slice( 1, 4 ) ),
    'numberOfRecords': data.readInt32LE( 4, true ),
    'headerLength': data.readInt16LE( 8, true ),
    'recordLength': data.readInt16LE( 10, true ),
    'fields': []
  };
};

Parser.prototype.parseHeaderDate = function( buffer ) {
  var day = buffer.readUInt8( 0, true ) + 1900;
  var month = buffer.readUInt8( 1, true ) - 1;
  var year = buffer.readUInt8( 2, true );
  return new Date( year, month, day );
};

Parser.prototype.parseFieldSubRecord = function( buffer ) {
  return {
    'name': buffer.toString( 'utf-8', 0, 11 ).replace( /\x00+$/, '' ),
    'type': buffer.toString( 'utf-8', 11, 12 ),
    'displacement': buffer.readInt32LE( 12, true ),
    'length': buffer.readUInt8( 16, true ),
    'decimalPlaces': buffer.readUInt8( 17, true ),
    'indexFlag': buffer.readUInt8( 31, true )
  };
};

module.exports = Parser;
