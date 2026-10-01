const fs = require('fs');
let c = fs.readFileSync('public/index.html', 'utf8');

c = c.replace(/fetch\('\/api/g, "fetch(API_BASE_URL + '/api");
c = c.replace(/fetch\(`\/api/g, "fetch(API_BASE_URL + `/api");
c = c.replace(/const socket = io\(\);/g, "const socket = io(API_BASE_URL);");
c = c.replace(/const hlsUrl = `\/media\/live\//g, "const hlsUrl = `${API_BASE_URL}/media/live/");

// Add config block and dynamically load socket.io
const configBlock = `    <script>
        const API_BASE_URL = 'http://100.31.90.51:3000';
        document.write('<script src="' + API_BASE_URL + '/socket.io/socket.io.js"><\\/script>');
    </script>
    <script>`;

c = c.replace('<script src="/socket.io/socket.io.js"></script>\r\n    <script>', configBlock);
c = c.replace('<script src="/socket.io/socket.io.js"></script>\n    <script>', configBlock);

fs.writeFileSync('public/index.html', c);
