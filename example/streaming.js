var DBF = require( '../index.js' );
var url = require( 'url' );
var http = require( 'http' );
var unzip = require( 'unzip' ); // npm install unzip
var iconv = require( 'iconv-lite' ); // npm install iconv-lite

function getDateString() {
  var d = new Date();
  return ( ( '0' + d.getDate() ).slice( -2 ) + ( '0' + ( d.getMonth() + 1 ) ).slice( -2 ) + d.getFullYear() )
}

var dbfOptions = {
  parseTypes: true,
  recordAsArray: false,
  rawFieldValue: false,
  fieldValueParser: function( field, buf ) {
    return field.type == 'C' ? iconv.decode( buf, 'cp866' ) : null;
  }
};

var dbURL = 'http://www.cbr.ru/mcirabis/BIK/bik_db_' + getDateString()  + '.zip';

var httpOptions = {
  host: url.parse( dbURL ).host,
  port: 80,
  path: url.parse( dbURL ).pathname
};

http.get( httpOptions, function( res ) {
  res
    .pipe( unzip.Parse() )
    .on( 'entry', function( entry ) {
      if ( entry.path == 'bnkseek.dbf' ) {
        var parser = new DBF( entry, dbfOptions );
        var data = [];
        parser.stream.on( 'data', function( record ) {
          data.push( record );
        } );
        parser.stream.on( 'end', function() {
          console.log( JSON.stringify( data, null, 2 ) );
        } );
      } else {
        entry.autodrain();
      }
    } );
} );
