// The three monitored servers. Static metadata kept in code, so no extra
// "servers" collection is needed (only "input" and "result" exist in MongoDB).
// Field names follow the supplied input_schema.py where relevant.
const SERVERS = [
  {
    server_id: 'SRV-01',
    device_id: 'DEV-1001',
    server_name: 'Server-01',
    model: 'ProLiant DL360',
    processor_vendor: 'Intel',
    server_generation: 'Gen10',
    location_name: 'Campus Data Center - Rack A',
  },
  {
    server_id: 'SRV-02',
    device_id: 'DEV-1002',
    server_name: 'Server-02',
    model: 'ProLiant DL380',
    processor_vendor: 'AMD',
    server_generation: 'Gen10',
    location_name: 'Campus Data Center - Rack B',
  },
  {
    server_id: 'SRV-03',
    device_id: 'DEV-1003',
    server_name: 'Server-03',
    model: 'ProLiant DL380',
    processor_vendor: 'Intel',
    server_generation: 'Gen11',
    location_name: 'Campus Data Center - Rack C',
  },
];

const findServer = (serverId) => SERVERS.find((s) => s.server_id === serverId) || null;

module.exports = { SERVERS, findServer };
