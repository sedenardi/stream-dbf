stream-dbf
==========

A dBase DBF file parser that outputs a node stream.

`stream-dbf` uses the logic from abstractvector's [node-dbf](https://github.com/abstractvector/node-dbf) in a `Transform` stream. It's written in plain JavaScript.

    npm install stream-dbf

# Usage

Create a new instance of the parser by specifying the file path of the dBase file, and optionally any of the `options` flags (described below).

```js
var DBF = require('stream-dbf');
var parser = new DBF(fileName, [options]);
```

## options

* `parseTypes` - default: true - If false, integers and floats will be returned as strings.
* `recAsArray` - default: false - If true, stream will emit arrays instead objects (this slightly improve throughput).
* `encoding`   - default: "utf-8" - It is passed to the `iconv-lite` to decode the field names and values in order to support encodings like GBK etc.
* `lowercase`  - default: false - If true, the field names will be converted to lowercase.
* `withMeta`   - default: true - If true, each record will contain two meta fields named "@sequenceNumber" and "@deleted".

## parser.stream

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

## parser.header

Returns the header object, which contains information like the modified date, number of records, and a list of the fields and their types and lengths.

### parser.header.fields

Array object which contains information about fields.
Every item is an object with next fields: `name`, `type`, `displacement`, `length`,
`decimalPlaces`, `indexFlag`.

#### parser.header.fields.raw

If need, field value can be returned as raw buffer for custom parsing (e.g. convert encodings).
To enable this behavior you need set `raw` property to `true`:

```js
var DBF = require('stream-dbf');
var parser = new DBF(fileName, [options]);
parser.header.fields[1].raw = true;
```

## Array mode

If `recAsArray` option is enabled emitted arrays will have `parser.header.fields.length`+2 items.
Zero number item will be `sequenceNumber` and first item will be a deleted flag.

For searching field number by you can use `getFieldNo(name[, case_sensitivity])` function:
```js
var DBF = require('stream-dbf');
var parser = new DBF(fileName, {'recAsArray': true});
var idxName = parser.getFieldNo("Name");
parser.stream.on('data', function(record) {
  console.log("Name: " + record[idxName]);
});
```

