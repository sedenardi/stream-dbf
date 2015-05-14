var stream = require( 'stream' );
var fs = require( 'fs' );
var util = require( 'util' );
var events = require( 'events' );

var Parser = function( input, options ) {
  options = options || {};
  var self = this;
  this.inputStream = ( typeof( input ) === 'object' ) ? input : fs.createReadStream( input );
  this.decoder = options.decoder;
  this.parseTypes = ( typeof( options.parseTypes ) !== 'undefined' ) ? true : options.parseTypes;

  this.stream = new stream.Transform( { objectMode: true } );
  this.header = {};

  var hStart, hNumRecs, hRecLen, hEndLoc;

  var sequenceNumber = 0;
  var loc = 0;
  var bufLoc = 0;
  var overflow = null;

  this.stream._transform = function( chunk, encoding, done ) {
    var buffer = chunk;
    if ( overflow !== null ) {
      buffer = Buffer.concat( [ overflow, buffer ] );
    }
    if ( loc < 32 ) {
      self.header = self.parseHeader( buffer );
      hStart = self.header.start;
      hNumRecs = self.header.numberOfRecords;
      hRecLen = self.header.recordLength;
      hEndLoc = hStart + hNumRecs * hRecLen;
      bufLoc = 32;
    }
    if ( hStart ) {
      if ( loc < hStart && bufLoc < hStart ) {
        while ( bufLoc < ( hStart - 32 ) && ( bufLoc + 32 ) <= buffer.length ) {
          self.header.fields.push( self.parseFieldSubRecord( buffer.slice( bufLoc, bufLoc += 32 ) ) );
        }
        if ( bufLoc == hStart - 1 ) {
          bufLoc = hStart;
        }
      } else {
        while ( loc < hEndLoc && ( bufLoc + hRecLen ) <= buffer.length ) {
          this.push( self.parseRecord( ++sequenceNumber, buffer.slice( bufLoc, bufLoc += hRecLen ) ) );
        }
      }
      overflow = ( bufLoc < buffer.length ) ? buffer.slice( bufLoc, buffer.length ) : null;
    }
    loc += bufLoc;
    bufLoc = 0;
    done();
  };

  this.inputStream.pipe( this.stream );
};
util.inherits( Parser, events.EventEmitter );

Parser.prototype.parseRecord = function( sequenceNumber, buffer ) {
  var self = this;

  var record = {
    '@sequenceNumber': sequenceNumber,
    '@deleted': ( buffer.slice( 0, 1 ) )[ 0 ] !== 32
  };
  var loc = 1;
  for ( var i = 0; i < this.header.fields.length; i++ ) {
    ( function( field ) {
      record[ field.name ] = self.parseField( field, buffer.slice( loc, loc += field.length ) );
    } )( this.header.fields[ i ] );
  }
  return record;
};

Parser.prototype.parseField = function( field, buffer ) {
  var self = this;

  function bufferToString( useDecoder ) {
    var t = useDecoder ? self.decoder( buffer ) : buffer.toString( 'utf-8' );
    return t.replace( /^\x20+|\x20+$/g, '' );
  }

  if ( this.parseTypes && ( field.type === 'N' || field.type === 'F' ) ) {
    return Number( bufferToString() );
  }
  if ( this.decoder && field.type === 'C' ) {
    return bufferToString( true );
  }

  return bufferToString();
};

Parser.prototype.parseHeader = function( data ) {
  var header = {};
  header.type = ( data.slice( 0, 1 ) ).toString( 'utf-8' );
  header.dateUpdated = this.parseHeaderDate( data.slice( 1, 4 ) );
  header.numberOfRecords = ( data.slice( 4, 8 ) ).readInt32LE( 0, true );
  header.start = ( data.slice( 8, 10 ) ).readInt32LE( 0, true );
  header.recordLength = ( data.slice( 10, 12 ) ).readInt32LE( 0, true );
  header.fields = [];
  return header;
};

Parser.prototype.parseHeaderDate = function( buffer ) {
  var day, month, year;
  year = 1900 + ( buffer.slice( 0, 1 ) ).readInt32LE( 0, true );
  month = ( ( buffer.slice( 1, 2 ) ).readInt32LE( 0, true ) ) - 1;
  day = ( buffer.slice( 2, 3 ) ).readInt32LE( 0, true );
  return new Date( year, month, day );
};

Parser.prototype.parseFieldSubRecord = function( buffer ) {
  return {
    name: ( ( buffer.slice( 0, 11 ) ).toString( 'utf-8' )).replace( /[\u0000]+$/, '' ),
    type: ( buffer.slice( 11, 12 ) ).toString( 'utf-8' ),
    displacement: ( buffer.slice( 12, 16 ) ).readInt32LE( 0, true ),
    length: ( buffer.slice( 16, 17 ) ).readInt32LE( 0, true ),
    decimalPlaces: ( buffer.slice( 17, 18 ) ).readInt32LE( 0, true )
  };
};

module.exports = Parser;
