const path = require('path');
const fs = require('fs');
const express = require('express');
const WebTorrent = require('webtorrent-hybrid');
const FfmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(FfmpegInstaller.path);

const app = express();
const client = new WebTorrent();
const DOWNLOAD_DIR = path.resolve(__dirname, 'downloads');
const HISTORY_FILE = path.resolve(__dirname, 'history.json');

if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);
let history = [];
if (fs.existsSync(HISTORY_FILE)) {
  history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
}

let taskCounter = 0;
const tasks = {};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/add-magnet', (req, res) => {
  const { magnets, bitrate } = req.body;
  if (!Array.isArray(magnets) || magnets.length === 0) {
    return res.status(400).json({ error: '请提供至少一个磁力链接' });
  }
  const ids = magnets.map(link => startTask(link, bitrate || '192k'));
  res.json({ status: 'started', taskIds: ids });
});

app.get('/status', (req, res) => {
  res.json(Object.values(tasks).map(t => ({
    id: t.id,
    name: t.name || t.magnet,
    status: t.status,
    downloadPercent: t.downloadPercent,
    convertPercent: t.convertPercent
  })));
});

app.get('/history', (req, res) => {
  res.json(history);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

function startTask(magnetLink, audioBitrate) {
  const id = ++taskCounter;
  const task = {
    id,
    magnet: magnetLink,
    name: null,
    status: '等待下载',
    downloadPercent: 0,
    convertPercent: 0,
    output: null
  };
  tasks[id] = task;

  client.add(magnetLink, { path: DOWNLOAD_DIR }, torrent => {
    torrent.files.sort((a, b) => b.length - a.length);
    const file = torrent.files[0];
    task.name = file.name;
    torrent.files.forEach(f => f === file ? f.select() : f.deselect());
    task.status = '下载中';

    torrent.on('download', () => {
      task.downloadPercent = +(torrent.progress * 100).toFixed(1);
    });

    torrent.on('done', () => {
      task.downloadPercent = 100;
      task.status = '转换中';
      const input = path.join(DOWNLOAD_DIR, file.path);
      const base = path.basename(file.name, path.extname(file.name));
      const output = path.join(DOWNLOAD_DIR, base + '.mp3');
      task.output = output;

      ffmpeg(input)
        .noVideo()
        .audioBitrate(audioBitrate)
        .format('mp3')
        .on('progress', p => {
          if (p.percent) task.convertPercent = +p.percent.toFixed(1);
        })
        .on('end', () => {
          task.convertPercent = 100;
          task.status = '完成';
          saveHistory(task);
        })
        .on('error', err => {
          console.error(err);
          task.status = '转换失败';
        })
        .save(output);
    });
  });

  return id;
}

function saveHistory(task) {
  const entry = {
    id: task.id,
    name: task.name,
    magnet: task.magnet,
    output: task.output,
    status: task.status,
    time: new Date().toLocaleString()
  };
  history.push(entry);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}
