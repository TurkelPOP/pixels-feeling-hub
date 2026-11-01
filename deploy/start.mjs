// Entry point for Node hosts such as alwaysdata, which pass the address to
// listen on through the IP and PORT environment variables.
// Usage: node start.mjs  (from the folder that contains server/ and public/)
if (process.env.IP && !process.env.HOST) process.env.HOST = process.env.IP;
await import("./server/index.mjs");
