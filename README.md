stream-dbf
==========

A dBase DBF file parser that outputs a node stream.

`stream-dbf` uses the logic from abstractvector's [node-dbf](https://github.com/abstractvector/node-dbf) in a `Transform` stream. It's written in plain javascript and has no dependencies.

    npm install stream-dbf

#Usage

Create a new instance of the parser by specifying the file path of the dBase file, and optionally any of the `options` flags (described below).

```js
var DBF = require('stream-dbf');
var parser = new DBF(fileName, [options]);
```

or

```js
var fs = require('fs');
var DBF = require('stream-dbf');
var file = fs.createReadStream(filename);
var parser = new DBF(file, [options]);
```


##options

* `parseTypes` - default: true - If false, integers and floats will be returned as strings.
* `recordAsArray` - default: false - If true, stream will emit arrays instead objects (this slightly improve throughput).
* `rawFieldValue` - default: false - If true, field value returned as raw buffer for custom parsing.
* `parser` - default: null - function like `function( field, buffer )` for custom parsing field values. Function must return parsed value or null, if returned null, then be used standard parser. If `rawFieldValue` option is set, then parser not used!

##parser.stream

Attach standard stream listeners to this object to access the records.

```js
var stream = parser.stream;
stream.on('readable', function() {
  var record = stream.read();
  // do something with the record
});
stream.on('end', function() {
  console.log('finished');
});
```

You can also use the stream in [flowing mode](http://nodejs.org/api/stream.html#stream_event_data) by attaching a `data` event listener.

```js
var stream = parser.stream;
stream.on('data', function(record) {
  // do something with the record
});
stream.on('end', function() {
  console.log('finished');
});
```

Lastly, you can also pipe the stream like you would any other readable stream.

```js
var stream = parser.stream;
var writableStream = somehowGetWritableStream();
stream.pipe(writableStream);
```

##parser.header

Returns the header object, which contains information like the modified date, number of records, and a list of the fields and their types and lengths.

###parser.header.fields

Array object which contains information about fields.
Every item is an object with next fields: `name`, `type`, `displacement`, `length`,
`decimalPlaces`, `indexFlag`.

##Array mode

If `recordAsArray` option is enabled emitted arrays will have `parser.header.fields.length`+2 items.
Zero number item will be `sequenceNumber` and first item will be a deleted flag.

For searching field number by you can use `getFieldNo(name[, case_sensitivity])` function:
```js
var DBF = require('stream-dbf');
var parser = new DBF(fileName, {'recordAsArray': true});
var idxName = parser.getFieldNo("Name");
parser.stream.on('data', function(record) {
  console.log("Name: " + record[idxName]);
});
```

##Custom parser

If `parser` option is function, it will used for parse field value.

```js
var DBF = require( 'stream-dbf' );
var fs = require( 'fs' );
var file = fs.createReadStream( filename );

function valueParse( field, buffer ) {
  return field.type == 'C' ? decode( buffer, 'cp866' ) : null;
};

var parser = new DBF( file, { parser: valueParse } );
var data = [];

parser.stream.on( 'data', function( record ) {
  data.push( record );
} );
parser.stream.on( 'data', function( record ) {
  console.log( JSON.stringify( data, null, 2 ) );
} );
```
