import http from 'node:http';

const port = Number(process.argv[2] || 54327);
let sequence = 0;
const runId = `${Date.now()}_${process.pid}`;
let scenario = { createStatus: 'pending', confirmStatus: 'pending', httpStatus: 200 };
const orders = new Map();
const requests = [];
const customers = new Map();

function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);

  if (request.method === 'POST' && url.pathname === '/__scenario') {
    scenario = { ...scenario, ...(await readJson(request)) };
    return send(response, 200, scenario);
  }
  if (request.method === 'POST' && url.pathname === '/__order-status') {
    const body = await readJson(request);
    const order = orders.get(String(body.id));
    if (!order) return send(response, 404, { error: 'not_found' });
    order.confirmStatus = String(body.status);
    return send(response, 200, order);
  }
  if (request.method === 'GET' && url.pathname === '/__requests') {
    return send(response, 200, requests);
  }
  if (request.method === 'POST' && url.pathname === '/customers') {
    const body = await readJson(request);
    requests.push({ method: 'POST', path: '/customers', body });
    if (!body.document || !body.address?.zip_code) return send(response, 400, { error: 'invalid_customer' });
    const id = `cus_mock_${body.code}`;
    customers.set(id, body);
    return send(response, 200, { id });
  }
  const cardMatch = url.pathname.match(/^\/customers\/([^/]+)\/cards$/);
  if (request.method === 'POST' && cardMatch) {
    const body = await readJson(request);
    requests.push({ method: 'POST', path: url.pathname, body });
    if (!customers.has(cardMatch[1]) || !body.token || !body.billing_address?.zip_code || body.number || body.cvv) return send(response, 400, { error: 'invalid_card' });
    return send(response, 200, { id: `card_mock_${cardMatch[1]}` });
  }
  if (request.method === 'POST' && url.pathname === '/orders') {
    const body = await readJson(request);
    requests.push({ method: 'POST', path: '/orders', body });
    if (!/^\d{11}$/.test((body.customer || customers.get(body.customer_id))?.document || '')) {
      return send(response, 400, { errors: [{ message: 'The customer Document is required.' }] });
    }
    if (body.payments?.[0]?.payment_method === 'credit_card' &&
        (!body.customer_id || !body.payments[0].credit_card?.card_id || body.payments[0].credit_card?.card_token || !body.payments[0].credit_card?.billing_address?.zip_code)) {
      return send(response, 400, { error: 'PSP_requires_customer_card_and_billing_address' });
    }
    if (Number(scenario.httpStatus) !== 200) {
      return send(response, Number(scenario.httpStatus), { errors: [{ message: 'mock failure' }] });
    }
    sequence += 1;
    const id = `or_mock_${runId}_${sequence}`;
    const chargeId = `ch_mock_${runId}_${sequence}`;
    const order = {
      id,
      code: body.code,
      status: scenario.createStatus,
      confirmStatus: scenario.confirmStatus,
      created_at: '2026-09-15T02:30:00.000Z',
      updated_at: '2026-09-15T02:30:00.000Z',
      charges: [{
        id: chargeId,
        status: scenario.createStatus,
        last_transaction: {
          qr_code: `000201-mock-${sequence}`,
          qr_code_url: `https://mock.test/qr/${sequence}`,
          expires_at: '2026-09-15T03:30:00.000Z',
        },
      }],
    };
    orders.set(id, order);
    return send(response, 200, order);
  }

  const orderMatch = url.pathname.match(/^\/orders\/(or_mock_[A-Za-z0-9_]+)$/);
  if (request.method === 'GET' && orderMatch) {
    const order = orders.get(orderMatch[1]);
    if (!order) return send(response, 404, { error: 'not_found' });
    requests.push({ method: 'GET', path: url.pathname });
    return send(response, 200, {
      id: order.id,
      code: order.code,
      status: order.confirmStatus,
      updated_at: order.updated_at,
      charges: [{ id: order.charges[0].id, status: order.confirmStatus }],
    });
  }

  return send(response, 404, { error: 'not_found' });
});

server.listen(port, '0.0.0.0', () => {
  process.stdout.write(`mock-ready:${port}\n`);
});
