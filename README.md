stream-dbf
==========

A dBase DBF file parser that outputs a node stream.

`stream-dbf` uses the logic from abstractvector's [node-dbf](https://github.com/abstractvector/node-dbf) in a `Transform` stream. It's written in plain javascript and has no dependencies.

    npm install stream-dbf

#Usage

Create a new instance of the parser by specifying the file path of the dBase file, and optionally any of the `options` flags (described below).

    var DBF = require('stream-dbf');

    var parser = new DBF(fileName, [options]);

##options

* `parseTypes` - default: true - If false, integers and floats will be returned as strings.

##parser.stream

Attach standard stream listeners to this object to access the records.

    var stream = parser.stream;
    stream.on('readable', function() {
      var record = stream.read();
      // do something with the record
    });
    stream.on('end', function() {
      console.log('finished');
    });

You can also use the stream in [flowing mode](http://nodejs.org/api/stream.html#stream_event_data) by attaching a `data` event listener.

    var stream = parser.stream;
    stream.on('data', function(record) {
      // do something with the record
    });
    stream.on('end', function() {
      console.log('finished');
    });

Lastly, you can also pipe the stream like you would any other readable stream.

    var stream = parser.stream;
    var writableStream = somehowGetWritableStream();
    stream.pipe(writableStream);

##parser.header

Returns the header object, which contains information like the modified date, number of records, and a list of the fields and their types and lengths.