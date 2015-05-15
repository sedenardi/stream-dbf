var fs = require( 'fs' );
var DBF = require( '../index.js' );
var iconv;

var use_iconv = true;

if ( use_iconv ) {
  iconv = require( 'iconv-lite' );
}

var options = {
  parseTypes: true,
  recordAsArray: false,
  rawFieldValue: false,
  parser: use_iconv ? function( field, buf ) { return field.type == 'C' ? iconv.decode( buf, 'cp866' ) : null; } : null
};

var inputStream = fs.createReadStream( './kladr.dbf' );
var parser = new DBF( inputStream, options );
var data = [];
var r = 0;

parser.stream.on( 'data', function( record ) {
  //console.log( parser.header.numberOfRecords - r++ );
  if ( data.length < 10 ) {
    data.push( record );
  }
} );

parser.stream.on( 'end', function() {
  console.log( JSON.stringify( data, null, 2 ) );
} );
