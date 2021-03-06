/* vim: set expandtab tabstop=2 shiftwidth=2: */
// Load the http module to create an http server.
var geoip = require('geoip'),
    path = require('path'),
    http = require('http'),
    url = require('url');

// Command line options
var args = require('optimist')
    .options('port', {
        default: 9042,
        alias: 'p'
    }).describe('port', 'port to run the server on')
    .options('geodb', {
        default: './GeoLiteCity.dat',
        alias: 'g'
    }).describe('geodb', 'path to the GeoLiteCity database from MaxMind')
    .options('help', {
        default: false,
        alias: 'h'
    }).describe('help', 'this help message')
    .alias('help', '?')
    .usage("Usage: $0");
var argv = args.argv;

if (argv.help) {
  args.showHelp();
  process.exit(0);
}

// Can we open the geo database?
if (! path.existsSync(argv.geodb)) {
  console.error("The geodb file doesn't exist: %s", argv.geodb);  
  process.exit(1);
}
try {
  var city = new geoip.City(argv.geodb); 
} catch(e) {
  console.error("Error loading the geodb file: %s", e);
  console.trace(e);
  process.exit(1);
}

function getIp(request) {
  var get = url.parse(request.url, true).query;
  if (get.ip) {
    return get.ip;
  } else if (request.headers['x-forwarded-for']) {
    // http://en.wikipedia.org/wiki/X-Forwarded-For 
    // Pull the first one out of the list 
    return request.headers['x-forwarded-for'].split(',')[0];
  } else {
    return request.connection.remoteAddress; 
  }
}

function formatResult(request, lookup) {
  var get = url.parse(request.url, true).query,
      indent = parseInt(get.indent, 10) || 0,
      json = JSON.stringify(lookup, null, indent);
  if (get.callback) {
    /// Simple XSS protection
    var callback = get.callback.replace(/[^A-Za-z.\_$]/, '_');
    return callback + '(' + json + ')';
  } else {
    return json;
  }
}

// Configure our HTTP server to respond
var server = http.createServer(function (request, response) {
  var ip = getIp(request);
  city.lookup(ip, function(err, data) {
    if (err) {
      console.error("lookup failed for ", ip, err);
      response.writeHead(200, {"Content-Type": "text/javascript"});
      response.end(formatResult(request, {}));
    } else if (data) {
      console.log("lookup worked for ip", ip);
      response.writeHead(200, {"Content-Type": "text/javascript"});
      response.end(formatResult(request, data));
    }
  });
});

server.listen(argv.port);

// Put a friendly message on the terminal
console.log("Server running at http://127.0.0.1:%s/, using %s", argv.port, argv.geodb);
