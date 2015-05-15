var DBF = require( '../index.js' );
var iconv = require( 'iconv-lite' ); // npm install iconv-lite

var dbfOptions = {
  parseTypes: true,
  recordAsArray: false,
  rawFieldValue: false,
  parser: function( field, buf ) {
    return field.type == 'C' ? iconv.decode( buf, 'cp866' ) : null;
  }
};

var parser = new DBF( 'kladr.dbf', dbfOptions );
var data = [];
parser.stream.on( 'data', function( record ) {
  data.push( record );
} );
parser.stream.on( 'end', function() {
  console.log( JSON.stringify( data, null, 2 ) );
} );
