import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? 3000);
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (request.url === '/api/health' && request.method === 'GET') {
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  response.writeHead(404).end(JSON.stringify({ error: 'not_found' }));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`API http://127.0.0.1:${server.address().port}`);
});
