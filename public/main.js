const startBtn = document.getElementById('startBtn');
const magnetInput = document.getElementById('magnetInput');
const tasksDiv = document.getElementById('tasks');
const historyDiv = document.getElementById('history');
const bitrateInput = document.getElementById('bitrate');

startBtn.addEventListener('click', () => {
  const lines = magnetInput.value.split('\n')
    .map(l => l.trim()).filter(l => l);
  if (!lines.length) return alert('请输入至少一个磁力链接');
  fetch('/add-magnet', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ magnets: lines, bitrate: bitrateInput.value })
  });
  magnetInput.value = '';
});

function updateStatus() {
  fetch('/status')
    .then(r => r.json())
    .then(list => {
      tasksDiv.innerHTML = '';
      list.forEach(t => {
        const div = document.createElement('div');
        div.className = 'task';
        div.innerHTML = `
          <div>【${t.id}】 ${t.name}</div>
          <div>状态：${t.status}</div>
          <div>下载：<progress max="100" value="${t.downloadPercent}"></progress> ${t.downloadPercent}%</div>
          <div>转换：<progress max="100" value="${t.convertPercent}"></progress> ${t.convertPercent}%</div>
        `;
        tasksDiv.appendChild(div);
      });
    });

  fetch('/history')
    .then(r => r.json())
    .then(list => {
      historyDiv.innerHTML = '';
      list.forEach(h => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.textContent = `${h.time} 【${h.id}】 ${h.name} → ${h.output}`;
        historyDiv.appendChild(div);
      });
    });
}
setInterval(updateStatus, 1000);
updateStatus();
