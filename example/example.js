var fs = require( 'fs' );
var DBF = require( '../index.js' );
var iconv;

var use_iconv = true;

if ( use_iconv ) {
  iconv = require( 'iconv-lite' );
}

var options = {
  parseTypes: true,
  recAsArray: true,
  decoder: use_iconv ? function( buf ) { return iconv.decode( buf, 'cp866' ); } : null
};

var inputStream = fs.createReadStream( './kladr.dbf' );
var parse = new DBF( inputStream, options );
var data = [];

parse.stream.on( 'data', function( record ) {
  if ( data.length < 10 ) {
    data.push( record );
  }
} );

parse.stream.on( 'end', function() {
  console.log( JSON.stringify( data, null, 2 ) );
} );
