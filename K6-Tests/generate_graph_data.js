import fs from 'fs';
import readline from 'readline';

const resultsFile = 'results.json';
const summaryFile = 'summary.json';

async function processData() {
  const timeSeries = {}; // second -> { vus: max, reqs: count }
  
  const fileStream = fs.createReadStream(resultsFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'Point') {
        const timestamp = new Date(entry.data.time);
        const second = Math.floor(timestamp.getTime() / 1000);
        
        if (!timeSeries[second]) {
          timeSeries[second] = { vus: 0, reqs: 0, time: timestamp.toISOString() };
        }
        
        if (entry.metric === 'vus') {
          timeSeries[second].vus = Math.max(timeSeries[second].vus, entry.data.value);
        } else if (entry.metric === 'http_reqs') {
          timeSeries[second].reqs += entry.data.value; // Usually 1
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  // Sort by time
  const sortedSeconds = Object.keys(timeSeries).sort();
  const labels = [];
  const vusData = [];
  const reqsData = [];
  
  let startSecond = null;
  for (const sec of sortedSeconds) {
    if (startSecond === null) startSecond = sec;
    const relSec = sec - startSecond;
    labels.push(`${relSec}s`);
    vusData.push(timeSeries[sec].vus);
    reqsData.push(timeSeries[sec].reqs);
  }

  // Read summary for percentiles
  const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
  const durationMetrics = summary.metrics.http_req_duration;
  const latencyData = {
    labels: ['Avg', 'Med', 'p(90)', 'p(95)', 'Max'],
    values: [
      durationMetrics.avg,
      durationMetrics.med,
      durationMetrics['p(90)'],
      durationMetrics['p(95)'],
      durationMetrics.max
    ]
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>K6 Load Test Graphs</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: sans-serif; margin: 20px; background-color: #f5f5f5; }
    .chart-container { width: 80%; max-width: 1000px; margin: 20px auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    h1 { text-align: center; }
  </style>
</head>
<body>
  <h1>K6 Load Test Results</h1>
  
  <div class="chart-container">
    <canvas id="timeSeriesChart"></canvas>
  </div>
  
  <div class="chart-container">
    <canvas id="latencyChart"></canvas>
  </div>

  <script>
    const labels = ${JSON.stringify(labels)};
    const vusData = ${JSON.stringify(vusData)};
    const reqsData = ${JSON.stringify(reqsData)};
    
    const ctx1 = document.getElementById('timeSeriesChart').getContext('2d');
    new Chart(ctx1, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Throughput (reqs/s)',
            data: reqsData,
            borderColor: 'blue',
            backgroundColor: 'rgba(0, 0, 255, 0.1)',
            yAxisID: 'y',
            tension: 0.2,
            fill: true
          },
          {
            label: 'Virtual Users (VUs)',
            data: vusData,
            borderColor: 'green',
            backgroundColor: 'transparent',
            yAxisID: 'y1',
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'VUs vs Throughput' }
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'Reqs/s' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'VUs' }
          }
        }
      }
    });

    const latencyData = ${JSON.stringify(latencyData)};
    const ctx2 = document.getElementById('latencyChart').getContext('2d');
    new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: latencyData.labels,
        datasets: [{
          label: 'Latency (ms)',
          data: latencyData.values,
          backgroundColor: ['#4bc0c0', '#36a2eb', '#ffce56', '#ff9f40', '#ff6384']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Latency Percentiles' }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Milliseconds' } }
        }
      }
    });
  </script>
</body>
</html>
  `;
  
  fs.writeFileSync('graphs.html', html);
  console.log('Successfully generated graphs.html');
}

processData().catch(console.error);
