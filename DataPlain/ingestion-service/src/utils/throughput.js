let totalLogs = 0;
let start = Date.now();

function recordThroughput(count) {
  totalLogs += count;

  const elapsed = (Date.now() - start) / 1000;

  if (elapsed >= 5) {
    const rate = Math.round(totalLogs / elapsed);

    console.log(`[INGESTION THROUGHPUT] ${rate} logs/sec`);

    totalLogs = 0;
    start = Date.now();
  }
}
export { recordThroughput };
