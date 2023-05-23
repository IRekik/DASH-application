const http = require('http');
const multiparty = require('multiparty');
const path = require('path');

const uploadDir = path.join(__dirname, '/files');

const logs =[];

const server = http.createServer((request, response) => {
  // allow Cross-Origin Resource Sharing (CORS) 
  response.setHeader('Access-Control-Allow-Origin', '*');
  if (request.method === 'POST') {
    let form = new multiparty.Form({ uploadDir: uploadDir });
    form.parse(request, (err, fields, files) => {
      if (err) {
        console.error('Error parsing form data:', err);
        response.writeHead(500);
        response.end();
      } else {
        // Handle the form data here
        console.log('Received form data:', fields, files);
        // Adding file to logs
        const text = JSON.stringify(files);
        logs.push(text);
        // Send a response
        response.writeHead(200, {'ok': 'text/plain'});
        response.end('Form data received');
      }
    });
  }  else {
    // Return a 404 error for all other requests
    response.writeHead(404);
    response.end();
  }
});

server.listen(8000, () => {
  console.log('Server listening on port 8000');
});

process.on('SIGINT', function() {
  console.log("Caught interrupt signal");
  console.log("Here is the list of files that have been transfered throughout the life of the server:");
  console.log(logs);
  process.exit(0);
});